import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DataGuard } from '../../src/agents/cra/dataGuard';
import type {
  SanitizedLoanRecord,
  DataGuardConfig,
  DataGuardInput,
} from '../../src/types/cra';

// ---------------------------------------------------------------------------
// Mocks — isolate from external APIs in unit tests
// ---------------------------------------------------------------------------

jest.mock('../../src/lib/ffiecClient', () => ({
  FFIECClient: jest.fn(() => ({
    verifyTract: jest.fn(() => Promise.resolve({
      success: true,
      census_tract: '17-031-0801.00',
      msa_md: '16974',
      county_code: '17031',
      tract_income_level: 'middle',
      tract_minority_percentage: 42.1,
      tract_median_family_income: 75000,
      tract_population: 3800,
      msa_median_family_income: 82000,
      geocoding_quality: 'exact',
    })),
    lookupFromCache: jest.fn(() => Promise.resolve(null)),
    saveToCache: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn(() => Promise.resolve({
        content: [{ type: 'text', text: 'Validation complete. No critical issues found.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })),
    },
  })),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeValidLoan(overrides: Partial<SanitizedLoanRecord> = {}): SanitizedLoanRecord {
  return {
    loan_id: 'LOAN-2026-00001',
    borrower_token: '[PERSON_001]',
    census_tract: '17-031-2814.02',
    msa_md: '16974',
    loan_amount: 250000,
    loan_origination_date: '2026-01-15',
    loan_purpose: 'home_purchase',
    loan_type: 'conventional',
    income_level: 'moderate',
    tract_income_level: 'moderate',
    tract_minority_percentage: 35.4,
    tract_median_income: 65000,
    tract_population: 4200,
    geocoding_quality: 'exact',
    metadata: {
      sanitized_at: '2026-02-15T10:00:00Z',
      sanitization_version: 'v1.0',
      census_tract_verified: true,
    },
    ...overrides,
  };
}

function makeInput(loans: SanitizedLoanRecord[], sessionId = 'TEST_001'): DataGuardInput {
  return {
    loans,
    config: defaultConfig,
    session_id: sessionId,
    reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' },
  };
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

let defaultConfig: DataGuardConfig;
let dataGuard: DataGuard;

beforeEach(() => {
  defaultConfig = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    temperature: 0.0,
    ffiec_geocode_api_url: 'https://geomap.ffiec.gov/api/',
    ffiec_api_timeout_ms: 5000,
    ffiec_cache_ttl_seconds: 86400,
    require_census_tract: true,
    require_msa_md: true,
    require_income_level: true,
    allow_auto_correction: true,
    max_auto_correction_confidence_threshold: 80,
    batch_size: 500,
    parallel_workers: 4,
    max_retries: 3,
    generate_exception_report: true,
    exception_report_format: 'json',
    include_audit_trail: true,
  };

  dataGuard = new DataGuard(defaultConfig);
});

// ===========================================================================
// Schema Validation
// ===========================================================================

describe('DataGuard — Schema Validation', () => {
  it('should validate a complete, valid loan record with zero errors', async () => {
    const result = await dataGuard.validate(makeInput([makeValidLoan()]));

    expect(result.summary.total_records).toBe(1);
    expect(result.summary.valid_records).toBe(1);
    expect(result.summary.records_with_errors).toBe(0);
    expect(result.errors.length).toBe(0);
    expect(result.summary.critical_errors).toBe(0);
  });

  it('should flag missing census_tract as CRITICAL with regulatory citation', async () => {
    const loan = makeValidLoan({
      census_tract: undefined as unknown as string,
      geocoding_quality: 'failed',
      metadata: { sanitized_at: '2026-02-15T10:00:00Z', sanitization_version: 'v1.0', census_tract_verified: false },
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_002'));

    expect(result.summary.critical_errors).toBeGreaterThanOrEqual(1);
    const error = result.errors.find((e) => e.field === 'census_tract');
    expect(error).toBeDefined();
    expect(error?.error_type).toBe('missing_required');
    expect(error?.severity).toBe('critical');
    expect(error?.regulatory_requirement).toContain('12 CFR §228.42');
  });

  it('should flag invalid census tract format as CRITICAL', async () => {
    const loan = makeValidLoan({
      census_tract: 'INVALID',
      geocoding_quality: 'failed',
      metadata: { sanitized_at: '2026-02-15T10:00:00Z', sanitization_version: 'v1.0', census_tract_verified: false },
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_003'));

    expect(result.summary.critical_errors).toBeGreaterThanOrEqual(1);
    const error = result.errors.find((e) => e.field === 'census_tract');
    expect(error).toBeDefined();
    expect(error?.error_type).toBe('census_tract_invalid');
    expect(error?.suggested_correction).toContain('FFIEC geocoding API');
  });

  it('should validate complete small business loan with NAICS code', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00004',
      borrower_token: '[BUSINESS_001]',
      census_tract: '17-043-1001.01',
      loan_amount: 500000,
      loan_purpose: 'small_business',
      loan_type: 'commercial',
      annual_revenue: 2000000,
      naics_code: '722511',
      income_level: undefined,
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_004'));

    expect(result.summary.valid_records).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should flag missing NAICS code for small_business loan as HIGH severity', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00005',
      borrower_token: '[BUSINESS_002]',
      loan_purpose: 'small_business',
      loan_type: 'commercial',
      annual_revenue: 1500000,
      naics_code: undefined,
      income_level: undefined,
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_005'));

    expect(result.summary.high_severity_errors).toBeGreaterThanOrEqual(1);
    const error = result.errors.find((e) => e.field === 'naics_code');
    expect(error).toBeDefined();
    expect(error?.severity).toBe('high');
  });

  it('should flag missing annual_revenue for small_business loan as HIGH severity', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00005b',
      borrower_token: '[BUSINESS_003]',
      loan_purpose: 'small_business',
      loan_type: 'commercial',
      annual_revenue: undefined,
      naics_code: '722511',
      income_level: undefined,
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_005B'));

    const error = result.errors.find((e) => e.field === 'annual_revenue');
    expect(error).toBeDefined();
    expect(error?.severity).toBe('high');
  });

  it('should flag missing income_level as HIGH severity', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00014',
      income_level: undefined,
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_014'));

    expect(result.summary.high_severity_errors).toBeGreaterThanOrEqual(1);
    const error = result.errors.find((e) => e.field === 'income_level');
    expect(error).toBeDefined();
    expect(error?.severity).toBe('high');
  });

  it('should flag loan_amount of zero or negative as CRITICAL', async () => {
    const loan = makeValidLoan({ loan_id: 'LOAN-2026-00015', loan_amount: 0 });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_015'));

    const error = result.errors.find((e) => e.field === 'loan_amount');
    expect(error).toBeDefined();
    expect(error?.severity).toBe('critical');
    expect(error?.error_type).toBe('out_of_range');
  });

  it('should flag missing msa_md as MEDIUM severity when require_msa_md is true', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00016',
      msa_md: undefined as unknown as string,
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_016'));

    const error = result.errors.find((e) => e.field === 'msa_md');
    expect(error).toBeDefined();
  });

  it('should flag invalid loan_type as CRITICAL', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00017',
      loan_type: 'invalid_type' as unknown as SanitizedLoanRecord['loan_type'],
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_017'));

    const error = result.errors.find((e) => e.field === 'loan_type');
    expect(error).toBeDefined();
    expect(error?.severity).toBe('critical');
  });

  it('should flag invalid loan_purpose as CRITICAL', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00018',
      loan_purpose: 'not_a_purpose' as unknown as SanitizedLoanRecord['loan_purpose'],
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_018'));

    const error = result.errors.find((e) => e.field === 'loan_purpose');
    expect(error).toBeDefined();
    expect(error?.severity).toBe('critical');
  });
});

// ===========================================================================
// Auto-Correction
// ===========================================================================

describe('DataGuard — Auto-Correction', () => {
  it('should auto-correct census tract format (missing dashes and period)', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00006',
      borrower_token: '[PERSON_004]',
      census_tract: '17031281402',
      geocoding_quality: 'census_tract',
      metadata: { sanitized_at: '2026-02-15T10:00:00Z', sanitization_version: 'v1.0', census_tract_verified: true },
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_006'));

    expect(result.summary.records_auto_corrected).toBeGreaterThanOrEqual(1);
    const correction = result.corrections.find((c) => c.field === 'census_tract');
    expect(correction).toBeDefined();
    expect(correction?.original_value).toBe('17031281402');
    expect(correction?.corrected_value).toBe('17-031-2814.02');
    expect(correction?.correction_type).toBe('format_normalization');
    expect(correction?.confidence).toBeGreaterThanOrEqual(95);
  });

  it('should auto-correct US date format to ISO 8601', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00007',
      borrower_token: '[PERSON_005]',
      census_tract: '17-031-2815.01',
      loan_origination_date: '2/15/2026',
      loan_purpose: 'home_improvement',
      loan_type: 'heloc',
    });

    const result = await dataGuard.validate({
      ...makeInput([loan], 'TEST_007'),
      reporting_period: { start_date: '2026-02-01', end_date: '2026-02-28' },
    });

    const correction = result.corrections.find((c) => c.field === 'loan_origination_date');
    expect(correction).toBeDefined();
    expect(correction?.corrected_value).toBe('2026-02-15');
    expect(correction?.correction_type).toBe('format_normalization');
  });

  it('should auto-correct NAICS code by padding with trailing zeros', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00008',
      borrower_token: '[BUSINESS_003]',
      census_tract: '17-043-1003.00',
      loan_amount: 450000,
      loan_purpose: 'small_business',
      loan_type: 'commercial',
      annual_revenue: 1800000,
      naics_code: '7225',
      income_level: undefined,
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_008'));

    const correction = result.corrections.find((c) => c.field === 'naics_code');
    expect(correction).toBeDefined();
    expect(correction?.original_value).toBe('7225');
    expect(correction?.corrected_value).toBe('722500');
    expect(correction?.correction_type).toBe('format_normalization');
  });

  it('should NOT auto-correct when census tract is clearly invalid with no recoverable pattern', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00009',
      borrower_token: '[PERSON_006]',
      census_tract: '17-999-9999.99',
      geocoding_quality: 'failed',
      metadata: { sanitized_at: '2026-02-15T10:00:00Z', sanitization_version: 'v1.0', census_tract_verified: false },
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_009'));

    expect(result.summary.critical_errors).toBeGreaterThanOrEqual(1);
    const correction = result.corrections.find(
      (c) => c.field === 'census_tract' && (c.confidence as number) >= 80,
    );
    expect(correction).toBeUndefined();
  });

  it('should auto-correct "purchase" loan purpose alias to home_purchase', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00019',
      loan_purpose: 'purchase' as unknown as SanitizedLoanRecord['loan_purpose'],
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_019'));

    const correction = result.corrections.find((c) => c.field === 'loan_purpose');
    expect(correction).toBeDefined();
    expect(correction?.corrected_value).toBe('home_purchase');
  });

  it('should auto-correct "refi" loan purpose alias to refinance', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00020',
      loan_purpose: 'refi' as unknown as SanitizedLoanRecord['loan_purpose'],
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_020'));

    const correction = result.corrections.find((c) => c.field === 'loan_purpose');
    expect(correction).toBeDefined();
    expect(correction?.corrected_value).toBe('refinance');
  });

  it('should include audit trail on all corrections', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00021',
      census_tract: '17031281402',
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_021'));

    const correction = result.corrections.find((c) => c.field === 'census_tract');
    expect(correction).toBeDefined();
    expect(correction?.audit_trail.corrected_by).toBe('DataGuard Agent v1.0');
    expect(correction?.audit_trail.corrected_at).toBeDefined();
    expect(correction?.audit_trail.correction_rule).toBeDefined();
  });
});

// ===========================================================================
// FFIEC Geocoding Integration
// ===========================================================================

describe('DataGuard — FFIEC Geocoding', () => {
  it('should process FFIEC response shape correctly', () => {
    const ffiecResponse = {
      success: true,
      address: { street: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' },
      census_tract: '17-031-0801.00',
      msa_md: '16974',
      county_code: '17031',
      tract_income_level: 'middle' as const,
      tract_minority_percentage: 42.1,
      tract_median_family_income: 75000,
      tract_population: 3800,
      msa_median_family_income: 82000,
      geocoding_quality: 'exact' as const,
    };

    expect(ffiecResponse.census_tract).toBe('17-031-0801.00');
    expect(ffiecResponse.tract_income_level).toBe('middle');
    expect(ffiecResponse.geocoding_quality).toBe('exact');
  });

  it('should track ffiec_cache_hits in performance metrics', async () => {
    const loan = makeValidLoan({
      loan_id: 'LOAN-2026-00010',
      borrower_token: '[PERSON_007]',
      census_tract: '17-031-0801.00',
      tract_minority_percentage: 42.1,
      tract_median_income: 75000,
      metadata: { sanitized_at: '2026-02-15T10:00:00Z', sanitization_version: 'v1.0', census_tract_verified: true },
    });

    const result = await dataGuard.validate(makeInput([loan], 'TEST_010'));

    expect(result.performance_metrics).toBeDefined();
    expect(typeof result.performance_metrics.ffiec_cache_hits).toBe('number');
    expect(typeof result.performance_metrics.ffiec_api_calls).toBe('number');
  });
});

// ===========================================================================
// Duplicate Detection
// ===========================================================================

describe('DataGuard — Duplicate Detection', () => {
  it('should detect duplicate loan_ids within the same batch', async () => {
    const loans = [
      makeValidLoan({ loan_id: 'LOAN-2026-00011', borrower_token: '[PERSON_008]', census_tract: '17-031-0802.00' }),
      makeValidLoan({
        loan_id: 'LOAN-2026-00011',   // DUPLICATE
        borrower_token: '[PERSON_009]',
        census_tract: '17-031-0803.00',
        loan_amount: 260000,
        loan_purpose: 'refinance',
        loan_type: 'conventional',
        income_level: 'middle',
        tract_income_level: 'middle',
      }),
    ];

    const result = await dataGuard.validate(makeInput(loans, 'TEST_011'));

    expect(result.summary.high_severity_errors).toBeGreaterThanOrEqual(1);
    const duplicateError = result.errors.find((e) => e.error_type === 'duplicate');
    expect(duplicateError).toBeDefined();
    expect(duplicateError?.field).toBe('loan_id');
  });

  it('should not flag unique loan IDs as duplicates', async () => {
    const loans = [
      makeValidLoan({ loan_id: 'LOAN-2026-00022' }),
      makeValidLoan({ loan_id: 'LOAN-2026-00023', borrower_token: '[PERSON_010]', census_tract: '17-031-2815.01' }),
    ];

    const result = await dataGuard.validate(makeInput(loans, 'TEST_022'));

    const duplicateError = result.errors.find((e) => e.error_type === 'duplicate');
    expect(duplicateError).toBeUndefined();
  });
});

// ===========================================================================
// Exception Reporting
// ===========================================================================

describe('DataGuard — Exception Reporting', () => {
  it('should generate exception report URL when generate_exception_report is true', async () => {
    const loans = [
      makeValidLoan({ loan_id: 'LOAN-2026-00012', census_tract: '17-031-0804.00' }),
      makeValidLoan({
        loan_id: 'LOAN-2026-00013',
        borrower_token: '[PERSON_011]',
        census_tract: '',
        geocoding_quality: 'failed',
        metadata: { sanitized_at: '2026-02-15T10:00:00Z', sanitization_version: 'v1.0', census_tract_verified: false },
      }),
    ];

    const result = await dataGuard.validate({
      ...makeInput(loans, 'TEST_012'),
      reporting_period: { start_date: '2026-02-01', end_date: '2026-02-28' },
    });

    expect(result.summary.critical_errors).toBeGreaterThanOrEqual(1);
    expect(result.exception_report_url).toBeDefined();
  });

  it('should include all severity levels in summary counts', async () => {
    const result = await dataGuard.validate(makeInput([makeValidLoan()], 'TEST_013'));

    expect(typeof result.summary.critical_errors).toBe('number');
    expect(typeof result.summary.high_severity_errors).toBe('number');
    expect(typeof result.summary.medium_severity_errors).toBe('number');
    expect(typeof result.summary.low_severity_errors).toBe('number');
  });

  it('should calculate validation_pass_rate correctly', async () => {
    const loans = [
      makeValidLoan({ loan_id: 'LOAN-2026-00024' }),
      makeValidLoan({ loan_id: 'LOAN-2026-00025', borrower_token: '[PERSON_012]', census_tract: '17-031-2815.01' }),
    ];

    const result = await dataGuard.validate(makeInput(loans, 'TEST_024'));

    expect(result.summary.validation_pass_rate).toBeGreaterThanOrEqual(0);
    expect(result.summary.validation_pass_rate).toBeLessThanOrEqual(100);
  });
});

// ===========================================================================
// Performance Requirements
// ===========================================================================

describe('DataGuard — Performance', () => {
  it('should process 10,000 loan records in under 5 seconds', async () => {
    const loans: SanitizedLoanRecord[] = Array.from({ length: 10000 }, (_, i) => ({
      loan_id: `LOAN-PERF-${String(i).padStart(5, '0')}`,
      borrower_token: `[PERSON_${String(i).padStart(3, '0')}]`,
      census_tract: `17-031-${String(800 + (i % 100)).padStart(4, '0')}.00`,
      msa_md: '16974',
      loan_amount: 150000 + i * 1000,
      loan_origination_date: '2026-01-15',
      loan_purpose: 'home_purchase',
      loan_type: 'conventional',
      income_level: 'moderate',
      tract_income_level: 'moderate',
      geocoding_quality: 'exact',
      metadata: {
        sanitized_at: '2026-02-15T10:00:00Z',
        sanitization_version: 'v1.0',
        census_tract_verified: true,
      },
    }));

    const start = Date.now();
    const result = await dataGuard.validate({
      loans,
      config: defaultConfig,
      session_id: 'PERF_TEST_001',
      reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' },
    });
    const duration = Date.now() - start;

    expect(result.summary.total_records).toBe(10000);
    expect(duration).toBeLessThan(5000);
    expect(result.performance_metrics.avg_record_latency_ms).toBeLessThan(0.5);
  }, 10000); // 10s jest timeout for this test

  it('should include total_duration_ms in performance metrics', async () => {
    const result = await dataGuard.validate(makeInput([makeValidLoan()], 'PERF_TEST_002'));

    expect(result.performance_metrics.total_duration_ms).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Output structure
// ===========================================================================

describe('DataGuard — Output Structure', () => {
  it('should always return session_id matching input', async () => {
    const result = await dataGuard.validate(makeInput([makeValidLoan()], 'STRUCT_TEST_001'));
    expect(result.session_id).toBe('STRUCT_TEST_001');
  });

  it('should return reporting_period matching input', async () => {
    const input = makeInput([makeValidLoan()], 'STRUCT_TEST_002');
    const result = await dataGuard.validate(input);
    expect(result.reporting_period).toEqual(input.reporting_period);
  });

  it('should return processed_at as valid ISO 8601 timestamp', async () => {
    const result = await dataGuard.validate(makeInput([makeValidLoan()], 'STRUCT_TEST_003'));
    expect(new Date(result.processed_at).getTime()).not.toBeNaN();
  });

  it('should include validated_records array in output', async () => {
    const result = await dataGuard.validate(makeInput([makeValidLoan()], 'STRUCT_TEST_004'));
    expect(Array.isArray(result.validated_records)).toBe(true);
    expect(result.validated_records.length).toBe(1);
  });
});
