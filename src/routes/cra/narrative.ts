/**
 * CRA NarrativeWriter Routes
 *
 * POST /v1/cra/narrative         — Generate CRA performance narrative
 * POST /v1/cra/narrative/:job_id/acknowledge — Compliance officer acknowledgment
 *
 * Auth: Bearer JWT required on both routes
 * PII: piiDetectorMiddleware runs at boundary before any agent call
 * Hard gate: if dataGuard_critical_errors > 0, returns 422 UPSTREAM_CRITICAL_ERRORS
 *
 * All narrative output has draft_status: true until acknowledged.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { NarrativeWriter } from '../../agents/cra/narrativeWriter';
import { NarrativeWriterRepository } from '../../agents/cra/narrativeWriterRepository';
import { getServiceClient, setBankContext } from '../../lib/supabase';
import { authenticateRequest, extractBankId, extractUser } from '../../middleware/auth';
import { piiDetectorMiddleware } from '../../middleware/piiDetector';
import type { NarrativeWriterConfig } from '../../types/cra-narrative';

// ---------------------------------------------------------------------------
// Request schemas (zod)
// ---------------------------------------------------------------------------

const ReportingPeriodSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const AssessmentAreaSchema = z.object({
  area_id: z.string().min(1),
  bank_id: z.string().min(1),
  area_name: z.string().min(1),
  area_type: z.enum(['msa', 'non_msa_county', 'combined']),
  state_codes: z.array(z.string()),
  county_fips_codes: z.array(z.string()),
  census_tracts: z.array(z.string()),
  msa_md_code: z.string().optional(),
  tract_income_distribution: z.object({
    low_income_pct: z.number().min(0).max(100),
    moderate_income_pct: z.number().min(0).max(100),
    middle_income_pct: z.number().min(0).max(100),
    upper_income_pct: z.number().min(0).max(100),
  }),
  minority_tract_pct: z.number().min(0).max(100),
  created_at: z.string(),
  reporting_year: z.number().int().min(2000).max(2100),
});

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

const CommunityDevelopmentLoanSummarySchema = z.object({
  loan_id: z.string().min(1),
  approval_date: z.string(),
  loan_amount: z.number().positive(),
  primary_purpose: z.enum(['affordable_housing', 'community_services', 'economic_development', 'revitalize_stabilize']),
  assessment_area_id: z.string().min(1),
  census_tract: z.string().optional(),
  organization_type: z.string().min(1),
  qualifies_as: z.enum(['community_development_loan', 'small_business_loan', 'small_farm_loan']),
});

const CommunityDevelopmentInvestmentSchema = z.object({
  investment_id: z.string().min(1),
  bank_id: z.string().min(1),
  investment_date: z.string(),
  investment_type: z.enum([
    'lihtc_equity', 'nmtc_equity', 'affordable_housing_bond',
    'cdc_equity', 'small_business_investment', 'grant',
  ]),
  organization_name: z.string().min(1),
  organization_type: z.enum([
    'cdfi', 'nonprofit_housing', 'small_business_development',
    'community_service', 'educational_institution', 'government',
  ]),
  amount: z.number().positive(),
  primary_purpose: z.enum(['affordable_housing', 'community_services', 'economic_development', 'revitalize_stabilize']),
  census_tract: z.string().optional(),
  assessment_area_id: z.string().min(1),
  multi_year_commitment: z.boolean(),
  commitment_end_date: z.string().optional(),
  qualifies_for_cra: z.boolean(),
  cra_test: z.literal('community_development_investments'),
  created_at: z.string(),
});

const CommunityDevelopmentServiceSchema = z.object({
  service_id: z.string().min(1),
  bank_id: z.string().min(1),
  service_date: z.string(),
  service_type: z.enum([
    'financial_literacy', 'technical_assistance', 'board_service',
    'fundraising', 'homebuyer_counseling', 'small_business_counseling',
  ]),
  provider_name: z.string().min(1),
  provider_token: z.string().min(1),
  organization_name: z.string().min(1),
  organization_type: z.enum([
    'cdfi', 'nonprofit_housing', 'small_business_development',
    'community_service', 'educational_institution', 'government',
  ]),
  primary_purpose: z.enum(['affordable_housing', 'community_services', 'economic_development', 'revitalize_stabilize']),
  census_tract: z.string().optional(),
  assessment_area_id: z.string().min(1),
  hours_contributed: z.number().positive(),
  estimated_dollar_value: z.number().positive().optional(),
  description: z.string().min(1),
  qualifies_for_cra: z.boolean(),
  cra_test: z.literal('community_development_services'),
  created_at: z.string(),
});

const NarrativeRequestSchema = z.object({
  validated_loans: z.array(SanitizedLoanRecordSchema).max(10000),
  community_development_loans: z.array(CommunityDevelopmentLoanSummarySchema),
  community_development_investments: z.array(CommunityDevelopmentInvestmentSchema),
  community_development_services: z.array(CommunityDevelopmentServiceSchema),
  assessment_areas: z.array(AssessmentAreaSchema).min(1),
  bank_name: z.string().min(1),
  bank_asset_size: z.number().positive(),
  bank_charter_type: z.enum(['national_bank', 'state_bank', 'savings_association', 'credit_union']),
  reporting_period: ReportingPeriodSchema,
  dataGuard_critical_errors: z.number().int().min(0).optional().default(0),
  session_id: z.string().optional(),
  config: z.object({
    reporting_year: z.number().int().min(2000).max(2100).optional(),
    evaluation_framework: z.enum(['large_bank', 'intermediate_small_bank', 'small_bank']).optional(),
    narrative_tone: z.enum(['formal_regulatory', 'plain_language']).optional(),
    include_examiner_qa: z.boolean().optional(),
    output_format: z.enum(['pdf', 'docx', 'json']).optional(),
    sections_to_generate: z.array(z.enum([
      'executive_summary', 'scope_of_evaluation', 'assessment_area_description',
      'lending_test', 'investment_test', 'service_test', 'community_development', 'conclusions',
    ])).optional(),
  }).optional(),
});

const AcknowledgeRequestSchema = z.object({
  acknowledged_by: z.string().min(1),
  acknowledgment_note: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Default NarrativeWriter config
// ---------------------------------------------------------------------------

function buildNarrativeConfig(
  bankAssetSize: number,
  overrides?: z.infer<typeof NarrativeRequestSchema>['config'],
): NarrativeWriterConfig {
  // Determine evaluation framework from asset size if not provided
  let defaultFramework: NarrativeWriterConfig['evaluation_framework'];
  if (bankAssetSize >= 1564000000) {
    defaultFramework = 'large_bank';
  } else if (bankAssetSize >= 391000000) {
    defaultFramework = 'intermediate_small_bank';
  } else {
    defaultFramework = 'small_bank';
  }

  const defaultSections: NarrativeWriterConfig['sections_to_generate'] =
    defaultFramework === 'large_bank'
      ? ['executive_summary', 'scope_of_evaluation', 'assessment_area_description', 'lending_test', 'investment_test', 'service_test', 'community_development', 'conclusions']
      : ['executive_summary', 'scope_of_evaluation', 'assessment_area_description', 'lending_test', 'community_development', 'conclusions'];

  return {
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    temperature: 0.3,
    evaluation_framework: overrides?.evaluation_framework ?? defaultFramework,
    reporting_year: overrides?.reporting_year ?? new Date().getFullYear() - 1,
    narrative_tone: overrides?.narrative_tone ?? 'formal_regulatory',
    include_examiner_qa: overrides?.include_examiner_qa ?? true,
    include_performance_summary: true,
    sections_to_generate: overrides?.sections_to_generate ?? defaultSections,
    output_format: overrides?.output_format ?? 'json',
    include_public_file: true,
    completeness_check: true,
    max_retries: 3,
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function generateNarrativeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const bankId = extractBankId(request);
  const requestId = uuidv4();

  const parsed = NarrativeRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Request body validation failed',
      details: parsed.error.flatten(),
      meta: { request_id: requestId },
    });
    return;
  }

  const data = parsed.data;

  // Hard gate: DataGuard critical errors block NarrativeWriter
  if (data.dataGuard_critical_errors > 0) {
    await reply.status(422).send({
      error: 'UPSTREAM_CRITICAL_ERRORS',
      message: `DataGuard found ${data.dataGuard_critical_errors} critical error(s). All critical errors must be resolved before NarrativeWriter can run.`,
      meta: { request_id: requestId, bank_id: bankId },
    });
    return;
  }

  const sessionId = data.session_id ?? `nw-${requestId.slice(0, 8)}`;
  const config = buildNarrativeConfig(data.bank_asset_size, data.config);

  // Set Supabase RLS bank context
  const supabase = getServiceClient();
  await setBankContext(supabase, bankId);

  // Run NarrativeWriter
  const agent = new NarrativeWriter(config);
  const output = await agent.generate({
    validated_loans: data.validated_loans,
    community_development_loans: data.community_development_loans,
    community_development_investments: data.community_development_investments,
    community_development_services: data.community_development_services,
    assessment_areas: data.assessment_areas,
    bank_id: bankId,
    bank_name: data.bank_name,
    bank_asset_size: data.bank_asset_size,
    bank_charter_type: data.bank_charter_type,
    config,
    session_id: sessionId,
    reporting_period: data.reporting_period,
  });

  // Persist results (non-blocking — failures don't fail the response)
  const repository = new NarrativeWriterRepository(supabase);
  void repository.saveNarrativeRun(
    {
      validated_loans: data.validated_loans,
      community_development_loans: data.community_development_loans,
      community_development_investments: data.community_development_investments,
      community_development_services: data.community_development_services,
      assessment_areas: data.assessment_areas,
      bank_id: bankId,
      bank_name: data.bank_name,
      bank_asset_size: data.bank_asset_size,
      bank_charter_type: data.bank_charter_type,
      config,
      session_id: sessionId,
      reporting_period: data.reporting_period,
    },
    output,
    bankId,
  );

  await reply.status(200).send({
    job_id: sessionId,
    status: 'completed',
    draft_status: true,
    output,
    meta: {
      request_id: requestId,
      bank_id: bankId,
      api_version: 'v1',
    },
  });
}

async function acknowledgeNarrativeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const requestId = uuidv4();
  const user = extractUser(request);

  // Role check: only compliance_officer or admin may acknowledge
  if (user.role !== 'compliance_officer' && user.role !== 'admin') {
    await reply.status(403).send({
      error: 'FORBIDDEN',
      message: 'Only compliance_officer or admin roles may acknowledge CRA narratives.',
      meta: { request_id: requestId },
    });
    return;
  }

  const { job_id: jobId } = request.params as { job_id: string };

  const parsed = AcknowledgeRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Request body validation failed',
      details: parsed.error.flatten(),
      meta: { request_id: requestId },
    });
    return;
  }

  const { acknowledged_by: acknowledgedBy, acknowledgment_note: acknowledgmentNote } = parsed.data;

  // Set Supabase RLS bank context
  const supabase = getServiceClient();
  await setBankContext(supabase, user.bankId);

  // Write acknowledgment to audit log
  const repository = new NarrativeWriterRepository(supabase);
  await repository.saveAcknowledgment(jobId, user.bankId, acknowledgedBy, acknowledgmentNote);

  const acknowledgedAt = new Date().toISOString();

  await reply.status(200).send({
    job_id: jobId,
    acknowledged: true,
    acknowledged_at: acknowledgedAt,
    acknowledged_by: acknowledgedBy,
    meta: {
      request_id: requestId,
      bank_id: user.bankId,
      api_version: 'v1',
    },
  });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function craNarrativeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/v1/cra/narrative',
    {
      preHandler: [authenticateRequest, piiDetectorMiddleware],
    },
    generateNarrativeHandler,
  );

  fastify.post(
    '/v1/cra/narrative/:job_id/acknowledge',
    {
      preHandler: [authenticateRequest],
    },
    acknowledgeNarrativeHandler,
  );
}
