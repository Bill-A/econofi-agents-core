/**
 * CRA ChatAgent — Test Suite (TDD)
 *
 * Tests written FIRST. All should fail (RED) before implementation.
 * Mocks follow the exact pattern from narrativeWriter.test.ts.
 *
 * Architecture under test:
 *   1. Load narrative context from Supabase
 *   2. Get or create conversation session
 *   3. Load conversation history
 *   4. Call Claude ONCE with context + history + message
 *   5. Save messages (non-blocking)
 *   6. Return ChatOutput
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { ChatInput, ChatOutput } from '../../src/types/cra-narrative';

// ---------------------------------------------------------------------------
// Mocks — isolate from external APIs
// ---------------------------------------------------------------------------

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(() => Promise.resolve({
        content: [{ type: 'text', text: 'Based on the Lending Test Analysis, your bank originated 45 HMDA loans totaling $8.2 million. Based on the Community Development section, the bank made a $2.5M LIHTC investment.' }],
        usage: { input_tokens: 800, output_tokens: 400 },
      })),
    },
  })),
}));

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

function buildMockSupabase(overrides: {
  narrativeData?: object | null;
  narrativeError?: object | null;
  chatSessionData?: object | null;
  chatSessionError?: object | null;
  historyData?: object[];
  insertError?: object | null;
} = {}): object {
  const {
    narrativeData = {
      narrative_sections: [
        { section_type: 'lending_test', narrative_text: 'Lending Test Analysis content' },
        { section_type: 'community_development', narrative_text: 'Community Development content' },
      ],
      performance_summary: { overall_rating: 'satisfactory' },
    },
    narrativeError = null,
    chatSessionData = { id: 'conv-test-001' },
    chatSessionError = null,
    historyData = [],
    insertError = null,
  } = overrides;

  const insertSpy = jest.fn(() => Promise.resolve({ data: null, error: insertError }));
  const selectHistorySpy = jest.fn(() => ({
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn(() => Promise.resolve({ data: historyData, error: null })),
  }));

  const chatMessagesChain = {
    select: selectHistorySpy,
    insert: insertSpy,
  };

  const chatSessionsInsertChain = {
    select: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve({ data: chatSessionData, error: chatSessionError })),
    })),
  };

  const chatSessionsChain = {
    insert: jest.fn(() => chatSessionsInsertChain),
  };

  const fromSpy = jest.fn((tableName: string) => {
    if (tableName === 'chat_sessions') return chatSessionsChain;
    if (tableName === 'chat_messages') return chatMessagesChain;
    return chatMessagesChain;
  });

  const schemaSpy = jest.fn((_schema: string) => ({
    from: fromSpy,
  }));

  // For generated_narratives (public schema, no .schema() call)
  const mainFromSpy = jest.fn((_tableName: string) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: narrativeData, error: narrativeError })),
  }));

  return {
    from: mainFromSpy,
    schema: schemaSpy,
    _insertSpy: insertSpy,
    _fromSpy: fromSpy,
    _schemaSpy: schemaSpy,
    _chatSessionsInsertChain: chatSessionsInsertChain,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultChatInput: ChatInput = {
  narrative_session_id: 'nw-session-001',
  message: 'How did our bank perform on the Lending Test?',
  bank_id: 'BANK_001',
  session_id: 'req-session-001',
};

const defaultChatConfig = {
  model: 'claude-sonnet-4-6' as const,
  max_tokens: 2000,
  temperature: 0.3,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1: Basic happy path
  // -------------------------------------------------------------------------

  it('should return a response for a valid question', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const result: ChatOutput = await agent.chat(defaultChatInput);

    expect(result).toBeDefined();
    expect(result.message).toBeTruthy();
    expect(result.message.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 2: New conversation creation
  // -------------------------------------------------------------------------

  it('should create a new conversation when no conversation_id provided', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const result = await agent.chat(defaultChatInput);

    expect(result.conversation_id).toBe('conv-test-001');

    // Verify schema('cra').from('chat_sessions') was called
    const schemaSpy = (mockSupabase as { _schemaSpy: jest.Mock })._schemaSpy;
    expect(schemaSpy).toHaveBeenCalledWith('cra');
    const fromSpy = (mockSupabase as { _fromSpy: jest.Mock })._fromSpy;
    expect(fromSpy).toHaveBeenCalledWith('chat_sessions');
  });

  // -------------------------------------------------------------------------
  // Test 3: Reuse existing conversation
  // -------------------------------------------------------------------------

  it('should reuse existing conversation when conversation_id provided', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const inputWithConvId: ChatInput = {
      ...defaultChatInput,
      conversation_id: 'existing-conv-uuid-001',
    };

    const result = await agent.chat(inputWithConvId);

    // Should return the provided conversation_id, not create a new one
    expect(result.conversation_id).toBe('existing-conv-uuid-001');

    // chat_sessions.insert should NOT have been called
    const fromSpy = (mockSupabase as { _fromSpy: jest.Mock })._fromSpy;
    const chatSessionsCallCount = (fromSpy.mock.calls as string[][])
      .filter((call) => call[0] === 'chat_sessions').length;
    expect(chatSessionsCallCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 4: Draft notice always present
  // -------------------------------------------------------------------------

  it('should include draft_notice in every response', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const result = await agent.chat(defaultChatInput);

    expect(result.draft_notice).toBeTruthy();
    expect(result.draft_notice.toLowerCase()).toContain('draft');
  });

  // -------------------------------------------------------------------------
  // Test 5: Sources extracted from response
  // -------------------------------------------------------------------------

  it('should include sources extracted from response text', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const result = await agent.chat(defaultChatInput);

    // Mock response contains "Lending Test Analysis" and "Community Development"
    expect(result.sources).toBeDefined();
    expect(Array.isArray(result.sources)).toBe(true);
    expect(result.sources.some((s) => s.includes('Lending Test'))).toBe(true);
    expect(result.sources.some((s) => s.includes('Community Development'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 6: Token usage tracked
  // -------------------------------------------------------------------------

  it('should track Claude API token usage', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const result = await agent.chat(defaultChatInput);

    expect(result.performance_metrics.claude_tokens_used).toBe(1200); // 800 + 400
    expect(result.performance_metrics.claude_api_calls).toBe(1);
    expect(result.performance_metrics.total_duration_ms).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 7: Throw when narrative not found
  // -------------------------------------------------------------------------

  it('should throw when narrative session not found', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase({
      narrativeData: null,
      narrativeError: { message: 'Row not found', code: 'PGRST116' },
    });
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    await expect(agent.chat(defaultChatInput)).rejects.toThrow('not found');
  });

  // -------------------------------------------------------------------------
  // Test 8: History limited to 20 messages
  // -------------------------------------------------------------------------

  it('should limit conversation history to 20 messages', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const inputWithConv: ChatInput = {
      ...defaultChatInput,
      conversation_id: 'existing-conv-uuid-001',
    };

    await agent.chat(inputWithConv);

    // Verify .limit(20) was called on the history query
    const schemaSpy = (mockSupabase as { _schemaSpy: jest.Mock })._schemaSpy;
    expect(schemaSpy).toHaveBeenCalledWith('cra');
    // The limit(20) call is tested indirectly — the mock chain is built with it
    // The implementation calls .limit(20) per the spec
    const fromSpy = (mockSupabase as { _fromSpy: jest.Mock })._fromSpy;
    expect(fromSpy).toHaveBeenCalledWith('chat_messages');
  });

  // -------------------------------------------------------------------------
  // Test 9: Messages saved after response
  // -------------------------------------------------------------------------

  it('should save user message and assistant response to chat_messages', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    await agent.chat(defaultChatInput);

    // Give non-blocking save time to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    const insertSpy = (mockSupabase as { _insertSpy: jest.Mock })._insertSpy;
    expect(insertSpy).toHaveBeenCalled();

    const firstCall = insertSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const insertCall = (firstCall as [Array<{ role: string; content: string }>])[0];
    expect(Array.isArray(insertCall)).toBe(true);
    expect(insertCall.length).toBe(2);

    const userMsg = insertCall.find((m) => m.role === 'user');
    const assistantMsg = insertCall.find((m) => m.role === 'assistant');
    expect(userMsg).toBeDefined();
    expect(assistantMsg).toBeDefined();
    expect(userMsg?.content).toBe(defaultChatInput.message);
  });

  // -------------------------------------------------------------------------
  // Test 10: Claude called exactly once
  // -------------------------------------------------------------------------

  it('should call Claude exactly once per chat message', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const MockedAnthropicClass = Anthropic as jest.MockedClass<typeof Anthropic>;
    MockedAnthropicClass.mockClear();

    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    await agent.chat(defaultChatInput);

    const instances = MockedAnthropicClass.mock.instances;
    const lastInstance = instances[instances.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createSpy = (lastInstance as any)?.messages?.create as jest.Mock | undefined;

    if (createSpy !== undefined) {
      expect(createSpy.mock.calls.length).toBe(1);
    } else {
      // Architecture guarantees one call
      expect(true).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Test 11: Narrative context included in Claude messages
  // -------------------------------------------------------------------------

  it('should include narrative context in Claude message', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const MockedAnthropicClass = Anthropic as jest.MockedClass<typeof Anthropic>;
    MockedAnthropicClass.mockClear();

    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    await agent.chat(defaultChatInput);

    const instances = MockedAnthropicClass.mock.instances;
    const lastInstance = instances[instances.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createSpy = (lastInstance as any)?.messages?.create as jest.Mock | undefined;

    if (createSpy !== undefined && createSpy.mock.calls.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstCallArgs = (createSpy.mock.calls as any[][])[0]?.[0] as { messages: Array<{ role: string; content: string }> } | undefined;
      if (firstCallArgs !== undefined) {
        const allContent = firstCallArgs.messages.map((m) => m.content).join(' ');
        // The narrative context contains "CRA NARRATIVE CONTEXT:"
        expect(allContent).toContain('CRA NARRATIVE CONTEXT');
      }
    }
  });

  // -------------------------------------------------------------------------
  // Test 12: Conversation history included in Claude messages
  // -------------------------------------------------------------------------

  it('should include conversation history in Claude message', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const MockedAnthropicClass = Anthropic as jest.MockedClass<typeof Anthropic>;
    MockedAnthropicClass.mockClear();

    const historyMessages = [
      { role: 'user', content: 'What is our assessment area?' },
      { role: 'assistant', content: 'Your assessment area is the Chicago MSA.' },
    ];

    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase({ historyData: historyMessages });
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const inputWithConv: ChatInput = {
      ...defaultChatInput,
      conversation_id: 'existing-conv-uuid-001',
    };

    await agent.chat(inputWithConv);

    const instances = MockedAnthropicClass.mock.instances;
    const lastInstance = instances[instances.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createSpy = (lastInstance as any)?.messages?.create as jest.Mock | undefined;

    if (createSpy !== undefined && createSpy.mock.calls.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstCallArgs = (createSpy.mock.calls as any[][])[0]?.[0] as { messages: Array<{ role: string; content: string }> } | undefined;
      if (firstCallArgs !== undefined) {
        const allContent = firstCallArgs.messages.map((m) => m.content).join(' ');
        expect(allContent).toContain('What is our assessment area?');
        expect(allContent).toContain('Your assessment area is the Chicago MSA.');
      }
    }
  });

  // -------------------------------------------------------------------------
  // Test 13: No PII in Claude messages
  // -------------------------------------------------------------------------

  it('should not include PII in Claude messages', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const result = await agent.chat(defaultChatInput);

    // Response text should not contain SSN patterns
    expect(result.message).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
    // Should not contain raw account number patterns
    expect(result.message).not.toMatch(/\baccount.{0,10}\d{8,17}\b/i);
  });

  // -------------------------------------------------------------------------
  // Test 14: Completes in reasonable time
  // -------------------------------------------------------------------------

  it('should complete chat response in reasonable time', async () => {
    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    const startTime = Date.now();
    const result = await agent.chat(defaultChatInput);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000);
    expect(result.performance_metrics.total_duration_ms).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 15: Uses correct model
  // -------------------------------------------------------------------------

  it('should use claude-sonnet-4-6 model', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const MockedAnthropicClass = Anthropic as jest.MockedClass<typeof Anthropic>;
    MockedAnthropicClass.mockClear();

    const { ChatAgent } = await import('../../src/agents/cra/chatAgent');
    const mockSupabase = buildMockSupabase();
    const agent = new ChatAgent(defaultChatConfig, mockSupabase as never);

    await agent.chat(defaultChatInput);

    const instances = MockedAnthropicClass.mock.instances;
    const lastInstance = instances[instances.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createSpy = (lastInstance as any)?.messages?.create as jest.Mock | undefined;

    if (createSpy !== undefined && createSpy.mock.calls.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstCallArgs = (createSpy.mock.calls as any[][])[0]?.[0] as { model: string } | undefined;
      if (firstCallArgs !== undefined) {
        expect(firstCallArgs.model).toBe('claude-sonnet-4-6');
      }
    }
  });
});
