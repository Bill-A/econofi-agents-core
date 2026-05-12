/**
 * BSA/AML Type Definitions
 *
 * PII sanitization is the orchestrator's responsibility.
 * By the time data reaches TransactionMonitor, all PII has been replaced
 * with hashes and tokens. No raw PII ever reaches this layer.
 */

// ---------------------------------------------------------------------------
// Transaction Types
// ---------------------------------------------------------------------------

export type TransactionType =
  | 'cash_deposit'
  | 'cash_withdrawal'
  | 'wire_in'
  | 'wire_out'
  | 'ach_debit'
  | 'ach_credit'
  | 'check_deposit'
  | 'check_withdrawal';

export type CustomerSegment = 'retail' | 'small_business' | 'commercial' | 'nonprofit' | 'trust';

export type TransactionFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type AlertType =
  | 'structuring'
  | 'velocity_anomaly'
  | 'round_dollar'
  | 'geographic_risk'
  | 'customer_deviation'
  | 'multiple_indicators';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RecommendedAction = 'monitor' | 'investigate' | 'file_sar' | 'escalate_immediately';

export type InvestigationStatus =
  | 'pending'
  | 'in_progress'
  | 'sar_filed'
  | 'no_sar_warranted'
  | 'false_positive';

// ---------------------------------------------------------------------------
// Core Input Types
// ---------------------------------------------------------------------------

export interface SanitizedTransaction {
  readonly transaction_id: string;
  readonly account_hash: string; // SHA-256 hash of account number — never raw account number
  readonly customer_token: string; // e.g. [PERSON_001], [BUSINESS_007]
  readonly amount: number;
  readonly transaction_type: TransactionType;
  readonly transaction_date: string; // ISO 8601
  readonly branch_code?: string; // Not PII — preserved for pattern analysis
  readonly counterparty_token?: string; // e.g. [COUNTERPARTY_001]
  readonly counterparty_country?: string; // ISO 3166-1 alpha-2
  readonly geographic_risk_score?: number; // 0-100
  readonly description_sanitized?: string; // PII stripped from description
  readonly is_online_banking: boolean;
  readonly metadata: {
    readonly sanitized_at: string; // ISO 8601
    readonly sanitization_version: string;
  };
}

export interface CustomerHistoricalContext {
  readonly account_hash: string;
  readonly customer_token: string;
  readonly account_age_days: number;
  readonly total_transactions_6mo: number;
  readonly avg_transaction_amount_6mo: number;
  readonly median_transaction_amount_6mo: number;
  readonly max_transaction_amount_6mo: number;
  readonly deposit_count_6mo: number;
  readonly withdrawal_count_6mo: number;
  readonly avg_monthly_balance_6mo: number;
  readonly customer_segment: CustomerSegment;
  readonly expected_transaction_frequency: TransactionFrequency;
  readonly previous_sar_filings: number;
  readonly customer_age_bracket?: string;
  readonly customer_occupation_category?: string;
  readonly last_sar_filed_date?: string; // ISO date
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TransactionMonitorConfig {
  readonly model: string;
  readonly max_tokens: number;
  readonly temperature: number;
  readonly structuring_threshold_usd: number;
  readonly structuring_proximity_tolerance: number; // 0.15 = within 15% of threshold
  readonly velocity_anomaly_ratio_threshold: number; // 3.0 = 3x baseline triggers alert
  readonly round_dollar_threshold: number; // 0.8 = >80% round amounts triggers alert
  readonly batch_size: number;
  readonly parallel_workers: number;
  readonly cache_ttl_seconds: number;
  readonly enable_structuring_detection: boolean;
  readonly enable_velocity_detection: boolean;
  readonly enable_round_dollar_detection: boolean;
  readonly enable_geographic_risk: boolean;
  readonly enable_customer_segmentation: boolean;
}

// ---------------------------------------------------------------------------
// Agent Input / Output
// ---------------------------------------------------------------------------

export interface TransactionMonitorInput {
  readonly transactions: SanitizedTransaction[];
  readonly historical_context?: CustomerHistoricalContext[];
  readonly config: TransactionMonitorConfig;
  readonly session_id: string; // For audit trail
}

export interface SuspiciousActivityAlert {
  readonly alert_id: string; // ALT-YYYY-MM-DD-NNNNN
  readonly account_hash: string;
  readonly customer_token: string;
  readonly risk_score: number; // 0-100
  readonly alert_type: AlertType;
  readonly severity: AlertSeverity;
  readonly transactions_flagged: SanitizedTransaction[];
  readonly suspicious_indicators: string[];
  readonly regulatory_citation: string;
  readonly recommended_action: RecommendedAction;
  readonly confidence_score: number; // 0-100
  readonly false_positive_probability: number; // 0.00-1.00
  readonly created_at: string; // ISO timestamp
  readonly expires_at: string; // 30 days from created_at
}

export interface TransactionMonitorOutput {
  readonly session_id: string;
  readonly processed_at: string; // ISO timestamp
  readonly transactions_analyzed: number;
  readonly alerts_generated: number;
  readonly alerts: SuspiciousActivityAlert[];
  readonly performance_metrics: {
    readonly total_duration_ms: number;
    readonly avg_transaction_latency_ms: number;
    readonly claude_api_calls: number;
    readonly claude_tokens_used: number;
  };
  readonly errors?: Array<{
    readonly transaction_id: string;
    readonly error_message: string;
    readonly error_type: string;
  }>;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ClaudeAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'ClaudeAPIError';
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly params?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}
