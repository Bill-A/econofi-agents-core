-- Migration 003: CRA Narrative Schema
-- Creates tables for NarrativeWriter agent: community development services,
-- investments, assessment areas, generated narratives, and audit log.
-- All tables: RLS enabled, bank_id isolation, append-only audit log.

-- Community development services tracking
CREATE TABLE cra.community_development_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id UUID NOT NULL,
  service_date DATE NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN (
    'financial_literacy', 'technical_assistance', 'board_service',
    'fundraising', 'homebuyer_counseling', 'small_business_counseling'
  )),
  provider_token TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN (
    'cdfi', 'nonprofit_housing', 'small_business_development',
    'community_service', 'educational_institution', 'government'
  )),
  primary_purpose TEXT NOT NULL CHECK (primary_purpose IN (
    'affordable_housing', 'community_services', 'economic_development', 'revitalize_stabilize'
  )),
  census_tract CHAR(11),
  assessment_area_id UUID NOT NULL,
  hours_contributed NUMERIC(6, 2) NOT NULL CHECK (hours_contributed > 0),
  estimated_dollar_value NUMERIC(12, 2),
  description TEXT NOT NULL,
  qualifies_for_cra BOOLEAN NOT NULL DEFAULT false,
  reporting_year SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cds_bank ON cra.community_development_services (bank_id);
CREATE INDEX idx_cds_date ON cra.community_development_services (service_date);
CREATE INDEX idx_cds_type ON cra.community_development_services (service_type);
CREATE INDEX idx_cds_purpose ON cra.community_development_services (primary_purpose);
CREATE INDEX idx_cds_qualifies ON cra.community_development_services (qualifies_for_cra);
CREATE INDEX idx_cds_year ON cra.community_development_services (reporting_year);

ALTER TABLE cra.community_development_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY cds_bank_isolation ON cra.community_development_services
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Community development investments (LIHTC, NMTC, etc.)
CREATE TABLE cra.community_development_investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id UUID NOT NULL,
  investment_date DATE NOT NULL,
  investment_type TEXT NOT NULL CHECK (investment_type IN (
    'lihtc_equity', 'nmtc_equity', 'affordable_housing_bond',
    'cdc_equity', 'small_business_investment', 'grant'
  )),
  organization_name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  primary_purpose TEXT NOT NULL,
  census_tract CHAR(11),
  assessment_area_id UUID NOT NULL,
  multi_year_commitment BOOLEAN NOT NULL DEFAULT false,
  commitment_end_date DATE,
  qualifies_for_cra BOOLEAN NOT NULL DEFAULT false,
  reporting_year SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cdi_bank ON cra.community_development_investments (bank_id);
CREATE INDEX idx_cdi_date ON cra.community_development_investments (investment_date);
CREATE INDEX idx_cdi_type ON cra.community_development_investments (investment_type);
CREATE INDEX idx_cdi_amount ON cra.community_development_investments (amount);
CREATE INDEX idx_cdi_qualifies ON cra.community_development_investments (qualifies_for_cra);
CREATE INDEX idx_cdi_year ON cra.community_development_investments (reporting_year);

ALTER TABLE cra.community_development_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY cdi_bank_isolation ON cra.community_development_investments
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Assessment area definitions
CREATE TABLE cra.assessment_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id UUID NOT NULL,
  area_name TEXT NOT NULL,
  area_type TEXT NOT NULL CHECK (area_type IN ('msa', 'non_msa_county', 'combined')),
  state_codes TEXT[] NOT NULL,
  county_fips_codes TEXT[] NOT NULL,
  census_tracts TEXT[] NOT NULL,
  msa_md_code TEXT,
  low_income_tract_pct NUMERIC(5, 2) NOT NULL,
  moderate_income_tract_pct NUMERIC(5, 2) NOT NULL,
  middle_income_tract_pct NUMERIC(5, 2) NOT NULL,
  upper_income_tract_pct NUMERIC(5, 2) NOT NULL,
  minority_tract_pct NUMERIC(5, 2) NOT NULL,
  reporting_year SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (bank_id, area_name, reporting_year)
);

CREATE INDEX idx_aa_bank ON cra.assessment_areas (bank_id);
CREATE INDEX idx_aa_year ON cra.assessment_areas (reporting_year);

ALTER TABLE cra.assessment_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_bank_isolation ON cra.assessment_areas
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Generated CRA narratives (versioned, append-only in practice)
CREATE TABLE cra.generated_narratives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  bank_id UUID NOT NULL,
  reporting_year SMALLINT NOT NULL,
  evaluation_framework TEXT NOT NULL,
  narrative_sections JSONB NOT NULL,
  performance_summary JSONB NOT NULL,
  public_file JSONB NOT NULL,
  anticipated_questions JSONB NOT NULL,
  community_impact_metrics JSONB NOT NULL,
  document_url TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  claude_model TEXT NOT NULL,
  claude_tokens_used INTEGER NOT NULL,
  generation_duration_ms INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_narratives_bank ON cra.generated_narratives (bank_id);
CREATE INDEX idx_narratives_year ON cra.generated_narratives (reporting_year);
CREATE INDEX idx_narratives_session ON cra.generated_narratives (session_id);
CREATE INDEX idx_narratives_generated ON cra.generated_narratives (generated_at DESC);

ALTER TABLE cra.generated_narratives ENABLE ROW LEVEL SECURITY;
CREATE POLICY narratives_bank_isolation ON cra.generated_narratives
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Narrative audit log (immutable — INSERT only)
CREATE TABLE cra.narrative_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  bank_id UUID NOT NULL,
  agent_name TEXT NOT NULL DEFAULT 'NarrativeWriter',
  action TEXT NOT NULL,
  reporting_year SMALLINT,
  input_record_count INTEGER,
  output_narrative_id UUID,
  claude_model TEXT,
  claude_tokens_used INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_narrative_audit_session ON cra.narrative_audit_log (session_id);
CREATE INDEX idx_narrative_audit_bank ON cra.narrative_audit_log (bank_id);
CREATE INDEX idx_narrative_audit_created ON cra.narrative_audit_log (created_at DESC);

ALTER TABLE cra.narrative_audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only: INSERT only, no UPDATE or DELETE policies
CREATE POLICY narrative_audit_append_only ON cra.narrative_audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY narrative_audit_read ON cra.narrative_audit_log
  FOR SELECT USING (true);
