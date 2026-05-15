-- =============================================================================
-- Audit Trail Seed — bsa_aml.alert_events
-- Populates realistic investigation event history for resolved and in-progress alerts.
-- Run in Supabase Studio SQL Editor AFTER seed-cloud.sql has been applied.
-- Safe to re-run: DELETE clears existing demo events first.
-- =============================================================================

DELETE FROM bsa_aml.alert_events WHERE alert_id LIKE 'ALT-2026-%';

-- ---------------------------------------------------------------------------
-- ALT-2026-04-10-00001 — Geographic risk, MEDIUM — SAR Filed
-- Wire to FATF grey-list jurisdiction, no business relationship documented
-- ---------------------------------------------------------------------------
INSERT INTO bsa_aml.alert_events (alert_id, event_type, from_status, to_status, notes, actor, created_at) VALUES
(
  'ALT-2026-04-10-00001', 'status_change', 'pending', 'in_progress',
  'Opened investigation. Pulling CDD records and reviewing counterparty entity. No prior relationship documented in account file.',
  'M. Washington, BSA Officer',
  '2026-04-11T09:15:00Z'
),
(
  'ALT-2026-04-10-00001', 'status_change', 'in_progress', 'sar_filed',
  'Investigation complete. Counterparty entity has no documented business relationship with customer. Wire destination confirmed in current FATF grey-list. No plausible legitimate purpose identified. SAR filed with FinCEN Apr 28. Reference number logged in case file.',
  'M. Washington, BSA Officer',
  '2026-04-28T16:00:00Z'
);

-- ---------------------------------------------------------------------------
-- ALT-2026-04-20-00001 — Velocity anomaly, CRITICAL — SAR Filed
-- Dormant account, $62K in / $59.5K out within 24 hours — layering
-- ---------------------------------------------------------------------------
INSERT INTO bsa_aml.alert_events (alert_id, event_type, from_status, to_status, notes, actor, created_at) VALUES
(
  'ALT-2026-04-20-00001', 'status_change', 'pending', 'in_progress',
  'CRITICAL — escalated same day. Account dormant 18 months. In-out within 24 hours is consistent with layering. Pulling account opening documentation and CDD. Wire originator cross-referenced against FinCEN advisory list.',
  'M. Washington, BSA Officer',
  '2026-04-20T10:30:00Z'
),
(
  'ALT-2026-04-20-00001', 'status_change', 'in_progress', 'sar_filed',
  'Pass-through layering pattern confirmed. Wire originator matches entity flagged in FinCEN Advisory FIN-2024-A002. No legitimate business purpose identified. Account placed on enhanced monitoring. SAR filed Apr 30.',
  'M. Washington, BSA Officer',
  '2026-04-30T11:00:00Z'
);

-- ---------------------------------------------------------------------------
-- ALT-2026-04-15-00001 — Structuring, HIGH — No SAR Warranted (tanda cycle)
-- ---------------------------------------------------------------------------
INSERT INTO bsa_aml.alert_events (alert_id, event_type, from_status, to_status, notes, closure_reason_code, actor, created_at) VALUES
(
  'ALT-2026-04-15-00001', 'status_change', 'pending', 'in_progress',
  'Opening investigation. Pattern is consistent with structuring but also consistent with tanda/ROSCA activity common in this customer segment. Scheduling customer interview.',
  NULL,
  'M. Washington, BSA Officer',
  '2026-04-16T10:00:00Z'
),
(
  'ALT-2026-04-15-00001', 'status_change', 'in_progress', 'no_sar_warranted',
  'Customer interview conducted Apr 22. Tanda savings circle confirmed — 12 documented participants, monthly contribution schedule. Schedule matches deposit pattern exactly. Supporting documentation collected: participant list, contribution agreement. Filed per institutional CDD policy. No SAR warranted.',
  'tanda_cycle',
  'M. Washington, BSA Officer',
  '2026-04-29T14:00:00Z'
);

-- ---------------------------------------------------------------------------
-- ALT-2026-04-25-00001 — Round dollar, MEDIUM — No SAR Warranted (payroll)
-- ---------------------------------------------------------------------------
INSERT INTO bsa_aml.alert_events (alert_id, event_type, from_status, to_status, notes, closure_reason_code, actor, created_at) VALUES
(
  'ALT-2026-04-25-00001', 'status_change', 'pending', 'in_progress',
  'Reviewing round-dollar withdrawal pattern. Two consecutive $5,000 withdrawals are unusual for this retail customer profile. Contacting customer to verify purpose.',
  NULL,
  'M. Washington, BSA Officer',
  '2026-04-26T09:00:00Z'
),
(
  'ALT-2026-04-25-00001', 'status_change', 'in_progress', 'no_sar_warranted',
  'Customer confirmed cash payroll for seasonal agricultural workers — 10 employees at $500/week during planting season. W-9s and payroll schedule reviewed and filed. Pattern is consistent with documented business purpose. No SAR warranted.',
  'documented_business_purpose',
  'M. Washington, BSA Officer',
  '2026-05-05T10:00:00Z'
);

-- ---------------------------------------------------------------------------
-- ALT-2026-04-12-00001 — Customer deviation, LOW — False positive (IRS refund)
-- ---------------------------------------------------------------------------
INSERT INTO bsa_aml.alert_events (alert_id, event_type, from_status, to_status, notes, closure_reason_code, actor, created_at) VALUES
(
  'ALT-2026-04-12-00001', 'status_change', 'pending', 'false_positive',
  'Customer contacted Apr 17. ACH credit confirmed as annual IRS tax refund — consistent with prior-year refund amounts. Originator code TREAS 310 TAX REF. System flagged deviation in originator name formatting. No suspicious activity. Closed as system false positive.',
  'system_false_positive',
  'M. Washington, BSA Officer',
  '2026-04-18T09:00:00Z'
);

-- ---------------------------------------------------------------------------
-- ALT-2026-04-28-00001 — Multiple indicators, CRITICAL — In Progress
-- Structuring + FATF wire on new account — active investigation
-- ---------------------------------------------------------------------------
INSERT INTO bsa_aml.alert_events (alert_id, event_type, from_status, to_status, notes, actor, created_at) VALUES
(
  'ALT-2026-04-28-00001', 'status_change', 'pending', 'in_progress',
  'CRITICAL — multiple indicators on account opened 6 weeks ago. Structuring pattern feeding into FATF grey-list wire. Escalated immediately. Pulling account opening docs and CDD. Wire destination matches jurisdiction flagged in FinCEN Advisory. Compliance officer notified.',
  'M. Washington, BSA Officer',
  '2026-04-28T14:00:00Z'
);

-- ---------------------------------------------------------------------------
-- ALT-2026-05-01-00001 — Structuring, HIGH — In Progress
-- Second structuring pattern this quarter on same customer
-- ---------------------------------------------------------------------------
INSERT INTO bsa_aml.alert_events (alert_id, event_type, from_status, to_status, notes, actor, created_at) VALUES
(
  'ALT-2026-05-01-00001', 'status_change', 'pending', 'in_progress',
  'Second structuring pattern on this customer in Q1/Q2 2026. Pulling Q1 SAR for context. Two alerts on the same account in 90 days may warrant enhanced due diligence review and possible account review. Escalating to compliance officer.',
  'M. Washington, BSA Officer',
  '2026-05-02T09:00:00Z'
);

-- ---------------------------------------------------------------------------
-- ALT-2026-05-03-00001 — Velocity anomaly, HIGH — In Progress
-- New account, ACH in / wire out within 34 hours
-- ---------------------------------------------------------------------------
INSERT INTO bsa_aml.alert_events (alert_id, event_type, from_status, to_status, notes, actor, created_at) VALUES
(
  'ALT-2026-05-03-00001', 'status_change', 'pending', 'in_progress',
  'New account showing rapid pass-through pattern. ACH credit of $28,000 followed by wire-out of $26,500 within 34 hours. Customer contact attempted by phone May 4 — no answer. Follow-up scheduled. Verifying ACH originator against known entities.',
  'M. Washington, BSA Officer',
  '2026-05-04T08:30:00Z'
);

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
SELECT alert_id, from_status, to_status, actor, created_at
FROM bsa_aml.alert_events
ORDER BY created_at;
