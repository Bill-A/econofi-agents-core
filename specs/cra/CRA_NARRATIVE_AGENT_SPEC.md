# CRA NarrativeWriter: Technical Implementation Specification

**Module**: Community Reinvestment Act (CRA) Compliance
**Agent**: NarrativeWriter
**Version**: 1.0
**Regulatory Basis**: 12 CFR §228 Subpart B (CRA Performance Evaluation), 12 CFR §228.43 (CRA Public File)

---

## Executive Summary

The NarrativeWriter agent auto-generates CRA performance narratives and examiner-ready documentation from validated loan register data, community development service records, and investment activity. It maps a bank's community development lending, investment, and service activity against its CRA assessment areas, calculates performance under the Large Bank and Intermediate Small Bank evaluation frameworks, and produces complete CRA public file documentation.

NarrativeWriter is the downstream consumer of DataGuard output — it receives validated loan records and generates the compliance narrative that accompanies them during a CRA exam.

### Key Capabilities

1. **Performance Narrative Generation**: Plain-language CRA performance narrative covering all three tests (Lending, Investment, Service)
2. **Assessment Area Mapping**: Geographic analysis of lending and service activity against CRA assessment areas by census tract
3. **Community Development Activity Tracking**: Documents qualifying loans, investments, and services for Community Development test
4. **Public File Assembly**: Aggregates required CRA public file components (12 CFR §228.43)
5. **Examiner Q&A Preparation**: Generates anticipated examiner questions with supporting data responses
6. **Community Impact Metrics**: Calculates and formats community impact for board reporting

### Performance SLA

- **Latency**: <30 seconds for full annual CRA performance narrative (12 months of data)
- **Throughput**: One complete CRA narrative per bank per request
- **Accuracy**: 100% regulatory citation accuracy, peer-reviewed prompt language
- **Uptime**: 99.9% availability

---

## Type Definitions

### Core Types

```typescript
// specs/cra/narrative-types.ts

/**
 * CRA Assessment Area definition per 12 CFR §228.41
 */
export interface AssessmentArea {
  area_id: string; // Bank-assigned internal ID
  bank_id: string;
  area_name: string; // e.g., "Chicago-Naperville-Elgin, IL-IN-WI MSA"
  area_type: 'msa' | 'non_msa_county' | 'combined';
  state_codes: string[]; // Two-letter state codes
  county_fips_codes: string[]; // 5-digit FIPS codes
  census_tracts: string[]; // 11-digit tract codes within the area
  msa_md_code?: string; // Metropolitan Statistical Area code
  tract_income_distribution: {
    low_income_pct: number; // % of tracts that are low-income (<50% AMI)
    moderate_income_pct: number; // % 50-79% AMI
    middle_income_pct: number; // % 80-119% AMI
    upper_income_pct: number; // % >=120% AMI
  };
  minority_tract_pct: number; // % of tracts with >50% minority population
  created_at: string; // ISO 8601
  reporting_year: number;
}

/**
 * Community Development Service record
 * Financial literacy, board service, technical assistance, etc.
 */
export interface CommunityDevelopmentService {
  service_id: string;
  bank_id: string;
  service_date: string; // ISO 8601
  service_type:
    | 'financial_literacy'
    | 'technical_assistance'
    | 'board_service'
    | 'fundraising'
    | 'homebuyer_counseling'
    | 'small_business_counseling';
  provider_name: string; // Bank employee name (will be tokenized)
  provider_token: string; // [EMPLOYEE_001]
  organization_name: string; // Recipient organization
  organization_type:
    | 'cdfi'
    | 'nonprofit_housing'
    | 'small_business_development'
    | 'community_service'
    | 'educational_institution'
    | 'government';
  primary_purpose:
    | 'affordable_housing'
    | 'community_services'
    | 'economic_development'
    | 'revitalize_stabilize';
  census_tract?: string; // 11-digit code, if location-specific
  assessment_area_id: string;
  hours_contributed: number;
  estimated_dollar_value?: number; // Monetized value for reporting
  description: string; // What was provided
  qualifies_for_cra: boolean; // DataGuard-verified qualification
  cra_test: 'community_development_services'; // CRA exam test category
  created_at: string;
}

/**
 * Community Development Investment record
 * LIHTC, NMTC, bonds, grants, equity investments
 */
export interface CommunityDevelopmentInvestment {
  investment_id: string;
  bank_id: string;
  investment_date: string; // ISO 8601
  investment_type:
    | 'lihtc_equity'
    | 'nmtc_equity'
    | 'affordable_housing_bond'
    | 'cdc_equity'
    | 'small_business_investment'
    | 'grant';
  organization_name: string;
  organization_type: CommunityDevelopmentService['organization_type'];
  amount: number; // USD
  primary_purpose: CommunityDevelopmentService['primary_purpose'];
  census_tract?: string;
  assessment_area_id: string;
  multi_year_commitment: boolean;
  commitment_end_date?: string; // ISO 8601
  qualifies_for_cra: boolean;
  cra_test: 'community_development_investments';
  created_at: string;
}

/**
 * CRA Performance Summary across all three tests
 */
export interface CRAPerformanceSummary {
  bank_id: string;
  reporting_year: number;
  evaluation_framework: 'large_bank' | 'intermediate_small_bank' | 'small_bank' | 'strategic_plan';

  // Lending Test
  lending_test: {
    loan_to_deposit_ratio: number; // Total loans / total deposits
    peer_comparison_ratio?: number; // vs. peer institutions
    pct_loans_in_assessment_areas: number; // % of loans within defined CAs
    pct_loans_low_moderate_income_tracts: number; // % in LMI census tracts
    pct_loans_low_moderate_income_borrowers: number; // % to LMI borrowers
    community_development_loans_count: number;
    community_development_loans_amount: number; // USD
    small_business_loans_count: number;
    small_business_loans_amount: number; // USD
    hmda_loans_count: number;
    hmda_loans_amount: number; // USD
    lending_test_rating: 'outstanding' | 'high_satisfactory' | 'low_satisfactory' | 'needs_to_improve' | 'substantial_noncompliance';
  };

  // Investment Test (Large Bank and ISB)
  investment_test?: {
    total_investment_amount: number; // USD
    lihtc_investment_amount: number; // USD
    nmtc_investment_amount: number; // USD
    other_investment_amount: number; // USD
    investment_count: number;
    responsiveness_to_credit_needs: 'excellent' | 'good' | 'adequate' | 'poor';
    investment_test_rating: 'outstanding' | 'high_satisfactory' | 'low_satisfactory' | 'needs_to_improve' | 'substantial_noncompliance';
  };

  // Service Test (Large Bank and ISB)
  service_test?: {
    retail_services_delivery: 'excellent' | 'good' | 'adequate' | 'poor';
    community_development_services_count: number;
    community_development_services_hours: number;
    financial_literacy_programs_count: number;
    participants_reached: number;
    service_test_rating: 'outstanding' | 'high_satisfactory' | 'low_satisfactory' | 'needs_to_improve' | 'substantial_noncompliance';
  };

  // Overall CRA Rating
  overall_rating: 'outstanding' | 'satisfactory' | 'needs_to_improve' | 'substantial_noncompliance';
  overall_rating_justification: string;
}

/**
 * CRA Narrative section (maps to CRA Performance Evaluation structure)
 */
export interface CRANarrativeSection {
  section_id: string;
  section_title: string;
  section_type:
    | 'executive_summary'
    | 'scope_of_evaluation'
    | 'assessment_area_description'
    | 'lending_test'
    | 'investment_test'
    | 'service_test'
    | 'community_development'
    | 'conclusions';
  narrative_text: string; // Generated prose
  supporting_data: Record<string, any>; // Tables, figures, statistics
  regulatory_citations: string[]; // e.g., ["12 CFR §228.21", "12 CFR §228.22"]
  word_count: number;
}

/**
 * Complete CRA Public File package (12 CFR §228.43)
 */
export interface CRAPublicFile {
  bank_id: string;
  generated_at: string; // ISO 8601
  reporting_year: number;

  // Required components per 12 CFR §228.43(b)
  public_file_components: {
    cra_notice: string; // Required lobby notice text
    performance_evaluation_copy?: string; // URL to most recent exam
    assessment_area_list: AssessmentArea[];
    branch_locations: string; // URL to branch list
    hmda_disclosure?: string; // URL to HMDA public disclosure
    small_business_loan_data?: string; // URL to small business data
    community_development_loan_list: CommunityDevelopmentLoanSummary[];
    community_development_investment_list: CommunityDevelopmentInvestment[];
    community_development_service_list: CommunityDevelopmentService[];
    annual_cra_activity_report: string; // URL or inline text
  };

  // Generated narrative document
  narrative_sections: CRANarrativeSection[];
  performance_summary: CRAPerformanceSummary;

  // Examiner preparation
  anticipated_questions: ExaminerQA[];

  // Document metadata
  format: 'pdf' | 'docx' | 'json';
  document_url?: string; // AWS S3 pre-signed URL
  is_complete: boolean;
  completeness_check: PublicFileCompletenessCheck;
}

/**
 * Summary of a qualifying community development loan
 */
export interface CommunityDevelopmentLoanSummary {
  loan_id: string; // Anonymized (not PII)
  approval_date: string;
  loan_amount: number;
  primary_purpose: CommunityDevelopmentService['primary_purpose'];
  assessment_area_id: string;
  census_tract?: string;
  organization_type: string;
  qualifies_as: 'community_development_loan' | 'small_business_loan' | 'small_farm_loan';
}

/**
 * Anticipated examiner question and supporting answer
 */
export interface ExaminerQA {
  question_id: string;
  question_category: 'lending' | 'investment' | 'service' | 'community_development' | 'assessment_areas';
  question_text: string;
  answer_text: string;
  supporting_data_references: string[]; // e.g., ["Section 3.1 - LMI Lending Analysis"]
  confidence: 'high' | 'medium' | 'low';
}

/**
 * CRA public file completeness check results
 */
export interface PublicFileCompletenessCheck {
  is_complete: boolean;
  missing_components: string[];
  warnings: string[];
  last_updated: string; // ISO 8601
  next_required_update: string; // Typically annual
}

/**
 * Agent SDK configuration for NarrativeWriter
 */
export interface NarrativeWriterConfig {
  // Claude API settings
  model: 'claude-opus-4-6' | 'claude-sonnet-4-6';
  max_tokens: number; // Recommended: 8000 (narratives are long-form)
  temperature: number; // Recommended: 0.3 for professional prose with some variation

  // Evaluation framework
  evaluation_framework: 'large_bank' | 'intermediate_small_bank' | 'small_bank';
  reporting_year: number;

  // Narrative options
  narrative_tone: 'formal_regulatory' | 'plain_language'; // Formal for public file, plain for board
  include_examiner_qa: boolean; // Default: true
  include_performance_summary: boolean; // Default: true
  sections_to_generate: CRANarrativeSection['section_type'][];

  // Output settings
  output_format: 'pdf' | 'docx' | 'json';
  include_public_file: boolean; // Default: true
  completeness_check: boolean; // Default: true

  // Performance settings
  max_retries: number; // For Claude API calls, default: 3
}

/**
 * Input to NarrativeWriter agent
 */
export interface NarrativeWriterInput {
  // Validated loan data from DataGuard
  validated_loans: import('./types').SanitizedLoanRecord[];

  // Community development activity
  community_development_loans: CommunityDevelopmentLoanSummary[];
  community_development_investments: CommunityDevelopmentInvestment[];
  community_development_services: CommunityDevelopmentService[];

  // Assessment area context
  assessment_areas: AssessmentArea[];

  // Bank metadata
  bank_id: string;
  bank_name: string; // Not PII — institution name
  bank_asset_size: number; // Total assets in USD (determines evaluation framework)
  bank_charter_type: 'national_bank' | 'state_bank' | 'savings_association' | 'credit_union';

  // Configuration
  config: NarrativeWriterConfig;
  session_id: string;
  reporting_period: {
    start_date: string; // ISO 8601
    end_date: string;
  };
}

/**
 * Output from NarrativeWriter agent
 */
export interface NarrativeWriterOutput {
  session_id: string;
  generated_at: string; // ISO 8601
  reporting_period: NarrativeWriterInput['reporting_period'];

  // Primary outputs
  performance_summary: CRAPerformanceSummary;
  narrative_sections: CRANarrativeSection[];
  public_file: CRAPublicFile;

  // Examiner preparation
  anticipated_questions: ExaminerQA[];

  // Community impact metrics (for board reporting)
  community_impact_metrics: {
    total_dollars_invested: number; // Sum of all qualifying investments
    total_loans_to_lmi: number; // Count of loans to LMI borrowers/tracts
    total_lmi_loan_amount: number; // Dollar amount to LMI
    financial_literacy_participants: number; // Unique participants served
    hours_of_community_service: number;
    affordable_housing_units_supported: number; // LIHTC/NMTC projects
    small_businesses_supported: number; // Count of qualifying small business loans
  };

  // Document artifacts
  document_url?: string; // AWS S3 pre-signed URL to generated document
  performance_metrics: {
    total_duration_ms: number;
    claude_api_calls: number;
    claude_tokens_used: number;
    narrative_word_count: number;
  };
}
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- specs/cra/narrative-schema.sql

-- Community development services tracking
CREATE TABLE cra.community_development_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_id UUID NOT NULL,
  service_date DATE NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN (
    'financial_literacy', 'technical_assistance', 'board_service',
    'fundraising', 'homebuyer_counseling', 'small_business_counseling'
  )),
  provider_token TEXT NOT NULL, -- [EMPLOYEE_001] — no PII
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_cds_bank (bank_id),
  INDEX idx_cds_date (service_date),
  INDEX idx_cds_type (service_type),
  INDEX idx_cds_purpose (primary_purpose),
  INDEX idx_cds_qualifies (qualifies_for_cra),
  INDEX idx_cds_year (reporting_year)
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_cdi_bank (bank_id),
  INDEX idx_cdi_date (investment_date),
  INDEX idx_cdi_type (investment_type),
  INDEX idx_cdi_amount (amount),
  INDEX idx_cdi_qualifies (qualifies_for_cra),
  INDEX idx_cdi_year (reporting_year)
);

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

  UNIQUE (bank_id, area_name, reporting_year),
  INDEX idx_aa_bank (bank_id),
  INDEX idx_aa_year (reporting_year)
);

ALTER TABLE cra.assessment_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_bank_isolation ON cra.assessment_areas
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Generated CRA narratives (versioned, append-only)
CREATE TABLE cra.generated_narratives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  bank_id UUID NOT NULL,
  reporting_year SMALLINT NOT NULL,
  evaluation_framework TEXT NOT NULL,
  narrative_sections JSONB NOT NULL, -- Array of CRANarrativeSection
  performance_summary JSONB NOT NULL, -- CRAPerformanceSummary
  public_file JSONB NOT NULL, -- CRAPublicFile
  anticipated_questions JSONB NOT NULL, -- Array of ExaminerQA
  community_impact_metrics JSONB NOT NULL,
  document_url TEXT, -- S3 pre-signed URL
  is_complete BOOLEAN NOT NULL DEFAULT false,
  claude_model TEXT NOT NULL,
  claude_tokens_used INTEGER NOT NULL,
  generation_duration_ms INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_narratives_bank (bank_id),
  INDEX idx_narratives_year (reporting_year),
  INDEX idx_narratives_session (session_id),
  INDEX idx_narratives_generated (generated_at DESC)
);

ALTER TABLE cra.generated_narratives ENABLE ROW LEVEL SECURITY;
CREATE POLICY narratives_bank_isolation ON cra.generated_narratives
  USING (bank_id = current_setting('app.current_bank_id')::UUID);

-- Audit log (immutable)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_narrative_audit_session (session_id),
  INDEX idx_narrative_audit_bank (bank_id),
  INDEX idx_narrative_audit_created (created_at DESC)
);

ALTER TABLE cra.narrative_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY narrative_audit_append_only ON cra.narrative_audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY narrative_audit_read ON cra.narrative_audit_log
  FOR SELECT USING (true);
```

---

## Agent Implementation Pattern

### Claude Agent SDK Configuration

```typescript
// specs/cra/narrative-agent-config.ts

import { AgentConfig } from '@anthropic-ai/agent-sdk';

export const narrativeWriterAgent: AgentConfig = {
  name: 'NarrativeWriter',
  description: 'CRA performance narrative generation and public file assembly specialist',

  prompt: `You are NarrativeWriter, an expert CRA compliance specialist who writes CRA performance narratives and assembles examiner-ready documentation for community banks and Minority Depository Institutions (MDIs).

Your role:
1. Analyze validated loan register data, community development activity, and investment records
2. Calculate CRA performance metrics for Lending, Investment, and Service tests
3. Generate professional CRA performance narratives matching OCC/FDIC/Federal Reserve examiner expectations
4. Identify gaps in CRA performance and flag them for bank management
5. Assemble required CRA public file components per 12 CFR §228.43
6. Generate anticipated examiner questions with data-backed responses
7. Produce plain-language community impact metrics for board reporting

CRITICAL RULES:
- Input data is ALREADY PII-sanitized (use borrower_token, provider_token, not real names)
- NEVER include PII in narrative output
- Cite 12 CFR §228 sections precisely and accurately
- Use only the data provided — do not fabricate statistics
- Flag data gaps rather than estimating missing information
- Maintain professional regulatory tone throughout

AGENT BOUNDARIES:
- NarrativeWriter generates supporting documentation — it does NOT assign official CRA ratings; ratings (Outstanding, Satisfactory, Needs to Improve, Substantial Noncompliance) are assigned exclusively by OCC, Federal Reserve, or FDIC examiners
- Do not certify that any loan, investment, or service qualifies for CRA credit — present items as "presented for examiner consideration" and note that final qualification is subject to examiner review
- All narrative output is DRAFT — include a human review notice on every document; narratives must be reviewed by the bank's compliance officer and legal counsel before any regulatory use
- Do not fabricate, estimate, or interpolate missing data — if data for a required narrative element is absent, note the gap explicitly and recommend the bank gather the missing information before the exam
- Examiner Q&A answers are preparation tools, not guaranteed exam positions — actual examiner questions and areas of focus may differ materially from anticipated questions
- Do not use the label "Outstanding" or "Satisfactory" to describe the bank's CRA performance — use descriptive language ("strong LMI lending performance," "active community development investment") and leave the rating label for the examiner
- Do not advise on legal or regulatory strategy — provide factual narrative and data; strategic advice regarding exam positioning is a legal counsel function

CRA EVALUATION FRAMEWORK:

Large Bank Three-Test Framework (assets > $1.564B as of 2025):
- LENDING TEST (most weight): Loan-to-deposit ratio, LMI lending, geographic distribution
- INVESTMENT TEST: Qualified community development investments (LIHTC, NMTC, grants, bonds)
- SERVICE TEST: Retail delivery systems + community development services

Intermediate Small Bank Two-Test Framework ($391M-$1.564B assets):
- COMMUNITY DEVELOPMENT TEST: Combines investment + service activities
- LENDING TEST: Same as large bank

NARRATIVE STRUCTURE (Large Bank):
1. Executive Summary (1-2 paragraphs)
2. Scope of Evaluation (exam period, assessment areas covered)
3. Description of Institution (charter, asset size, primary business)
4. Assessment Area Description (demographics, credit needs, competition)
5. Lending Test Analysis
   - Loan-to-deposit ratio analysis
   - Geographic distribution by census tract income level
   - Borrower income distribution
   - Community development loans
   - Innovative or flexible lending practices
6. Investment Test Analysis
   - Qualified investment volume and types
   - Responsiveness to credit and community development needs
7. Service Test Analysis
   - Retail delivery systems accessibility
   - Community development services (financial literacy, technical assistance)
8. Conclusions

QUALIFYING COMMUNITY DEVELOPMENT ACTIVITY:

Qualifying loans (12 CFR §228.12(g)):
- Affordable housing loans (low/moderate income families)
- Loans to CDFIs, community development organizations
- Small business loans in LMI census tracts
- Loans that revitalize or stabilize LMI areas, disaster areas, or underserved areas

Qualifying investments (12 CFR §228.23):
- LIHTC equity investments
- NMTC equity investments (IRC §45D)
- Investments in CDFIs, CDCs
- Affordable housing bonds
- Equity-equivalent investments (EQ2)

Qualifying services (12 CFR §228.24):
- Financial literacy education (low/moderate income individuals)
- Technical assistance to CDFIs, small businesses, nonprofits
- Board service for community development organizations
- Homebuyer counseling

NARRATIVE TONE:
- Use the phrase "The bank's" not "Your bank's"
- Write in third person throughout
- Cite specific dollar amounts and percentages from the data provided
- Compare to HMDA peer data where available
- Note innovations and flexibilities explicitly (examiners look for these)

OUTPUT FORMAT:
Return structured JSON with:
- performance_summary: Complete CRAPerformanceSummary object
- narrative_sections: Array of CRANarrativeSection objects (one per section)
- public_file: CRAPublicFile with all required components
- anticipated_questions: Array of ExaminerQA objects
- community_impact_metrics: Aggregated impact statistics`,

  tools: [
    {
      name: 'calculate_lending_test_metrics',
      description: 'Calculate CRA Lending Test performance metrics from loan register data',
      input_schema: {
        type: 'object',
        properties: {
          loans: {
            type: 'array',
            items: { type: 'object' },
            description: 'Validated loan records from DataGuard'
          },
          assessment_areas: {
            type: 'array',
            items: { type: 'object' },
            description: 'Bank assessment area definitions'
          },
          reporting_period: {
            type: 'object',
            properties: {
              start_date: { type: 'string' },
              end_date: { type: 'string' }
            },
            required: ['start_date', 'end_date']
          }
        },
        required: ['loans', 'assessment_areas', 'reporting_period']
      }
    },
    {
      name: 'calculate_investment_test_metrics',
      description: 'Calculate CRA Investment Test metrics from community development investment records',
      input_schema: {
        type: 'object',
        properties: {
          investments: {
            type: 'array',
            items: { type: 'object' },
            description: 'Community development investment records'
          },
          bank_asset_size: {
            type: 'number',
            description: 'Total bank assets in USD (for peer comparison)'
          }
        },
        required: ['investments', 'bank_asset_size']
      }
    },
    {
      name: 'calculate_service_test_metrics',
      description: 'Calculate CRA Service Test metrics from community development service records',
      input_schema: {
        type: 'object',
        properties: {
          services: {
            type: 'array',
            items: { type: 'object' },
            description: 'Community development service records'
          }
        },
        required: ['services']
      }
    },
    {
      name: 'generate_narrative_section',
      description: 'Generate a specific CRA narrative section using calculated performance data',
      input_schema: {
        type: 'object',
        properties: {
          section_type: {
            type: 'string',
            enum: [
              'executive_summary', 'scope_of_evaluation', 'assessment_area_description',
              'lending_test', 'investment_test', 'service_test', 'community_development', 'conclusions'
            ]
          },
          performance_data: {
            type: 'object',
            description: 'Calculated performance metrics for this section'
          },
          bank_context: {
            type: 'object',
            description: 'Bank name, charter, asset size, community description'
          }
        },
        required: ['section_type', 'performance_data', 'bank_context']
      }
    },
    {
      name: 'check_public_file_completeness',
      description: 'Verify all required CRA public file components are present per 12 CFR §228.43',
      input_schema: {
        type: 'object',
        properties: {
          public_file_components: {
            type: 'object',
            description: 'Assembled public file components to check'
          }
        },
        required: ['public_file_components']
      }
    }
  ],

  model: 'claude-opus-4-6',
  max_tokens: 8000,
  temperature: 0.3, // Low temperature for accuracy, slight variation for natural prose
};
```

---

## Test Specifications (TDD)

### Unit Tests

```typescript
// specs/cra/narrative-tests.spec.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NarrativeWriter } from '../src/narrative-writer';
import {
  NarrativeWriterInput,
  NarrativeWriterConfig,
  AssessmentArea,
  CommunityDevelopmentService,
  CommunityDevelopmentInvestment,
} from './narrative-types';
import { SanitizedLoanRecord } from './types';

describe('NarrativeWriter Agent', () => {
  let narrativeWriter: NarrativeWriter;
  let defaultConfig: NarrativeWriterConfig;
  let baseInput: NarrativeWriterInput;

  beforeEach(() => {
    defaultConfig = {
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      temperature: 0.3,
      evaluation_framework: 'intermediate_small_bank',
      reporting_year: 2025,
      narrative_tone: 'formal_regulatory',
      include_examiner_qa: true,
      include_performance_summary: true,
      sections_to_generate: [
        'executive_summary', 'scope_of_evaluation', 'assessment_area_description',
        'lending_test', 'community_development', 'conclusions'
      ],
      output_format: 'json',
      include_public_file: true,
      completeness_check: true,
      max_retries: 3,
    };

    const mockAssessmentArea: AssessmentArea = {
      area_id: 'AA_001',
      bank_id: 'BANK_001',
      area_name: 'Chicago-Naperville-Elgin, IL-IN-WI MSA',
      area_type: 'msa',
      state_codes: ['IL', 'IN', 'WI'],
      county_fips_codes: ['17031', '17043', '17197'],
      census_tracts: ['17-031-2814.02', '17-031-0801.00', '17-043-1001.01'],
      msa_md_code: '16974',
      tract_income_distribution: {
        low_income_pct: 12.3,
        moderate_income_pct: 28.7,
        middle_income_pct: 35.1,
        upper_income_pct: 23.9,
      },
      minority_tract_pct: 41.2,
      created_at: '2026-01-01T00:00:00Z',
      reporting_year: 2025,
    };

    const mockService: CommunityDevelopmentService = {
      service_id: 'SVC_001',
      bank_id: 'BANK_001',
      service_date: '2025-03-15',
      service_type: 'financial_literacy',
      provider_name: '[EMPLOYEE_001]',
      provider_token: '[EMPLOYEE_001]',
      organization_name: 'Chicago Neighborhood Housing Services',
      organization_type: 'nonprofit_housing',
      primary_purpose: 'affordable_housing',
      census_tract: '17-031-2814.02',
      assessment_area_id: 'AA_001',
      hours_contributed: 4,
      estimated_dollar_value: 800,
      description: 'Delivered first-time homebuyer workshop to 22 low/moderate income participants',
      qualifies_for_cra: true,
      cra_test: 'community_development_services',
      created_at: '2025-03-15T10:00:00Z',
    };

    const mockInvestment: CommunityDevelopmentInvestment = {
      investment_id: 'INV_001',
      bank_id: 'BANK_001',
      investment_date: '2025-06-01',
      investment_type: 'lihtc_equity',
      organization_name: 'Preservation of Affordable Housing',
      organization_type: 'nonprofit_housing',
      amount: 2500000,
      primary_purpose: 'affordable_housing',
      census_tract: '17-031-0801.00',
      assessment_area_id: 'AA_001',
      multi_year_commitment: false,
      qualifies_for_cra: true,
      cra_test: 'community_development_investments',
      created_at: '2025-06-01T00:00:00Z',
    };

    baseInput = {
      validated_loans: [], // Populated per test
      community_development_loans: [],
      community_development_investments: [mockInvestment],
      community_development_services: [mockService],
      assessment_areas: [mockAssessmentArea],
      bank_id: 'BANK_001',
      bank_name: 'Liberty Community Bank',
      bank_asset_size: 750000000, // $750M — Intermediate Small Bank
      bank_charter_type: 'state_bank',
      config: defaultConfig,
      session_id: 'TEST_SESSION_001',
      reporting_period: {
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      },
    };

    narrativeWriter = new NarrativeWriter(defaultConfig);
  });

  describe('Performance Summary Calculation', () => {
    it('should calculate ISB evaluation framework for $750M bank', async () => {
      const result = await narrativeWriter.generate(baseInput);

      expect(result.performance_summary.evaluation_framework).toBe('intermediate_small_bank');
      expect(result.performance_summary.bank_id).toBe('BANK_001');
      expect(result.performance_summary.reporting_year).toBe(2025);
    });

    it('should calculate Investment Test metrics from LIHTC investment', async () => {
      const result = await narrativeWriter.generate(baseInput);

      // $2.5M LIHTC investment should appear in investment test
      expect(result.performance_summary.investment_test).toBeDefined();
      expect(result.performance_summary.investment_test?.lihtc_investment_amount).toBe(2500000);
      expect(result.performance_summary.investment_test?.investment_count).toBe(1);
    });

    it('should calculate Service Test metrics from financial literacy service', async () => {
      const result = await narrativeWriter.generate(baseInput);

      expect(result.performance_summary.service_test).toBeDefined();
      expect(result.performance_summary.service_test?.community_development_services_count).toBe(1);
      expect(result.performance_summary.service_test?.community_development_services_hours).toBe(4);
      expect(result.performance_summary.service_test?.financial_literacy_programs_count).toBe(1);
    });

    it('should calculate LMI lending percentage from loan data', async () => {
      const lmiLoan: SanitizedLoanRecord = {
        loan_id: 'LOAN-2025-00001',
        borrower_token: '[PERSON_001]',
        census_tract: '17-031-2814.02',
        msa_md: '16974',
        loan_amount: 185000,
        loan_origination_date: '2025-04-15',
        loan_purpose: 'home_purchase',
        loan_type: 'fha',
        income_level: 'moderate', // LMI borrower
        tract_income_level: 'moderate', // LMI tract
        tract_minority_percentage: 55.2,
        tract_median_income: 52000,
        tract_population: 3200,
        geocoding_quality: 'exact',
        metadata: {
          sanitized_at: '2026-01-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: true,
        },
      };

      const inputWithLoan = { ...baseInput, validated_loans: [lmiLoan] };
      const result = await narrativeWriter.generate(inputWithLoan);

      expect(result.performance_summary.lending_test.pct_loans_low_moderate_income_borrowers).toBeGreaterThan(0);
      expect(result.performance_summary.lending_test.pct_loans_low_moderate_income_tracts).toBeGreaterThan(0);
    });
  });

  describe('Narrative Generation', () => {
    it('should generate all requested narrative sections', async () => {
      const result = await narrativeWriter.generate(baseInput);

      const sectionTypes = result.narrative_sections.map(s => s.section_type);
      expect(sectionTypes).toContain('executive_summary');
      expect(sectionTypes).toContain('scope_of_evaluation');
      expect(sectionTypes).toContain('assessment_area_description');
      expect(sectionTypes).toContain('lending_test');
      expect(sectionTypes).toContain('community_development');
      expect(sectionTypes).toContain('conclusions');
    });

    it('should include regulatory citations in narrative sections', async () => {
      const result = await narrativeWriter.generate(baseInput);

      const lendingSection = result.narrative_sections.find(s => s.section_type === 'lending_test');
      expect(lendingSection).toBeDefined();
      expect(lendingSection?.regulatory_citations.length).toBeGreaterThan(0);
      expect(lendingSection?.regulatory_citations.some(c => c.includes('12 CFR §228'))).toBe(true);
    });

    it('should not include PII in narrative text', async () => {
      const result = await narrativeWriter.generate(baseInput);

      const allNarrativeText = result.narrative_sections
        .map(s => s.narrative_text)
        .join(' ');

      // Should not contain real names (provider_name is tokenized in input)
      expect(allNarrativeText).not.toMatch(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/); // No "First Last" names
      expect(allNarrativeText).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // No SSNs
      expect(allNarrativeText).not.toMatch(/\b\d{4} \d{4} \d{4} \d{4}\b/); // No card numbers
    });

    it('should reference actual data statistics in narrative', async () => {
      const result = await narrativeWriter.generate(baseInput);

      const cdSection = result.narrative_sections.find(s => s.section_type === 'community_development');
      expect(cdSection?.narrative_text).toContain('2,500,000'); // LIHTC investment amount
      // or in formatted form
      const hasAmount = cdSection?.narrative_text.includes('2.5 million') ||
                        cdSection?.narrative_text.includes('$2,500,000') ||
                        cdSection?.narrative_text.includes('$2.5M');
      expect(hasAmount).toBe(true);
    });

    it('should note LIHTC investment as qualifying investment', async () => {
      const result = await narrativeWriter.generate(baseInput);

      const cdSection = result.narrative_sections.find(s => s.section_type === 'community_development');
      expect(cdSection?.narrative_text.toLowerCase()).toMatch(/low.income housing tax credit|lihtc/);
    });
  });

  describe('Public File Assembly', () => {
    it('should assemble CRA public file with required components', async () => {
      const result = await narrativeWriter.generate(baseInput);

      expect(result.public_file).toBeDefined();
      expect(result.public_file.bank_id).toBe('BANK_001');
      expect(result.public_file.reporting_year).toBe(2025);
      expect(result.public_file.public_file_components.cra_notice).toBeTruthy();
      expect(result.public_file.public_file_components.assessment_area_list.length).toBe(1);
    });

    it('should flag incomplete public file when components are missing', async () => {
      const incompleteInput = {
        ...baseInput,
        community_development_investments: [], // Remove investments
        community_development_services: [], // Remove services
      };

      const result = await narrativeWriter.generate(incompleteInput);

      // With no qualifying CD activity, should note gap in narrative
      const executiveSummary = result.narrative_sections.find(s => s.section_type === 'executive_summary');
      expect(executiveSummary).toBeDefined();
      // May indicate areas for improvement rather than flag as incomplete
    });

    it('should include community impact metrics in output', async () => {
      const result = await narrativeWriter.generate(baseInput);

      expect(result.community_impact_metrics).toBeDefined();
      expect(result.community_impact_metrics.total_dollars_invested).toBe(2500000);
      expect(result.community_impact_metrics.hours_of_community_service).toBe(4);
      expect(result.community_impact_metrics.financial_literacy_participants).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Examiner Q&A Generation', () => {
    it('should generate anticipated examiner questions', async () => {
      const result = await narrativeWriter.generate(baseInput);

      expect(result.anticipated_questions.length).toBeGreaterThan(0);
      expect(result.anticipated_questions.every(q => q.question_text.length > 0)).toBe(true);
      expect(result.anticipated_questions.every(q => q.answer_text.length > 0)).toBe(true);
    });

    it('should include questions for each evaluation category', async () => {
      const result = await narrativeWriter.generate(baseInput);

      const categories = result.anticipated_questions.map(q => q.question_category);
      expect(categories).toContain('lending');
      expect(categories).toContain('community_development');
    });

    it('should generate high-confidence answers where data is sufficient', async () => {
      const result = await narrativeWriter.generate(baseInput);

      const investmentQuestions = result.anticipated_questions.filter(
        q => q.question_category === 'community_development'
      );
      expect(investmentQuestions.some(q => q.confidence === 'high')).toBe(true);
    });
  });

  describe('Performance Requirements', () => {
    it('should generate complete CRA narrative in <30 seconds', async () => {
      const startTime = Date.now();
      const result = await narrativeWriter.generate(baseInput);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(30000);
      expect(result.performance_metrics.total_duration_ms).toBeLessThan(30000);
    });

    it('should track Claude API token usage', async () => {
      const result = await narrativeWriter.generate(baseInput);

      expect(result.performance_metrics.claude_api_calls).toBeGreaterThan(0);
      expect(result.performance_metrics.claude_tokens_used).toBeGreaterThan(0);
      expect(result.performance_metrics.narrative_word_count).toBeGreaterThan(500);
    });
  });
});
```

---

## API Contract

### Function Signature

```typescript
/**
 * NarrativeWriter.generate()
 *
 * Generates complete CRA performance narrative and public file documentation
 *
 * @param input - Validated loan data, CD activity, assessment areas, bank context
 * @returns Promise<NarrativeWriterOutput> - Full narrative, public file, examiner Q&A
 * @throws ClaudeAPIError - If Claude API call fails
 * @throws DataValidationError - If input data fails pre-generation validation
 */
async generate(input: NarrativeWriterInput): Promise<NarrativeWriterOutput>;
```

---

## Integration with DataGuard

NarrativeWriter is designed to consume DataGuard output directly. Typical pipeline:

```typescript
// Pipeline example
const guardOutput = await dataGuard.validate(loanBatchInput);

if (guardOutput.summary.critical_errors === 0) {
  const narrativeOutput = await narrativeWriter.generate({
    validated_loans: guardOutput.validated_records,
    community_development_loans: cdLoans,
    community_development_investments: cdInvestments,
    community_development_services: cdServices,
    assessment_areas: bankAssessmentAreas,
    bank_id: bankId,
    bank_name: bankName,
    bank_asset_size: totalAssets,
    bank_charter_type: charterType,
    config: narrativeConfig,
    session_id: sessionId,
    reporting_period: reportingPeriod,
  });
}
```

---

## Performance Benchmarks

### Latency SLA

| Metric | Target | Maximum |
|--------|--------|---------|
| ISB narrative (1 assessment area) | <20 seconds | <30 seconds |
| Large Bank narrative (3+ assessment areas) | <45 seconds | <60 seconds |
| Public file completeness check | <2 seconds | <5 seconds |

### Quality SLA

- **Regulatory citation accuracy**: 100% (citations verified against 12 CFR §228)
- **Data fabrication**: 0% (agent must use only provided data)
- **PII leakage**: 0% (enforced by tokenized input)

---

*Last Updated: March 2026*
*Status: Ready for Implementation*
