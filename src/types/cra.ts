/**
 * CRA DataGuard agent-level types.
 * These are in-memory / API types — distinct from the Supabase DB row types in database.ts.
 * PII has already been removed before any of these types are populated.
 */

import type { LoanPurpose, LoanType, IncomeLevel, GeocodingQuality } from './database';

export type { LoanPurpose, LoanType, IncomeLevel, GeocodingQuality };

// ---------------------------------------------------------------------------
// Core loan record types
// ---------------------------------------------------------------------------

/**
 * Sanitized loan record — PII removed, census tract may still need verification.
 * This is the input format that DataGuard receives.
 */
export interface SanitizedLoanRecord {
  loan_id: string;
  borrower_token: string;            // [PERSON_001] or [BUSINESS_001]
  census_tract: string;              // 11-digit: XX-XXX-XXXX.XX (may be malformed)
  msa_md: string;
  loan_amount: number;               // USD
  loan_origination_date: string;     // ISO 8601 date (may be malformed)
  loan_purpose: LoanPurpose;
  loan_type: LoanType;
  annual_revenue?: number;           // Required for small_business / small_farm
  naics_code?: string;               // 6-digit, required for small_business
  income_level?: IncomeLevel;        // Borrower income level
  tract_income_level: IncomeLevel;   // Census tract income designation
  tract_minority_percentage?: number;
  tract_median_income?: number;
  tract_population?: number;
  geocoding_quality: GeocodingQuality;
  metadata: {
    sanitized_at: string;            // ISO 8601
    sanitization_version: string;
    census_tract_verified: boolean;
  };
}

// ---------------------------------------------------------------------------
// FFIEC types
// ---------------------------------------------------------------------------

export interface FFIECGeocodeRequest {
  street: string;
  city: string;
  state: string;          // Two-letter code
  zip: string;
}

export interface FFIECGeocodeResponse {
  success: boolean;
  address: FFIECGeocodeRequest;
  census_tract: string;              // 11-digit XX-XXX-XXXX.XX
  msa_md: string;
  county_code: string;               // 5-digit FIPS
  tract_income_level: IncomeLevel;
  tract_minority_percentage: number;
  tract_median_family_income: number;
  tract_population: number;
  msa_median_family_income: number;
  geocoding_quality: Exclude<GeocodingQuality, 'failed'>;
}

// ---------------------------------------------------------------------------
// Validation error types
// ---------------------------------------------------------------------------

export type ValidationErrorType =
  | 'missing_required'
  | 'invalid_format'
  | 'out_of_range'
  | 'duplicate'
  | 'census_tract_invalid'
  | 'inconsistent_data';

export type ValidationSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface LoanValidationError {
  loan_id: string;
  field: string;
  error_type: ValidationErrorType;
  severity: ValidationSeverity;
  current_value: unknown;
  expected_value?: unknown;
  suggested_correction?: string;
  regulatory_requirement: string;    // e.g. "12 CFR §228.42(a)(1)(i)"
  auto_correctable: boolean;
}

// ---------------------------------------------------------------------------
// Auto-correction types
// ---------------------------------------------------------------------------

export type CorrectionType =
  | 'format_normalization'
  | 'census_tract_lookup'
  | 'calculated_field'
  | 'default_value';

export interface LoanAutoCorrection {
  loan_id: string;
  field: string;
  original_value: unknown;
  corrected_value: unknown;
  correction_type: CorrectionType;
  confidence: number;                // 0-100
  audit_trail: {
    corrected_at: string;
    corrected_by: string;            // 'DataGuard Agent v1.0'
    correction_rule: string;
  };
}

// ---------------------------------------------------------------------------
// Summary + output types
// ---------------------------------------------------------------------------

export interface ValidationSummary {
  total_records: number;
  valid_records: number;
  records_with_errors: number;
  records_auto_corrected: number;
  critical_errors: number;
  high_severity_errors: number;
  medium_severity_errors: number;
  low_severity_errors: number;
  validation_pass_rate: number;      // 0-100
  auto_correction_rate: number;      // 0-100
}

export interface PerformanceMetrics {
  total_duration_ms: number;
  avg_record_latency_ms: number;
  ffiec_api_calls: number;
  ffiec_cache_hits: number;
  claude_api_calls: number;
  claude_tokens_used: number;
}

// ---------------------------------------------------------------------------
// DataGuard agent config + I/O
// ---------------------------------------------------------------------------

export type CRAFramework = '1995_legacy' | '2023_modern';

export interface DataGuardConfig {
  model: 'claude-sonnet-4-6' | 'claude-opus-4-6';
  max_tokens: number;
  temperature: number;

  ffiec_geocode_api_url: string;
  ffiec_api_timeout_ms: number;
  ffiec_cache_ttl_seconds: number;

  require_census_tract: boolean;
  require_msa_md: boolean;
  require_income_level: boolean;
  allow_auto_correction: boolean;
  max_auto_correction_confidence_threshold: number;  // Default: 80

  batch_size: number;
  parallel_workers: number;
  max_retries: number;

  generate_exception_report: boolean;
  exception_report_format: 'json' | 'csv' | 'xlsx';
  include_audit_trail: boolean;

  cra_framework?: CRAFramework;      // Defaults to env CRA_FRAMEWORK
}

export interface ReportingPeriod {
  start_date: string;
  end_date: string;
}

export interface DataGuardInput {
  loans: SanitizedLoanRecord[];
  config: DataGuardConfig;
  session_id: string;
  reporting_period: ReportingPeriod;
}

export interface DataGuardOutput {
  session_id: string;
  processed_at: string;
  reporting_period: ReportingPeriod;
  summary: ValidationSummary;
  validated_records: SanitizedLoanRecord[];
  errors: LoanValidationError[];
  corrections: LoanAutoCorrection[];
  exception_report_url?: string;
  performance_metrics: PerformanceMetrics;
}

// ---------------------------------------------------------------------------
// HTTP API types
// ---------------------------------------------------------------------------

export interface ValidateRequestBody {
  loans: SanitizedLoanRecord[];
  session_id?: string;
  reporting_period: ReportingPeriod;
  config?: Partial<DataGuardConfig>;
}

export interface ValidateResponse {
  job_id: string;
  status: 'completed' | 'failed';
  output: DataGuardOutput;
}
