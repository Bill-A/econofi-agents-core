/**
 * POST /v1/cra/chat
 *
 * Conversational CRA compliance chat agent.
 * Compliance officers ask plain-English questions about their CRA data
 * and receive answers grounded in NarrativeWriter output.
 *
 * Auth: Bearer JWT required
 * PII: piiDetectorMiddleware runs at boundary before any agent call
 * Body: { narrative_session_id, message, conversation_id? }
 * Response: { conversation_id, message, sources, draft_notice, performance_metrics, meta }
 *
 * AGENT BOUNDARIES:
 *   - Answers only from provided narrative context. Does not fabricate.
 *   - Does NOT assign CRA ratings (examiner function).
 *   - Does NOT provide legal strategy advice.
 *   - All responses carry a draft notice.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ChatAgent } from '../../agents/cra/chatAgent';
import { getServiceClient, setBankContext } from '../../lib/supabase';
import { authenticateRequest, extractBankId } from '../../middleware/auth';
import { piiDetectorMiddleware } from '../../middleware/piiDetector';
import type { ChatAgentConfig } from '../../types/cra-narrative';

// ---------------------------------------------------------------------------
// Request schema (zod)
// ---------------------------------------------------------------------------

const ChatRequestSchema = z.object({
  narrative_session_id: z.string().min(1),
  message: z.string().min(1).max(2000),
  conversation_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Default chat config
// ---------------------------------------------------------------------------

const DEFAULT_CHAT_CONFIG: ChatAgentConfig = {
  model: 'claude-sonnet-4-6',
  max_tokens: 2000,
  temperature: 0.3,
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

async function chatHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const bankId = extractBankId(request);
  const requestId = uuidv4();

  const parsed = ChatRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Request body validation failed',
      details: parsed.error.flatten(),
      meta: { request_id: requestId },
    });
    return;
  }

  const { narrative_session_id: narrativeSessionId, message, conversation_id: conversationId } =
    parsed.data;

  const sessionId = `chat-${requestId.slice(0, 8)}`;

  // Set Supabase RLS bank context
  const supabase = getServiceClient();
  await setBankContext(supabase, bankId);

  // Run ChatAgent
  const agent = new ChatAgent(DEFAULT_CHAT_CONFIG, supabase);
  const output = await agent.chat({
    narrative_session_id: narrativeSessionId,
    message,
    conversation_id: conversationId,
    bank_id: bankId,
    session_id: sessionId,
  });

  await reply.status(200).send({
    conversation_id: output.conversation_id,
    message: output.message,
    sources: output.sources,
    draft_notice: output.draft_notice,
    performance_metrics: output.performance_metrics,
    meta: {
      request_id: requestId,
      bank_id: bankId,
      api_version: 'v1',
    },
  });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function craChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/v1/cra/chat',
    {
      preHandler: [authenticateRequest, piiDetectorMiddleware],
    },
    chatHandler,
  );
}
