# BSA/AML TransactionMonitor: Technical Implementation Specification

**Module**: BSA/AML Compliance
**Agent**: TransactionMonitor
**Version**: 1.0
**Regulatory Basis**: 31 USC §5318(g) (Suspicious Activity Reporting), §5324 (Structuring)

---

## Executive Summary

The TransactionMonitor agent performs real-time suspicious transaction detection using pattern analysis and anomaly detection. It identifies structuring (deposits designed to evade $10K CTR reporting), velocity anomalies (sudden account activity changes), round-dollar patterns, and geographic risk indicators.

### Key Capabilities

1. **Structuring Detection**: Multiple deposits just under $10K threshold
2. **Velocity Anomaly**: Dormant accounts suddenly receiving large transfers
3. **Round-Dollar Analysis**: Unusual use of exact amounts vs. normal business patterns
4. **Geographic Risk**: Transactions involving high-risk jurisdictions (FATF grey/blacklist)
5. **Customer Segmentation**: Behavior deviation from peer cohort

### Performance SLA

- **Latency**: <200ms per transaction analysis
- **Throughput**: 500 transactions/second sustained
- **Batch Processing**: 50,000 transactions in <5 minutes
- **Accuracy**: <5% false positive rate, <0.1% false negative rate
- **Uptime**: 99.9% availability

---

## Type Definitions

### Core Types

```typescript
// specs/bsa-aml/types.ts

/**
 * Raw transaction from core banking system
 * Contains PII - must be sanitized before Claude processing
 */
export interface RawTransaction {
  id: string; // Bank's internal transaction ID
  account_number: string; // PII: Will be hashed
  customer_name: string; // PII: Will be tokenized to [PERSON_XXX]
  customer_ssn?: string; // PII: Will be hashed
  amount: number; // USD, positive for deposits, negative for withdrawals
  transaction_type: 'cash_deposit' | 'cash_withdrawal' | 'wire_in' | 'wire_out' | 'ach_debit' | 'ach_credit' | 'check_deposit' | 'check_withdrawal';
  transaction_date: Date;
  branch_code?: string; // Physical branch location
  teller_id?: string; // PII: Will be tokenized
  counterparty_name?: string; // Wire/ACH counterparty (PII if individual)
  counterparty_account?: string; // External account number
  counterparty_bank?: string; // ABA routing number or SWIFT code
  counterparty_country?: string; // ISO 3166-1 alpha-2 country code
  description?: string; // Transaction memo/description
  ip_address?: string; // For online banking transactions
  device_fingerprint?: string; // For fraud detection
  created_at: Date; // When transaction was created in core banking system
}

/**
 * Sanitized transaction for Claude API processing
 * ALL PII removed and replaced with anonymized tokens
 */
export interface SanitizedTransaction {
  transaction_id: string; // Same as original ID (not PII)
  account_hash: string; // SHA-256 hash: ACCT_HASH_xxxxx
  customer_token: string; // Anonymous token: [PERSON_001]
  amount: number;
  transaction_type: RawTransaction['transaction_type'];
  transaction_date: string; // ISO 8601 format
  branch_code?: string; // Not PII, can keep as-is
  counterparty_token?: string; // [COUNTERPARTY_042] or [BUSINESS_007]
  counterparty_country?: string; // ISO country code (not PII)
  geographic_risk_score?: number; // 0-100, pre-calculated
  description_sanitized?: string; // PII stripped from original description
  is_online_banking: boolean; // true if ip_address was present
  metadata: {
    sanitized_at: string; // ISO timestamp
    sanitization_version: string; // e.g., "v1.0"
  };
}

/**
 * Historical context for customer behavior analysis
 * Aggregated statistics, no PII
 */
export interface CustomerHistoricalContext {
  account_hash: string;
  customer_token: string;
  account_age_days: number;
  total_transactions_6mo: number;
  avg_transaction_amount_6mo: number;
  median_transaction_amount_6mo: number;
  max_transaction_amount_6mo: number;
  deposit_count_6mo: number;
  withdrawal_count_6mo: number;
  avg_monthly_balance_6mo: number;
  customer_segment: 'retail' | 'small_business' | 'commercial' | 'nonprofit' | 'trust';
  customer_age_bracket?: '18-25' | '26-35' | '36-50' | '51-65' | '65+';
  customer_occupation_category?: 'professional' | 'service' | 'retired' | 'self_employed' | 'unemployed' | 'student';
  expected_transaction_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  previous_sar_filings: number; // Count of past SARs involving this customer
  last_sar_filed_date?: string; // ISO date or null
}

/**
 * Suspicious activity alert output
 */
export interface SuspiciousActivityAlert {
  alert_id: string; // Format: ALT-YYYY-MM-DD-NNNNN
  account_hash: string;
  customer_token: string;
  risk_score: number; // 0-100, higher = more suspicious
  alert_type: 'structuring' | 'velocity_anomaly' | 'round_dollar' | 'geographic_risk' | 'customer_deviation' | 'multiple_indicators';
  severity: 'low' | 'medium' | 'high' | 'critical';
  transactions_flagged: SanitizedTransaction[];
  suspicious_indicators: string[]; // Human-readable explanations
  regulatory_citation: string; // e.g., "31 USC §5324 - Structuring"
  recommended_action: 'monitor' | 'investigate' | 'file_sar' | 'escalate_immediately';
  confidence_score: number; // 0-100, model confidence in detection
  false_positive_probability: number; // 0-1, estimated FP rate
  created_at: string; // ISO timestamp
  expires_at: string; // ISO timestamp (30 days from creation per SAR filing deadline)
  assigned_to?: string; // Compliance officer token
  investigation_status: 'pending' | 'in_progress' | 'sar_filed' | 'no_sar_warranted' | 'false_positive';
  investigation_notes?: string;
}

/**
 * Structuring detection result
 * Identifies deposits/withdrawals designed to evade $10K CTR threshold
 */
export interface StructuringDetectionResult {
  detected: boolean;
  pattern_type: 'single_day_multiple' | 'consecutive_days' | 'weekly_pattern' | 'smurfing' | null;
  time_window_days: number; // How many days the pattern spans
  transaction_count: number;
  total_amount: number;
  avg_amount: number;
  threshold_proximity: number; // How close to $10K threshold (0-1, 1 = exactly $9,999)
  different_branches: boolean; // Indicates intentional distribution
  different_tellers: boolean;
  confidence: number; // 0-100
  explanation: string;
}

/**
 * Velocity anomaly detection result
 * Identifies sudden changes in account activity
 */
export interface VelocityAnomalyResult {
  detected: boolean;
  anomaly_type: 'dormant_activation' | 'volume_spike' | 'amount_spike' | 'frequency_change' | null;
  baseline_period_days: number; // Historical comparison period
  baseline_transaction_count: number;
  current_period_days: number;
  current_transaction_count: number;
  velocity_ratio: number; // current / baseline (>3 = suspicious)
  amount_ratio: number; // current avg / baseline avg
  statistical_significance: number; // p-value from t-test
  confidence: number; // 0-100
  explanation: string;
}

/**
 * Agent SDK configuration for TransactionMonitor
 */
export interface TransactionMonitorConfig {
  // Claude API settings
  model: 'claude-sonnet-4-5-20250929' | 'claude-opus-4-5-20251101';
  max_tokens: number; // Recommended: 4000
  temperature: number; // Recommended: 0.0 for deterministic compliance

  // Detection thresholds
  structuring_threshold_usd: number; // Default: 10000 (CTR threshold)
  structuring_proximity_tolerance: number; // Default: 0.15 (within 15% of threshold)
  velocity_anomaly_ratio_threshold: number; // Default: 3.0 (3x normal activity)
  round_dollar_threshold: number; // Default: 0.8 (80% of amounts are round)

  // Performance settings
  batch_size: number; // Transactions per API call, default: 100
  parallel_workers: number; // For batch processing, default: 4
  cache_ttl_seconds: number; // Historical context cache, default: 3600

  // Feature flags
  enable_structuring_detection: boolean;
  enable_velocity_detection: boolean;
  enable_round_dollar_detection: boolean;
  enable_geographic_risk: boolean;
  enable_customer_segmentation: boolean;
}

/**
 * Input to TransactionMonitor agent
 */
export interface TransactionMonitorInput {
  transactions: SanitizedTransaction[];
  historical_context?: CustomerHistoricalContext[];
  config: TransactionMonitorConfig;
  session_id: string; // For audit trail
}

/**
 * Output from TransactionMonitor agent
 */
export interface TransactionMonitorOutput {
  session_id: string;
  processed_at: string; // ISO timestamp
  transactions_analyzed: number;
  alerts_generated: number;
  alerts: SuspiciousActivityAlert[];
  performance_metrics: {
    total_duration_ms: number;
    avg_transaction_latency_ms: number;
    claude_api_calls: number;
    claude_tokens_used: number;
  };
  errors?: Array<{
    transaction_id: string;
    error_message: string;
    error_type: string;
  }>;
}
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- specs/bsa-aml/schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Transaction staging table (receives sanitized data from orchestrator)
CREATE TABLE bsa_aml.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT NOT NULL UNIQUE,
  account_hash TEXT NOT NULL,
  customer_token TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'cash_deposit', 'cash_withdrawal', 'wire_in', 'wire_out',
    'ach_debit', 'ach_credit', 'check_deposit', 'check_withdrawal'
  )),
  transaction_date TIMESTAMPTZ NOT NULL,
  branch_code TEXT,
  counterparty_token TEXT,
  counterparty_country CHAR(2), -- ISO 3166-1 alpha-2
  geographic_risk_score INTEGER CHECK (geographic_risk_score BETWEEN 0 AND 100),
  description_sanitized TEXT,
  is_online_banking BOOLEAN DEFAULT FALSE,
  sanitized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for performance
  INDEX idx_transactions_account_hash (account_hash),
  INDEX idx_transactions_customer_token (customer_token),
  INDEX idx_transactions_date (transaction_date DESC),
  INDEX idx_transactions_amount (amount),
  INDEX idx_transactions_type (transaction_type)
);

-- Row Level Security (RLS) - Users can only access their bank's data
ALTER TABLE bsa_aml.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_isolation ON bsa_aml.transactions
  USING (account_hash IN (
    SELECT account_hash FROM bank_customer_mapping WHERE bank_id = current_setting('app.current_bank_id')::UUID
  ));

-- Customer historical context table
CREATE TABLE bsa_aml.customer_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_hash TEXT NOT NULL UNIQUE,
  customer_token TEXT NOT NULL,
  account_age_days INTEGER NOT NULL,
  total_transactions_6mo INTEGER NOT NULL DEFAULT 0,
  avg_transaction_amount_6mo NUMERIC(15, 2),
  median_transaction_amount_6mo NUMERIC(15, 2),
  max_transaction_amount_6mo NUMERIC(15, 2),
  deposit_count_6mo INTEGER DEFAULT 0,
  withdrawal_count_6mo INTEGER DEFAULT 0,
  avg_monthly_balance_6mo NUMERIC(15, 2),
  customer_segment TEXT CHECK (customer_segment IN (
    'retail', 'small_business', 'commercial', 'nonprofit', 'trust'
  )),
  customer_age_bracket TEXT,
  customer_occupation_category TEXT,
  expected_transaction_frequency TEXT CHECK (expected_transaction_frequency IN (
    'daily', 'weekly', 'monthly', 'quarterly'
  )),
  previous_sar_filings INTEGER DEFAULT 0,
  last_sar_filed_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_customer_history_account (account_hash),
  INDEX idx_customer_history_segment (customer_segment)
);

ALTER TABLE bsa_aml.customer_history ENABLE ROW LEVEL SECURITY;

-- Suspicious activity alerts table
CREATE TABLE bsa_aml.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id TEXT NOT NULL UNIQUE, -- ALT-YYYY-MM-DD-NNNNN
  account_hash TEXT NOT NULL,
  customer_token TEXT NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'structuring', 'velocity_anomaly', 'round_dollar',
    'geographic_risk', 'customer_deviation', 'multiple_indicators'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  transactions_flagged JSONB NOT NULL, -- Array of SanitizedTransaction
  suspicious_indicators TEXT[] NOT NULL,
  regulatory_citation TEXT NOT NULL,
  recommended_action TEXT NOT NULL CHECK (recommended_action IN (
    'monitor', 'investigate', 'file_sar', 'escalate_immediately'
  )),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  false_positive_probability NUMERIC(3, 2) CHECK (false_positive_probability BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- 30 days from created_at
  assigned_to TEXT,
  investigation_status TEXT NOT NULL DEFAULT 'pending' CHECK (investigation_status IN (
    'pending', 'in_progress', 'sar_filed', 'no_sar_warranted', 'false_positive'
  )),
  investigation_notes TEXT,
  investigation_completed_at TIMESTAMPTZ,

  INDEX idx_alerts_account (account_hash),
  INDEX idx_alerts_status (investigation_status),
  INDEX idx_alerts_severity (severity),
  INDEX idx_alerts_created (created_at DESC),
  INDEX idx_alerts_expires (expires_at)
);

ALTER TABLE bsa_aml.alerts ENABLE ROW LEVEL SECURITY;

-- Audit trail table (immutable append-only log)
CREATE TABLE bsa_aml.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  agent_name TEXT NOT NULL DEFAULT 'TransactionMonitor',
  action TEXT NOT NULL,
  input_hash TEXT, -- SHA-256 of input data
  output_hash TEXT, -- SHA-256 of output data
  claude_model TEXT,
  claude_tokens_used INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL, -- Service role or user token

  INDEX idx_audit_session (session_id),
  INDEX idx_audit_created (created_at DESC)
);

-- Immutable: No UPDATE or DELETE allowed
ALTER TABLE bsa_aml.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_append_only ON bsa_aml.audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY audit_log_read_only ON bsa_aml.audit_log
  FOR SELECT USING (true);

-- Migration: Create all tables
-- Migration version: 001_create_transaction_monitor_schema.sql
```

---

## Agent Implementation Pattern

### Claude Agent SDK Configuration

```typescript
// specs/bsa-aml/agent-config.ts

import { Agent, AgentConfig } from '@anthropic-ai/agent-sdk';
import { TransactionMonitorInput, TransactionMonitorOutput } from './types';

export const transactionMonitorAgent: AgentConfig = {
  name: 'TransactionMonitor',
  description: 'BSA/AML suspicious transaction detection specialist',

  // Agent prompt (system message)
  prompt: `You are TransactionMonitor, an expert BSA/AML compliance agent specializing in suspicious activity detection.

Your role:
1. Analyze sanitized transaction data for suspicious patterns
2. Detect structuring (31 USC §5324): deposits designed to evade $10K CTR reporting
3. Identify velocity anomalies: sudden changes in account activity patterns
4. Flag round-dollar patterns inconsistent with normal business operations
5. Score geographic risk based on FATF grey/blacklist countries
6. Compare customer behavior to peer cohort baselines

CRITICAL RULES:
- Input data is ALREADY PII-sanitized (account_hash, customer_token format)
- NEVER attempt to re-identify customers or accounts
- Focus on patterns, amounts, dates, and risk indicators
- Provide clear explanations citing specific regulatory violations
- Assign risk scores 0-100 with confidence levels
- Recommend actions: monitor, investigate, file_sar, escalate_immediately

AGENT BOUNDARIES:
- TransactionMonitor flags suspicious patterns — it does NOT file SARs autonomously; SAR filing requires human authorization per 31 CFR §1020.320 and bank policy
- Do not determine guilt or innocent intent — flag patterns and provide evidence; intent determination is a legal function
- Do not recommend prosecution or law enforcement referral — recommend internal escalation only
- Do not treat any single pattern as definitive proof of money laundering — provide risk scores with confidence levels and let compliance officers decide
- Risk scores are decision-support tools, not determinations — a score of 100 does not mean a SAR must be filed; human judgment is required
- Do not attempt to access, infer, or reason about redacted PII — if a pattern requires PII to confirm, flag for human investigation

Detection Patterns:

STRUCTURING (31 USC §5324):
- Pattern: Multiple cash deposits <$10K within short timeframe
- Red flags: Different branches, different tellers, round amounts
- Example: $9,800 Mon, $9,900 Tue, $9,700 Wed = CRITICAL
- Threshold: Within 15% of $10K ($8,500-$9,999)

VELOCITY ANOMALY:
- Pattern: Dormant account suddenly active or volume spike
- Baseline: Compare last 7 days vs. prior 180 days
- Red flag: 3x increase in transaction count or 5x amount increase
- Example: 2 transactions/month → 30 transactions/week = HIGH RISK

ROUND DOLLAR:
- Pattern: Unusual prevalence of exact dollar amounts
- Normal: $1,247.83 (business invoice), $827.50 (payroll)
- Suspicious: $100,000.00, $50,000.00, $25,000.00 (laundering)
- Threshold: >80% of transactions are round dollars

GEOGRAPHIC RISK:
- High risk: FATF blacklist countries (Iran, N. Korea, Myanmar)
- Medium risk: FATF greylist (UAE, Turkey, Philippines)
- Wire transfers to/from shell company jurisdictions (Cayman, BVI)

OUTPUT FORMAT:
Return JSON array of SuspiciousActivityAlert objects with:
- risk_score: 0-100
- alert_type: structuring | velocity_anomaly | round_dollar | etc.
- severity: low | medium | high | critical
- suspicious_indicators: Array of human-readable explanations
- regulatory_citation: Specific USC or CFR reference
- recommended_action: monitor | investigate | file_sar | escalate_immediately`,

  // Tools available to the agent
  tools: [
    {
      name: 'analyze_transactions',
      description: 'Analyze batch of transactions for suspicious patterns',
      input_schema: {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            items: { type: 'object' },
            description: 'Sanitized transaction data'
          },
          historical_context: {
            type: 'array',
            items: { type: 'object' },
            description: 'Customer historical behavior baselines'
          }
        },
        required: ['transactions']
      }
    }
  ],

  // Model configuration
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4000,
  temperature: 0.0, // Deterministic for compliance
};
```

---

## Test Specifications (TDD)

### Unit Tests

```typescript
// specs/bsa-aml/tests.spec.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TransactionMonitor } from '../src/transaction-monitor';
import { SanitizedTransaction, TransactionMonitorConfig } from './types';

describe('TransactionMonitor Agent', () => {
  let monitor: TransactionMonitor;
  let defaultConfig: TransactionMonitorConfig;

  beforeEach(() => {
    defaultConfig = {
      model: 'claude-sonnet-4-5-20250929',
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

    monitor = new TransactionMonitor(defaultConfig);
  });

  describe('Structuring Detection', () => {
    it('should detect classic structuring pattern: 3 deposits <$10K in 3 days', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN001',
          account_hash: 'ACCT_HASH_A7F2',
          customer_token: '[PERSON_001]',
          amount: 9800,
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-13T10:30:00Z',
          branch_code: 'BR_DOWNTOWN',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-13T10:31:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN002',
          account_hash: 'ACCT_HASH_A7F2',
          customer_token: '[PERSON_001]',
          amount: 9900,
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-14T14:15:00Z',
          branch_code: 'BR_EASTSIDE',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-14T14:16:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN003',
          account_hash: 'ACCT_HASH_A7F2',
          customer_token: '[PERSON_001]',
          amount: 9700,
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-15T09:45:00Z',
          branch_code: 'BR_WESTSIDE',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T09:46:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_001' });

      expect(result.alerts_generated).toBe(1);
      expect(result.alerts[0].alert_type).toBe('structuring');
      expect(result.alerts[0].severity).toBe('critical');
      expect(result.alerts[0].risk_score).toBeGreaterThanOrEqual(85);
      expect(result.alerts[0].suspicious_indicators).toContain(
        expect.stringMatching(/three.*deposits.*under.*10k/i)
      );
      expect(result.alerts[0].suspicious_indicators).toContain(
        expect.stringMatching(/different.*branch/i)
      );
      expect(result.alerts[0].regulatory_citation).toContain('31 USC §5324');
      expect(result.alerts[0].recommended_action).toBe('file_sar');
    });

    it('should NOT flag legitimate business deposits that exceed $10K', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN004',
          account_hash: 'ACCT_HASH_B3D9',
          customer_token: '[BUSINESS_001]',
          amount: 12500.75,
          transaction_type: 'check_deposit',
          transaction_date: '2026-02-13T11:00:00Z',
          description_sanitized: 'Business revenue deposit',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-13T11:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_002' });

      expect(result.alerts_generated).toBe(0);
    });

    it('should detect "smurfing" pattern: same-day deposits at multiple branches', async () => {
      const sameDay = '2026-02-15';
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN005',
          account_hash: 'ACCT_HASH_C5E1',
          customer_token: '[PERSON_002]',
          amount: 4000,
          transaction_type: 'cash_deposit',
          transaction_date: `${sameDay}T09:00:00Z`,
          branch_code: 'BR_NORTH',
          is_online_banking: false,
          metadata: { sanitized_at: `${sameDay}T09:01:00Z`, sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN006',
          account_hash: 'ACCT_HASH_C5E1',
          customer_token: '[PERSON_002]',
          amount: 3500,
          transaction_type: 'cash_deposit',
          transaction_date: `${sameDay}T11:30:00Z`,
          branch_code: 'BR_SOUTH',
          is_online_banking: false,
          metadata: { sanitized_at: `${sameDay}T11:31:00Z`, sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN007',
          account_hash: 'ACCT_HASH_C5E1',
          customer_token: '[PERSON_002]',
          amount: 2000,
          transaction_type: 'cash_deposit',
          transaction_date: `${sameDay}T14:00:00Z`,
          branch_code: 'BR_EAST',
          is_online_banking: false,
          metadata: { sanitized_at: `${sameDay}T14:01:00Z`, sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_003' });

      expect(result.alerts_generated).toBe(1);
      expect(result.alerts[0].alert_type).toBe('structuring');
      expect(result.alerts[0].transactions_flagged.length).toBe(3);
      expect(result.alerts[0].suspicious_indicators).toContain(
        expect.stringMatching(/same.*day.*multiple.*branches/i)
      );
    });

    it('should calculate threshold_proximity correctly', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN008',
          account_hash: 'ACCT_HASH_D7F3',
          customer_token: '[PERSON_003]',
          amount: 9999.99, // 0.01% below threshold
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-15T10:00:00Z',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_004' });

      expect(result.alerts_generated).toBe(1);
      const alert = result.alerts[0];
      expect(alert.risk_score).toBeGreaterThanOrEqual(80);
      // Expect high threshold proximity to be noted in indicators
      expect(alert.suspicious_indicators.some(indicator =>
        indicator.toLowerCase().includes('threshold') || indicator.includes('$10,000')
      )).toBe(true);
    });
  });

  describe('Velocity Anomaly Detection', () => {
    it('should detect dormant account activation', async () => {
      const historicalContext = {
        account_hash: 'ACCT_HASH_E8G4',
        customer_token: '[PERSON_004]',
        account_age_days: 730, // 2 years old
        total_transactions_6mo: 4, // Very low activity
        avg_transaction_amount_6mo: 500,
        median_transaction_amount_6mo: 450,
        max_transaction_amount_6mo: 800,
        deposit_count_6mo: 2,
        withdrawal_count_6mo: 2,
        avg_monthly_balance_6mo: 1200,
        customer_segment: 'retail' as const,
        expected_transaction_frequency: 'monthly' as const,
        previous_sar_filings: 0,
      };

      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN009',
          account_hash: 'ACCT_HASH_E8G4',
          customer_token: '[PERSON_004]',
          amount: 250000, // Massive deposit vs. $500 average
          transaction_type: 'wire_in',
          transaction_date: '2026-02-15T10:00:00Z',
          counterparty_token: '[COUNTERPARTY_001]',
          counterparty_country: 'KY', // Cayman Islands
          geographic_risk_score: 75,
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({
        transactions,
        historical_context: [historicalContext],
        config: defaultConfig,
        session_id: 'TEST_005'
      });

      expect(result.alerts_generated).toBe(1);
      expect(result.alerts[0].alert_type).toMatch(/velocity|geographic|multiple/);
      expect(result.alerts[0].severity).toMatch(/high|critical/);
      expect(result.alerts[0].risk_score).toBeGreaterThanOrEqual(80);
      expect(result.alerts[0].suspicious_indicators).toContain(
        expect.stringMatching(/dormant|inactive|sudden|large/i)
      );
    });

    it('should NOT flag expected seasonal business activity', async () => {
      const historicalContext = {
        account_hash: 'ACCT_HASH_F9H5',
        customer_token: '[BUSINESS_002]',
        account_age_days: 1095, // 3 years
        total_transactions_6mo: 120,
        avg_transaction_amount_6mo: 5000,
        median_transaction_amount_6mo: 4500,
        max_transaction_amount_6mo: 25000,
        deposit_count_6mo: 80,
        withdrawal_count_6mo: 40,
        avg_monthly_balance_6mo: 50000,
        customer_segment: 'small_business' as const,
        expected_transaction_frequency: 'daily' as const,
        previous_sar_filings: 0,
      };

      // Holiday season spike - expected for retail business
      const transactions: SanitizedTransaction[] = Array.from({ length: 10 }, (_, i) => ({
        transaction_id: `TXN01${i}`,
        account_hash: 'ACCT_HASH_F9H5',
        customer_token: '[BUSINESS_002]',
        amount: 6000 + (i * 100), // Slightly higher than average, but within normal range
        transaction_type: 'check_deposit' as const,
        transaction_date: `2026-02-${10 + i}T10:00:00Z`,
        description_sanitized: 'Business revenue deposit',
        is_online_banking: false,
        metadata: { sanitized_at: `2026-02-${10 + i}T10:01:00Z`, sanitization_version: 'v1.0' }
      }));

      const result = await monitor.analyze({
        transactions,
        historical_context: [historicalContext],
        config: defaultConfig,
        session_id: 'TEST_006'
      });

      // Should not generate high-severity alerts for normal business fluctuation
      const highSeverityAlerts = result.alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
      expect(highSeverityAlerts.length).toBe(0);
    });
  });

  describe('Round Dollar Detection', () => {
    it('should flag unusual prevalence of round-dollar wire transfers', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN020',
          account_hash: 'ACCT_HASH_G1I6',
          customer_token: '[PERSON_005]',
          amount: 100000.00,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-10T10:00:00Z',
          counterparty_token: '[COUNTERPARTY_002]',
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-10T10:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN021',
          account_hash: 'ACCT_HASH_G1I6',
          customer_token: '[PERSON_005]',
          amount: 50000.00,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-12T14:00:00Z',
          counterparty_token: '[COUNTERPARTY_003]',
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-12T14:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN022',
          account_hash: 'ACCT_HASH_G1I6',
          customer_token: '[PERSON_005]',
          amount: 75000.00,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-14T09:00:00Z',
          counterparty_token: '[COUNTERPARTY_004]',
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-14T09:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_007' });

      expect(result.alerts_generated).toBeGreaterThanOrEqual(1);
      const roundDollarAlert = result.alerts.find(a => a.alert_type === 'round_dollar' || a.alert_type === 'multiple_indicators');
      expect(roundDollarAlert).toBeDefined();
      expect(roundDollarAlert?.suspicious_indicators).toContain(
        expect.stringMatching(/round.*dollar|exact.*amount/i)
      );
    });

    it('should NOT flag normal payroll with round amounts', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN023',
          account_hash: 'ACCT_HASH_H2J7',
          customer_token: '[BUSINESS_003]',
          amount: 3000.00, // Bi-weekly payroll
          transaction_type: 'ach_credit',
          transaction_date: '2026-02-01T00:00:00Z',
          description_sanitized: 'Payroll deposit',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-01T00:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN024',
          account_hash: 'ACCT_HASH_H2J7',
          customer_token: '[BUSINESS_003]',
          amount: 3000.00,
          transaction_type: 'ach_credit',
          transaction_date: '2026-02-15T00:00:00Z',
          description_sanitized: 'Payroll deposit',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T00:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_008' });

      // Payroll is expected to be round amounts and regular
      const highSeverityAlerts = result.alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
      expect(highSeverityAlerts.length).toBe(0);
    });
  });

  describe('Geographic Risk Scoring', () => {
    it('should flag wire transfer to FATF blacklist country', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN025',
          account_hash: 'ACCT_HASH_I3K8',
          customer_token: '[PERSON_006]',
          amount: 50000,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-15T10:00:00Z',
          counterparty_token: '[COUNTERPARTY_005]',
          counterparty_country: 'IR', // Iran - FATF blacklist
          geographic_risk_score: 95,
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_009' });

      expect(result.alerts_generated).toBeGreaterThanOrEqual(1);
      const geoAlert = result.alerts.find(a => a.alert_type === 'geographic_risk' || a.alert_type === 'multiple_indicators');
      expect(geoAlert).toBeDefined();
      expect(geoAlert?.severity).toMatch(/high|critical/);
      expect(geoAlert?.suspicious_indicators).toContain(
        expect.stringMatching(/blacklist|high.*risk.*country|iran/i)
      );
    });

    it('should flag transactions to shell company jurisdictions', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN026',
          account_hash: 'ACCT_HASH_J4L9',
          customer_token: '[BUSINESS_004]',
          amount: 125000,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-15T10:00:00Z',
          counterparty_token: '[BUSINESS_005]',
          counterparty_country: 'KY', // Cayman Islands
          geographic_risk_score: 70,
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN027',
          account_hash: 'ACCT_HASH_J4L9',
          customer_token: '[BUSINESS_004]',
          amount: 85000,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-16T11:00:00Z',
          counterparty_token: '[BUSINESS_006]',
          counterparty_country: 'VG', // British Virgin Islands
          geographic_risk_score: 68,
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-16T11:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_010' });

      expect(result.alerts_generated).toBeGreaterThanOrEqual(1);
      const geoAlert = result.alerts.find(a => a.alert_type === 'geographic_risk' || a.alert_type === 'multiple_indicators');
      expect(geoAlert).toBeDefined();
      expect(geoAlert?.suspicious_indicators).toContain(
        expect.stringMatching(/offshore|shell.*company|tax.*haven|cayman|virgin.*islands/i)
      );
    });
  });

  describe('Performance Requirements', () => {
    it('should process single transaction in <200ms', async () => {
      const transaction: SanitizedTransaction = {
        transaction_id: 'PERF001',
        account_hash: 'ACCT_HASH_PERF1',
        customer_token: '[PERSON_PERF1]',
        amount: 5000,
        transaction_type: 'check_deposit',
        transaction_date: '2026-02-15T10:00:00Z',
        is_online_banking: false,
        metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
      };

      const startTime = Date.now();
      await monitor.analyze({ transactions: [transaction], config: defaultConfig, session_id: 'PERF_TEST_001' });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should process batch of 100 transactions with avg <5ms per transaction', async () => {
      const transactions: SanitizedTransaction[] = Array.from({ length: 100 }, (_, i) => ({
        transaction_id: `PERF${String(i).padStart(3, '0')}`,
        account_hash: `ACCT_HASH_PERF${i % 10}`,
        customer_token: `[PERSON_PERF${i % 10}]`,
        amount: 1000 + (i * 100),
        transaction_type: 'check_deposit' as const,
        transaction_date: `2026-02-15T${String(i % 24).padStart(2, '0')}:00:00Z`,
        is_online_banking: false,
        metadata: { sanitized_at: `2026-02-15T${String(i % 24).padStart(2, '0')}:01:00Z`, sanitization_version: 'v1.0' }
      }));

      const startTime = Date.now();
      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'PERF_TEST_002' });
      const duration = Date.now() - startTime;

      expect(result.transactions_analyzed).toBe(100);
      expect(result.performance_metrics.avg_transaction_latency_ms).toBeLessThan(5);
      expect(duration).toBeLessThan(500); // Total batch time <500ms
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed transaction data gracefully', async () => {
      const badTransaction: any = {
        transaction_id: 'BAD001',
        // Missing required fields
        amount: 'not-a-number',
      };

      const result = await monitor.analyze({
        transactions: [badTransaction],
        config: defaultConfig,
        session_id: 'ERROR_TEST_001'
      });

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0].error_type).toMatch(/validation|schema/i);
    });

    it('should continue processing when one transaction fails', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'GOOD001',
          account_hash: 'ACCT_HASH_OK',
          customer_token: '[PERSON_OK]',
          amount: 5000,
          transaction_type: 'check_deposit',
          transaction_date: '2026-02-15T10:00:00Z',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'BAD002',
          account_hash: '', // Invalid empty hash
          customer_token: '[PERSON_BAD]',
          amount: -1000, // Negative amount might be invalid depending on type
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-15T10:00:00Z',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        } as any
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'ERROR_TEST_002' });

      expect(result.transactions_analyzed).toBeGreaterThan(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.transaction_id === 'BAD002')).toBe(true);
    });
  });

  describe('Audit Trail', () => {
    it('should log all analysis sessions to audit table', async () => {
      const transaction: SanitizedTransaction = {
        transaction_id: 'AUDIT001',
        account_hash: 'ACCT_HASH_AUDIT',
        customer_token: '[PERSON_AUDIT]',
        amount: 5000,
        transaction_type: 'check_deposit',
        transaction_date: '2026-02-15T10:00:00Z',
        is_online_banking: false,
        metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
      };

      const result = await monitor.analyze({ transactions: [transaction], config: defaultConfig, session_id: 'AUDIT_TEST_001' });

      // Verify audit log entry created
      // (This would query the database in actual implementation)
      expect(result.session_id).toBe('AUDIT_TEST_001');
      expect(result.performance_metrics.claude_tokens_used).toBeGreaterThan(0);
    });
  });
});
```

---

## API Contract

### Function Signature

```typescript
/**
 * TransactionMonitor.analyze()
 *
 * Analyzes batch of sanitized transactions for suspicious activity
 *
 * @param input - Transaction batch with optional historical context
 * @returns Promise<TransactionMonitorOutput> - Alerts and performance metrics
 * @throws ValidationError - If input schema validation fails
 * @throws ClaudeAPIError - If Claude API call fails
 * @throws DatabaseError - If audit log write fails
 */
async analyze(input: TransactionMonitorInput): Promise<TransactionMonitorOutput>;
```

### Error Handling

```typescript
// Custom error types
class ValidationError extends Error {
  constructor(message: string, public field: string, public value: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ClaudeAPIError extends Error {
  constructor(message: string, public statusCode: number, public response?: any) {
    super(message);
    this.name = 'ClaudeAPIError';
  }
}

class DatabaseError extends Error {
  constructor(message: string, public query?: string, public params?: any) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Error handling example
try {
  const result = await transactionMonitor.analyze(input);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation failed for field: ${error.field}`);
    // Return 400 Bad Request
  } else if (error instanceof ClaudeAPIError) {
    console.error(`Claude API error: ${error.statusCode}`);
    // Retry with exponential backoff
  } else if (error instanceof DatabaseError) {
    console.error(`Database error: ${error.message}`);
    // Alert ops team
  }
}
```

---

## Performance Benchmarks

### Latency SLA

| Metric | Target | Maximum |
|--------|--------|---------|
| Single transaction | <100ms p50 | <200ms p99 |
| Batch (100 tx) | <300ms total | <500ms total |
| Batch (1000 tx) | <2 seconds | <5 seconds |
| Daily batch (50K tx) | <3 minutes | <5 minutes |

### Throughput SLA

- **Real-time mode**: 500 transactions/second sustained
- **Batch mode**: 10,000 transactions/minute
- **Peak load**: 1,000 transactions/second burst (30 seconds)

### Resource Limits

- **Memory**: <512 MB per worker
- **CPU**: <80% utilization sustained
- **Database connections**: <10 concurrent connections per worker
- **Claude API rate limit**: 5,000 requests/minute (Anthropic tier 3)

---

## Security Considerations

### PII Protection

1. **Pre-Processing**: ALL PII removed by orchestrator before TransactionMonitor
2. **No Re-Identification**: Agent never attempts to reverse hashes or tokens
3. **Audit Trail**: Every analysis session logged with input/output hashes
4. **Data Retention**: Sanitized data retained 5 years per BSA requirements

### Access Control

```typescript
// Row Level Security (RLS) example
SET app.current_bank_id = 'bank-uuid-here';

// User can only query their bank's transactions
SELECT * FROM bsa_aml.transactions; -- Automatically filtered by RLS policy
```

### Encryption

- **At Rest**: PostgreSQL RDS encrypted with AWS KMS
- **In Transit**: TLS 1.3 for all connections
- **Box Storage**: AES-256 encryption (FedRAMP High compliant)

---

## Deployment Architecture

### AWS Infrastructure (Terraform/CDK)

```typescript
// Infrastructure as Code example
const transactionMonitorService = new ecs.FargateService(this, 'TransactionMonitorService', {
  cluster,
  taskDefinition: transactionMonitorTask,
  desiredCount: 4, // 4 workers for parallel processing
  maxHealthyPercent: 200,
  minHealthyPercent: 50,
  healthCheckGracePeriod: cdk.Duration.seconds(60),
});

// Auto-scaling based on queue depth
const scaling = transactionMonitorService.autoScaleTaskCount({
  minCapacity: 2,
  maxCapacity: 10,
});

scaling.scaleOnMetric('QueueDepthScaling', {
  metric: transactionQueue.metricApproximateNumberOfMessagesVisible(),
  scalingSteps: [
    { upper: 0, change: -1 },
    { lower: 100, change: +1 },
    { lower: 500, change: +2 },
    { lower: 1000, change: +3 },
  ],
});
```

---

## Historical Data Dependency

### The Problem

The `CustomerHistoricalContext` type used by pattern detection assumes populated aggregates (`avg_transaction_amount_6mo`, `deposit_count_6mo`, etc.). The `bsa_aml.customer_history` table has no data at onboarding. Without it, the TransactionMonitor falls back to generic peer cohort baselines, which increases false positive rates and makes velocity anomaly detection unreliable for the first 30–90 days of operation.

The same gap affects any future conversational interface (e.g., TransactionMonitorChat) that queries `bsa_aml.transactions` for 90-day pattern lookups — if individual transactions were never loaded, the query returns empty.

### Two-Phase Data Model

**Phase 1 — Onboarding Backfill (one-time)**

At go-live, the bank provides a historical transaction export via SFTP:
- Format: fixed-width or CSV (bank's core banking standard — FIS, Fiserv, Jack Henry)
- Date range: minimum 12 months; 18 months preferred
- Content: all transaction types in `RawTransaction` shape
- Loader sanitizes (PII → tokens/hashes) before inserting into `bsa_aml.transactions`
- `bsa_aml.customer_history` aggregates computed from loaded data, not from defaults

**Phase 2 — Daily Feed (ongoing)**

End-of-day SFTP export appended to `bsa_aml.transactions`. After 90 days of live operation the rolling window is fully populated without depending on the backfill.

### Deduplication Requirement

The ingestion loader must be idempotent. Re-processing a previously loaded file must not create duplicate rows. Deduplication key: `transaction_id` (UNIQUE constraint already enforced in schema). Use `INSERT ... ON CONFLICT (transaction_id) DO NOTHING`.

### Dependencies This Gap Creates

| Capability | Requires |
|---|---|
| Velocity anomaly detection (accurate) | `customer_history` populated from real data |
| 90-day pattern queries (TransactionMonitorChat) | `bsa_aml.transactions` backfill loaded |
| SARDraftAgent context window | Individual transaction rows for the flagged account |

### Build Priority

The SFTP ingestion pipeline is not in the current 3-day sprint scope. It is a prerequisite for TransactionMonitorChat and for accurate velocity detection on new customers. Target: Weeks 3–4 alongside the full API layer build.

Spec to be written: `specs/bsa-aml/SFTP_INGESTION_SPEC.md`

---

## Next Steps

1. **Review Specification**: Validate completeness and accuracy with compliance team
2. **Implement Tests**: Write all test cases FIRST (TDD approach)
3. **Implement Agent**: Code TransactionMonitor class to pass tests
4. **Integration Testing**: Test with sanitized production-like data
5. **Performance Tuning**: Optimize to meet latency SLA
6. **Security Audit**: Penetration testing and code review
7. **Regulatory Review**: Legal counsel approval of detection logic
8. **Pilot Deployment**: Single MDI bank pilot program

---

*Last Updated: February 15, 2026*
*Status: Ready for Implementation*
