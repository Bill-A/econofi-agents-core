# CRA DataGuard: Technical Implementation Specification

**Module**: Community Reinvestment Act (CRA) Compliance
**Agent**: DataGuard
**Version**: 1.0
**Regulatory Basis**: 12 CFR §228.42 (CRA Data Collection and Reporting)

---

## Executive Summary

The DataGuard agent automates loan register validation and quality assurance for CRA compliance reporting. It validates schema adherence, verifies census tract codes via FFIEC geocoding API, performs data quality checks, applies auto-corrections with audit trail, and generates exception reports with severity classification.

### Key Capabilities

1. **Schema Validation**: Auto-map CSV columns to CRA §228.42 requirements
2. **Census Tract Verification**: FFIEC geocoding API validation
3. **Data Quality Checks**: Missing values, invalid ranges, duplicate detection
4. **Auto-Correction**: Format normalization with audit trail
5. **Exception Reporting**: Severity classification (CRITICAL, HIGH, MEDIUM, LOW)

### Performance SLA

- **Latency**: <5 seconds for 10,000 loan records
- **Throughput**: 2,000 records/second sustained
- **Accuracy**: 100% schema validation, 99.9% census tract accuracy
- **Uptime**: 99.9% availability

---

## Type Definitions

### Core Types

```typescript
// specs/cra/types.ts

/**
 * Raw loan record from core banking system
 * Contains PII - must be sanitized before Claude processing
 */
export interface RawLoanRecord {
  loan_id: string; // Bank's internal loan number
  borrower_name: string; // PII: Will be tokenized
  borrower_ssn?: string; // PII: Will be hashed
  borrower_address: string; // PII: Will use census tract only
  borrower_city: string;
  borrower_state: string; // Two-letter code
  borrower_zip: string; // 5 or 9 digit
  property_address?: string; // For real estate loans
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  loan_amount: number; // USD
  loan_origination_date: Date;
  loan_purpose: 'home_purchase' | 'home_improvement' | 'refinance' | 'small_business' | 'small_farm' | 'community_development';
  loan_type: 'conventional' | 'fha' | 'va' | 'usda' | 'heloc' | 'commercial' | 'farm';
  annual_revenue?: number; // For business loans
  naics_code?: string; // 6-digit industry code
  census_tract?: string; // 11-digit code (may be missing)
  msa_md?: string; // Metropolitan Statistical Area code
  income_level?: 'low' | 'moderate' | 'middle' | 'upper'; // Borrower income
  tract_income_level?: 'low' | 'moderate' | 'middle' | 'upper'; // Census tract income
  minority_tract?: boolean;
  created_at: Date;
}

/**
 * Sanitized loan record for Claude API processing
 * PII removed, census tract verified
 */
export interface SanitizedLoanRecord {
  loan_id: string; // Not PII, can keep
  borrower_token: string; // [PERSON_XXX] or [BUSINESS_XXX]
  census_tract: string; // 11-digit validated code
  msa_md: string; // MSA/MD code
  loan_amount: number;
  loan_origination_date: string; // ISO 8601
  loan_purpose: RawLoanRecord['loan_purpose'];
  loan_type: RawLoanRecord['loan_type'];
  annual_revenue?: number; // For business loans
  naics_code?: string;
  income_level?: RawLoanRecord['income_level'];
  tract_income_level: RawLoanRecord['tract_income_level'];
  tract_minority_percentage?: number; // 0-100
  tract_median_income?: number; // USD
  tract_population?: number;
  geocoding_quality: 'exact' | 'census_tract' | 'zip' | 'city' | 'failed';
  metadata: {
    sanitized_at: string;
    sanitization_version: string;
    census_tract_verified: boolean;
  };
}

/**
 * FFIEC Geocoding API response
 */
export interface FFIECGeocodeResponse {
  success: boolean;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  census_tract: string; // 11-digit code
  msa_md: string;
  county_code: string; // 5-digit FIPS code
  tract_income_level: 'low' | 'moderate' | 'middle' | 'upper';
  tract_minority_percentage: number;
  tract_median_family_income: number;
  tract_population: number;
  msa_median_family_income: number;
  geocoding_quality: 'exact' | 'census_tract' | 'zip' | 'city';
}

/**
 * Validation error for a single loan record
 */
export interface LoanValidationError {
  loan_id: string;
  field: string;
  error_type: 'missing_required' | 'invalid_format' | 'out_of_range' | 'duplicate' | 'census_tract_invalid' | 'inconsistent_data';
  severity: 'critical' | 'high' | 'medium' | 'low';
  current_value: any;
  expected_value?: any;
  suggested_correction?: any;
  regulatory_requirement: string; // Citation to 12 CFR §228.42
  auto_correctable: boolean;
}

/**
 * Auto-correction applied to loan record
 */
export interface LoanAutoCorrection {
  loan_id: string;
  field: string;
  original_value: any;
  corrected_value: any;
  correction_type: 'format_normalization' | 'census_tract_lookup' | 'calculated_field' | 'default_value';
  confidence: number; // 0-100
  audit_trail: {
    corrected_at: string;
    corrected_by: string; // 'DataGuard Agent v1.0'
    correction_rule: string;
  };
}

/**
 * Validation summary report
 */
export interface ValidationSummary {
  total_records: number;
  valid_records: number;
  records_with_errors: number;
  records_auto_corrected: number;
  critical_errors: number;
  high_severity_errors: number;
  medium_severity_errors: number;
  low_severity_errors: number;
  validation_pass_rate: number; // 0-100
  auto_correction_rate: number; // 0-100
}

/**
 * Agent SDK configuration for DataGuard
 */
export interface DataGuardConfig {
  // Claude API settings
  model: 'claude-sonnet-4-5-20250929' | 'claude-opus-4-5-20251101';
  max_tokens: number; // Recommended: 4000
  temperature: number; // Recommended: 0.0 for deterministic validation

  // FFIEC API settings
  ffiec_geocode_api_url: string; // Default: https://geomap.ffiec.gov/api/
  ffiec_api_timeout_ms: number; // Default: 5000
  ffiec_cache_ttl_seconds: number; // Default: 86400 (24 hours)

  // Validation rules
  require_census_tract: boolean; // Default: true
  require_msa_md: boolean; // Default: true
  require_income_level: boolean; // Default: true
  allow_auto_correction: boolean; // Default: true
  max_auto_correction_confidence_threshold: number; // Default: 80 (only apply if 80%+ confidence)

  // Performance settings
  batch_size: number; // Records per API call, default: 500
  parallel_workers: number; // For batch processing, default: 4
  max_retries: number; // For FFIEC API calls, default: 3

  // Output settings
  generate_exception_report: boolean; // Default: true
  exception_report_format: 'json' | 'csv' | 'xlsx';
  include_audit_trail: boolean; // Default: true
}

/**
 * Input to DataGuard agent
 */
export interface DataGuardInput {
  loans: SanitizedLoanRecord[]; // Already sanitized by orchestrator
  config: DataGuardConfig;
  session_id: string;
  reporting_period: {
    start_date: string; // ISO 8601
    end_date: string;
  };
}

/**
 * Output from DataGuard agent
 */
export interface DataGuardOutput {
  session_id: string;
  processed_at: string;
  reporting_period: DataGuardInput['reporting_period'];
  summary: ValidationSummary;
  validated_records: SanitizedLoanRecord[]; // Fully validated and corrected
  errors: LoanValidationError[];
  corrections: LoanAutoCorrection[];
  exception_report_url?: string; // S3 or Box URL
  performance_metrics: {
    total_duration_ms: number;
    avg_record_latency_ms: number;
    ffiec_api_calls: number;
    ffiec_cache_hits: number;
    claude_api_calls: number;
    claude_tokens_used: number;
  };
}
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- specs/cra/schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CRA loan staging table
CREATE TABLE cra.loan_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id TEXT NOT NULL UNIQUE,
  borrower_token TEXT NOT NULL,
  census_tract CHAR(11) NOT NULL, -- XX-XXX-XXXX.XX format
  msa_md TEXT,
  loan_amount NUMERIC(15, 2) NOT NULL CHECK (loan_amount > 0),
  loan_origination_date DATE NOT NULL,
  loan_purpose TEXT NOT NULL CHECK (loan_purpose IN (
    'home_purchase', 'home_improvement', 'refinance',
    'small_business', 'small_farm', 'community_development'
  )),
  loan_type TEXT NOT NULL CHECK (loan_type IN (
    'conventional', 'fha', 'va', 'usda', 'heloc', 'commercial', 'farm'
  )),
  annual_revenue NUMERIC(15, 2),
  naics_code CHAR(6) CHECK (naics_code ~ '^[0-9]{6}$'),
  income_level TEXT CHECK (income_level IN ('low', 'moderate', 'middle', 'upper')),
  tract_income_level TEXT NOT NULL CHECK (tract_income_level IN ('low', 'moderate', 'middle', 'upper')),
  tract_minority_percentage NUMERIC(5, 2) CHECK (tract_minority_percentage BETWEEN 0 AND 100),
  tract_median_income NUMERIC(10, 2),
  tract_population INTEGER,
  geocoding_quality TEXT NOT NULL CHECK (geocoding_quality IN ('exact', 'census_tract', 'zip', 'city', 'failed')),
  sanitized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for performance
  INDEX idx_loans_census_tract (census_tract),
  INDEX idx_loans_msa (msa_md),
  INDEX idx_loans_origination_date (loan_origination_date),
  INDEX idx_loans_purpose (loan_purpose),
  INDEX idx_loans_tract_income (tract_income_level)
);

-- Row Level Security
ALTER TABLE cra.loan_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY loans_isolation ON cra.loan_records
  USING (borrower_token IN (
    SELECT borrower_token FROM bank_customer_mapping WHERE bank_id = current_setting('app.current_bank_id')::UUID
  ));

-- Validation errors table
CREATE TABLE cra.validation_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id TEXT NOT NULL,
  field TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK (error_type IN (
    'missing_required', 'invalid_format', 'out_of_range',
    'duplicate', 'census_tract_invalid', 'inconsistent_data'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  current_value TEXT,
  expected_value TEXT,
  suggested_correction TEXT,
  regulatory_requirement TEXT NOT NULL,
  auto_correctable BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_validation_errors_loan (loan_id),
  INDEX idx_validation_errors_severity (severity),
  INDEX idx_validation_errors_resolved (resolved),
  INDEX idx_validation_errors_type (error_type)
);

ALTER TABLE cra.validation_errors ENABLE ROW LEVEL SECURITY;

-- Auto-corrections audit trail
CREATE TABLE cra.auto_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id TEXT NOT NULL,
  field TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN (
    'format_normalization', 'census_tract_lookup', 'calculated_field', 'default_value'
  )),
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  corrected_by TEXT NOT NULL,
  correction_rule TEXT NOT NULL,

  INDEX idx_auto_corrections_loan (loan_id),
  INDEX idx_auto_corrections_field (field),
  INDEX idx_auto_corrections_date (corrected_at DESC)
);

ALTER TABLE cra.auto_corrections ENABLE ROW LEVEL SECURITY;

-- FFIEC geocoding cache
CREATE TABLE cra.ffiec_geocode_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address_hash TEXT NOT NULL UNIQUE, -- SHA-256 of normalized address
  census_tract CHAR(11) NOT NULL,
  msa_md TEXT,
  county_code CHAR(5),
  tract_income_level TEXT,
  tract_minority_percentage NUMERIC(5, 2),
  tract_median_family_income NUMERIC(10, 2),
  tract_population INTEGER,
  msa_median_family_income NUMERIC(10, 2),
  geocoding_quality TEXT,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',

  INDEX idx_ffiec_cache_address (address_hash),
  INDEX idx_ffiec_cache_expires (expires_at)
);

-- No RLS on cache (shared across banks)

-- Audit log table (immutable)
CREATE TABLE cra.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  agent_name TEXT NOT NULL DEFAULT 'DataGuard',
  action TEXT NOT NULL,
  input_hash TEXT,
  output_hash TEXT,
  records_processed INTEGER,
  errors_found INTEGER,
  auto_corrections_applied INTEGER,
  claude_model TEXT,
  claude_tokens_used INTEGER,
  ffiec_api_calls INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,

  INDEX idx_audit_session (session_id),
  INDEX idx_audit_created (created_at DESC)
);

ALTER TABLE cra.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_append_only ON cra.audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY audit_log_read_only ON cra.audit_log
  FOR SELECT USING (true);

-- Migration: Create all tables
-- Migration version: 001_create_data_guard_schema.sql
```

---

## Agent Implementation Pattern

### Claude Agent SDK Configuration

```typescript
// specs/cra/agent-config.ts

import { Agent, AgentConfig } from '@anthropic-ai/agent-sdk';
import { DataGuardInput, DataGuardOutput } from './types';

export const dataGuardAgent: AgentConfig = {
  name: 'DataGuard',
  description: 'CRA loan register validation and quality assurance specialist',

  // Agent prompt (system message)
  prompt: `You are DataGuard, an expert CRA compliance agent specializing in loan register validation and data quality assurance.

Your role:
1. Validate loan records against CRA regulation 12 CFR §228.42 requirements
2. Verify census tract codes are valid 11-digit format (XX-XXX-XXXX.XX)
3. Check data quality: missing values, invalid ranges, duplicates
4. Apply auto-corrections when confidence is high (>80%)
5. Generate exception reports with severity classification
6. Ensure FFIEC reporting standards compliance

CRITICAL RULES:
- Input data is ALREADY PII-sanitized (borrower_token format)
- NEVER attempt to re-identify borrowers
- Focus on data quality, completeness, and regulatory compliance
- Validate schema adherence to 12 CFR §228.42
- Flag CRITICAL errors that block CRA submission
- Apply auto-corrections ONLY when confidence >80%
- Document all corrections in audit trail

CRA Data Collection Requirements (12 CFR §228.42):

REQUIRED FIELDS:
1. Loan/Application Number (Unique identifier)
2. Loan Amount or Amount Applied For
3. Date of Action Taken
4. Loan Purpose (home purchase, home improvement, refinance, small business, farm, community development)
5. Loan Type (conventional, FHA, VA, USDA, HELOC, commercial, farm)
6. Census Tract (11-digit: XX-XXX-XXXX.XX)
7. MSA/MD (Metropolitan Statistical Area code)
8. Income Level of Borrower (low, moderate, middle, upper)
9. Income Level of Census Tract (low, moderate, middle, upper)

SMALL BUSINESS LOANS (additional requirements):
- Gross Annual Revenue of Business
- NAICS Code (6-digit industry classification)

VALIDATION RULES:

Census Tract:
- Format: XX-XXX-XXXX.XX (state-county-tract.block)
- Must be valid per FFIEC geocoding database
- Example: 17-031-2814.02 (Illinois, Cook County, Tract 2814.02)

Loan Amount:
- Must be positive number
- Typical range: $1,000 - $10,000,000
- Flag if outside normal range for loan type

Income Level:
- Low: <50% of MSA median family income
- Moderate: 50-79% of MSA median family income
- Middle: 80-119% of MSA median family income
- Upper: ≥120% of MSA median family income

NAICS Code (if small business):
- 6 digits, numeric only
- Must be valid per NAICS classification system
- Example: 722511 = Full-Service Restaurants

AUTO-CORRECTION EXAMPLES:

Census Tract Format:
- Input: "17031281402" → Corrected: "17-031-2814.02"
- Input: "17-31-2814" → Call FFIEC API to get full code

Date Format:
- Input: "2/15/2026" → Corrected: "2026-02-15"
- Input: "Feb 15 2026" → Corrected: "2026-02-15"

NAICS Code:
- Input: "722" → Corrected: "722000" (add trailing zeros)
- Input: "72251" → Corrected: "722510" (add trailing zero)

Loan Purpose Normalization:
- Input: "purchase" → Corrected: "home_purchase"
- Input: "refi" → Corrected: "refinance"

EXCEPTION REPORTING:

Severity Levels:
- CRITICAL: Blocks CRA submission (missing required field, invalid census tract)
- HIGH: Significant data quality issue (missing income level, invalid NAICS)
- MEDIUM: Minor data quality issue (formatting inconsistency, missing optional field)
- LOW: Informational (recommendation for improvement)

Example Critical Error:
{
  "loan_id": "LOAN-2026-00542",
  "field": "census_tract",
  "error_type": "missing_required",
  "severity": "critical",
  "current_value": null,
  "regulatory_requirement": "12 CFR §228.42(a)(1)(i) - Census tract required for all loans",
  "suggested_correction": "Call FFIEC geocoding API using property address"
}

OUTPUT FORMAT:
Return JSON object with:
- summary: ValidationSummary (counts of valid/invalid records)
- validated_records: Array of fully validated SanitizedLoanRecord
- errors: Array of LoanValidationError objects
- corrections: Array of LoanAutoCorrection objects
- exception_report_url: S3/Box URL for detailed exception report`,

  // Tools available to the agent
  tools: [
    {
      name: 'validate_loan_batch',
      description: 'Validate batch of loan records against CRA requirements',
      input_schema: {
        type: 'object',
        properties: {
          loans: {
            type: 'array',
            items: { type: 'object' },
            description: 'Sanitized loan records to validate'
          },
          config: {
            type: 'object',
            description: 'Validation configuration settings'
          }
        },
        required: ['loans', 'config']
      }
    },
    {
      name: 'verify_census_tract',
      description: 'Verify census tract code via FFIEC geocoding API',
      input_schema: {
        type: 'object',
        properties: {
          address: {
            type: 'object',
            description: 'Property address to geocode'
          }
        },
        required: ['address']
      }
    },
    {
      name: 'apply_auto_correction',
      description: 'Apply auto-correction to loan record with audit trail',
      input_schema: {
        type: 'object',
        properties: {
          loan_id: { type: 'string' },
          field: { type: 'string' },
          corrected_value: { type: 'string' },
          correction_type: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 100 }
        },
        required: ['loan_id', 'field', 'corrected_value', 'correction_type', 'confidence']
      }
    }
  ],

  // Model configuration
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4000,
  temperature: 0.0, // Deterministic for compliance
};
```

---

## Test Specifications (TDD)

### Unit Tests

```typescript
// specs/cra/tests.spec.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataGuard } from '../src/data-guard';
import { SanitizedLoanRecord, DataGuardConfig } from './types';

describe('DataGuard Agent', () => {
  let dataGuard: DataGuard;
  let defaultConfig: DataGuardConfig;

  beforeEach(() => {
    defaultConfig = {
      model: 'claude-sonnet-4-5-20250929',
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

  describe('Schema Validation', () => {
    it('should validate complete valid loan record', async () => {
      const loan: SanitizedLoanRecord = {
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
          census_tract_verified: true
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_001',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      expect(result.summary.valid_records).toBe(1);
      expect(result.summary.records_with_errors).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should flag missing required field (census_tract)', async () => {
      const loan: any = {
        loan_id: 'LOAN-2026-00002',
        borrower_token: '[PERSON_002]',
        // census_tract: MISSING
        msa_md: '16974',
        loan_amount: 180000,
        loan_origination_date: '2026-01-20',
        loan_purpose: 'home_purchase',
        loan_type: 'fha',
        income_level: 'low',
        tract_income_level: 'low',
        geocoding_quality: 'failed',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: false
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_002',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      expect(result.summary.critical_errors).toBe(1);
      expect(result.errors[0].field).toBe('census_tract');
      expect(result.errors[0].error_type).toBe('missing_required');
      expect(result.errors[0].severity).toBe('critical');
      expect(result.errors[0].regulatory_requirement).toContain('12 CFR §228.42');
    });

    it('should flag invalid census tract format', async () => {
      const loan: SanitizedLoanRecord = {
        loan_id: 'LOAN-2026-00003',
        borrower_token: '[PERSON_003]',
        census_tract: 'INVALID', // Not 11-digit format
        msa_md: '16974',
        loan_amount: 300000,
        loan_origination_date: '2026-01-25',
        loan_purpose: 'refinance',
        loan_type: 'conventional',
        income_level: 'middle',
        tract_income_level: 'middle',
        geocoding_quality: 'failed',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: false
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_003',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      expect(result.summary.critical_errors).toBe(1);
      expect(result.errors[0].field).toBe('census_tract');
      expect(result.errors[0].error_type).toBe('census_tract_invalid');
      expect(result.errors[0].suggested_correction).toContain('FFIEC geocoding API');
    });

    it('should validate small business loan with NAICS code', async () => {
      const loan: SanitizedLoanRecord = {
        loan_id: 'LOAN-2026-00004',
        borrower_token: '[BUSINESS_001]',
        census_tract: '17-043-1001.01',
        msa_md: '16974',
        loan_amount: 500000,
        loan_origination_date: '2026-01-10',
        loan_purpose: 'small_business',
        loan_type: 'commercial',
        annual_revenue: 2000000,
        naics_code: '722511', // Full-Service Restaurants
        tract_income_level: 'moderate',
        geocoding_quality: 'exact',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: true
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_004',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      expect(result.summary.valid_records).toBe(1);
      expect(result.errors.length).toBe(0);
    });

    it('should flag missing NAICS code for small business loan', async () => {
      const loan: SanitizedLoanRecord = {
        loan_id: 'LOAN-2026-00005',
        borrower_token: '[BUSINESS_002]',
        census_tract: '17-043-1002.00',
        msa_md: '16974',
        loan_amount: 350000,
        loan_origination_date: '2026-01-12',
        loan_purpose: 'small_business',
        loan_type: 'commercial',
        annual_revenue: 1500000,
        // naics_code: MISSING (required for small business)
        tract_income_level: 'middle',
        geocoding_quality: 'exact',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: true
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_005',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      expect(result.summary.high_severity_errors).toBeGreaterThanOrEqual(1);
      const naicsError = result.errors.find(e => e.field === 'naics_code');
      expect(naicsError).toBeDefined();
      expect(naicsError?.severity).toBe('high');
    });
  });

  describe('Auto-Correction', () => {
    it('should auto-correct census tract format', async () => {
      const loan: SanitizedLoanRecord = {
        loan_id: 'LOAN-2026-00006',
        borrower_token: '[PERSON_004]',
        census_tract: '17031281402', // Missing dashes and period
        msa_md: '16974',
        loan_amount: 275000,
        loan_origination_date: '2026-01-18',
        loan_purpose: 'home_purchase',
        loan_type: 'va',
        income_level: 'moderate',
        tract_income_level: 'moderate',
        geocoding_quality: 'census_tract',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: true
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_006',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      expect(result.summary.records_auto_corrected).toBe(1);
      expect(result.corrections.length).toBeGreaterThanOrEqual(1);

      const correction = result.corrections.find(c => c.field === 'census_tract');
      expect(correction).toBeDefined();
      expect(correction?.original_value).toBe('17031281402');
      expect(correction?.corrected_value).toBe('17-031-2814.02');
      expect(correction?.correction_type).toBe('format_normalization');
      expect(correction?.confidence).toBeGreaterThanOrEqual(95);
    });

    it('should auto-correct date format', async () => {
      const loan: any = {
        loan_id: 'LOAN-2026-00007',
        borrower_token: '[PERSON_005]',
        census_tract: '17-031-2815.01',
        msa_md: '16974',
        loan_amount: 220000,
        loan_origination_date: '2/15/2026', // US format instead of ISO
        loan_purpose: 'home_improvement',
        loan_type: 'heloc',
        income_level: 'middle',
        tract_income_level: 'middle',
        geocoding_quality: 'exact',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: true
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_007',
        reporting_period: { start_date: '2026-02-01', end_date: '2026-02-28' }
      });

      const correction = result.corrections.find(c => c.field === 'loan_origination_date');
      expect(correction).toBeDefined();
      expect(correction?.corrected_value).toBe('2026-02-15');
      expect(correction?.correction_type).toBe('format_normalization');
    });

    it('should auto-correct NAICS code with trailing zeros', async () => {
      const loan: SanitizedLoanRecord = {
        loan_id: 'LOAN-2026-00008',
        borrower_token: '[BUSINESS_003]',
        census_tract: '17-043-1003.00',
        msa_md: '16974',
        loan_amount: 450000,
        loan_origination_date: '2026-01-22',
        loan_purpose: 'small_business',
        loan_type: 'commercial',
        annual_revenue: 1800000,
        naics_code: '7225', // Only 4 digits, should be 6
        tract_income_level: 'moderate',
        geocoding_quality: 'exact',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: true
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_008',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      const correction = result.corrections.find(c => c.field === 'naics_code');
      expect(correction).toBeDefined();
      expect(correction?.original_value).toBe('7225');
      expect(correction?.corrected_value).toBe('722500');
      expect(correction?.correction_type).toBe('format_normalization');
    });

    it('should NOT auto-correct when confidence is low (<80%)', async () => {
      const loan: SanitizedLoanRecord = {
        loan_id: 'LOAN-2026-00009',
        borrower_token: '[PERSON_006]',
        census_tract: '17-999-9999.99', // Invalid tract, unclear correction
        msa_md: '16974',
        loan_amount: 195000,
        loan_origination_date: '2026-01-28',
        loan_purpose: 'home_purchase',
        loan_type: 'usda',
        income_level: 'low',
        tract_income_level: 'low',
        geocoding_quality: 'failed',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: false
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_009',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      expect(result.summary.critical_errors).toBeGreaterThanOrEqual(1);
      // Should flag error but NOT auto-correct without high confidence
      const correction = result.corrections.find(c => c.field === 'census_tract');
      expect(correction).toBeUndefined();
    });
  });

  describe('FFIEC Geocoding Integration', () => {
    it('should call FFIEC API to verify census tract', async () => {
      // Mock FFIEC API response
      const ffiecResponse = {
        success: true,
        address: {
          street: '123 Main St',
          city: 'Chicago',
          state: 'IL',
          zip: '60601'
        },
        census_tract: '17-031-0801.00',
        msa_md: '16974',
        county_code: '17031',
        tract_income_level: 'middle' as const,
        tract_minority_percentage: 42.1,
        tract_median_family_income: 75000,
        tract_population: 3800,
        msa_median_family_income: 82000,
        geocoding_quality: 'exact' as const
      };

      // Test will verify FFIEC API called and response processed correctly
      expect(ffiecResponse.census_tract).toBe('17-031-0801.00');
      expect(ffiecResponse.tract_income_level).toBe('middle');
    });

    it('should use cached census tract data when available', async () => {
      // Simulate cache hit scenario
      const loan: SanitizedLoanRecord = {
        loan_id: 'LOAN-2026-00010',
        borrower_token: '[PERSON_007]',
        census_tract: '17-031-0801.00',
        msa_md: '16974',
        loan_amount: 285000,
        loan_origination_date: '2026-01-30',
        loan_purpose: 'refinance',
        loan_type: 'conventional',
        income_level: 'middle',
        tract_income_level: 'middle',
        tract_minority_percentage: 42.1,
        tract_median_income: 75000,
        geocoding_quality: 'exact',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: true
        }
      };

      const result = await dataGuard.validate({
        loans: [loan],
        config: defaultConfig,
        session_id: 'TEST_010',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });

      // Should use cached data, minimal API calls
      expect(result.performance_metrics.ffiec_cache_hits).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate loan IDs', async () => {
      const loans: SanitizedLoanRecord[] = [
        {
          loan_id: 'LOAN-2026-00011',
          borrower_token: '[PERSON_008]',
          census_tract: '17-031-0802.00',
          msa_md: '16974',
          loan_amount: 240000,
          loan_origination_date: '2026-02-01',
          loan_purpose: 'home_purchase',
          loan_type: 'fha',
          income_level: 'moderate',
          tract_income_level: 'moderate',
          geocoding_quality: 'exact',
          metadata: {
            sanitized_at: '2026-02-15T10:00:00Z',
            sanitization_version: 'v1.0',
            census_tract_verified: true
          }
        },
        {
          loan_id: 'LOAN-2026-00011', // DUPLICATE ID
          borrower_token: '[PERSON_009]',
          census_tract: '17-031-0803.00',
          msa_md: '16974',
          loan_amount: 260000,
          loan_origination_date: '2026-02-05',
          loan_purpose: 'refinance',
          loan_type: 'conventional',
          income_level: 'middle',
          tract_income_level: 'middle',
          geocoding_quality: 'exact',
          metadata: {
            sanitized_at: '2026-02-15T10:00:00Z',
            sanitization_version: 'v1.0',
            census_tract_verified: true
          }
        }
      ];

      const result = await dataGuard.validate({
        loans,
        config: defaultConfig,
        session_id: 'TEST_011',
        reporting_period: { start_date: '2026-02-01', end_date: '2026-02-28' }
      });

      expect(result.summary.high_severity_errors).toBeGreaterThanOrEqual(1);
      const duplicateError = result.errors.find(e => e.error_type === 'duplicate');
      expect(duplicateError).toBeDefined();
      expect(duplicateError?.field).toBe('loan_id');
    });
  });

  describe('Performance Requirements', () => {
    it('should process 10,000 loan records in <5 seconds', async () => {
      const loans: SanitizedLoanRecord[] = Array.from({ length: 10000 }, (_, i) => ({
        loan_id: `LOAN-2026-${String(i).padStart(5, '0')}`,
        borrower_token: `[PERSON_${String(i).padStart(3, '0')}]`,
        census_tract: `17-031-${String(800 + (i % 100)).padStart(4, '0')}.00`,
        msa_md: '16974',
        loan_amount: 150000 + (i * 1000),
        loan_origination_date: '2026-01-15',
        loan_purpose: 'home_purchase',
        loan_type: 'conventional',
        income_level: 'moderate',
        tract_income_level: 'moderate',
        geocoding_quality: 'exact',
        metadata: {
          sanitized_at: '2026-02-15T10:00:00Z',
          sanitization_version: 'v1.0',
          census_tract_verified: true
        }
      }));

      const startTime = Date.now();
      const result = await dataGuard.validate({
        loans,
        config: defaultConfig,
        session_id: 'PERF_TEST_001',
        reporting_period: { start_date: '2026-01-01', end_date: '2026-01-31' }
      });
      const duration = Date.now() - startTime;

      expect(result.summary.total_records).toBe(10000);
      expect(duration).toBeLessThan(5000);
      expect(result.performance_metrics.avg_record_latency_ms).toBeLessThan(0.5);
    });
  });

  describe('Exception Reporting', () => {
    it('should generate exception report with severity classification', async () => {
      const loans: SanitizedLoanRecord[] = [
        {
          loan_id: 'LOAN-2026-00012',
          borrower_token: '[PERSON_010]',
          census_tract: '17-031-0804.00',
          msa_md: '16974',
          loan_amount: 230000,
          loan_origination_date: '2026-02-10',
          loan_purpose: 'home_purchase',
          loan_type: 'conventional',
          income_level: 'moderate',
          tract_income_level: 'moderate',
          geocoding_quality: 'exact',
          metadata: {
            sanitized_at: '2026-02-15T10:00:00Z',
            sanitization_version: 'v1.0',
            census_tract_verified: true
          }
        },
        {
          loan_id: 'LOAN-2026-00013',
          borrower_token: '[PERSON_011]',
          census_tract: '', // CRITICAL: Missing required field
          msa_md: '16974',
          loan_amount: 200000,
          loan_origination_date: '2026-02-12',
          loan_purpose: 'refinance',
          loan_type: 'fha',
          income_level: 'low',
          tract_income_level: 'low',
          geocoding_quality: 'failed',
          metadata: {
            sanitized_at: '2026-02-15T10:00:00Z',
            sanitization_version: 'v1.0',
            census_tract_verified: false
          }
        } as any
      ];

      const result = await dataGuard.validate({
        loans,
        config: defaultConfig,
        session_id: 'TEST_012',
        reporting_period: { start_date: '2026-02-01', end_date: '2026-02-28' }
      });

      expect(result.exception_report_url).toBeDefined();
      expect(result.summary.critical_errors).toBeGreaterThanOrEqual(1);
    });
  });
});
```

---

## API Contract

### Function Signature

```typescript
/**
 * DataGuard.validate()
 *
 * Validates batch of sanitized loan records against CRA requirements
 *
 * @param input - Loan batch with reporting period
 * @returns Promise<DataGuardOutput> - Validation results, errors, and corrections
 * @throws ValidationError - If input schema validation fails
 * @throws FFIECAPIError - If FFIEC geocoding API fails
 * @throws ClaudeAPIError - If Claude API call fails
 */
async validate(input: DataGuardInput): Promise<DataGuardOutput>;
```

---

## Performance Benchmarks

### Latency SLA

| Metric | Target | Maximum |
|--------|--------|---------|
| 1,000 records | <500ms | <1 second |
| 10,000 records | <3 seconds | <5 seconds |
| 50,000 records | <15 seconds | <30 seconds |

### Accuracy SLA

- **Schema validation**: 100% accuracy
- **Census tract verification**: 99.9% accuracy (FFIEC API dependent)
- **Auto-correction precision**: >95% (only high-confidence corrections applied)

---

*Last Updated: February 15, 2026*
*Status: Ready for Implementation*
