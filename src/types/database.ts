/**
 * Supabase database type definitions.
 * Auto-generation via `supabase gen types typescript` once schema is migrated.
 * Placeholder until migrations are applied to a live Supabase project.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      set_config: {
        Args: {
          setting_name: string;
          setting_value: string;
          is_local: boolean;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
  bsa_aml: {
    Tables: {
      transactions: { Row: BsaAmlTransaction; Insert: BsaAmlTransactionInsert; Update: Partial<BsaAmlTransactionInsert> };
      customer_history: { Row: BsaAmlCustomerHistory; Insert: BsaAmlCustomerHistoryInsert; Update: Partial<BsaAmlCustomerHistoryInsert> };
      alerts: { Row: BsaAmlAlert; Insert: BsaAmlAlertInsert; Update: Partial<BsaAmlAlertInsert> };
      audit_log: { Row: BsaAmlAuditLog; Insert: BsaAmlAuditLogInsert; Update: never };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
  cra: {
    Tables: {
      loan_records: { Row: CraLoanRecord; Insert: CraLoanRecordInsert; Update: Partial<CraLoanRecordInsert> };
      validation_errors: { Row: CraValidationError; Insert: CraValidationErrorInsert; Update: Partial<CraValidationErrorInsert> };
      auto_corrections: { Row: CraAutoCorrection; Insert: CraAutoCorrectionInsert; Update: never };
      ffiec_geocode_cache: { Row: CraGeocodeCache; Insert: CraGeocodeCacheInsert; Update: Partial<CraGeocodeCacheInsert> };
      audit_log: { Row: CraAuditLog; Insert: CraAuditLogInsert; Update: never };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// -----------------------------------------------------------------------
// BSA/AML types
// -----------------------------------------------------------------------

export type TransactionType =
  | 'cash_deposit'
  | 'cash_withdrawal'
  | 'wire_in'
  | 'wire_out'
  | 'ach_debit'
  | 'ach_credit'
  | 'check_deposit'
  | 'check_withdrawal';

export type AlertType =
  | 'structuring'
  | 'velocity_anomaly'
  | 'round_dollar'
  | 'geographic_risk'
  | 'customer_deviation'
  | 'multiple_indicators';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type InvestigationStatus =
  | 'pending'
  | 'in_progress'
  | 'sar_filed'
  | 'no_sar_warranted'
  | 'false_positive';

export type CustomerSegment = 'retail' | 'small_business' | 'commercial' | 'nonprofit' | 'trust';

export interface BsaAmlTransaction {
  id: string;
  transaction_id: string;
  account_hash: string;
  customer_token: string;
  amount: number;
  transaction_type: TransactionType;
  transaction_date: string;
  branch_code: string | null;
  counterparty_token: string | null;
  counterparty_country: string | null;
  geographic_risk_score: number | null;
  description_sanitized: string | null;
  is_online_banking: boolean;
  sanitized_at: string;
  created_at: string;
}

export type BsaAmlTransactionInsert = Omit<BsaAmlTransaction, 'id' | 'created_at' | 'sanitized_at'>;

export interface BsaAmlCustomerHistory {
  id: string;
  account_hash: string;
  customer_token: string;
  account_age_days: number;
  total_transactions_6mo: number;
  avg_transaction_amount_6mo: number | null;
  median_transaction_amount_6mo: number | null;
  max_transaction_amount_6mo: number | null;
  deposit_count_6mo: number;
  withdrawal_count_6mo: number;
  avg_monthly_balance_6mo: number | null;
  customer_segment: CustomerSegment | null;
  customer_age_bracket: string | null;
  customer_occupation_category: string | null;
  expected_transaction_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | null;
  previous_sar_filings: number;
  last_sar_filed_date: string | null;
  updated_at: string;
}

export type BsaAmlCustomerHistoryInsert = Omit<BsaAmlCustomerHistory, 'id' | 'updated_at'>;

export interface BsaAmlAlert {
  id: string;
  alert_id: string;
  account_hash: string;
  customer_token: string;
  risk_score: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  transactions_flagged: unknown;
  suspicious_indicators: string[];
  regulatory_citation: string;
  recommended_action: 'monitor' | 'investigate' | 'file_sar' | 'escalate_immediately';
  confidence_score: number | null;
  false_positive_probability: number | null;
  created_at: string;
  expires_at: string;
  assigned_to: string | null;
  investigation_status: InvestigationStatus;
  investigation_notes: string | null;
  investigation_completed_at: string | null;
}

export type BsaAmlAlertInsert = Omit<BsaAmlAlert, 'id' | 'created_at'>;

export interface BsaAmlAuditLog {
  id: string;
  session_id: string;
  agent_name: string;
  action: string;
  input_hash: string | null;
  output_hash: string | null;
  claude_model: string | null;
  claude_tokens_used: number | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  created_by: string;
}

export type BsaAmlAuditLogInsert = Omit<BsaAmlAuditLog, 'id' | 'created_at'>;

// -----------------------------------------------------------------------
// CRA types
// -----------------------------------------------------------------------

export type LoanPurpose =
  | 'home_purchase'
  | 'home_improvement'
  | 'refinance'
  | 'small_business'
  | 'small_farm'
  | 'community_development';

export type LoanType = 'conventional' | 'fha' | 'va' | 'usda' | 'heloc' | 'commercial' | 'farm';

export type IncomeLevel = 'low' | 'moderate' | 'middle' | 'upper';

export type GeocodingQuality = 'exact' | 'census_tract' | 'zip' | 'city' | 'failed';

export type ValidationErrorType =
  | 'missing_required'
  | 'invalid_format'
  | 'out_of_range'
  | 'duplicate'
  | 'census_tract_invalid'
  | 'inconsistent_data';

export type ValidationSeverity = 'critical' | 'high' | 'medium' | 'low';

export type CorrectionType =
  | 'format_normalization'
  | 'census_tract_lookup'
  | 'calculated_field'
  | 'default_value';

export interface CraLoanRecord {
  id: string;
  loan_id: string;
  borrower_token: string;
  census_tract: string;
  msa_md: string | null;
  loan_amount: number;
  loan_origination_date: string;
  loan_purpose: LoanPurpose;
  loan_type: LoanType;
  annual_revenue: number | null;
  naics_code: string | null;
  income_level: IncomeLevel | null;
  tract_income_level: IncomeLevel;
  tract_minority_percentage: number | null;
  tract_median_income: number | null;
  tract_population: number | null;
  geocoding_quality: GeocodingQuality;
  sanitized_at: string;
  validated_at: string | null;
  created_at: string;
}

export type CraLoanRecordInsert = Omit<CraLoanRecord, 'id' | 'created_at' | 'sanitized_at'>;

export interface CraValidationError {
  id: string;
  loan_id: string;
  field: string;
  error_type: ValidationErrorType;
  severity: ValidationSeverity;
  current_value: string | null;
  expected_value: string | null;
  suggested_correction: string | null;
  regulatory_requirement: string;
  auto_correctable: boolean;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export type CraValidationErrorInsert = Omit<CraValidationError, 'id' | 'created_at'>;

export interface CraAutoCorrection {
  id: string;
  loan_id: string;
  field: string;
  original_value: string | null;
  corrected_value: string;
  correction_type: CorrectionType;
  confidence: number;
  corrected_at: string;
  corrected_by: string;
  correction_rule: string;
}

export type CraAutoCorrectionInsert = Omit<CraAutoCorrection, 'id' | 'corrected_at'>;

export interface CraGeocodeCache {
  id: string;
  address_hash: string;
  census_tract: string;
  msa_md: string | null;
  county_code: string | null;
  tract_income_level: IncomeLevel | null;
  tract_minority_percentage: number | null;
  tract_median_family_income: number | null;
  tract_population: number | null;
  msa_median_family_income: number | null;
  geocoding_quality: string | null;
  cached_at: string;
  expires_at: string;
}

export type CraGeocodeCacheInsert = Omit<CraGeocodeCache, 'id' | 'cached_at'>;

export interface CraAuditLog {
  id: string;
  session_id: string;
  agent_name: string;
  action: string;
  input_hash: string | null;
  output_hash: string | null;
  records_processed: number | null;
  errors_found: number | null;
  auto_corrections_applied: number | null;
  claude_model: string | null;
  claude_tokens_used: number | null;
  ffiec_api_calls: number | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  created_by: string;
}

export type CraAuditLogInsert = Omit<CraAuditLog, 'id' | 'created_at'>;
