/**
 * CRA DataGuard — Schema Validator
 *
 * Pure, deterministic validation functions. No external dependencies.
 * Validates loan records against 12 CFR §228.42 requirements.
 *
 * Architecture note: Validation is intentionally pure (no Claude, no FFIEC API)
 * to meet the 10K records / <5 seconds SLA. Claude is only called once per batch
 * for exception report generation, not per-record.
 */

import type {
  SanitizedLoanRecord,
  LoanValidationError,
  ValidationSeverity,
  ValidationErrorType,
} from '../../../types/cra';

// ---------------------------------------------------------------------------
// Constants — regulatory citations
// ---------------------------------------------------------------------------

const REG_228_42 = '12 CFR §228.42';
const REG_228_42_A1 = '12 CFR §228.42(a)(1) — Required data fields for loan register';
const REG_228_42_A1_I = '12 CFR §228.42(a)(1)(i) — Census tract required for all loans';
const REG_228_42_A1_II = '12 CFR §228.42(a)(1)(ii) — MSA/MD required for assessment area mapping';
const REG_228_42_A2 = '12 CFR §228.42(a)(2) — Income level of borrower required';
const REG_228_42_B1 = '12 CFR §228.42(b)(1) — Gross annual revenue required for small business loans';
const REG_228_42_B2 = '12 CFR §228.42(b)(2) — NAICS code required for small business loans';

// ---------------------------------------------------------------------------
// Census tract validation
// ---------------------------------------------------------------------------

/**
 * Valid 11-digit census tract format: XX-XXX-XXXX.XX
 * Examples: 17-031-2814.02, 06-037-1001.01
 */
const CENSUS_TRACT_REGEX = /^\d{2}-\d{3}-\d{4}\.\d{2}$/;

export function isValidCensusTractFormat(tract: string): boolean {
  return CENSUS_TRACT_REGEX.test(tract);
}

// ---------------------------------------------------------------------------
// Valid enum sets
// ---------------------------------------------------------------------------

const VALID_LOAN_PURPOSES = new Set([
  'home_purchase',
  'home_improvement',
  'refinance',
  'small_business',
  'small_farm',
  'community_development',
]);

const VALID_LOAN_TYPES = new Set([
  'conventional',
  'fha',
  'va',
  'usda',
  'heloc',
  'commercial',
  'farm',
]);

const VALID_INCOME_LEVELS = new Set(['low', 'moderate', 'middle', 'upper']);

const SMALL_BUSINESS_PURPOSES = new Set(['small_business', 'small_farm']);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function error(
  loan_id: string,
  field: string,
  error_type: ValidationErrorType,
  severity: ValidationSeverity,
  current_value: unknown,
  regulatory_requirement: string,
  opts: {
    expected_value?: unknown;
    suggested_correction?: string;
    auto_correctable?: boolean;
  } = {},
): LoanValidationError {
  return {
    loan_id,
    field,
    error_type,
    severity,
    current_value,
    regulatory_requirement,
    expected_value: opts.expected_value,
    suggested_correction: opts.suggested_correction,
    auto_correctable: opts.auto_correctable ?? false,
  };
}

// ---------------------------------------------------------------------------
// Individual field validators
// ---------------------------------------------------------------------------

/**
 * Validates census tract format AND checks for known placeholder values.
 * County codes >= 900 (e.g. 999) are FIPS placeholders — not real counties.
 * Valid county FIPS codes: 001–840 per US Census Bureau.
 */
export function validateCensusTract(loan: SanitizedLoanRecord): LoanValidationError | null {
  const { loan_id, census_tract } = loan;

  if (census_tract === undefined || census_tract === null || census_tract === '') {
    return error(loan_id, 'census_tract', 'missing_required', 'critical', census_tract, REG_228_42_A1_I, {
      suggested_correction: 'Call FFIEC geocoding API using property address',
      auto_correctable: false,
    });
  }

  if (!isValidCensusTractFormat(census_tract)) {
    // Check if it looks like a reformattable 11-digit string
    const numericOnly = census_tract.replace(/[^0-9]/g, '');
    const isReformattable = numericOnly.length === 11;

    return error(loan_id, 'census_tract', 'census_tract_invalid', 'critical', census_tract, REG_228_42_A1_I, {
      expected_value: 'XX-XXX-XXXX.XX (11-digit FFIEC format)',
      suggested_correction: isReformattable
        ? `Reformat ${census_tract} to FFIEC format, then verify via FFIEC geocoding API`
        : 'Call FFIEC geocoding API using property address to obtain valid census tract',
      auto_correctable: isReformattable,
    });
  }

  // Format is valid — check for known FIPS placeholder values
  // County code is characters 3-5 (SS-CCC-...). Values >= 900 are placeholders.
  const countyCode = parseInt(census_tract.slice(3, 6), 10);
  if (countyCode >= 900) {
    return error(loan_id, 'census_tract', 'census_tract_invalid', 'critical', census_tract, REG_228_42_A1_I, {
      expected_value: 'Valid FFIEC census tract — county code must be < 900',
      suggested_correction: 'Call FFIEC geocoding API using property address to obtain valid census tract',
      auto_correctable: false,
    });
  }

  return null;
}

export function validateMsaMd(loan: SanitizedLoanRecord): LoanValidationError | null {
  if (!loan.msa_md || loan.msa_md.trim() === '') {
    return error(loan.loan_id, 'msa_md', 'missing_required', 'medium', loan.msa_md, REG_228_42_A1_II, {
      suggested_correction: 'Derive from census tract via FFIEC geocoding API',
      auto_correctable: false,
    });
  }
  return null;
}

export function validateLoanAmount(loan: SanitizedLoanRecord): LoanValidationError | null {
  const { loan_id, loan_amount } = loan;

  if (loan_amount === undefined || loan_amount === null) {
    return error(loan_id, 'loan_amount', 'missing_required', 'critical', loan_amount, REG_228_42_A1, {
      auto_correctable: false,
    });
  }

  if (loan_amount <= 0) {
    return error(loan_id, 'loan_amount', 'out_of_range', 'critical', loan_amount, REG_228_42_A1, {
      expected_value: 'Positive number (USD)',
      auto_correctable: false,
    });
  }

  // Soft range check — flag as LOW for human review
  if (loan_amount > 10_000_000) {
    return error(loan_id, 'loan_amount', 'out_of_range', 'low', loan_amount, REG_228_42_A1, {
      expected_value: 'Typically $1,000 - $10,000,000',
      suggested_correction: 'Verify loan amount with originating officer',
      auto_correctable: false,
    });
  }

  return null;
}

export function validateLoanPurpose(loan: SanitizedLoanRecord): LoanValidationError | null {
  if (!loan.loan_purpose || !VALID_LOAN_PURPOSES.has(loan.loan_purpose)) {
    return error(loan.loan_id, 'loan_purpose', 'invalid_format', 'critical', loan.loan_purpose, REG_228_42_A1, {
      expected_value: Array.from(VALID_LOAN_PURPOSES).join(' | '),
      auto_correctable: true,
    });
  }
  return null;
}

export function validateLoanType(loan: SanitizedLoanRecord): LoanValidationError | null {
  if (!loan.loan_type || !VALID_LOAN_TYPES.has(loan.loan_type)) {
    return error(loan.loan_id, 'loan_type', 'invalid_format', 'critical', loan.loan_type, REG_228_42_A1, {
      expected_value: Array.from(VALID_LOAN_TYPES).join(' | '),
      auto_correctable: false,
    });
  }
  return null;
}

export function validateIncomeLevel(
  loan: SanitizedLoanRecord,
  required: boolean,
): LoanValidationError | null {
  if (required && !loan.income_level) {
    return error(loan.loan_id, 'income_level', 'missing_required', 'high', loan.income_level, REG_228_42_A2, {
      expected_value: 'low | moderate | middle | upper',
      auto_correctable: false,
    });
  }

  if (loan.income_level && !VALID_INCOME_LEVELS.has(loan.income_level)) {
    return error(loan.loan_id, 'income_level', 'invalid_format', 'high', loan.income_level, REG_228_42_A2, {
      expected_value: 'low | moderate | middle | upper',
      auto_correctable: false,
    });
  }

  return null;
}

export function validateTractIncomeLevel(loan: SanitizedLoanRecord): LoanValidationError | null {
  if (!loan.tract_income_level || !VALID_INCOME_LEVELS.has(loan.tract_income_level)) {
    return error(loan.loan_id, 'tract_income_level', 'missing_required', 'high', loan.tract_income_level, REG_228_42_A1, {
      expected_value: 'low | moderate | middle | upper',
      suggested_correction: 'Derive from FFIEC census tract data',
      auto_correctable: false,
    });
  }
  return null;
}

export function validateOriginationDate(loan: SanitizedLoanRecord): LoanValidationError | null {
  const { loan_id, loan_origination_date } = loan;

  if (!loan_origination_date) {
    return error(loan_id, 'loan_origination_date', 'missing_required', 'critical', loan_origination_date, REG_228_42_A1, {
      auto_correctable: false,
    });
  }

  // Check if ISO 8601 date (YYYY-MM-DD)
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO_DATE.test(loan_origination_date)) {
    // Check if it's a US date format that can be auto-corrected
    const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const usMatch = US_DATE.exec(loan_origination_date);

    return error(loan_id, 'loan_origination_date', 'invalid_format', 'medium', loan_origination_date, REG_228_42_A1, {
      expected_value: 'ISO 8601 date: YYYY-MM-DD',
      suggested_correction: usMatch !== null
        ? `Convert ${loan_origination_date} to ISO 8601: ${usMatch[3] ?? ''}-${String(parseInt(usMatch[1] ?? '0', 10)).padStart(2, '0')}-${String(parseInt(usMatch[2] ?? '0', 10)).padStart(2, '0')}`
        : 'Convert to ISO 8601 format (YYYY-MM-DD)',
      auto_correctable: usMatch !== null,
    });
  }

  // Validate it's a real date
  const parsed = new Date(loan_origination_date);
  if (isNaN(parsed.getTime())) {
    return error(loan_id, 'loan_origination_date', 'invalid_format', 'critical', loan_origination_date, REG_228_42_A1, {
      auto_correctable: false,
    });
  }

  return null;
}

export function validateSmallBusinessFields(loan: SanitizedLoanRecord): LoanValidationError[] {
  const errors: LoanValidationError[] = [];

  if (!SMALL_BUSINESS_PURPOSES.has(loan.loan_purpose)) {
    return errors;
  }

  if (!loan.annual_revenue || loan.annual_revenue <= 0) {
    errors.push(error(loan.loan_id, 'annual_revenue', 'missing_required', 'high', loan.annual_revenue, REG_228_42_B1, {
      auto_correctable: false,
    }));
  }

  if (!loan.naics_code) {
    errors.push(error(loan.loan_id, 'naics_code', 'missing_required', 'high', loan.naics_code, REG_228_42_B2, {
      expected_value: '6-digit NAICS code',
      auto_correctable: false,
    }));
  } else {
    const NAICS_REGEX = /^\d{1,6}$/;
    if (!NAICS_REGEX.test(loan.naics_code)) {
      errors.push(error(loan.loan_id, 'naics_code', 'invalid_format', 'high', loan.naics_code, REG_228_42_B2, {
        expected_value: '6-digit numeric NAICS code (e.g. 722511)',
        auto_correctable: loan.naics_code.replace(/\D/g, '').length <= 6,
      }));
    } else if (loan.naics_code.length < 6) {
      // Short NAICS — flagged here but auto-corrector will pad it
      errors.push(error(loan.loan_id, 'naics_code', 'invalid_format', 'medium', loan.naics_code, REG_228_42_B2, {
        expected_value: '6-digit NAICS code',
        suggested_correction: `Pad to 6 digits: ${loan.naics_code.padEnd(6, '0')}`,
        auto_correctable: true,
      }));
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Duplicate detection (batch-level check)
// ---------------------------------------------------------------------------

export function detectDuplicates(loans: SanitizedLoanRecord[]): LoanValidationError[] {
  const seen = new Map<string, number>();
  const errors: LoanValidationError[] = [];

  loans.forEach((loan, idx) => {
    const prev = seen.get(loan.loan_id);
    if (prev !== undefined) {
      errors.push(
        error(loan.loan_id, 'loan_id', 'duplicate', 'high', loan.loan_id, REG_228_42, {
          expected_value: 'Unique loan identifier',
          suggested_correction: `Duplicate of record at index ${prev} in this batch`,
          auto_correctable: false,
        }),
      );
    } else {
      seen.set(loan.loan_id, idx);
    }
  });

  return errors;
}

// ---------------------------------------------------------------------------
// Master validator — runs all checks on one record
// ---------------------------------------------------------------------------

export function validateRecord(
  loan: SanitizedLoanRecord,
  opts: { requireIncomeLevel: boolean; requireMsaMd: boolean },
): LoanValidationError[] {
  const errors: LoanValidationError[] = [];

  const checks = [
    validateCensusTract(loan),
    opts.requireMsaMd ? validateMsaMd(loan) : null,
    validateLoanAmount(loan),
    validateLoanPurpose(loan),
    validateLoanType(loan),
    validateIncomeLevel(loan, opts.requireIncomeLevel && !SMALL_BUSINESS_PURPOSES.has(loan.loan_purpose)),
    validateTractIncomeLevel(loan),
    validateOriginationDate(loan),
  ];

  checks.forEach((e) => {
    if (e !== null) errors.push(e);
  });

  // Small business additional checks
  errors.push(...validateSmallBusinessFields(loan));

  return errors;
}
