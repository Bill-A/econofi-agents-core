-- =============================================================================
-- Cloud Demo Seed — econofi-agents-core
-- 15 alerts: full status coverage, all alert types, realistic investigation history
-- Run in Supabase Studio SQL Editor against the cloud project
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: bank_customer_mapping (8 customers for bank-demo-001)
-- ---------------------------------------------------------------------------
INSERT INTO public.bank_customer_mapping (bank_id, account_hash, customer_token) VALUES
  ('00000000-0000-0000-0000-000000000001', 'a8f3c92e4b1d5f7a3c2b1e9d0f8a7b6c', '[PERSON_001]'),
  ('00000000-0000-0000-0000-000000000001', 'b1c4d7e2f5a8b3c6d9e0f3a6b9c2d5e8', '[PERSON_002]'),
  ('00000000-0000-0000-0000-000000000001', 'c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7', '[PERSON_003]'),
  ('00000000-0000-0000-0000-000000000001', 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8', '[PERSON_004]'),
  ('00000000-0000-0000-0000-000000000001', 'e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9', '[PERSON_005]'),
  ('00000000-0000-0000-0000-000000000001', 'f5a8b1c4d7e0f3a6b9c2d5e8f1a4b7c0', '[PERSON_006]'),
  ('00000000-0000-0000-0000-000000000001', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', '[PERSON_007]'),
  ('00000000-0000-0000-0000-000000000001', 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7', '[PERSON_008]')
ON CONFLICT (bank_id, account_hash) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Step 2: clear existing demo alerts
-- ---------------------------------------------------------------------------
DELETE FROM bsa_aml.alerts WHERE alert_id LIKE 'ALT-2026-%';

-- ---------------------------------------------------------------------------
-- Step 3: 15 demo alerts
-- ---------------------------------------------------------------------------

-- RESOLVED: SAR Filed (Apr 10)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status, investigation_notes, investigation_completed_at
) VALUES (
  'ALT-2026-04-10-00001', 'c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7', '[PERSON_003]',
  79, 'geographic_risk', 'medium',
  '[{"transaction_id":"txn-geo-001","amount":18500,"transaction_type":"wire_out","transaction_date":"2026-04-09T14:00:00Z","is_online_banking":true}]',
  ARRAY['Wire transfer of $18,500 to FATF grey-list jurisdiction','Counterparty entity has no prior relationship with account'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'file_sar', 79, 0.21,
  '2026-04-10T08:00:00Z', '2026-05-10T08:00:00Z',
  'sar_filed',
  'Reviewed counterparty records — no documented business relationship. Wire destination is FATF grey-list. SAR filed with FinCEN on Apr 28.',
  '2026-04-28T16:00:00Z'
);

-- RESOLVED: SAR Filed (Apr 20)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status, investigation_notes, investigation_completed_at
) VALUES (
  'ALT-2026-04-20-00001', 'b1c4d7e2f5a8b3c6d9e0f3a6b9c2d5e8', '[PERSON_002]',
  97, 'velocity_anomaly', 'critical',
  '[{"transaction_id":"txn-vel-001","amount":62000,"transaction_type":"wire_in","transaction_date":"2026-04-19T08:30:00Z","is_online_banking":false},{"transaction_id":"txn-vel-002","amount":59500,"transaction_type":"wire_out","transaction_date":"2026-04-20T09:00:00Z","is_online_banking":true}]',
  ARRAY['Account dormant 18 months — $62,000 wire-in followed by $59,500 wire-out within 24 hours','Pass-through pattern consistent with layering','Transaction velocity 4,100% above 6-month baseline'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'escalate_immediately', 97, 0.03,
  '2026-04-20T09:00:00Z', '2026-05-20T09:00:00Z',
  'sar_filed',
  'Classic pass-through / layering pattern. In-out within 24 hours, account previously dormant. Escalated to BSA Officer on same day. SAR filed Apr 30.',
  '2026-04-30T11:00:00Z'
);

-- RESOLVED: No SAR Warranted / Tanda cycle (Apr 15)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status, investigation_notes, investigation_completed_at,
  closure_reason_code, closure_reason_detail
) VALUES (
  'ALT-2026-04-15-00001', 'e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9', '[PERSON_005]',
  64, 'structuring', 'high',
  '[{"transaction_id":"txn-str-t01","amount":9800,"transaction_type":"cash_deposit","transaction_date":"2026-04-13T10:00:00Z","is_online_banking":false},{"transaction_id":"txn-str-t02","amount":9600,"transaction_type":"cash_deposit","transaction_date":"2026-04-14T10:30:00Z","is_online_banking":false}]',
  ARRAY['Two cash deposits of $9,800 and $9,600 on consecutive days','Both below $10,000 CTR threshold'],
  '31 USC §5324 — Structuring transactions to evade reporting requirements',
  'investigate', 64, 0.36,
  '2026-04-15T00:00:00Z', '2026-05-15T00:00:00Z',
  'no_sar_warranted',
  'Customer interview confirmed participation in documented tanda savings circle. 12 members, monthly contributions. Supporting documentation collected and filed.',
  '2026-04-29T14:00:00Z',
  'tanda_cycle', 'Rotating savings circle with 12 documented participants. Monthly contribution schedule matches deposit pattern.'
);

-- RESOLVED: No SAR / Documented business purpose (Apr 25)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status, investigation_notes, investigation_completed_at,
  closure_reason_code, closure_reason_detail
) VALUES (
  'ALT-2026-04-25-00001', 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8', '[PERSON_004]',
  58, 'round_dollar', 'medium',
  '[{"transaction_id":"txn-rd-001","amount":5000,"transaction_type":"cash_withdrawal","transaction_date":"2026-04-23T09:00:00Z","is_online_banking":false},{"transaction_id":"txn-rd-002","amount":5000,"transaction_type":"cash_withdrawal","transaction_date":"2026-04-24T09:15:00Z","is_online_banking":false}]',
  ARRAY['Two consecutive $5,000 round-dollar cash withdrawals','Pattern inconsistent with prior transaction history'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'investigate', 58, 0.42,
  '2026-04-25T00:00:00Z', '2026-05-25T00:00:00Z',
  'no_sar_warranted',
  'Verified payroll disbursement for small business — cash wages for seasonal workers. W-9s and payroll records reviewed.',
  '2026-05-05T10:00:00Z',
  'documented_business_purpose', 'Seasonal agricultural payroll — 10 workers, $500/week each. Payroll documentation on file.'
);

-- RESOLVED: False positive / System (Apr 12)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status, investigation_notes, investigation_completed_at,
  closure_reason_code
) VALUES (
  'ALT-2026-04-12-00001', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', '[PERSON_007]',
  41, 'customer_deviation', 'low',
  '[{"transaction_id":"txn-cd-001","amount":12400,"transaction_type":"ach_credit","transaction_date":"2026-04-11T00:00:00Z","is_online_banking":true}]',
  ARRAY['ACH credit 340% above customer baseline','Originator not previously seen'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'monitor', 41, 0.59,
  '2026-04-12T00:00:00Z', '2026-05-12T00:00:00Z',
  'false_positive',
  'ACH credit is annual IRS tax refund. Verified via customer contact. No further action warranted.',
  '2026-04-18T09:00:00Z',
  'system_false_positive'
);

-- IN PROGRESS: Multiple indicators, CRITICAL (Apr 28)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status, investigation_notes
) VALUES (
  'ALT-2026-04-28-00001', 'f5a8b1c4d7e0f3a6b9c2d5e8f1a4b7c0', '[PERSON_006]',
  93, 'multiple_indicators', 'critical',
  '[{"transaction_id":"txn-mi-001","amount":9100,"transaction_type":"cash_deposit","transaction_date":"2026-04-26T10:00:00Z","is_online_banking":false},{"transaction_id":"txn-mi-002","amount":8900,"transaction_type":"cash_deposit","transaction_date":"2026-04-27T10:30:00Z","is_online_banking":false},{"transaction_id":"txn-mi-003","amount":14200,"transaction_type":"wire_out","transaction_date":"2026-04-28T08:00:00Z","is_online_banking":true}]',
  ARRAY['Structuring pattern: two sub-$10K cash deposits followed by immediate wire-out','Wire destination: FATF grey-list jurisdiction','Account opened 6 weeks ago — rapid escalation of activity'],
  '31 USC §5324 and §5318(g)(1) — Structuring and suspicious activity',
  'escalate_immediately', 93, 0.07,
  '2026-04-28T00:00:00Z', '2026-05-28T00:00:00Z',
  'in_progress',
  'Reviewing account opening documentation and CDD records. Wire destination flagged in prior FinCEN advisory. Awaiting compliance officer review.'
);

-- IN PROGRESS: Structuring, HIGH (May 01)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status, investigation_notes
) VALUES (
  'ALT-2026-05-01-00001', 'a8f3c92e4b1d5f7a3c2b1e9d0f8a7b6c', '[PERSON_001]',
  81, 'structuring', 'high',
  '[{"transaction_id":"txn-str-001","amount":9200,"transaction_type":"cash_deposit","transaction_date":"2026-04-29T09:15:00Z","is_online_banking":false},{"transaction_id":"txn-str-002","amount":9400,"transaction_type":"cash_deposit","transaction_date":"2026-04-30T14:30:00Z","is_online_banking":false}]',
  ARRAY['Two sub-threshold cash deposits at different branches within 48 hours','Prior structuring alert filed on this account in Q1 2026'],
  '31 USC §5324 — Structuring transactions to evade reporting requirements',
  'file_sar', 81, 0.19,
  '2026-05-01T00:00:00Z', '2026-05-31T00:00:00Z',
  'in_progress',
  'Second structuring pattern on this account this quarter. Pulling prior Q1 SAR for context. Pattern may warrant enhanced due diligence.'
);

-- IN PROGRESS: Velocity anomaly, HIGH (May 03)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status, investigation_notes
) VALUES (
  'ALT-2026-05-03-00001', 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7', '[PERSON_008]',
  76, 'velocity_anomaly', 'high',
  '[{"transaction_id":"txn-va-001","amount":28000,"transaction_type":"ach_credit","transaction_date":"2026-05-02T00:00:00Z","is_online_banking":true},{"transaction_id":"txn-va-002","amount":26500,"transaction_type":"wire_out","transaction_date":"2026-05-03T10:00:00Z","is_online_banking":true}]',
  ARRAY['ACH credit of $28,000 followed by wire-out of $26,500 within 34 hours','Account opened 3 months ago — no prior transactions above $2,000'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'investigate', 76, 0.24,
  '2026-05-03T00:00:00Z', '2026-06-02T00:00:00Z',
  'in_progress',
  'New account with rapid escalation. Contacting customer to verify source of ACH credit and purpose of wire.'
);

-- PENDING: Structuring, HIGH (May 04 — original)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status
) VALUES (
  'ALT-2026-05-04-00001', 'a8f3c92e4b1d5f7a3c2b1e9d0f8a7b6c', '[PERSON_001]',
  87, 'structuring', 'high',
  '[{"transaction_id":"txn-demo-001a","amount":9200,"transaction_type":"cash_deposit","transaction_date":"2026-05-01T09:15:00Z","is_online_banking":false},{"transaction_id":"txn-demo-001b","amount":9400,"transaction_type":"cash_deposit","transaction_date":"2026-05-02T14:30:00Z","is_online_banking":false},{"transaction_id":"txn-demo-001c","amount":9150,"transaction_type":"cash_deposit","transaction_date":"2026-05-03T11:00:00Z","is_online_banking":false}]',
  ARRAY['Three cash deposits of $9,200, $9,400, and $9,150 across three branches within 5-day window','All deposits below $10,000 CTR threshold — pattern consistent with deliberate avoidance','No corresponding business activity increase to explain deposit frequency'],
  '31 USC §5324 — Structuring transactions to evade reporting requirements',
  'file_sar', 88, 0.12,
  '2026-05-04T10:00:00Z', '2026-06-04T10:00:00Z',
  'pending'
);

-- PENDING: Velocity anomaly, CRITICAL (May 05 — original)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status
) VALUES (
  'ALT-2026-05-05-00001', 'b1c4d7e2f5a8b3c6d9e0f3a6b9c2d5e8', '[PERSON_002]',
  94, 'velocity_anomaly', 'critical',
  '[{"transaction_id":"txn-demo-002a","amount":47500,"transaction_type":"wire_in","transaction_date":"2026-05-05T08:00:00Z","is_online_banking":false}]',
  ARRAY['Account dormant for 14 months — sudden activation with $47,500 wire','Transaction volume 2,300% above 6-month baseline','Wire originator flagged in prior FinCEN advisory'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'escalate_immediately', 96, 0.04,
  '2026-05-05T10:00:00Z', '2026-06-05T10:00:00Z',
  'pending'
);

-- PENDING: Geographic risk, MEDIUM (May 06 — original)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status
) VALUES (
  'ALT-2026-05-06-00001', 'c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7', '[PERSON_003]',
  61, 'geographic_risk', 'medium',
  '[{"transaction_id":"txn-demo-003a","amount":3200,"transaction_type":"wire_out","transaction_date":"2026-05-06T10:00:00Z","is_online_banking":true}]',
  ARRAY['Wire transfer to FATF grey-list jurisdiction','Counterparty has no prior relationship with account holder'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'investigate', 63, 0.38,
  '2026-05-06T10:00:00Z', '2026-06-06T10:00:00Z',
  'pending'
);

-- PENDING: Round dollar, HIGH (May 07 — original)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status
) VALUES (
  'ALT-2026-05-07-00001', 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8', '[PERSON_004]',
  72, 'round_dollar', 'high',
  '[{"transaction_id":"txn-demo-004a","amount":10000,"transaction_type":"cash_withdrawal","transaction_date":"2026-05-07T09:00:00Z","is_online_banking":false},{"transaction_id":"txn-demo-004b","amount":5000,"transaction_type":"wire_out","transaction_date":"2026-05-09T13:20:00Z","is_online_banking":true}]',
  ARRAY['Three consecutive round-dollar withdrawals — $10,000, $5,000','Pattern inconsistent with retail customer profile'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'investigate', 74, 0.27,
  '2026-05-07T10:00:00Z', '2026-06-07T10:00:00Z',
  'pending'
);

-- PENDING: Multiple indicators, HIGH (May 09)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status
) VALUES (
  'ALT-2026-05-09-00001', 'e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9', '[PERSON_005]',
  83, 'multiple_indicators', 'high',
  '[{"transaction_id":"txn-mi-101","amount":9500,"transaction_type":"cash_deposit","transaction_date":"2026-05-08T11:00:00Z","is_online_banking":false},{"transaction_id":"txn-mi-102","amount":8800,"transaction_type":"cash_deposit","transaction_date":"2026-05-09T10:00:00Z","is_online_banking":false}]',
  ARRAY['Sub-threshold cash deposits on consecutive days','Same customer had prior no_sar_warranted closure in April — second occurrence elevates risk','Deposits at two different branch locations'],
  '31 USC §5324 and §5318(g)(1)',
  'investigate', 83, 0.17,
  '2026-05-09T10:00:00Z', '2026-06-09T10:00:00Z',
  'pending'
);

-- PENDING: Structuring, CRITICAL (May 11)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status
) VALUES (
  'ALT-2026-05-11-00001', 'f5a8b1c4d7e0f3a6b9c2d5e8f1a4b7c0', '[PERSON_006]',
  91, 'structuring', 'critical',
  '[{"transaction_id":"txn-str-601","amount":9900,"transaction_type":"cash_deposit","transaction_date":"2026-05-09T09:00:00Z","is_online_banking":false},{"transaction_id":"txn-str-602","amount":9700,"transaction_type":"cash_deposit","transaction_date":"2026-05-10T09:30:00Z","is_online_banking":false},{"transaction_id":"txn-str-603","amount":9850,"transaction_type":"cash_deposit","transaction_date":"2026-05-11T08:45:00Z","is_online_banking":false}]',
  ARRAY['Three sub-threshold cash deposits on three consecutive days at three different branches','Account also flagged for multiple_indicators alert two weeks prior — pattern escalating','Total $29,450 in 3 days — CTR threshold avoidance highly probable'],
  '31 USC §5324 — Structuring transactions to evade reporting requirements',
  'file_sar', 91, 0.09,
  '2026-05-11T10:00:00Z', '2026-06-11T10:00:00Z',
  'pending'
);

-- PENDING: Customer deviation, MEDIUM (May 13)
INSERT INTO bsa_aml.alerts (
  alert_id, account_hash, customer_token, risk_score, alert_type, severity,
  transactions_flagged, suspicious_indicators, regulatory_citation,
  recommended_action, confidence_score, false_positive_probability,
  created_at, expires_at, investigation_status
) VALUES (
  'ALT-2026-05-13-00001', 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7', '[PERSON_008]',
  55, 'customer_deviation', 'medium',
  '[{"transaction_id":"txn-cd-801","amount":15600,"transaction_type":"ach_credit","transaction_date":"2026-05-12T00:00:00Z","is_online_banking":true}]',
  ARRAY['ACH credit 780% above 6-month average','New originator not seen in prior 12 months of account history'],
  '31 USC §5318(g)(1) — Suspicious activity reporting',
  'monitor', 55, 0.45,
  '2026-05-13T10:00:00Z', '2026-06-13T10:00:00Z',
  'pending'
);

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
SELECT investigation_status, COUNT(*) FROM bsa_aml.alerts GROUP BY investigation_status ORDER BY investigation_status;
