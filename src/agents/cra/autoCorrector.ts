/**
 * CRA DataGuard — Auto-Corrector
 *
 * Pure, deterministic format normalization rules.
 * Only applies corrections with confidence >= threshold (default 80).
 * Every correction produces a full audit trail entry.
 *
 * AGENT BOUNDARIES: Auto-corrections are suggestions, not authoritative conclusions.
 * All corrections are written to cra.auto_corrections for human review.
 */

import type { SanitizedLoanRecord, LoanAutoCorrection, CorrectionType } from '../../types/cra';

const CORRECTED_BY = 'DataGuard Agent v1.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function correction(
  loan_id: string,
  field: string,
  original_value: unknown,
  corrected_value: unknown,
  correction_type: CorrectionType,
  confidence: number,
  correction_rule: string,
): LoanAutoCorrection {
  return {
    loan_id,
    field,
    original_value,
    corrected_value,
    correction_type,
    confidence,
    audit_trail: {
      corrected_at: new Date().toISOString(),
      corrected_by: CORRECTED_BY,
      correction_rule,
    },
  };
}

// ---------------------------------------------------------------------------
// Census tract format normalization
//
// Handles the common case where a bank exports tracts without dashes/period:
//   "17031281402" → "17-031-2814.02"
// Format: SS-CCC-TTTT.BB  (state 2, county 3, tract 4, block 2)
// ---------------------------------------------------------------------------

const CENSUS_TRACT_VALID = /^\d{2}-\d{3}-\d{4}\.\d{2}$/;
const CENSUS_TRACT_NUMERIC = /^\d{11}$/;

export function correctCensusTractFormat(
  loan_id: string,
  raw: string,
): LoanAutoCorrection | null {
  if (CENSUS_TRACT_VALID.test(raw)) return null; // Already correct

  const numeric = raw.replace(/[^0-9]/g, '');
  if (numeric.length !== 11) return null; // Cannot recover — confidence too low

  // Reformat: SS CCC TTTTBB → SS-CCC-TTTT.BB
  const state = numeric.slice(0, 2);
  const county = numeric.slice(2, 5);
  const tract = numeric.slice(5, 9);
  const block = numeric.slice(9, 11);
  const formatted = `${state}-${county}-${tract}.${block}`;

  return correction(
    loan_id,
    'census_tract',
    raw,
    formatted,
    'format_normalization',
    CENSUS_TRACT_NUMERIC.test(numeric) ? 97 : 90,
    'Census tract reformatted from compact numeric (SSCCCTTTTBB) to FFIEC format (SS-CCC-TTTT.BB)',
  );
}

// ---------------------------------------------------------------------------
// Date format normalization
//
// Handles US format "M/D/YYYY" or "MM/DD/YYYY" → ISO 8601 "YYYY-MM-DD"
// Also handles "Mon DD YYYY" → ISO 8601
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const US_DATE_DASHES = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

export function correctDateFormat(
  loan_id: string,
  raw: string,
): LoanAutoCorrection | null {
  if (ISO_DATE.test(raw)) return null;

  const usMatch = US_DATE.exec(raw) ?? US_DATE_DASHES.exec(raw);
  if (usMatch !== null) {
    const month = String(parseInt(usMatch[1]!, 10)).padStart(2, '0');
    const day = String(parseInt(usMatch[2]!, 10)).padStart(2, '0');
    const year = usMatch[3]!;
    const iso = `${year}-${month}-${day}`;

    // Validate it's a real date
    if (!isNaN(new Date(iso).getTime())) {
      return correction(
        loan_id,
        'loan_origination_date',
        raw,
        iso,
        'format_normalization',
        98,
        'Date converted from US format (M/D/YYYY) to ISO 8601 (YYYY-MM-DD)',
      );
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// NAICS code normalization
//
// Pads short NAICS codes with trailing zeros to reach 6 digits.
// "722" → "722000", "7225" → "722500", "72251" → "722510"
// ---------------------------------------------------------------------------

const NAICS_VALID = /^\d{6}$/;

export function correctNaicsCode(
  loan_id: string,
  raw: string,
): LoanAutoCorrection | null {
  if (NAICS_VALID.test(raw)) return null;

  const numericOnly = raw.replace(/\D/g, '');
  if (numericOnly.length === 0 || numericOnly.length > 6) return null;

  const padded = numericOnly.padEnd(6, '0');
  return correction(
    loan_id,
    'naics_code',
    raw,
    padded,
    'format_normalization',
    85,
    `NAICS code padded with trailing zeros from ${numericOnly.length} to 6 digits`,
  );
}

// ---------------------------------------------------------------------------
// Loan purpose alias normalization
//
// Banks sometimes export shorthand values. Map to canonical enum values.
// ---------------------------------------------------------------------------

const LOAN_PURPOSE_ALIASES: Record<string, string> = {
  purchase: 'home_purchase',
  'home purchase': 'home_purchase',
  'home-purchase': 'home_purchase',
  buy: 'home_purchase',
  refi: 'refinance',
  refinancing: 'refinance',
  'home improvement': 'home_improvement',
  'home-improvement': 'home_improvement',
  improvement: 'home_improvement',
  'small business': 'small_business',
  'small-business': 'small_business',
  business: 'small_business',
  'small farm': 'small_farm',
  'small-farm': 'small_farm',
  farm: 'small_farm',
  'community development': 'community_development',
  'community-development': 'community_development',
  cd: 'community_development',
};

const VALID_LOAN_PURPOSES = new Set([
  'home_purchase', 'home_improvement', 'refinance',
  'small_business', 'small_farm', 'community_development',
]);

export function correctLoanPurpose(
  loan_id: string,
  raw: string,
): LoanAutoCorrection | null {
  if (VALID_LOAN_PURPOSES.has(raw)) return null;

  const normalized = LOAN_PURPOSE_ALIASES[raw.toLowerCase().trim()];
  if (normalized === undefined) return null;

  return correction(
    loan_id,
    'loan_purpose',
    raw,
    normalized,
    'format_normalization',
    90,
    `Loan purpose alias "${raw}" normalized to canonical value "${normalized}"`,
  );
}

// ---------------------------------------------------------------------------
// Master auto-corrector — applies all rules and returns corrections
//
// Returns: { correctedLoan, corrections[] }
// Only applies corrections where confidence >= minConfidence threshold.
// ---------------------------------------------------------------------------

export interface AutoCorrectionResult {
  correctedLoan: SanitizedLoanRecord;
  corrections: LoanAutoCorrection[];
}

export function applyAutoCorrections(
  loan: SanitizedLoanRecord,
  minConfidence: number,
): AutoCorrectionResult {
  const corrections: LoanAutoCorrection[] = [];
  const correctedLoan = { ...loan };

  // Gather all candidate corrections
  const candidates: (LoanAutoCorrection | null)[] = [
    correctCensusTractFormat(loan.loan_id, loan.census_tract ?? ''),
    correctDateFormat(loan.loan_id, loan.loan_origination_date ?? ''),
    loan.naics_code !== undefined && loan.naics_code !== null
      ? correctNaicsCode(loan.loan_id, loan.naics_code)
      : null,
    correctLoanPurpose(loan.loan_id, loan.loan_purpose ?? ''),
  ];

  for (const candidate of candidates) {
    if (candidate === null) continue;
    if (candidate.confidence < minConfidence) continue;

    // Apply the correction to the cloned loan
    switch (candidate.field) {
      case 'census_tract':
        correctedLoan.census_tract = candidate.corrected_value as string;
        break;
      case 'loan_origination_date':
        correctedLoan.loan_origination_date = candidate.corrected_value as string;
        break;
      case 'naics_code':
        correctedLoan.naics_code = candidate.corrected_value as string;
        break;
      case 'loan_purpose':
        correctedLoan.loan_purpose = candidate.corrected_value as SanitizedLoanRecord['loan_purpose'];
        break;
    }

    corrections.push(candidate);
  }

  return { correctedLoan, corrections };
}
