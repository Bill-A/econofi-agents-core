/**
 * POST /v1/transactions/batch
 *
 * Accepts up to 500 sanitized transactions, runs them through TransactionMonitor,
 * persists any resulting alerts, and returns a processing summary.
 *
 * Synchronous — returns when all transactions are analyzed.
 * For 50K+ transaction loads, a future async endpoint with job_id polling is planned (Weeks 3–4).
 *
 * Auth: Bearer JWT required
 * PII: Rejected at boundary (422 PII_DETECTED) — entire batch rejected if any transaction contains PII
 * RLS: Bank-scoped via app.current_bank_id Supabase context
 *
 * Agent boundary: flags suspicious patterns only — does NOT file SARs.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { TransactionMonitor } from '../../agents/bsa-aml/transactionMonitor';
import { AlertRepository } from '../../agents/bsa-aml/alertRepository';
import { authenticateRequest, extractBankId } from '../../middleware/auth';
import { piiDetectorMiddleware } from '../../middleware/piiDetector';
import { buildSuccess, buildError } from '../../lib/apiResponse';
import { logger } from '../../lib/logger';
import { SanitizedTransactionSchema } from './transactions';
import type { TransactionMonitorConfig } from '../../types/bsa-aml';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const BatchRequestSchema = z.object({
  transactions: z.array(SanitizedTransactionSchema).min(1).max(500),
});

// ---------------------------------------------------------------------------
// Default config — matches single-screen route
// ---------------------------------------------------------------------------

const DEFAULT_MONITOR_CONFIG: TransactionMonitorConfig = {
  model: 'claude-sonnet-4-6',
  max_tokens: 4000,
  temperature: 0.0,
  structuring_threshold_usd: 10000,
  structuring_proximity_tolerance: 0.15,
  velocity_anomaly_ratio_threshold: 3.0,
  round_dollar_threshold: 0.8,
  batch_size: 100,
  parallel_workers: 4,
  cache_ttl_seconds: 3600,
  enable_structuring_detection: true,
  enable_velocity_detection: true,
  enable_round_dollar_detection: true,
  enable_geographic_risk: true,
  enable_customer_segmentation: true,
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

async function batchHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const bankId = extractBankId(request);
  const requestId = uuidv4();
  const batchId = `batch-${requestId.slice(0, 8)}`;

  const parsed = BatchRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send(
      buildError('INVALID_REQUEST', 'Request body validation failed', bankId, requestId, parsed.error.flatten()),
    );
    return;
  }

  const { transactions } = parsed.data;

  const monitor = new TransactionMonitor(DEFAULT_MONITOR_CONFIG);
  const output = await monitor.analyze({
    transactions,
    config: DEFAULT_MONITOR_CONFIG,
    session_id: batchId,
  });

  const alerts = output.alerts;

  if (alerts.length > 0) {
    const repository = new AlertRepository();
    await Promise.all(
      alerts.map((alert) =>
        repository.saveAlert(alert, bankId).catch((err: unknown) => {
          logger.error({ alert_id: alert.alert_id, err }, 'Failed to persist BSA/AML batch alert');
        }),
      ),
    );
  }

  await reply.status(200).send(
    buildSuccess(
      {
        batch_id: batchId,
        transactions_submitted: transactions.length,
        alerts_created: alerts.length,
        alerts,
      },
      bankId,
      requestId,
    ),
  );
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function bsaBatchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/v1/transactions/batch',
    { preHandler: [authenticateRequest, piiDetectorMiddleware] },
    batchHandler,
  );
}
