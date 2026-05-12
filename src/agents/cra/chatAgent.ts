/**
 * CRA ChatAgent
 *
 * Conversational agent that answers compliance officer questions about CRA
 * performance data grounded in NarrativeWriter output.
 *
 * Architecture:
 *   1. Load narrative context from Supabase (generated_narratives, keyed on session + bank)
 *   2. Get or create cra.chat_sessions row
 *   3. Load conversation history from cra.chat_messages (max 20)
 *   4. Call Claude ONCE with: system prompt + narrative context + history + new message
 *   5. Save user message + assistant response (non-blocking)
 *   6. Return ChatOutput
 *
 * AGENT BOUNDARIES:
 *   - Answers ONLY from provided narrative context. Does not fabricate data.
 *   - Does NOT assign CRA ratings (examiner function only).
 *   - Does NOT advise on legal or regulatory strategy.
 *   - All responses carry a draft notice.
 *   - PII must be tokenized before reaching this agent.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatInput, ChatOutput, ChatMessage, ChatAgentConfig } from '../../types/cra-narrative';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a CRA compliance assistant for a community bank. You answer questions about the bank's CRA performance based on the narrative documentation provided to you.

RULES:
- Answer ONLY from the narrative context provided. Do not fabricate data.
- Cite the specific narrative section your answer comes from (e.g., "Based on the Lending Test Analysis...")
- If a question cannot be answered from the provided data, say so explicitly and suggest the compliance officer consult their CRA examiner or legal counsel
- Write in plain English -- your audience is a compliance officer, not an examiner
- Do not assign CRA performance ratings (Outstanding, Satisfactory, etc.) -- those are examiner determinations
- Do not provide legal or regulatory strategy advice
- All narrative data is DRAFT until formally acknowledged by the compliance officer

AGENT BOUNDARIES:
- You cannot modify the narrative. You can only explain and summarize it.
- You cannot answer questions about other banks' data.
- You cannot speculate about examiner conclusions.
- Always include a brief note that responses are based on draft documentation.`;

// ---------------------------------------------------------------------------
// ChatAgent class
// ---------------------------------------------------------------------------

export class ChatAgent {
  private readonly anthropic: Anthropic;

  constructor(
    private readonly config: ChatAgentConfig,
    private readonly supabase: SupabaseClient,
  ) {
    this.anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    const startTime = performance.now();

    logger.info(
      {
        session_id: input.session_id,
        bank_id: input.bank_id,
        narrative_session_id: input.narrative_session_id,
      },
      'ChatAgent: processing message',
    );

    // Step 1: Load narrative context
    const narrativeContext = await this.loadNarrativeContext(
      input.narrative_session_id,
      input.bank_id,
    );

    // Step 2: Get or create conversation session
    const conversationId = await this.getOrCreateConversation(input);

    // Step 3: Load conversation history
    const history = await this.loadHistory(conversationId);

    // Step 4: Call Claude
    const { responseText, tokensUsed } = await this.callClaude(
      narrativeContext,
      history,
      input.message,
    );

    // Step 5: Save messages (non-blocking -- failures do not fail the response)
    void this.saveMessages(conversationId, input.bank_id, input.message, responseText);

    const totalDurationMs = Math.max(1, Math.round(performance.now() - startTime));

    return {
      conversation_id: conversationId,
      message: responseText,
      sources: this.extractSources(responseText),
      draft_notice:
        'This response is based on draft CRA narrative documentation. Consult your compliance officer and legal counsel before any regulatory use.',
      performance_metrics: {
        total_duration_ms: totalDurationMs,
        claude_api_calls: 1,
        claude_tokens_used: tokensUsed,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async loadNarrativeContext(
    narrativeSessionId: string,
    bankId: string,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('generated_narratives')
      .select('narrative_sections, performance_summary')
      .eq('session_id', narrativeSessionId)
      .eq('bank_id', bankId)
      .single();

    if (error !== null || data === null) {
      throw new Error(
        `ChatAgent: narrative session ${narrativeSessionId} not found for bank ${bankId}`,
      );
    }

    return `CRA NARRATIVE CONTEXT:\n${JSON.stringify(data, null, 2)}`;
  }

  private async getOrCreateConversation(input: ChatInput): Promise<string> {
    if (input.conversation_id !== undefined) {
      return input.conversation_id;
    }

    // Create new chat session
    const { data, error } = await this.supabase
      .schema('cra')
      .from('chat_sessions')
      .insert({ bank_id: input.bank_id, narrative_session_id: input.narrative_session_id })
      .select('id')
      .single();

    if (error !== null || data === null) {
      throw new Error(
        `ChatAgent: failed to create chat session: ${String(error?.message ?? 'unknown error')}`,
      );
    }

    return (data as { id: string }).id;
  }

  private async loadHistory(conversationId: string): Promise<ChatMessage[]> {
    const { data } = await this.supabase
      .schema('cra')
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    return (data ?? []) as ChatMessage[];
  }

  private async callClaude(
    narrativeContext: string,
    history: ChatMessage[],
    userMessage: string,
  ): Promise<{ responseText: string; tokensUsed: number }> {
    const messages: Anthropic.MessageParam[] = [
      // Inject narrative context as first user turn to ground the conversation
      { role: 'user', content: narrativeContext },
      {
        role: 'assistant',
        content:
          "I have reviewed the CRA narrative documentation. How can I help you understand your bank's CRA performance?",
      },
      // Replay conversation history
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      // Current message
      { role: 'user', content: userMessage },
    ];

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.max_tokens,
      temperature: this.config.temperature,
      system: SYSTEM_PROMPT,
      messages,
    });

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock === undefined || textBlock.type !== 'text') {
      throw new Error('ChatAgent: Claude returned no text content');
    }

    return { responseText: textBlock.text, tokensUsed };
  }

  private async saveMessages(
    conversationId: string,
    bankId: string,
    userMessage: string,
    assistantResponse: string,
  ): Promise<void> {
    await this.supabase
      .schema('cra')
      .from('chat_messages')
      .insert([
        { session_id: conversationId, bank_id: bankId, role: 'user', content: userMessage },
        {
          session_id: conversationId,
          bank_id: bankId,
          role: 'assistant',
          content: assistantResponse,
        },
      ]);
  }

  private extractSources(responseText: string): string[] {
    const sectionPatterns = [
      'Lending Test',
      'Investment Test',
      'Service Test',
      'Community Development',
      'Executive Summary',
      'Assessment Area',
      'Conclusions',
    ];
    return sectionPatterns.filter((s) => responseText.includes(s));
  }
}
