/**
 * CRA Public File Assembler
 *
 * Pure TypeScript functions (no I/O) that assemble the required CRA public file
 * components per 12 CFR §228.43(b).
 *
 * Functions:
 *   - assembleCRANotice       — Standard CRA lobby notice text
 *   - checkPublicFileCompleteness — Validates required components
 *   - assemblePublicFile      — Builds the complete CRAPublicFile object
 */

import type {
  AssessmentArea,
  CRANarrativeSection,
  CRAPerformanceSummary,
  CRAPublicFile,
  ExaminerQA,
  NarrativeWriterInput,
  PublicFileCompletenessCheck,
} from '../../types/cra-narrative';

// ---------------------------------------------------------------------------
// CRA Notice
// ---------------------------------------------------------------------------

/**
 * Returns the standard CRA lobby notice text per 12 CFR §228.44.
 * Every bank subject to CRA must post this notice in each facility.
 *
 * @param bankName - Institution name (not PII — bank name is public)
 * @returns Standard notice text
 */
export function assembleCRANotice(bankName: string): string {
  return [
    `COMMUNITY REINVESTMENT ACT NOTICE`,
    ``,
    `${bankName} is required by federal law to help meet the credit needs`,
    `of the communities in which we operate, including low- and moderate-income`,
    `neighborhoods, consistent with safe and sound banking practices.`,
    ``,
    `The Community Reinvestment Act (CRA) requires federal banking regulators to`,
    `periodically evaluate our record of meeting community credit needs. This`,
    `evaluation, and any public section of a CRA performance evaluation prepared`,
    `by the bank's federal supervisor, are available for review in our main office.`,
    ``,
    `You may also obtain information about our most recent CRA performance`,
    `evaluation by contacting us directly.`,
    ``,
    `This institution is examined by:`,
    `Federal Reserve System, Office of the Comptroller of the Currency, or`,
    `Federal Deposit Insurance Corporation (as applicable).`,
    ``,
    `12 CFR §228.44`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Public File Completeness Check
// ---------------------------------------------------------------------------

/**
 * Checks that required CRA public file components are present per 12 CFR §228.43(b).
 *
 * Required components:
 *   - cra_notice (required lobby posting)
 *   - assessment_area_list (must not be empty)
 *   - community_development_loan_list (required for Large and ISB banks)
 *
 * Optional components produce warnings when missing, not errors.
 *
 * @param components - Public file components to check
 * @returns Completeness check result
 */
export function checkPublicFileCompleteness(
  components: CRAPublicFile['public_file_components'],
): PublicFileCompletenessCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();

  // Required: CRA notice
  if (!components.cra_notice || components.cra_notice.trim().length === 0) {
    missing.push('cra_notice');
  }

  // Required: Assessment area list must not be empty
  if (!components.assessment_area_list || components.assessment_area_list.length === 0) {
    missing.push('assessment_area_list');
  }

  // Required: Community development loan list (may be empty list but must be present)
  if (!Array.isArray(components.community_development_loan_list)) {
    missing.push('community_development_loan_list');
  }

  // Optional — warn if missing
  if (!components.performance_evaluation_copy) {
    warnings.push('performance_evaluation_copy: Most recent CRA performance evaluation copy not provided.');
  }

  if (!components.hmda_disclosure) {
    warnings.push('hmda_disclosure: HMDA public disclosure URL not provided.');
  }

  if (!components.small_business_loan_data) {
    warnings.push('small_business_loan_data: Small business loan data URL not provided.');
  }

  // Calculate next required update (annual — one year from now)
  const nextUpdate = new Date(now);
  nextUpdate.setFullYear(nextUpdate.getFullYear() + 1);

  return {
    is_complete: missing.length === 0,
    missing_components: missing,
    warnings,
    last_updated: now,
    next_required_update: nextUpdate.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public File Assembly
// ---------------------------------------------------------------------------

/**
 * Assembles the complete CRA public file from narrative output and input data.
 *
 * @param input - Original NarrativeWriter input
 * @param narrativeSections - Generated narrative sections from Claude
 * @param performanceSummary - Performance summary from Claude
 * @param anticipatedQuestions - Examiner Q&A from Claude
 * @returns Complete CRAPublicFile ready for compliance officer review
 */
export function assemblePublicFile(
  input: NarrativeWriterInput,
  narrativeSections: CRANarrativeSection[],
  performanceSummary: CRAPerformanceSummary,
  anticipatedQuestions: ExaminerQA[],
): CRAPublicFile {
  const generatedAt = new Date().toISOString();
  const reportingYear = input.config.reporting_year;
  const craNotice = assembleCRANotice(input.bank_name);

  const components: CRAPublicFile['public_file_components'] = {
    cra_notice: craNotice,
    assessment_area_list: input.assessment_areas as AssessmentArea[],
    branch_locations: `[Branch locations to be populated by bank — 12 CFR §228.43(b)(5)]`,
    community_development_loan_list: input.community_development_loans,
    community_development_investment_list: input.community_development_investments,
    community_development_service_list: input.community_development_services,
    annual_cra_activity_report: `[Annual CRA activity report for ${reportingYear} — to be populated by bank]`,
  };

  const completenessCheck = checkPublicFileCompleteness(components);

  return {
    bank_id: input.bank_id,
    generated_at: generatedAt,
    reporting_year: reportingYear,
    public_file_components: components,
    narrative_sections: narrativeSections,
    performance_summary: performanceSummary,
    anticipated_questions: anticipatedQuestions,
    format: input.config.output_format,
    is_complete: completenessCheck.is_complete,
    completeness_check: completenessCheck,
  };
}
