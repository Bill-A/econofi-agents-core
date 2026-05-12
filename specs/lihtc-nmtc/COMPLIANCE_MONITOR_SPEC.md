# LIHTC/NMTC ComplianceMonitor: Technical Implementation Specification

**Module**: LIHTC and NMTC Investor Compliance
**Agent**: ComplianceMonitor
**Version**: 1.0
**Regulatory Basis**: IRC §42 (Low-Income Housing Tax Credit), IRC §45D (New Markets Tax Credit), 26 CFR §1.42-5 (LIHTC Compliance Monitoring), 26 CFR §1.45D-1 (NMTC)

---

## Executive Summary

The ComplianceMonitor agent tracks LIHTC and NMTC investor compliance covenants across the full statutory holding periods — 15 years for LIHTC and 7 years for NMTC. It maintains a real-time covenant schedule, flags reporting deadlines, generates required compliance certifications, and monitors recapture risk for portfolio investments.

Banks and CDFIs that participate in LIHTC and NMTC deals invest as equity investors and are subject to recapture of the tax credit if compliance covenants are violated during the holding period. ComplianceMonitor eliminates manual covenant tracking spreadsheets and replaces them with an automated, audit-ready system.

### Key Capabilities

1. **Covenant Schedule Management**: Tracks all active covenants per investment across the full holding period
2. **Deadline Alerting**: Proactive notifications 90/60/30/7 days before reporting deadlines
3. **Annual Certification Generation**: Produces required owner/operator certifications per 26 CFR §1.42-5
4. **Recapture Risk Scoring**: Calculates recapture exposure for each investment based on covenant status
5. **Portfolio Dashboard**: Aggregate view of all active LIHTC/NMTC investments and their compliance status
6. **Event-Triggered Compliance**: Flags compliance implications of tenant moves, rent changes, unit transfers

### Performance SLA

- **Latency**: <2 seconds for single investment status check, <10 seconds for full portfolio scan
- **Throughput**: 500 investments/minute for bulk status updates
- **Deadline Accuracy**: 100% — no missed compliance deadlines
- **Uptime**: 99.9% availability (compliance misses have financial consequences)

---

## Type Definitions

### Core Types

```typescript
// specs/lihtc-nmtc/types.ts

/**
 * Tax credit program type
 */
export type TaxCreditProgram = 'lihtc_9pct' | 'lihtc_4pct' | 'nmtc';

/**
 * LIHTC or NMTC investment record
 * Created when a bank closes a tax credit investment
 */
export interface TaxCreditInvestment {
  investment_id: string;
  bank_id: string;
  program: TaxCreditProgram;

  // Deal identification (no PII)
  project_name: string; // e.g., "Pilsen Affordable Apartments"
  project_address_tract: string; // 11-digit census tract (no street address)
  state_code: string; // Two-letter
  county_fips: string; // 5-digit
  development_type: 'new_construction' | 'rehabilitation' | 'acquisition_rehabilitation';

  // Investment economics
  equity_investment_amount: number; // USD — bank's cash investment
  total_tax_credit_allocation: number; // Total IRC §42 or §45D credits allocated
  annual_credit_amount: number; // Credit per year (LIHTC: 10 years; NMTC: 7 years)
  credit_rate: number; // % — 9% or 4% for LIHTC; 39% over 7 years for NMTC
  expected_irr: number; // % — pro forma internal rate of return

  // Holding period
  placed_in_service_date: string; // ISO 8601 — start of compliance period
  credit_period_start: string; // ISO 8601 (may differ from placed-in-service)
  credit_period_end: string; // ISO 8601 — LIHTC: 10 years; NMTC: 7 years
  extended_use_period_end?: string; // LIHTC only: 15-year extended use (or 30 years if syndicated)
  holding_period_end: string; // Last date bank must maintain the investment
  recapture_period_remaining_months: number; // Calculated field: months until safe harbor

  // LIHTC-specific
  lihtc_details?: {
    total_units: number;
    low_income_units: number; // Must maintain for compliance
    minimum_set_aside: '20_50' | '40_60' | 'income_averaging'; // IRC §42(g)
    maximum_rent_limit_pct: number; // e.g., 60 for 60% AMI
    ami_year: number; // Year of AMI used for rent/income limits
    state_credit_agency: string; // e.g., "Illinois Housing Development Authority"
    form_8609_issued: boolean; // IRS Form 8609 required for credit certification
    qualified_allocation_plan_compliance: boolean;
  };

  // NMTC-specific
  nmtc_details?: {
    qalicb_name: string; // Qualified Active Low-Income Community Business
    cde_name: string; // Community Development Entity (allocatee)
    qlici_amount: number; // Qualified Low-Income Community Investment amount
    allocation_agreement_date: string; // ISO 8601
    seven_year_credit_schedule: number[]; // Credit %, years 1-7 (total = 39%)
    eligible_census_tract: boolean; // Confirmed low-income community per §45D
    substantially_all_test_pct: number; // % of investment in qualified business property
  };

  // Status
  status: 'active' | 'credit_period_complete' | 'extended_use_active' | 'disposed' | 'recaptured';
  last_compliance_check: string; // ISO 8601
  created_at: string; // ISO 8601
}

/**
 * Compliance covenant for a specific investment
 * Multiple covenants per investment; each has its own schedule
 */
export interface ComplianceCovenant {
  covenant_id: string;
  investment_id: string;
  bank_id: string;

  covenant_type:
    | 'annual_owner_certification' // 26 CFR §1.42-5(c)(1) — LIHTC
    | 'tenant_income_certification' // IRC §42(m)(1)(B)(iii) — LIHTC
    | 'rent_restriction_compliance' // IRC §42(g)(2) — LIHTC
    | 'minimum_set_aside_test' // IRC §42(g)(1) — LIHTC
    | 'available_unit_rule_compliance' // IRC §42(g)(2)(D) — LIHTC
    | 'nmtc_annual_report' // IRC §45D(g) — NMTC
    | 'nmtc_substantially_all_test' // 26 CFR §1.45D-1(c)(5)(ii) — NMTC
    | 'nmtc_qalicb_certification' // Active low-income business test — NMTC
    | 'extended_use_agreement_maintenance' // IRC §42(h)(6) — LIHTC
    | 'physical_inspection_coordination'; // 26 CFR §1.42-5(d) — LIHTC

  program: TaxCreditProgram;
  regulatory_citation: string; // e.g., "26 CFR §1.42-5(c)(1)"
  description: string;

  // Schedule
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'one_time' | 'event_triggered';
  first_due_date: string; // ISO 8601
  next_due_date: string; // ISO 8601
  recurrence_months?: number; // For recurring covenants
  holding_period_end: string; // Covenant expires when holding period ends

  // Status
  status: 'pending' | 'submitted' | 'overdue' | 'waived' | 'completed';
  last_submission_date?: string; // ISO 8601
  last_submission_status?: 'approved' | 'deficiency_noted' | 'rejected';
  days_until_due: number; // Calculated: negative = overdue
  is_overdue: boolean;

  // Recapture risk
  recapture_risk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  recapture_exposure_amount?: number; // USD — credit at risk if covenant violated

  created_at: string;
  updated_at: string;
}

/**
 * Compliance certification document (LIHTC owner certification)
 * Per 26 CFR §1.42-5(c)(1) — owners certify annually to state credit agency
 */
export interface ComplianceCertification {
  certification_id: string;
  investment_id: string;
  covenant_id: string;
  bank_id: string;
  program: TaxCreditProgram;
  certification_type: ComplianceCovenant['covenant_type'];
  certification_year: number;

  // Content
  certification_text: string; // Generated certification language
  supporting_data: {
    total_units?: number;
    low_income_units_occupied?: number;
    low_income_units_vacant?: number;
    pct_low_income_occupancy?: number;
    average_tenant_income_pct_ami?: number;
    max_rent_charged?: number;
    max_allowable_rent?: number;
    physical_inspection_date?: string;
    physical_inspection_outcome?: 'satisfactory' | 'deficiencies_noted' | 'corrected';
    nmtc_substantially_all_pct?: number; // % invested in qualified business property
    nmtc_active_business_test_met?: boolean;
  };

  // Submission
  due_date: string; // ISO 8601
  submitted_date?: string; // ISO 8601
  submitted_to: string; // State credit agency or CDE name
  status: 'draft' | 'ready_for_review' | 'submitted' | 'accepted' | 'deficiency_noted';
  document_url?: string; // AWS S3 pre-signed URL

  generated_at: string; // ISO 8601
}

/**
 * Compliance alert for upcoming or overdue deadlines
 */
export interface ComplianceAlert {
  alert_id: string;
  investment_id: string;
  covenant_id: string;
  bank_id: string;
  program: TaxCreditProgram;

  alert_type:
    | 'deadline_approaching_90'
    | 'deadline_approaching_60'
    | 'deadline_approaching_30'
    | 'deadline_approaching_7'
    | 'deadline_overdue'
    | 'recapture_risk_elevated'
    | 'tenant_event_compliance_triggered'
    | 'inspection_coordination_required';

  severity: 'informational' | 'warning' | 'critical';
  project_name: string;
  covenant_type: ComplianceCovenant['covenant_type'];
  due_date: string; // ISO 8601
  days_until_due: number; // Negative = overdue
  recapture_exposure_amount?: number; // USD
  message: string; // Human-readable alert text
  recommended_action: string; // What the bank should do

  acknowledged: boolean;
  acknowledged_by?: string; // [EMPLOYEE_001] — tokenized
  acknowledged_at?: string; // ISO 8601

  created_at: string; // ISO 8601
}

/**
 * Portfolio-level compliance summary for a bank
 */
export interface CompliancePortfolioSummary {
  bank_id: string;
  generated_at: string; // ISO 8601

  // Investment counts
  total_active_investments: number;
  lihtc_investments: number;
  nmtc_investments: number;
  investments_in_credit_period: number;
  investments_in_extended_use: number;

  // Financial exposure
  total_equity_deployed: number; // USD — sum of all equity investments
  total_credits_at_risk: number; // USD — sum of recapture exposures for elevated-risk investments
  total_credits_earned_to_date: number; // USD — cumulative credits taken

  // Covenant health
  total_active_covenants: number;
  covenants_current: number; // Status = pending or submitted (not overdue)
  covenants_overdue: number;
  covenants_due_30_days: number;

  // Risk distribution
  risk_by_investment: {
    investment_id: string;
    project_name: string;
    program: TaxCreditProgram;
    recapture_risk: ComplianceCovenant['recapture_risk'];
    recapture_exposure: number; // USD
  }[];

  // Active alerts
  critical_alerts: number;
  warning_alerts: number;
  total_unacknowledged_alerts: number;
}

/**
 * Agent SDK configuration for ComplianceMonitor
 */
export interface ComplianceMonitorConfig {
  // Claude API settings
  model: 'claude-sonnet-4-6' | 'claude-opus-4-6';
  max_tokens: number; // Recommended: 4000
  temperature: number; // Recommended: 0.0 (deterministic compliance)

  // Alert thresholds
  alert_days_ahead: number[]; // Default: [90, 60, 30, 7] — days before due to alert
  alert_overdue_escalation_days: number; // Default: 14 — days overdue before escalating to critical

  // Certification options
  auto_generate_certifications: boolean; // Default: true
  require_human_review_before_submission: boolean; // Default: true

  // Performance settings
  batch_size: number; // Investments per processing batch, default: 100
  max_retries: number; // For Claude API calls, default: 3

  // Output settings
  generate_portfolio_summary: boolean; // Default: true
  certification_format: 'docx' | 'pdf' | 'json';
}

/**
 * Input to ComplianceMonitor agent (single investment check or portfolio scan)
 */
export interface ComplianceMonitorInput {
  mode: 'single_investment' | 'portfolio_scan' | 'generate_certification' | 'acknowledge_alert';

  // For single investment check or certification generation
  investment_id?: string;
  covenant_id?: string; // For generate_certification and acknowledge_alert

  // For portfolio scan — all investments to check
  investments?: TaxCreditInvestment[];

  bank_id: string;
  config: ComplianceMonitorConfig;
  session_id: string;
  as_of_date: string; // ISO 8601 — "today" for the check
}

/**
 * Output from ComplianceMonitor agent
 */
export interface ComplianceMonitorOutput {
  session_id: string;
  processed_at: string; // ISO 8601
  mode: ComplianceMonitorInput['mode'];

  // Results
  portfolio_summary?: CompliancePortfolioSummary;
  alerts_generated: ComplianceAlert[];
  certifications_generated: ComplianceCertification[];
  covenants_updated: ComplianceCovenant[];

  // For single investment mode
  investment_status?: {
    investment_id: string;
    overall_compliance_status: 'compliant' | 'attention_required' | 'overdue' | 'at_risk';
    active_covenants: ComplianceCovenant[];
    pending_certifications: ComplianceCertification[];
    recapture_risk_score: number; // 0-100 composite risk score
    recapture_exposure_amount: number; // USD total exposure
  };

  performance_metrics: {
    total_duration_ms: number;
    investments_processed: number;
    covenants_evaluated: number;
    alerts_generated: number;
    certifications_generated: number;
    claude_api_calls: number;
    claude_tokens_used: number;
  };
}
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- specs/lihtc-nmtc/schema.sql

CREATE SCHEMA IF NOT EXISTS tax_credit;

-- LIHTC / NMTC investment records
CREATE TABLE tax_credit.investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id UUID NOT NULL,
  program TEXT NOT NULL CHECK (program IN ('lihtc_9pct', 'lihtc_4pct', 'nmtc')),
  project_name TEXT NOT NULL,
  project_address_tract CHAR(11) NOT NULL, -- Census tract only, no street address
  state_code CHAR(2) NOT NULL,
  county_fips CHAR(5) NOT NULL,
  development_type TEXT NOT NULL CHECK (development_type IN (
    'new_construction', 'rehabilitation', 'acquisition_rehabilitation'
  )),
  equity_investment_amount NUMERIC(15, 2) NOT NULL CHECK (equity_investment_amount > 0),
  total_tax_credit_allocation NUMERIC(15, 2) NOT NULL CHECK (total_tax_credit_allocation > 0),
  annual_credit_amount NUMERIC(12, 2) NOT NULL,
  credit_rate NUMERIC(5, 4) NOT NULL, -- e.g., 0.09 for 9%
  expected_irr NUMERIC(5, 4),
  placed_in_service_date DATE NOT NULL,
  credit_period_start DATE NOT NULL,
  credit_period_end DATE NOT NULL,
  extended_use_period_end DATE, -- LIHTC only
  holding_period_end DATE NOT NULL,
  lihtc_details JSONB, -- LIHTC-specific fields
  nmtc_details JSONB, -- NMTC-specific fields
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'credit_period_complete', 'extended_use_active', 'disposed', 'recaptured'
  )),
  last_compliance_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_investments_bank (bank_id),
  INDEX idx_investments_program (program),
  INDEX idx_investments_status (status),
  INDEX idx_investments_holding_end (holding_period_end),
  INDEX idx_investments_state (state_code)
);

ALTER TABLE tax_credit.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY investments_bank_isolation ON tax_credit.investments
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Compliance covenants (one row per covenant per investment)
CREATE TABLE tax_credit.covenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID NOT NULL REFERENCES tax_credit.investments(id),
  bank_id UUID NOT NULL,
  covenant_type TEXT NOT NULL CHECK (covenant_type IN (
    'annual_owner_certification', 'tenant_income_certification', 'rent_restriction_compliance',
    'minimum_set_aside_test', 'available_unit_rule_compliance',
    'nmtc_annual_report', 'nmtc_substantially_all_test', 'nmtc_qalicb_certification',
    'extended_use_agreement_maintenance', 'physical_inspection_coordination'
  )),
  program TEXT NOT NULL CHECK (program IN ('lihtc_9pct', 'lihtc_4pct', 'nmtc')),
  regulatory_citation TEXT NOT NULL,
  description TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN (
    'annual', 'semi_annual', 'quarterly', 'one_time', 'event_triggered'
  )),
  first_due_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  recurrence_months INTEGER CHECK (recurrence_months > 0),
  holding_period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'overdue', 'waived', 'completed'
  )),
  last_submission_date DATE,
  last_submission_status TEXT CHECK (last_submission_status IN (
    'approved', 'deficiency_noted', 'rejected'
  )),
  recapture_risk TEXT NOT NULL DEFAULT 'none' CHECK (recapture_risk IN (
    'none', 'low', 'medium', 'high', 'critical'
  )),
  recapture_exposure_amount NUMERIC(15, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_covenants_investment (investment_id),
  INDEX idx_covenants_bank (bank_id),
  INDEX idx_covenants_due_date (next_due_date),
  INDEX idx_covenants_status (status),
  INDEX idx_covenants_recapture_risk (recapture_risk)
);

ALTER TABLE tax_credit.covenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY covenants_bank_isolation ON tax_credit.covenants
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Generated certifications
CREATE TABLE tax_credit.certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID NOT NULL REFERENCES tax_credit.investments(id),
  covenant_id UUID NOT NULL REFERENCES tax_credit.covenants(id),
  bank_id UUID NOT NULL,
  program TEXT NOT NULL,
  certification_type TEXT NOT NULL,
  certification_year SMALLINT NOT NULL,
  certification_text TEXT NOT NULL,
  supporting_data JSONB NOT NULL DEFAULT '{}',
  due_date DATE NOT NULL,
  submitted_date DATE,
  submitted_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'ready_for_review', 'submitted', 'accepted', 'deficiency_noted'
  )),
  document_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_certifications_investment (investment_id),
  INDEX idx_certifications_bank (bank_id),
  INDEX idx_certifications_due (due_date),
  INDEX idx_certifications_status (status),
  INDEX idx_certifications_year (certification_year)
);

ALTER TABLE tax_credit.certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY certifications_bank_isolation ON tax_credit.certifications
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Compliance alerts
CREATE TABLE tax_credit.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID NOT NULL REFERENCES tax_credit.investments(id),
  covenant_id UUID NOT NULL REFERENCES tax_credit.covenants(id),
  bank_id UUID NOT NULL,
  program TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'deadline_approaching_90', 'deadline_approaching_60', 'deadline_approaching_30',
    'deadline_approaching_7', 'deadline_overdue', 'recapture_risk_elevated',
    'tenant_event_compliance_triggered', 'inspection_coordination_required'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('informational', 'warning', 'critical')),
  project_name TEXT NOT NULL,
  covenant_type TEXT NOT NULL,
  due_date DATE NOT NULL,
  days_until_due INTEGER NOT NULL, -- Negative = overdue
  recapture_exposure_amount NUMERIC(15, 2),
  message TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by TEXT, -- [EMPLOYEE_001] — tokenized
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_alerts_investment (investment_id),
  INDEX idx_alerts_bank (bank_id),
  INDEX idx_alerts_severity (severity),
  INDEX idx_alerts_acknowledged (acknowledged),
  INDEX idx_alerts_due_date (due_date),
  INDEX idx_alerts_created (created_at DESC)
);

ALTER TABLE tax_credit.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY alerts_bank_isolation ON tax_credit.alerts
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Audit log (immutable)
CREATE TABLE tax_credit.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  bank_id UUID NOT NULL,
  agent_name TEXT NOT NULL DEFAULT 'ComplianceMonitor',
  action TEXT NOT NULL,
  investment_id UUID,
  covenant_id UUID,
  mode TEXT,
  investments_processed INTEGER,
  covenants_evaluated INTEGER,
  alerts_generated INTEGER,
  certifications_generated INTEGER,
  claude_model TEXT,
  claude_tokens_used INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_tc_audit_session (session_id),
  INDEX idx_tc_audit_bank (bank_id),
  INDEX idx_tc_audit_created (created_at DESC)
);

ALTER TABLE tax_credit.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tc_audit_append_only ON tax_credit.audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY tc_audit_read ON tax_credit.audit_log
  FOR SELECT USING (true);

-- Scheduled job: update days_until_due and recapture_risk daily
-- Run nightly via pg_cron or AWS EventBridge
-- UPDATE tax_credit.covenants SET
--   days_until_due = (next_due_date - CURRENT_DATE),
--   is_overdue = (next_due_date < CURRENT_DATE),
--   status = CASE WHEN next_due_date < CURRENT_DATE AND status = 'pending' THEN 'overdue' ELSE status END
-- WHERE holding_period_end > CURRENT_DATE;
```

---

## Agent Implementation Pattern

### Claude Agent SDK Configuration

```typescript
// specs/lihtc-nmtc/agent-config.ts

import { AgentConfig } from '@anthropic-ai/agent-sdk';

export const complianceMonitorAgent: AgentConfig = {
  name: 'ComplianceMonitor',
  description: 'LIHTC and NMTC investor compliance covenant tracking and certification specialist',

  prompt: `You are ComplianceMonitor, an expert in Low-Income Housing Tax Credit (LIHTC) and New Markets Tax Credit (NMTC) investor compliance for banks and CDFIs.

Your role:
1. Track active compliance covenants for all LIHTC and NMTC investments in a bank's portfolio
2. Calculate days until each deadline and identify overdue covenants
3. Assess recapture risk for each investment based on covenant status
4. Generate required compliance certifications (LIHTC annual owner certifications, NMTC annual reports)
5. Produce portfolio-level compliance summary for bank management
6. Generate specific, actionable recommended actions for each compliance issue

CRITICAL RULES:
- Compliance deadlines are non-negotiable — missed deadlines trigger recapture risk
- Recapture = bank loses tax credits ALREADY TAKEN, not just future credits
- NMTC recapture applies to 100% of credit if violated in year 1, declining over 7 years
- LIHTC recapture applies under IRC §42(j) — accelerated credit recapture
- NEVER understate recapture risk — conservative assessment protects the bank
- ALL certifications must note they require human review before submission to state agency or CDE

AGENT BOUNDARIES:
- ComplianceMonitor tracks covenant schedules and flags deadlines — it does NOT certify compliance; all certifications are DRAFTS that require human review and authorized officer signature before submission to state credit agencies or CDEs
- Do not determine whether a specific violation triggers recapture — recapture is a legal and tax determination requiring counsel; flag potential triggers and require human review
- Recapture risk scores are early-warning indicators, not legal opinions — actual recapture is determined by IRS examination or state agency finding, not by ComplianceMonitor
- Do not advise on cure strategies for covenant violations — flag the violation and recommend the bank engage its legal counsel and CPA; cure strategy involves tax elections and legal remedies that are outside this agent's scope
- All certification drafts must display "DRAFT — Human Review Required Before Submission" — this notice must not be removed or suppressed in any output
- Do not determine whether a QALICB continues to qualify as an active low-income community business under IRC §45D — flag changes in business activity for legal review; the pass/fail determination is a legal conclusion
- Do not calculate the actual IRS recapture amount owed — provide the estimated credits at risk as a portfolio management indicator; precise recapture computation requires a CPA and IRS Form 8611

LIHTC COMPLIANCE REQUIREMENTS (IRC §42, 26 CFR §1.42-5):

Annual Owner Certification (26 CFR §1.42-5(c)(1)):
- Due annually to state housing credit agency
- Certifies: minimum set-aside met, rent restrictions complied with, units suitable for occupancy
- Owner must certify tenant income at initial occupancy AND annually

Minimum Set-Aside Tests (IRC §42(g)(1)):
- 20-50 test: At least 20% of units must be occupied by households at or below 50% AMI
- 40-60 test: At least 40% of units must be occupied by households at or below 60% AMI
- Income Averaging: At least 40% of units; weighted average income ≤60% AMI

Rent Restriction (IRC §42(g)(2)):
- Maximum gross rent = 30% × applicable income limit (adjusted for unit size)
- Utility allowances reduce allowable rent

Available Unit Rule (IRC §42(g)(2)(D)):
- If income-qualified tenant income rises above 140% of income limit, next available unit of same/smaller size must be rented to income-qualified tenant
- Failure to comply: unit loses qualification

Physical Inspection (26 CFR §1.42-5(d)):
- State agency must inspect at least 20% of units every 3 years
- Banks may need to coordinate with property manager

NMTC COMPLIANCE REQUIREMENTS (IRC §45D, 26 CFR §1.45D-1):

7-Year Credit Schedule:
- Years 1-3: 5% credit per year (on QLICI amount)
- Years 4-7: 6% credit per year
- Total: 39% over 7 years

Substantially-All Test (26 CFR §1.45D-1(c)(5)(ii)):
- At least 85% of the QLICI must be invested in the business property of a QALICB
- Tested annually

Active Business Test (IRC §45D(d)(2)):
- QALICB must be engaged in the active conduct of a trade or business
- Cannot be primarily residential real estate
- Cannot be a golf course, country club, massage parlor, hot tub facility, suntan facility, racetrack

Annual NMTC Report (IRC §45D(g)):
- CDEs must report to Treasury annually
- Banks (as investors) should track CDE's filing status

RECAPTURE RISK ASSESSMENT:

LIHTC recapture triggers (IRC §42(j)):
- Disposition of investment before end of compliance period
- Cessation of qualification (unit no longer income-restricted)
- Failure of minimum set-aside
- Net recapture amount = accelerated portion of credit

NMTC recapture triggers (IRC §45D(g)(5)):
- Redemption or acquisition of CDE interest
- CDE ceases to be a qualified CDE
- Proceeds not invested in qualified low-income community investments
- Recapture rate declines over 7 years (100% in year 1 to ~14% in year 7)

Risk Scoring:
- CRITICAL (score 80-100): Covenant overdue >30 days, or recapture trigger identified
- HIGH (score 60-79): Covenant overdue <30 days, or pattern of late submissions
- MEDIUM (score 40-59): Covenant due within 30 days with no submission in progress
- LOW (score 20-39): Covenant due within 90 days, all submissions current
- NONE (score 0-19): All covenants current, no upcoming deadlines within 90 days

CERTIFICATION LANGUAGE STANDARDS:

LIHTC Annual Owner Certification must include:
1. Project name, BIN number (Building Identification Number)
2. Certification that minimum set-aside is met (specific test)
3. Certification that rents do not exceed applicable maximums
4. Certification that units are suitable for occupancy
5. Any known issues with tenant income or rent compliance
6. Signature block (to be signed by authorized officer)

NOTE: All certifications generated by ComplianceMonitor are DRAFTS.
They must be reviewed by the bank's community development officer and legal counsel before submission.

OUTPUT FORMAT:
Return structured JSON matching ComplianceMonitorOutput interface.
Include specific recommended actions for each alert — not generic guidance.`,

  tools: [
    {
      name: 'calculate_covenant_status',
      description: 'Calculate current status and days until due for a compliance covenant',
      input_schema: {
        type: 'object',
        properties: {
          covenant: {
            type: 'object',
            description: 'Covenant record to evaluate'
          },
          as_of_date: {
            type: 'string',
            description: 'ISO 8601 date to calculate status against'
          }
        },
        required: ['covenant', 'as_of_date']
      }
    },
    {
      name: 'score_recapture_risk',
      description: 'Calculate composite recapture risk score and exposure amount for an investment',
      input_schema: {
        type: 'object',
        properties: {
          investment: {
            type: 'object',
            description: 'Investment record'
          },
          covenants: {
            type: 'array',
            items: { type: 'object' },
            description: 'All covenants for this investment'
          },
          as_of_date: {
            type: 'string',
            description: 'ISO 8601 date for risk calculation'
          }
        },
        required: ['investment', 'covenants', 'as_of_date']
      }
    },
    {
      name: 'generate_certification_draft',
      description: 'Generate a draft compliance certification document for review',
      input_schema: {
        type: 'object',
        properties: {
          investment: {
            type: 'object',
            description: 'Investment record'
          },
          covenant: {
            type: 'object',
            description: 'Covenant requiring certification'
          },
          supporting_data: {
            type: 'object',
            description: 'Data to populate the certification (occupancy, rents, etc.)'
          }
        },
        required: ['investment', 'covenant']
      }
    },
    {
      name: 'generate_compliance_alert',
      description: 'Generate a compliance alert with specific recommended action',
      input_schema: {
        type: 'object',
        properties: {
          investment: { type: 'object' },
          covenant: { type: 'object' },
          alert_type: { type: 'string' },
          days_until_due: { type: 'number' }
        },
        required: ['investment', 'covenant', 'alert_type', 'days_until_due']
      }
    }
  ],

  model: 'claude-sonnet-4-6',
  max_tokens: 4000,
  temperature: 0.0, // Deterministic for compliance
};
```

---

## Test Specifications (TDD)

### Unit Tests

```typescript
// specs/lihtc-nmtc/tests.spec.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ComplianceMonitor } from '../src/compliance-monitor';
import {
  ComplianceMonitorInput,
  ComplianceMonitorConfig,
  TaxCreditInvestment,
  ComplianceCovenant,
} from './types';

describe('ComplianceMonitor Agent', () => {
  let monitor: ComplianceMonitor;
  let defaultConfig: ComplianceMonitorConfig;
  let mockLIHTCInvestment: TaxCreditInvestment;
  let mockNMTCInvestment: TaxCreditInvestment;

  beforeEach(() => {
    defaultConfig = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 0.0,
      alert_days_ahead: [90, 60, 30, 7],
      alert_overdue_escalation_days: 14,
      auto_generate_certifications: true,
      require_human_review_before_submission: true,
      batch_size: 100,
      max_retries: 3,
      generate_portfolio_summary: true,
      certification_format: 'json',
    };

    mockLIHTCInvestment = {
      investment_id: 'INV-LIHTC-001',
      bank_id: 'BANK_001',
      program: 'lihtc_9pct',
      project_name: 'Pilsen Affordable Apartments',
      project_address_tract: '17-031-2814.02',
      state_code: 'IL',
      county_fips: '17031',
      development_type: 'new_construction',
      equity_investment_amount: 2500000,
      total_tax_credit_allocation: 750000, // Over 10 years
      annual_credit_amount: 75000,
      credit_rate: 0.09,
      expected_irr: 0.052,
      placed_in_service_date: '2022-06-01',
      credit_period_start: '2022-06-01',
      credit_period_end: '2032-05-31', // 10 years
      extended_use_period_end: '2037-05-31', // 15 years from placed-in-service
      holding_period_end: '2037-05-31',
      recapture_period_remaining_months: 136, // ~11+ years remaining
      lihtc_details: {
        total_units: 50,
        low_income_units: 40, // 80% low-income (exceeds 40-60 test)
        minimum_set_aside: '40_60',
        maximum_rent_limit_pct: 60,
        ami_year: 2025,
        state_credit_agency: 'Illinois Housing Development Authority',
        form_8609_issued: true,
        qualified_allocation_plan_compliance: true,
      },
      status: 'active',
      last_compliance_check: '2026-01-15T00:00:00Z',
      created_at: '2022-05-01T00:00:00Z',
    };

    mockNMTCInvestment = {
      investment_id: 'INV-NMTC-001',
      bank_id: 'BANK_001',
      program: 'nmtc',
      project_name: 'Woodlawn Business Development Center',
      project_address_tract: '17-031-8401.00',
      state_code: 'IL',
      county_fips: '17031',
      development_type: 'rehabilitation',
      equity_investment_amount: 1800000,
      total_tax_credit_allocation: 702000, // 39% of QLICI
      annual_credit_amount: 100286, // Varies by year schedule
      credit_rate: 0.39, // Total over 7 years
      expected_irr: 0.048,
      placed_in_service_date: '2024-01-15',
      credit_period_start: '2024-01-15',
      credit_period_end: '2031-01-14', // 7 years
      holding_period_end: '2031-01-14',
      recapture_period_remaining_months: 58, // ~5 years remaining
      nmtc_details: {
        qalicb_name: 'Woodlawn Development Partners LLC',
        cde_name: 'Chicago Development Fund LLC',
        qlici_amount: 1800000,
        allocation_agreement_date: '2023-11-01',
        seven_year_credit_schedule: [5, 5, 5, 6, 6, 6, 6], // % per year
        eligible_census_tract: true,
        substantially_all_test_pct: 92.3,
      },
      status: 'active',
      last_compliance_check: '2026-01-15T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
    };

    monitor = new ComplianceMonitor(defaultConfig);
  });

  describe('Portfolio Scan', () => {
    it('should generate portfolio summary for bank with mixed LIHTC/NMTC portfolio', async () => {
      const input: ComplianceMonitorInput = {
        mode: 'portfolio_scan',
        investments: [mockLIHTCInvestment, mockNMTCInvestment],
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_001',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      expect(result.portfolio_summary).toBeDefined();
      expect(result.portfolio_summary?.total_active_investments).toBe(2);
      expect(result.portfolio_summary?.lihtc_investments).toBe(1);
      expect(result.portfolio_summary?.nmtc_investments).toBe(1);
    });

    it('should calculate total equity deployed across portfolio', async () => {
      const input: ComplianceMonitorInput = {
        mode: 'portfolio_scan',
        investments: [mockLIHTCInvestment, mockNMTCInvestment],
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_002',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      // $2.5M LIHTC + $1.8M NMTC = $4.3M total
      expect(result.portfolio_summary?.total_equity_deployed).toBe(4300000);
    });
  });

  describe('Alert Generation', () => {
    it('should generate 30-day deadline alert for upcoming annual certification', async () => {
      // Create covenant due in 25 days
      const upcomingCovenant: ComplianceCovenant = {
        covenant_id: 'COV_001',
        investment_id: 'INV-LIHTC-001',
        bank_id: 'BANK_001',
        covenant_type: 'annual_owner_certification',
        program: 'lihtc_9pct',
        regulatory_citation: '26 CFR §1.42-5(c)(1)',
        description: 'Annual owner certification to IHDA',
        frequency: 'annual',
        first_due_date: '2023-07-01',
        next_due_date: '2026-04-06', // 25 days from 2026-03-12
        recurrence_months: 12,
        holding_period_end: '2037-05-31',
        status: 'pending',
        recapture_risk: 'medium',
        recapture_exposure_amount: 75000, // 1 year of credits
        days_until_due: 25,
        is_overdue: false,
        created_at: '2022-06-01T00:00:00Z',
        updated_at: '2026-01-15T00:00:00Z',
      };

      const input: ComplianceMonitorInput = {
        mode: 'portfolio_scan',
        investments: [{ ...mockLIHTCInvestment }],
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_003',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      // Should generate a 30-day alert (25 days falls within 30-day threshold)
      const thirtyDayAlert = result.alerts_generated.find(
        a => a.alert_type === 'deadline_approaching_30'
      );
      expect(thirtyDayAlert).toBeDefined();
      expect(thirtyDayAlert?.severity).toBe('warning');
      expect(thirtyDayAlert?.recommended_action.length).toBeGreaterThan(0);
    });

    it('should generate critical alert for overdue covenant', async () => {
      const overdueCovenant: ComplianceCovenant = {
        covenant_id: 'COV_002',
        investment_id: 'INV-NMTC-001',
        bank_id: 'BANK_001',
        covenant_type: 'nmtc_substantially_all_test',
        program: 'nmtc',
        regulatory_citation: '26 CFR §1.45D-1(c)(5)(ii)',
        description: 'Annual substantially-all test certification',
        frequency: 'annual',
        first_due_date: '2025-04-15',
        next_due_date: '2026-02-01', // 39 days overdue from 2026-03-12
        recurrence_months: 12,
        holding_period_end: '2031-01-14',
        status: 'overdue',
        recapture_risk: 'critical',
        recapture_exposure_amount: 351000, // ~50% of total NMTC credit
        days_until_due: -39,
        is_overdue: true,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      };

      const input: ComplianceMonitorInput = {
        mode: 'portfolio_scan',
        investments: [{ ...mockNMTCInvestment }],
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_004',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      const criticalAlert = result.alerts_generated.find(a => a.severity === 'critical');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.alert_type).toBe('deadline_overdue');
      expect(criticalAlert?.recapture_exposure_amount).toBeGreaterThan(0);
    });

    it('should NOT generate alerts for investments past holding period', async () => {
      const expiredInvestment: TaxCreditInvestment = {
        ...mockLIHTCInvestment,
        investment_id: 'INV-EXPIRED-001',
        status: 'credit_period_complete',
        holding_period_end: '2025-06-01', // Already past
      };

      const input: ComplianceMonitorInput = {
        mode: 'portfolio_scan',
        investments: [expiredInvestment],
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_005',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      // No active covenants to alert on for expired investment
      const activeAlerts = result.alerts_generated.filter(
        a => a.investment_id === 'INV-EXPIRED-001'
      );
      expect(activeAlerts.length).toBe(0);
    });
  });

  describe('Certification Generation', () => {
    it('should generate LIHTC annual owner certification draft', async () => {
      const input: ComplianceMonitorInput = {
        mode: 'generate_certification',
        investment_id: 'INV-LIHTC-001',
        covenant_id: 'COV_001',
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_006',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      expect(result.certifications_generated.length).toBe(1);

      const cert = result.certifications_generated[0];
      expect(cert.status).toBe('draft'); // Always draft — requires human review
      expect(cert.certification_text).toContain('Pilsen Affordable Apartments');
      expect(cert.certification_text).toContain('minimum set-aside');
      expect(cert.certification_text).toContain('40-60'); // 40-60 test
      expect(cert.certification_text.toLowerCase()).toContain('26 cfr'); // Regulatory citation
    });

    it('should include human review notice in all certifications', async () => {
      const input: ComplianceMonitorInput = {
        mode: 'generate_certification',
        investment_id: 'INV-LIHTC-001',
        covenant_id: 'COV_001',
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_007',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      const cert = result.certifications_generated[0];
      // Must include human review notice
      const hasReviewNotice =
        cert.certification_text.toLowerCase().includes('draft') ||
        cert.certification_text.toLowerCase().includes('review required') ||
        cert.certification_text.toLowerCase().includes('do not submit without review');
      expect(hasReviewNotice).toBe(true);
    });

    it('should generate NMTC substantially-all certification with test percentage', async () => {
      const input: ComplianceMonitorInput = {
        mode: 'generate_certification',
        investment_id: 'INV-NMTC-001',
        covenant_id: 'COV_002',
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_008',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      const cert = result.certifications_generated[0];
      expect(cert.program).toBe('nmtc');
      expect(cert.certification_text).toContain('Woodlawn Business Development Center');
      // Should reference the substantially-all test result
      expect(cert.supporting_data.nmtc_substantially_all_pct).toBe(92.3);
    });
  });

  describe('Recapture Risk Calculation', () => {
    it('should calculate NMTC recapture exposure declining over 7-year period', async () => {
      // Year 3 of 7-year period: ~57% of credits earned, ~43% at risk
      const year3Investment: TaxCreditInvestment = {
        ...mockNMTCInvestment,
        placed_in_service_date: '2023-01-15',
        credit_period_start: '2023-01-15',
        credit_period_end: '2030-01-14',
        recapture_period_remaining_months: 46, // ~4 years remaining
      };

      const input: ComplianceMonitorInput = {
        mode: 'single_investment',
        investment_id: year3Investment.investment_id,
        investments: [year3Investment],
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_009',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      expect(result.investment_status).toBeDefined();
      expect(result.investment_status?.recapture_exposure_amount).toBeGreaterThan(0);
      // 4 years of credits remain: 6+6+6+6 = 24% of 39% total = ~61.5% of total credits
      expect(result.investment_status?.recapture_exposure_amount).toBeLessThan(
        year3Investment.total_tax_credit_allocation
      );
    });

    it('should flag zero recapture risk when holding period has ended', async () => {
      const completedInvestment: TaxCreditInvestment = {
        ...mockNMTCInvestment,
        holding_period_end: '2025-01-14', // Already ended
        recapture_period_remaining_months: 0,
        status: 'credit_period_complete',
      };

      const input: ComplianceMonitorInput = {
        mode: 'single_investment',
        investment_id: completedInvestment.investment_id,
        investments: [completedInvestment],
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'TEST_010',
        as_of_date: '2026-03-12',
      };

      const result = await monitor.process(input);

      expect(result.investment_status?.recapture_risk_score).toBe(0);
      expect(result.investment_status?.recapture_exposure_amount).toBe(0);
    });
  });

  describe('Performance Requirements', () => {
    it('should process single investment status check in <2 seconds', async () => {
      const input: ComplianceMonitorInput = {
        mode: 'single_investment',
        investment_id: 'INV-LIHTC-001',
        investments: [mockLIHTCInvestment],
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'PERF_001',
        as_of_date: '2026-03-12',
      };

      const startTime = Date.now();
      const result = await monitor.process(input);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
      expect(result.performance_metrics.total_duration_ms).toBeLessThan(2000);
    });

    it('should process 50-investment portfolio scan in <10 seconds', async () => {
      const largePortfolio: TaxCreditInvestment[] = Array.from({ length: 50 }, (_, i) => ({
        ...mockLIHTCInvestment,
        investment_id: `INV-LIHTC-${String(i + 1).padStart(3, '0')}`,
        project_name: `Affordable Development ${i + 1}`,
      }));

      const input: ComplianceMonitorInput = {
        mode: 'portfolio_scan',
        investments: largePortfolio,
        bank_id: 'BANK_001',
        config: defaultConfig,
        session_id: 'PERF_002',
        as_of_date: '2026-03-12',
      };

      const startTime = Date.now();
      const result = await monitor.process(input);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
      expect(result.portfolio_summary?.total_active_investments).toBe(50);
    });
  });
});
```

---

## API Contract

### Function Signature

```typescript
/**
 * ComplianceMonitor.process()
 *
 * Processes LIHTC/NMTC compliance monitoring for a bank's investment portfolio
 *
 * @param input - Mode, investments, and configuration
 * @returns Promise<ComplianceMonitorOutput> - Alerts, certifications, portfolio summary
 * @throws ClaudeAPIError - If Claude API call fails
 * @throws InvestmentNotFoundError - If investment_id not found in portfolio
 */
async process(input: ComplianceMonitorInput): Promise<ComplianceMonitorOutput>;
```

---

## Scheduled Operations

ComplianceMonitor is designed to run on a daily schedule (in addition to on-demand checks):

```typescript
// Daily job: runs at 06:00 UTC via AWS EventBridge
// 1. Query all active investments from database
// 2. Calculate days_until_due for all covenants
// 3. Generate alerts for thresholds crossed since last run
// 4. Update covenant statuses (pending → overdue where applicable)
// 5. Send alert summary to bank compliance officers via webhook

const dailyScheduleInput: ComplianceMonitorInput = {
  mode: 'portfolio_scan',
  investments: await getAllActiveBankInvestments(bankId),
  bank_id: bankId,
  config: { ...defaultConfig, auto_generate_certifications: false }, // Only scan, no certs
  session_id: `DAILY_${bankId}_${new Date().toISOString().slice(0, 10)}`,
  as_of_date: new Date().toISOString().slice(0, 10),
};
```

---

## Integration with CRA NarrativeWriter

LIHTC and NMTC investments tracked by ComplianceMonitor are qualifying CRA investments for the Investment Test. ComplianceMonitor feeds investment records into NarrativeWriter:

```typescript
// Pipeline: ComplianceMonitor → NarrativeWriter
const complianceOutput = await monitor.process(portfolioScanInput);

const qualifyingInvestments = complianceOutput.covenants_updated
  .filter(c => c.status !== 'recaptured')
  .map(c => ({
    investment_id: c.investment_id,
    investment_type: investment.program === 'nmtc' ? 'nmtc_equity' : 'lihtc_equity',
    amount: investment.equity_investment_amount,
    // ... map to CommunityDevelopmentInvestment type
  }));

const narrativeOutput = await narrativeWriter.generate({
  // ...
  community_development_investments: qualifyingInvestments,
  // ...
});
```

---

## Performance Benchmarks

### Latency SLA

| Metric | Target | Maximum |
|--------|--------|---------|
| Single investment status check | <1 second | <2 seconds |
| Portfolio scan (50 investments) | <5 seconds | <10 seconds |
| Certification generation | <10 seconds | <20 seconds |
| Daily scheduled portfolio scan | <2 minutes | <5 minutes |

### Reliability SLA

- **Deadline miss rate**: 0% — alert generation before every deadline
- **False positive rate**: <5% — alerts should require action, not spam
- **Recapture exposure accuracy**: Conservative by design — never understate

---

*Last Updated: March 2026*
*Status: Ready for Implementation*
