/**
 * CRA NarrativeWriter agent types.
 * Defines all interfaces for narrative generation, public file assembly,
 * examiner Q&A, and community impact metrics.
 *
 * PII note: all inputs must be tokenized before reaching this layer.
 * Provider names are stored as [EMPLOYEE_001] tokens, not real names.
 *
 * AGENT BOUNDARIES:
 *   - NarrativeWriter generates draft documentation only.
 *   - It does NOT assign CRA ratings (examiner function only).
 *   - All output carries draft_status: true until compliance officer acknowledges.
 */

import type { SanitizedLoanRecord, ReportingPeriod } from './cra';

export type { SanitizedLoanRecord, ReportingPeriod };

// ---------------------------------------------------------------------------
// Assessment area
// ---------------------------------------------------------------------------

/**
 * CRA Assessment Area definition per 12 CFR §228.41
 */
export interface AssessmentArea {
  readonly area_id: string;
  readonly bank_id: string;
  readonly area_name: string;
  readonly area_type: 'msa' | 'non_msa_county' | 'combined';
  readonly state_codes: string[];
  readonly county_fips_codes: string[];
  readonly census_tracts: string[];
  readonly msa_md_code?: string;
  readonly tract_income_distribution: {
    readonly low_income_pct: number;
    readonly moderate_income_pct: number;
    readonly middle_income_pct: number;
    readonly upper_income_pct: number;
  };
  readonly minority_tract_pct: number;
  readonly created_at: string;
  readonly reporting_year: number;
}

// ---------------------------------------------------------------------------
// Community development activity
// ---------------------------------------------------------------------------

/**
 * Community Development Service record (financial literacy, board service, etc.)
 */
export interface CommunityDevelopmentService {
  readonly service_id: string;
  readonly bank_id: string;
  readonly service_date: string;
  readonly service_type:
    | 'financial_literacy'
    | 'technical_assistance'
    | 'board_service'
    | 'fundraising'
    | 'homebuyer_counseling'
    | 'small_business_counseling';
  readonly provider_name: string;   // Must be tokenized: [EMPLOYEE_001]
  readonly provider_token: string;  // [EMPLOYEE_001]
  readonly organization_name: string;
  readonly organization_type:
    | 'cdfi'
    | 'nonprofit_housing'
    | 'small_business_development'
    | 'community_service'
    | 'educational_institution'
    | 'government';
  readonly primary_purpose:
    | 'affordable_housing'
    | 'community_services'
    | 'economic_development'
    | 'revitalize_stabilize';
  readonly census_tract?: string;
  readonly assessment_area_id: string;
  readonly hours_contributed: number;
  readonly estimated_dollar_value?: number;
  readonly description: string;
  readonly qualifies_for_cra: boolean;
  readonly cra_test: 'community_development_services';
  readonly created_at: string;
}

/**
 * Community Development Investment record (LIHTC, NMTC, bonds, grants, equity)
 */
export interface CommunityDevelopmentInvestment {
  readonly investment_id: string;
  readonly bank_id: string;
  readonly investment_date: string;
  readonly investment_type:
    | 'lihtc_equity'
    | 'nmtc_equity'
    | 'affordable_housing_bond'
    | 'cdc_equity'
    | 'small_business_investment'
    | 'grant';
  readonly organization_name: string;
  readonly organization_type: CommunityDevelopmentService['organization_type'];
  readonly amount: number;
  readonly primary_purpose: CommunityDevelopmentService['primary_purpose'];
  readonly census_tract?: string;
  readonly assessment_area_id: string;
  readonly multi_year_commitment: boolean;
  readonly commitment_end_date?: string;
  readonly qualifies_for_cra: boolean;
  readonly cra_test: 'community_development_investments';
  readonly created_at: string;
}

/**
 * Summary of a qualifying community development loan
 */
export interface CommunityDevelopmentLoanSummary {
  readonly loan_id: string;  // Anonymized, not PII
  readonly approval_date: string;
  readonly loan_amount: number;
  readonly primary_purpose: CommunityDevelopmentService['primary_purpose'];
  readonly assessment_area_id: string;
  readonly census_tract?: string;
  readonly organization_type: string;
  readonly qualifies_as:
    | 'community_development_loan'
    | 'small_business_loan'
    | 'small_farm_loan';
}

// ---------------------------------------------------------------------------
// Performance summary
// ---------------------------------------------------------------------------

type CRATestRating =
  | 'outstanding'
  | 'high_satisfactory'
  | 'low_satisfactory'
  | 'needs_to_improve'
  | 'substantial_noncompliance';

/**
 * CRA Performance Summary across all three tests.
 * IMPORTANT: Ratings here are draft classifications for internal preparation only.
 * Official CRA ratings are assigned exclusively by OCC, Federal Reserve, or FDIC examiners.
 */
export interface CRAPerformanceSummary {
  readonly bank_id: string;
  readonly reporting_year: number;
  readonly evaluation_framework:
    | 'large_bank'
    | 'intermediate_small_bank'
    | 'small_bank'
    | 'strategic_plan';

  readonly lending_test: {
    readonly loan_to_deposit_ratio: number;
    readonly peer_comparison_ratio?: number;
    readonly pct_loans_in_assessment_areas: number;
    readonly pct_loans_low_moderate_income_tracts: number;
    readonly pct_loans_low_moderate_income_borrowers: number;
    readonly community_development_loans_count: number;
    readonly community_development_loans_amount: number;
    readonly small_business_loans_count: number;
    readonly small_business_loans_amount: number;
    readonly hmda_loans_count: number;
    readonly hmda_loans_amount: number;
    readonly lending_test_rating: CRATestRating;
  };

  readonly investment_test?: {
    readonly total_investment_amount: number;
    readonly lihtc_investment_amount: number;
    readonly nmtc_investment_amount: number;
    readonly other_investment_amount: number;
    readonly investment_count: number;
    readonly responsiveness_to_credit_needs: 'excellent' | 'good' | 'adequate' | 'poor';
    readonly investment_test_rating: CRATestRating;
  };

  readonly service_test?: {
    readonly retail_services_delivery: 'excellent' | 'good' | 'adequate' | 'poor';
    readonly community_development_services_count: number;
    readonly community_development_services_hours: number;
    readonly financial_literacy_programs_count: number;
    readonly participants_reached: number;
    readonly service_test_rating: CRATestRating;
  };

  readonly overall_rating:
    | 'outstanding'
    | 'satisfactory'
    | 'needs_to_improve'
    | 'substantial_noncompliance';
  readonly overall_rating_justification: string;
}

// ---------------------------------------------------------------------------
// Narrative sections
// ---------------------------------------------------------------------------

/**
 * CRA Narrative section (maps to CRA Performance Evaluation structure)
 */
export interface CRANarrativeSection {
  readonly section_id: string;
  readonly section_title: string;
  readonly section_type:
    | 'executive_summary'
    | 'scope_of_evaluation'
    | 'assessment_area_description'
    | 'lending_test'
    | 'investment_test'
    | 'service_test'
    | 'community_development'
    | 'conclusions';
  readonly narrative_text: string;
  readonly supporting_data: Record<string, unknown>;
  readonly regulatory_citations: string[];
  readonly word_count: number;
}

// ---------------------------------------------------------------------------
// Public file
// ---------------------------------------------------------------------------

/**
 * CRA public file completeness check results per 12 CFR §228.43(b)
 */
export interface PublicFileCompletenessCheck {
  readonly is_complete: boolean;
  readonly missing_components: string[];
  readonly warnings: string[];
  readonly last_updated: string;
  readonly next_required_update: string;
}

/**
 * Anticipated examiner question and supporting answer
 */
export interface ExaminerQA {
  readonly question_id: string;
  readonly question_category:
    | 'lending'
    | 'investment'
    | 'service'
    | 'community_development'
    | 'assessment_areas';
  readonly question_text: string;
  readonly answer_text: string;
  readonly supporting_data_references: string[];
  readonly confidence: 'high' | 'medium' | 'low';
}

/**
 * Complete CRA Public File package (12 CFR §228.43)
 */
export interface CRAPublicFile {
  readonly bank_id: string;
  readonly generated_at: string;
  readonly reporting_year: number;

  readonly public_file_components: {
    readonly cra_notice: string;
    readonly performance_evaluation_copy?: string;
    readonly assessment_area_list: AssessmentArea[];
    readonly branch_locations: string;
    readonly hmda_disclosure?: string;
    readonly small_business_loan_data?: string;
    readonly community_development_loan_list: CommunityDevelopmentLoanSummary[];
    readonly community_development_investment_list: CommunityDevelopmentInvestment[];
    readonly community_development_service_list: CommunityDevelopmentService[];
    readonly annual_cra_activity_report: string;
  };

  readonly narrative_sections: CRANarrativeSection[];
  readonly performance_summary: CRAPerformanceSummary;
  readonly anticipated_questions: ExaminerQA[];

  readonly format: 'pdf' | 'docx' | 'json';
  readonly document_url?: string;
  readonly is_complete: boolean;
  readonly completeness_check: PublicFileCompletenessCheck;
}

// ---------------------------------------------------------------------------
// Agent config + I/O
// ---------------------------------------------------------------------------

/**
 * NarrativeWriter agent configuration
 */
export interface NarrativeWriterConfig {
  readonly model: 'claude-opus-4-6' | 'claude-sonnet-4-6';
  readonly max_tokens: number;
  readonly temperature: number;

  readonly evaluation_framework: 'large_bank' | 'intermediate_small_bank' | 'small_bank';
  readonly reporting_year: number;

  readonly narrative_tone: 'formal_regulatory' | 'plain_language';
  readonly include_examiner_qa: boolean;
  readonly include_performance_summary: boolean;
  readonly sections_to_generate: CRANarrativeSection['section_type'][];

  readonly output_format: 'pdf' | 'docx' | 'json';
  readonly include_public_file: boolean;
  readonly completeness_check: boolean;

  readonly max_retries: number;
}

/**
 * Input to NarrativeWriter agent
 */
export interface NarrativeWriterInput {
  readonly validated_loans: SanitizedLoanRecord[];
  readonly community_development_loans: CommunityDevelopmentLoanSummary[];
  readonly community_development_investments: CommunityDevelopmentInvestment[];
  readonly community_development_services: CommunityDevelopmentService[];
  readonly assessment_areas: AssessmentArea[];
  readonly bank_id: string;
  readonly bank_name: string;
  readonly bank_asset_size: number;
  readonly bank_charter_type:
    | 'national_bank'
    | 'state_bank'
    | 'savings_association'
    | 'credit_union';
  readonly config: NarrativeWriterConfig;
  readonly session_id: string;
  readonly reporting_period: ReportingPeriod;
}

/**
 * Output from NarrativeWriter agent.
 * draft_status is always true — compliance officer must acknowledge before regulatory use.
 */
export interface NarrativeWriterOutput {
  readonly session_id: string;
  readonly generated_at: string;
  readonly reporting_period: ReportingPeriod;
  readonly draft_status: true;  // Always true — never false
  readonly performance_summary: CRAPerformanceSummary;
  readonly narrative_sections: CRANarrativeSection[];
  readonly public_file: CRAPublicFile;
  readonly anticipated_questions: ExaminerQA[];
  readonly community_impact_metrics: {
    readonly total_dollars_invested: number;
    readonly total_loans_to_lmi: number;
    readonly total_lmi_loan_amount: number;
    readonly financial_literacy_participants: number;
    readonly hours_of_community_service: number;
    readonly affordable_housing_units_supported: number;
    readonly small_businesses_supported: number;
  };
  readonly document_url?: string;
  readonly performance_metrics: {
    readonly total_duration_ms: number;
    readonly claude_api_calls: number;
    readonly claude_tokens_used: number;
    readonly narrative_word_count: number;
  };
}

// ---------------------------------------------------------------------------
// Internal calculator output types (used by performanceCalculator.ts)
// ---------------------------------------------------------------------------

export interface LendingTestMetrics {
  readonly pct_loans_in_assessment_areas: number;
  readonly pct_loans_low_moderate_income_tracts: number;
  readonly pct_loans_low_moderate_income_borrowers: number;
  readonly hmda_loans_count: number;
  readonly hmda_loans_amount: number;
  readonly small_business_loans_count: number;
  readonly small_business_loans_amount: number;
  readonly community_development_loans_count: number;
  readonly community_development_loans_amount: number;
}

export interface InvestmentTestMetrics {
  readonly total_investment_amount: number;
  readonly lihtc_investment_amount: number;
  readonly nmtc_investment_amount: number;
  readonly other_investment_amount: number;
  readonly investment_count: number;
  readonly qualifying_investment_count: number;
}

export interface ServiceTestMetrics {
  readonly total_services_count: number;
  readonly total_hours: number;
  readonly financial_literacy_count: number;
  readonly participants_reached: number;
}

export interface CommunityImpactMetrics {
  readonly total_dollars_invested: number;
  readonly total_loans_to_lmi: number;
  readonly total_lmi_loan_amount: number;
  readonly financial_literacy_participants: number;
  readonly hours_of_community_service: number;
  readonly affordable_housing_units_supported: number;
  readonly small_businesses_supported: number;
}

// ---------------------------------------------------------------------------
// Chat agent types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatInput {
  narrative_session_id: string;  // links to NarrativeWriter run
  message: string;               // compliance officer's question
  conversation_id?: string;      // UUID of existing cra.chat_sessions row, if continuing
  bank_id: string;
  session_id: string;            // request session ID for logging
}

export interface ChatOutput {
  conversation_id: string;       // UUID of cra.chat_sessions row
  message: string;               // Claude's response
  sources: string[];             // e.g., ['Lending Test Analysis', 'Community Development']
  draft_notice: string;          // Always present -- warns data is draft
  performance_metrics: {
    total_duration_ms: number;
    claude_api_calls: number;
    claude_tokens_used: number;
  };
}

export interface ChatAgentConfig {
  model: 'claude-sonnet-4-6';
  max_tokens: number;            // 2000 -- chat responses are shorter than narratives
  temperature: number;           // 0.3
}
