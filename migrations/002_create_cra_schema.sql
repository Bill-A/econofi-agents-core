-- =============================================================================
-- Migration: 002_create_cra_schema.sql
-- Module: CRA DataGuard + NarrativeWriter
-- Regulatory basis: 12 CFR §228.42 (CRA Data Collection and Reporting),
--                   12 CFR §228.43 (CRA Public File)
-- Spec: specs/cra/DATA_GUARD_SPEC.md, specs/cra/CRA_NARRATIVE_AGENT_SPEC.md
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS cra;

-- ---------------------------------------------------------------------------
-- Loan records
-- Validated and sanitized loan register data (PII removed before insert).
-- Source: HMDA Loan Application Register (LAR) CSV upload.
-- ---------------------------------------------------------------------------
CREATE TABLE cra.loan_records (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id                   TEXT NOT NULL UNIQUE,
  borrower_token            TEXT NOT NULL,
  census_tract              CHAR(11) NOT NULL,   -- XX-XXX-XXXX.XX format
  msa_md                    TEXT,
  loan_amount               NUMERIC(15, 2) NOT NULL CHECK (loan_amount > 0),
  loan_origination_date     DATE NOT NULL,
  loan_purpose              TEXT NOT NULL CHECK (loan_purpose IN (
                              'home_purchase', 'home_improvement', 'refinance',
                              'small_business', 'small_farm', 'community_development'
                            )),
  loan_type                 TEXT NOT NULL CHECK (loan_type IN (
                              'conventional', 'fha', 'va', 'usda', 'heloc', 'commercial', 'farm'
                            )),
  annual_revenue            NUMERIC(15, 2),
  naics_code                CHAR(6) CHECK (naics_code ~ '^[0-9]{6}$'),
  income_level              TEXT CHECK (income_level IN ('low', 'moderate', 'middle', 'upper')),
  tract_income_level        TEXT NOT NULL CHECK (tract_income_level IN ('low', 'moderate', 'middle', 'upper')),
  tract_minority_percentage NUMERIC(5, 2) CHECK (tract_minority_percentage BETWEEN 0 AND 100),
  tract_median_income       NUMERIC(10, 2),
  tract_population          INTEGER,
  geocoding_quality         TEXT NOT NULL CHECK (geocoding_quality IN (
                              'exact', 'census_tract', 'zip', 'city', 'failed'
                            )),
  sanitized_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loans_census_tract      ON cra.loan_records (census_tract);
CREATE INDEX idx_loans_msa               ON cra.loan_records (msa_md);
CREATE INDEX idx_loans_origination_date  ON cra.loan_records (loan_origination_date);
CREATE INDEX idx_loans_purpose           ON cra.loan_records (loan_purpose);
CREATE INDEX idx_loans_tract_income      ON cra.loan_records (tract_income_level);

ALTER TABLE cra.loan_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY loans_isolation ON cra.loan_records
  USING (borrower_token IN (
    SELECT borrower_token
    FROM   bank_customer_mapping
    WHERE  bank_id = current_setting('app.current_bank_id')::UUID
  ));

-- ---------------------------------------------------------------------------
-- Validation errors
-- One row per field-level exception found during DataGuard validation.
-- Resolved when human corrects data or accepts auto-correction.
-- ---------------------------------------------------------------------------
CREATE TABLE cra.validation_errors (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id               TEXT NOT NULL,
  field                 TEXT NOT NULL,
  error_type            TEXT NOT NULL CHECK (error_type IN (
                          'missing_required', 'invalid_format', 'out_of_range',
                          'duplicate', 'census_tract_invalid', 'inconsistent_data'
                        )),
  severity              TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  current_value         TEXT,
  expected_value        TEXT,
  suggested_correction  TEXT,
  regulatory_requirement TEXT NOT NULL,    -- e.g. "12 CFR §228.42(b)(1)"
  auto_correctable      BOOLEAN NOT NULL DEFAULT false,
  resolved              BOOLEAN NOT NULL DEFAULT false,
  resolved_at           TIMESTAMPTZ,
  resolved_by           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validation_errors_loan      ON cra.validation_errors (loan_id);
CREATE INDEX idx_validation_errors_severity  ON cra.validation_errors (severity);
CREATE INDEX idx_validation_errors_resolved  ON cra.validation_errors (resolved);
CREATE INDEX idx_validation_errors_type      ON cra.validation_errors (error_type);

ALTER TABLE cra.validation_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY validation_errors_isolation ON cra.validation_errors
  USING (loan_id IN (
    SELECT loan_id FROM cra.loan_records
  ));

-- ---------------------------------------------------------------------------
-- Auto-corrections audit trail
-- Immutable record of every automated field correction applied.
-- DataGuard applies corrections only when confidence >= 80.
-- ---------------------------------------------------------------------------
CREATE TABLE cra.auto_corrections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id          TEXT NOT NULL,
  field            TEXT NOT NULL,
  original_value   TEXT,
  corrected_value  TEXT NOT NULL,
  correction_type  TEXT NOT NULL CHECK (correction_type IN (
                     'format_normalization', 'census_tract_lookup',
                     'calculated_field', 'default_value'
                   )),
  confidence       INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  corrected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  corrected_by     TEXT NOT NULL,        -- 'DataGuard Agent v1.0'
  correction_rule  TEXT NOT NULL
);

CREATE INDEX idx_auto_corrections_loan   ON cra.auto_corrections (loan_id);
CREATE INDEX idx_auto_corrections_field  ON cra.auto_corrections (field);
CREATE INDEX idx_auto_corrections_date   ON cra.auto_corrections (corrected_at DESC);

ALTER TABLE cra.auto_corrections ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- FFIEC geocoding cache
-- Shared across all banks — no RLS. Keyed by SHA-256 of normalized address.
-- TTL: 24 hours (configurable via FFIEC_CACHE_TTL_SECONDS)
-- ---------------------------------------------------------------------------
CREATE TABLE cra.ffiec_geocode_cache (
  id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address_hash                 TEXT NOT NULL UNIQUE,   -- SHA-256 of normalized address
  census_tract                 CHAR(11) NOT NULL,
  msa_md                       TEXT,
  county_code                  CHAR(5),
  tract_income_level           TEXT CHECK (tract_income_level IN ('low', 'moderate', 'middle', 'upper')),
  tract_minority_percentage    NUMERIC(5, 2),
  tract_median_family_income   NUMERIC(10, 2),
  tract_population             INTEGER,
  msa_median_family_income     NUMERIC(10, 2),
  geocoding_quality            TEXT,
  cached_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_ffiec_cache_address  ON cra.ffiec_geocode_cache (address_hash);
CREATE INDEX idx_ffiec_cache_expires  ON cra.ffiec_geocode_cache (expires_at);

-- No RLS — cache is shared across banks (no PII, only geographic data)

-- ---------------------------------------------------------------------------
-- DataGuard audit log (immutable)
-- Append-only record of every DataGuard validation session.
-- ---------------------------------------------------------------------------
CREATE TABLE cra.audit_log (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id                TEXT NOT NULL,
  agent_name                TEXT NOT NULL DEFAULT 'DataGuard',
  action                    TEXT NOT NULL,
  input_hash                TEXT,
  output_hash               TEXT,
  records_processed         INTEGER,
  errors_found              INTEGER,
  auto_corrections_applied  INTEGER,
  claude_model              TEXT,
  claude_tokens_used        INTEGER,
  ffiec_api_calls           INTEGER,
  duration_ms               INTEGER,
  error_message             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                TEXT NOT NULL
);

CREATE INDEX idx_cra_audit_session  ON cra.audit_log (session_id);
CREATE INDEX idx_cra_audit_created  ON cra.audit_log (created_at DESC);

ALTER TABLE cra.audit_log ENABLE ROW LEVEL SECURITY;

-- Immutable: INSERT only
CREATE POLICY cra_audit_log_append_only ON cra.audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY cra_audit_log_read_only ON cra.audit_log
  FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- Regulatory threshold config
-- Stores configurable thresholds so code never needs to change when
-- regulators update values. Updated by RegulatoryWatcher agent.
-- ---------------------------------------------------------------------------
CREATE TABLE cra.regulatory_config (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT NOT NULL UNIQUE,   -- e.g. 'CRA_FRAMEWORK', 'SMALL_BANK_ASSET_THRESHOLD'
  value        TEXT NOT NULL,
  description  TEXT NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   TEXT NOT NULL           -- 'RegulatoryWatcher' or user token
);

-- Seed defaults
INSERT INTO cra.regulatory_config (key, value, description, updated_by) VALUES
  ('CRA_FRAMEWORK',            '1995_legacy',    '1995 CRA rules (pre-2023). Use "2023_modern" for updated rules.', 'migration'),
  ('SMALL_BANK_ASSET_THRESHOLD', '376000000',    'Asset threshold for Small Bank designation (USD). Updated annually by OCC.', 'migration'),
  ('INTERMEDIATE_BANK_LOWER',  '376000000',      'Lower asset bound for Intermediate Small Bank (USD).', 'migration'),
  ('INTERMEDIATE_BANK_UPPER',  '1503000000',     'Upper asset bound for Intermediate Small Bank (USD).', 'migration'),
  ('AUTO_CORRECTION_MIN_CONFIDENCE', '80',        'Minimum confidence score (0-100) required to apply an auto-correction.', 'migration');
