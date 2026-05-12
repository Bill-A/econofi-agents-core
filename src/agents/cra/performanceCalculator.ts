/**
 * CRA Performance Calculator
 *
 * Pure TypeScript functions with no I/O. All calculations are deterministic.
 * These feed Claude with pre-computed metrics so Claude only narrates — never calculates.
 *
 * Functions:
 *   - calculateLendingTestMetrics
 *   - calculateInvestmentTestMetrics
 *   - calculateServiceTestMetrics
 *   - calculateCommunityImpactMetrics
 */

import type { SanitizedLoanRecord } from '../../types/cra';
import type {
  AssessmentArea,
  CommunityDevelopmentInvestment,
  CommunityDevelopmentService,
  LendingTestMetrics,
  InvestmentTestMetrics,
  ServiceTestMetrics,
  CommunityImpactMetrics,
} from '../../types/cra-narrative';

// ---------------------------------------------------------------------------
// Lending Test
// ---------------------------------------------------------------------------

/**
 * Calculate CRA Lending Test performance metrics from validated loan register.
 *
 * @param loans - Validated loan records from DataGuard (PII-sanitized)
 * @param assessmentAreas - Bank's defined assessment areas
 * @returns Lending test metrics for use in narrative generation
 */
export function calculateLendingTestMetrics(
  loans: SanitizedLoanRecord[],
  assessmentAreas: AssessmentArea[],
): LendingTestMetrics {
  if (loans.length === 0) {
    return {
      pct_loans_in_assessment_areas: 0,
      pct_loans_low_moderate_income_tracts: 0,
      pct_loans_low_moderate_income_borrowers: 0,
      hmda_loans_count: 0,
      hmda_loans_amount: 0,
      small_business_loans_count: 0,
      small_business_loans_amount: 0,
      community_development_loans_count: 0,
      community_development_loans_amount: 0,
    };
  }

  // Build a set of all census tracts in any assessment area
  const assessmentAreaTracts = new Set<string>();
  for (const area of assessmentAreas) {
    for (const tract of area.census_tracts) {
      assessmentAreaTracts.add(tract);
    }
  }

  let loansInAssessmentAreas = 0;
  let loansInLmiTracts = 0;
  let loansToLmiBorrowers = 0;
  let totalAmount = 0;
  let smallBusinessCount = 0;
  let smallBusinessAmount = 0;
  let communityDevelopmentCount = 0;
  let communityDevelopmentAmount = 0;

  for (const loan of loans) {
    totalAmount += loan.loan_amount;

    // Assessment area check
    if (assessmentAreaTracts.has(loan.census_tract)) {
      loansInAssessmentAreas += 1;
    }

    // LMI tract check
    if (loan.tract_income_level === 'low' || loan.tract_income_level === 'moderate') {
      loansInLmiTracts += 1;
    }

    // LMI borrower check
    if (loan.income_level === 'low' || loan.income_level === 'moderate') {
      loansToLmiBorrowers += 1;
    }

    // Small business / small farm
    if (loan.loan_purpose === 'small_business' || loan.loan_purpose === 'small_farm') {
      smallBusinessCount += 1;
      smallBusinessAmount += loan.loan_amount;
    }

    // Community development loans
    if (loan.loan_purpose === 'community_development') {
      communityDevelopmentCount += 1;
      communityDevelopmentAmount += loan.loan_amount;
    }
  }

  const total = loans.length;

  return {
    pct_loans_in_assessment_areas: round2((loansInAssessmentAreas / total) * 100),
    pct_loans_low_moderate_income_tracts: round2((loansInLmiTracts / total) * 100),
    pct_loans_low_moderate_income_borrowers: round2((loansToLmiBorrowers / total) * 100),
    hmda_loans_count: total,
    hmda_loans_amount: totalAmount,
    small_business_loans_count: smallBusinessCount,
    small_business_loans_amount: smallBusinessAmount,
    community_development_loans_count: communityDevelopmentCount,
    community_development_loans_amount: communityDevelopmentAmount,
  };
}

// ---------------------------------------------------------------------------
// Investment Test
// ---------------------------------------------------------------------------

/**
 * Calculate CRA Investment Test metrics from community development investment records.
 *
 * @param investments - Community development investment records
 * @param bankAssetSize - Total bank assets in USD (for context, not calculation)
 * @returns Investment test metrics
 */
export function calculateInvestmentTestMetrics(
  investments: CommunityDevelopmentInvestment[],
  _bankAssetSize: number,
): InvestmentTestMetrics {
  let totalAmount = 0;
  let lihtcAmount = 0;
  let nmtcAmount = 0;
  let otherAmount = 0;
  let qualifyingCount = 0;

  for (const inv of investments) {
    totalAmount += inv.amount;

    if (inv.investment_type === 'lihtc_equity') {
      lihtcAmount += inv.amount;
    } else if (inv.investment_type === 'nmtc_equity') {
      nmtcAmount += inv.amount;
    } else {
      otherAmount += inv.amount;
    }

    if (inv.qualifies_for_cra) {
      qualifyingCount += 1;
    }
  }

  return {
    total_investment_amount: totalAmount,
    lihtc_investment_amount: lihtcAmount,
    nmtc_investment_amount: nmtcAmount,
    other_investment_amount: otherAmount,
    investment_count: investments.length,
    qualifying_investment_count: qualifyingCount,
  };
}

// ---------------------------------------------------------------------------
// Service Test
// ---------------------------------------------------------------------------

/**
 * Calculate CRA Service Test metrics from community development service records.
 *
 * Note: participants_reached defaults to 0. The current data model does not
 * include a participant count field on service records. This is a known data
 * gap — banks should add participant tracking to their service records.
 *
 * @param services - Community development service records
 * @returns Service test metrics
 */
export function calculateServiceTestMetrics(
  services: CommunityDevelopmentService[],
): ServiceTestMetrics {
  let totalHours = 0;
  let financialLiteracyCount = 0;

  for (const svc of services) {
    totalHours += svc.hours_contributed;

    if (svc.service_type === 'financial_literacy') {
      financialLiteracyCount += 1;
    }
  }

  return {
    total_services_count: services.length,
    total_hours: totalHours,
    financial_literacy_count: financialLiteracyCount,
    participants_reached: 0,  // No participant count in data model — see note above
  };
}

// ---------------------------------------------------------------------------
// Community Impact Metrics
// ---------------------------------------------------------------------------

/**
 * Calculate community impact metrics for board reporting and public file.
 *
 * @param loans - Validated loan records
 * @param investments - Community development investment records
 * @param services - Community development service records
 * @returns Aggregated community impact statistics
 */
export function calculateCommunityImpactMetrics(
  loans: SanitizedLoanRecord[],
  investments: CommunityDevelopmentInvestment[],
  services: CommunityDevelopmentService[],
): CommunityImpactMetrics {
  // Total qualifying investment dollars
  const totalDollarsInvested = investments
    .filter((inv) => inv.qualifies_for_cra)
    .reduce((sum, inv) => sum + inv.amount, 0);

  // LMI loans (borrower income OR tract income is low/moderate)
  const lmiLoans = loans.filter(
    (loan) =>
      loan.income_level === 'low' ||
      loan.income_level === 'moderate' ||
      loan.tract_income_level === 'low' ||
      loan.tract_income_level === 'moderate',
  );
  const totalLoansToLmi = lmiLoans.length;
  const totalLmiLoanAmount = lmiLoans.reduce((sum, loan) => sum + loan.loan_amount, 0);

  // Service metrics
  const totalHours = services.reduce((sum, svc) => sum + svc.hours_contributed, 0);

  // LIHTC/NMTC affordable housing — count qualifying investments
  const affordableHousingUnits = investments.filter(
    (inv) =>
      (inv.investment_type === 'lihtc_equity' || inv.investment_type === 'nmtc_equity') &&
      inv.qualifies_for_cra,
  ).length;

  // Small business loans
  const smallBusinessesSupported = loans.filter(
    (loan) => loan.loan_purpose === 'small_business' || loan.loan_purpose === 'small_farm',
  ).length;

  return {
    total_dollars_invested: totalDollarsInvested,
    total_loans_to_lmi: totalLoansToLmi,
    total_lmi_loan_amount: totalLmiLoanAmount,
    financial_literacy_participants: 0,  // No participant count in data model
    hours_of_community_service: totalHours,
    affordable_housing_units_supported: affordableHousingUnits,
    small_businesses_supported: smallBusinessesSupported,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
