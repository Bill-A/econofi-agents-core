/**
 * POST /v1/cra/validate
 *
 * Runs DataGuard validation on a batch of sanitized CRA loan records.
 * Synchronous — returns full results immediately for batches up to 10K records.
 * For larger batches, use POST /v1/cra/batch (async, async job queue — B3).
 *
 * Auth: Bearer JWT required
 * PII: Rejected at boundary (422 PII_DETECTED)
 * RLS: Bank-scoped via app.current_bank_id Supabase context
 *
 * Hard gate: if critical_errors > 0, NarrativeWriter cannot run.
 * This endpoint response includes that gate status explicitly.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { DataGuard } from '../../agents/cra/dataGuard';
import { DataGuardRepository } from '../../agents/cra/dataGuardRepository';
import { getServiceClient, setBankContext } from '../../lib/supabase';
import { authenticateRequest, extractBankId } from '../../middleware/auth';
import { piiDetectorMiddleware } from '../../middleware/piiDetector';
import type { DataGuardConfig } from '../../types/cra';

// ---------------------------------------------------------------------------
// Request schema (zod)
// ---------------------------------------------------------------------------

const SanitizedLoanRecordSchema = z.object({
  loan_id: z.string().min(1),
  borrower_token: z.string().regex(/^\[(PERSON|BUSINESS|ENTITY)_\d+\]$/),
  census_tract: z.string(),
  msa_md: z.string().optional().default(''),
  loan_amount: z.number().positive(),
  loan_origination_date: z.string(),
  loan_purpose: z.enum([
    'home_purchase', 'home_improvement', 'refinance',
    'small_business', 'small_farm', 'community_development',
  ]),
  loan_type: z.enum(['conventional', 'fha', 'va', 'usda', 'heloc', 'commercial', 'farm']),
  annual_revenue: z.number().positive().optional(),
  naics_code: z.string().optional(),
  income_level: z.enum(['low', 'moderate', 'middle', 'upper']).optional(),
  tract_income_level: z.enum(['low', 'moderate', 'middle', 'upper']),
  tract_minority_percentage: z.number().min(0).max(100).optional(),
  tract_median_income: z.number().positive().optional(),
  tract_population: z.number().positive().optional(),
  geocoding_quality: z.enum(['exact', 'census_tract', 'zip', 'city', 'failed']),
  metadata: z.object({
    sanitized_at: z.string(),
    sanitization_version: z.string(),
    census_tract_verified: z.boolean(),
  }),
});

const ValidateRequestSchema = z.object({
  loans: z.array(SanitizedLoanRecordSchema).min(1).max(10000),
  session_id: z.string().optional(),
  reporting_period: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  config: z.object({
    allow_auto_correction: z.boolean().optional(),
    generate_exception_report: z.boolean().optional(),
    require_income_level: z.boolean().optional(),
  }).optional(),
});

// ValidateRequest is parsed at runtime by zod — Fastify route uses generic FastifyRequest

// ---------------------------------------------------------------------------
// Default DataGuard config
// ---------------------------------------------------------------------------

const DEFAULT_DATAGUARD_CONFIG: DataGuardConfig = {
  model: 'claude-sonnet-4-6',
  max_tokens: 4000,
  temperature: 0.0,
  ffiec_geocode_api_url: process.env['FFIEC_GEOCODE_API_URL'] ?? 'https://geomap.ffiec.gov/api/',
  ffiec_api_timeout_ms: parseInt(process.env['FFIEC_API_TIMEOUT_MS'] ?? '5000', 10),
  ffiec_cache_ttl_seconds: 86400,
  require_census_tract: true,
  require_msa_md: true,
  require_income_level: true,
  allow_auto_correction: true,
  max_auto_correction_confidence_threshold: 80,
  batch_size: 500,
  parallel_workers: 4,
  max_retries: 3,
  generate_exception_report: true,
  exception_report_format: 'json',
  include_audit_trail: true,
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

async function validateHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const bankId = extractBankId(request);
  const requestId = uuidv4();

  // Parse + validate request body
  const parsed = ValidateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Request body validation failed',
      details: parsed.error.flatten(),
      meta: { request_id: requestId },
    });
    return;
  }

  const { loans, reporting_period, config: configOverrides } = parsed.data;
  const sessionId = parsed.data.session_id ?? `dg-${requestId.slice(0, 8)}`;

  // Merge config overrides
  const config: DataGuardConfig = {
    ...DEFAULT_DATAGUARD_CONFIG,
    ...(configOverrides?.allow_auto_correction !== undefined
      ? { allow_auto_correction: configOverrides.allow_auto_correction }
      : {}),
    ...(configOverrides?.generate_exception_report !== undefined
      ? { generate_exception_report: configOverrides.generate_exception_report }
      : {}),
    ...(configOverrides?.require_income_level !== undefined
      ? { require_income_level: configOverrides.require_income_level }
      : {}),
  };

  // Set Supabase RLS bank context
  const supabase = getServiceClient();
  await setBankContext(supabase, bankId);

  // Run DataGuard validation
  const agent = new DataGuard(config);
  const output = await agent.validate({
    loans,
    config,
    session_id: sessionId,
    reporting_period,
  });

  // Persist results (non-blocking — failures don't fail the response)
  const repository = new DataGuardRepository(supabase);
  void repository.saveValidationRun({ loans, config, session_id: sessionId, reporting_period }, output, bankId);

  // NarrativeWriter gate status
  const narrativeReady = output.summary.critical_errors === 0;

  await reply.status(200).send({
    job_id: sessionId,
    status: 'completed',
    narrative_ready: narrativeReady,
    narrative_blocked_reason: !narrativeReady
      ? `DataGuard found ${output.summary.critical_errors} critical error(s). All critical errors must be resolved before NarrativeWriter can run. See errors[] for details.`
      : null,
    output,
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

export async function craValidateRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/v1/cra/validate',
    {
      preHandler: [authenticateRequest, piiDetectorMiddleware],
    },
    validateHandler,
  );
}
