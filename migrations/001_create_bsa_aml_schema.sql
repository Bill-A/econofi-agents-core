-- =============================================================================
-- Migration: 001_create_bsa_aml_schema.sql
-- Module: BSA/AML TransactionMonitor
-- Regulatory basis: 31 USC §5318(g), §5324 (Bank Secrecy Act)
-- Spec: specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema
CREATE SCHEMA IF NOT EXISTS bsa_aml;

-- ---------------------------------------------------------------------------
-- Shared: bank_customer_mapping (referenced by RLS policies across schemas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_customer_mapping (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id      UUID NOT NULL,
  account_hash TEXT NOT NULL,
  customer_token TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (bank_id, account_hash)
);

CREATE INDEX IF NOT EXISTS idx_bank_mapping_bank ON bank_customer_mapping (bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_mapping_account ON bank_customer_mapping (account_hash);

-- ---------------------------------------------------------------------------
-- Transaction staging table
-- Receives sanitized data from orchestrator. PII is tokenized before insert.
-- ---------------------------------------------------------------------------
CREATE TABLE bsa_aml.transactions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id         TEXT NOT NULL UNIQUE,
  account_hash           TEXT NOT NULL,
  customer_token         TEXT NOT NULL,
  amount                 NUMERIC(15, 2) NOT NULL,
  transaction_type       TEXT NOT NULL CHECK (transaction_type IN (
                           'cash_deposit', 'cash_withdrawal', 'wire_in', 'wire_out',
                           'ach_debit', 'ach_credit', 'check_deposit', 'check_withdrawal'
                         )),
  transaction_date       TIMESTAMPTZ NOT NULL,
  branch_code            TEXT,
  counterparty_token     TEXT,
  counterparty_country   CHAR(2),         -- ISO 3166-1 alpha-2
  geographic_risk_score  INTEGER CHECK (geographic_risk_score BETWEEN 0 AND 100),
  description_sanitized  TEXT,
  is_online_banking      BOOLEAN NOT NULL DEFAULT FALSE,
  sanitized_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_account_hash  ON bsa_aml.transactions (account_hash);
CREATE INDEX idx_transactions_customer_token ON bsa_aml.transactions (customer_token);
CREATE INDEX idx_transactions_date           ON bsa_aml.transactions (transaction_date DESC);
CREATE INDEX idx_transactions_amount         ON bsa_aml.transactions (amount);
CREATE INDEX idx_transactions_type           ON bsa_aml.transactions (transaction_type);

ALTER TABLE bsa_aml.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_isolation ON bsa_aml.transactions
  USING (account_hash IN (
    SELECT account_hash
    FROM   bank_customer_mapping
    WHERE  bank_id = current_setting('app.current_bank_id')::UUID
  ));

-- ---------------------------------------------------------------------------
-- Customer historical context
-- Aggregated 6-month baseline for anomaly detection
-- ---------------------------------------------------------------------------
CREATE TABLE bsa_aml.customer_history (
  id                               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_hash                     TEXT NOT NULL UNIQUE,
  customer_token                   TEXT NOT NULL,
  account_age_days                 INTEGER NOT NULL,
  total_transactions_6mo           INTEGER NOT NULL DEFAULT 0,
  avg_transaction_amount_6mo       NUMERIC(15, 2),
  median_transaction_amount_6mo    NUMERIC(15, 2),
  max_transaction_amount_6mo       NUMERIC(15, 2),
  deposit_count_6mo                INTEGER NOT NULL DEFAULT 0,
  withdrawal_count_6mo             INTEGER NOT NULL DEFAULT 0,
  avg_monthly_balance_6mo          NUMERIC(15, 2),
  customer_segment                 TEXT CHECK (customer_segment IN (
                                     'retail', 'small_business', 'commercial', 'nonprofit', 'trust'
                                   )),
  customer_age_bracket             TEXT,
  customer_occupation_category     TEXT,
  expected_transaction_frequency   TEXT CHECK (expected_transaction_frequency IN (
                                     'daily', 'weekly', 'monthly', 'quarterly'
                                   )),
  previous_sar_filings             INTEGER NOT NULL DEFAULT 0,
  last_sar_filed_date              DATE,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_history_account  ON bsa_aml.customer_history (account_hash);
CREATE INDEX idx_customer_history_segment  ON bsa_aml.customer_history (customer_segment);

ALTER TABLE bsa_aml.customer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_history_isolation ON bsa_aml.customer_history
  USING (account_hash IN (
    SELECT account_hash
    FROM   bank_customer_mapping
    WHERE  bank_id = current_setting('app.current_bank_id')::UUID
  ));

-- ---------------------------------------------------------------------------
-- Suspicious activity alerts
-- Created by TransactionMonitor agent. Require human authorization for SAR filing.
-- ---------------------------------------------------------------------------
CREATE TABLE bsa_aml.alerts (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id                    TEXT NOT NULL UNIQUE,     -- ALT-YYYY-MM-DD-NNNNN
  account_hash                TEXT NOT NULL,
  customer_token              TEXT NOT NULL,
  risk_score                  INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  alert_type                  TEXT NOT NULL CHECK (alert_type IN (
                                'structuring', 'velocity_anomaly', 'round_dollar',
                                'geographic_risk', 'customer_deviation', 'multiple_indicators'
                              )),
  severity                    TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  transactions_flagged        JSONB NOT NULL,            -- Array of SanitizedTransaction
  suspicious_indicators       TEXT[] NOT NULL,
  regulatory_citation         TEXT NOT NULL,
  recommended_action          TEXT NOT NULL CHECK (recommended_action IN (
                                'monitor', 'investigate', 'file_sar', 'escalate_immediately'
                              )),
  confidence_score            INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  false_positive_probability  NUMERIC(3, 2) CHECK (false_positive_probability BETWEEN 0 AND 1),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                  TIMESTAMPTZ NOT NULL,     -- 30 days from created_at
  assigned_to                 TEXT,
  investigation_status        TEXT NOT NULL DEFAULT 'pending' CHECK (investigation_status IN (
                                'pending', 'in_progress', 'sar_filed',
                                'no_sar_warranted', 'false_positive'
                              )),
  investigation_notes         TEXT,
  investigation_completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_alerts_account   ON bsa_aml.alerts (account_hash);
CREATE INDEX idx_alerts_status    ON bsa_aml.alerts (investigation_status);
CREATE INDEX idx_alerts_severity  ON bsa_aml.alerts (severity);
CREATE INDEX idx_alerts_created   ON bsa_aml.alerts (created_at DESC);
CREATE INDEX idx_alerts_expires   ON bsa_aml.alerts (expires_at);

ALTER TABLE bsa_aml.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_isolation ON bsa_aml.alerts
  USING (account_hash IN (
    SELECT account_hash
    FROM   bank_customer_mapping
    WHERE  bank_id = current_setting('app.current_bank_id')::UUID
  ));

-- ---------------------------------------------------------------------------
-- Audit log (immutable — no UPDATE or DELETE)
-- Append-only record of all agent operations
-- ---------------------------------------------------------------------------
CREATE TABLE bsa_aml.audit_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          TEXT NOT NULL,
  agent_name          TEXT NOT NULL DEFAULT 'TransactionMonitor',
  action              TEXT NOT NULL,
  input_hash          TEXT,     -- SHA-256 of input data
  output_hash         TEXT,     -- SHA-256 of output data
  claude_model        TEXT,
  claude_tokens_used  INTEGER,
  duration_ms         INTEGER,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT NOT NULL   -- Service role or user token
);

CREATE INDEX idx_bsa_audit_session  ON bsa_aml.audit_log (session_id);
CREATE INDEX idx_bsa_audit_created  ON bsa_aml.audit_log (created_at DESC);

ALTER TABLE bsa_aml.audit_log ENABLE ROW LEVEL SECURITY;

-- Immutable: INSERT only
CREATE POLICY audit_log_append_only ON bsa_aml.audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY audit_log_read_only ON bsa_aml.audit_log
  FOR SELECT USING (true);
