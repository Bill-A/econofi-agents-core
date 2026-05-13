-- =============================================================================
-- Migration: 005_bsa_aml_closure_and_events.sql
-- Post-demo sprint Items 1 + 3
-- Item 1: Structured closure reason on alerts (don't-file workflow)
-- Item 3: Alert events table (exam-ready audit trail, append-only)
-- Regulatory basis: 31 CFR §1020.320 — SAR declination must be documented
-- =============================================================================

-- Item 1: structured closure reason on bsa_aml.alerts
ALTER TABLE bsa_aml.alerts
  ADD COLUMN IF NOT EXISTS closure_reason_code TEXT
    CHECK (closure_reason_code IN (
      'tanda_cycle',
      'documented_business_purpose',
      'prior_cdd_review',
      'seasonal_income',
      'institutional_knowledge',
      'insufficient_evidence',
      'system_false_positive',
      'other'
    )),
  ADD COLUMN IF NOT EXISTS closure_reason_detail TEXT;

-- Item 3: alert events (immutable audit trail — INSERT only)
CREATE TABLE IF NOT EXISTS bsa_aml.alert_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id            TEXT NOT NULL,
  event_type          TEXT NOT NULL DEFAULT 'status_change',
  from_status         TEXT,
  to_status           TEXT NOT NULL,
  notes               TEXT,
  closure_reason_code TEXT,
  actor               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id   ON bsa_aml.alert_events (alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON bsa_aml.alert_events (created_at);

ALTER TABLE bsa_aml.alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_events_append_only ON bsa_aml.alert_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY alert_events_read_all ON bsa_aml.alert_events
  FOR SELECT USING (true);
