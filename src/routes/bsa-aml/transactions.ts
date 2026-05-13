/**
 * POST /v1/transactions/screen
 *
 * Runs TransactionMonitor on a single sanitized transaction.
 * Synchronous — returns alert (or null) immediately.
 *
 * Auth: Bearer JWT required
 * PII: Rejected at boundary (422 PII_DETECTED)
 * RLS: Bank-scoped via app.current_bank_id Supabase context
 *
 * Agent boundary: flags suspicious patterns only — does NOT file SARs.
 * SAR filing requires human authorization per 31 CFR §1020.320.
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
import type { TransactionMonitorConfig } from '../../types/bsa-aml';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

export const SanitizedTransactionSchema = z.object({
  transaction_id: z.string().min(1),
  account_hash: z.string().min(1),
  customer_token: z.string().min(1),
  amount: z.number().positive(),
  transaction_type: z.enum([
    'cash_deposit', 'cash_withdrawal', 'wire_in', 'wire_out',
    'ach_debit', 'ach_credit', 'check_deposit', 'check_withdrawal',
  ]),
  transaction_date: z.string(),
  branch_code: z.string().optional(),
  counterparty_token: z.string().optional(),
  counterparty_country: z.string().optional(),
  geographic_risk_score: z.number().min(0).max(100).optional(),
  description_sanitized: z.string().optional(),
  is_online_banking: z.boolean(),
  metadata: z.object({
    sanitized_at: z.string(),
    sanitization_version: z.string(),
  }),
});

const ScreenRequestSchema = z.object({
  transaction: SanitizedTransactionSchema,
  customer_context: z.object({
    account_hash: z.string(),
    customer_token: z.string(),
    account_age_days: z.number(),
    total_transactions_6mo: z.number(),
    avg_transaction_amount_6mo: z.number(),
    median_transaction_amount_6mo: z.number(),
    max_transaction_amount_6mo: z.number(),
    deposit_count_6mo: z.number(),
    withdrawal_count_6mo: z.number(),
    avg_monthly_balance_6mo: z.number(),
    customer_segment: z.enum(['retail', 'small_business', 'commercial', 'nonprofit', 'trust']),
    expected_transaction_frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
    previous_sar_filings: z.number(),
    customer_age_bracket: z.string().optional(),
    customer_occupation_category: z.string().optional(),
    last_sar_filed_date: z.string().optional(),
  }).optional(),
  options: z.object({
    enable_structuring_detection: z.boolean().optional(),
    enable_velocity_detection: z.boolean().optional(),
    enable_round_dollar_detection: z.boolean().optional(),
    enable_geographic_risk: z.boolean().optional(),
  }).optional(),
});

// ---------------------------------------------------------------------------
// Default config
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

const CHECKED_PATTERNS = ['structuring', 'velocity_anomaly', 'round_dollar', 'geographic_risk'];

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

async function screenHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const bankId = extractBankId(request);
  const requestId = uuidv4();
  const startMs = Date.now();

  const parsed = ScreenRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send(
      buildError('INVALID_REQUEST', 'Request body validation failed', bankId, requestId, parsed.error.flatten()),
    );
    return;
  }

  const { transaction, customer_context: customerContext, options } = parsed.data;

  const config: TransactionMonitorConfig = {
    ...DEFAULT_MONITOR_CONFIG,
    ...(options?.enable_structuring_detection !== undefined
      ? { enable_structuring_detection: options.enable_structuring_detection }
      : {}),
    ...(options?.enable_velocity_detection !== undefined
      ? { enable_velocity_detection: options.enable_velocity_detection }
      : {}),
    ...(options?.enable_round_dollar_detection !== undefined
      ? { enable_round_dollar_detection: options.enable_round_dollar_detection }
      : {}),
    ...(options?.enable_geographic_risk !== undefined
      ? { enable_geographic_risk: options.enable_geographic_risk }
      : {}),
  };

  const screeningId = `screen-${requestId.slice(0, 8)}`;

  const monitor = new TransactionMonitor(config);
  const output = await monitor.analyze({
    transactions: [transaction],
    historical_context: customerContext !== undefined ? [customerContext] : undefined,
    config,
    session_id: screeningId,
  });

  const alert = output.alerts.length > 0 ? output.alerts[0] ?? null : null;

  if (alert !== null) {
    const repository = new AlertRepository();
    void repository.saveAlert(alert, bankId).catch((err: unknown) => {
      logger.error({ alert_id: alert.alert_id, err }, 'Failed to persist BSA/AML alert');
    });
  }

  await reply.status(200).send(
    buildSuccess(
      { alert, screening_id: screeningId, checked_patterns: CHECKED_PATTERNS },
      bankId,
      requestId,
      Date.now() - startMs,
    ),
  );
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function bsaTransactionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/v1/transactions/screen',
    { preHandler: [authenticateRequest, piiDetectorMiddleware] },
    screenHandler,
  );
}
