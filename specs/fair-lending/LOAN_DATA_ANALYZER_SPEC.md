# Fair Lending LoanDataAnalyzer: Technical Implementation Specification

**Module**: Fair Lending / ECOA Compliance
**Agent**: LoanDataAnalyzer
**Version**: 1.0
**Regulatory Basis**: 15 USC §1691 (Equal Credit Opportunity Act), 42 USC §3605 (Fair Housing Act)

---

## Executive Summary

The LoanDataAnalyzer agent performs disparate impact testing using the 80% rule (EEOC framework) to detect potential lending discrimination. It analyzes approval rates, interest rate pricing, and loan terms across protected classes, applying regression analysis to control for legitimate credit risk factors (FICO, DTI, LTV).

### Key Capabilities

1. **80% Rule Testing**: Impact ratio = (Protected class rate) / (Comparison group rate)
2. **Regression Analysis**: Controls for FICO, DTI, LTV to isolate discrimination
3. **Matched-Pair Testing**: Identifies similar credit profiles with different outcomes
4. **Statistical Significance**: Chi-square tests, p-values, confidence intervals
5. **Examiner Q&A Preparation**: Anticipates regulatory questions with evidence-based responses

### Performance SLA

- **Latency**: <10 seconds for 5,000 loan applications
- **Statistical Confidence**: 95% confidence intervals
- **Accuracy**: 99% calculation accuracy for impact ratios
- **Uptime**: 99.9% availability

---

## Type Definitions

### Core Types

```typescript
// specs/fair-lending/types.ts

/**
 * Sanitized loan application for fair lending analysis
 * PII removed, protected class data stored separately
 */
export interface SanitizedLoanApplication {
  application_id: string;
  applicant_token: string; // [PERSON_XXX]
  loan_amount_requested: number;
  loan_purpose: 'home_purchase' | 'refinance' | 'home_improvement';
  property_value?: number;
  credit_score: number; // FICO score
  debt_to_income_ratio: number; // 0-1 (e.g., 0.43 = 43%)
  loan_to_value_ratio?: number; // 0-1 (e.g., 0.80 = 80% LTV)
  employment_status: 'employed' | 'self_employed' | 'retired' | 'unemployed';
  annual_income: number;
  application_date: string; // ISO 8601
  decision: 'approved' | 'denied' | 'withdrawn' | 'incomplete';
  decision_date?: string;
  approved_amount?: number;
  interest_rate?: number; // APR as decimal (0.0425 = 4.25%)
  loan_term_months?: number;
  denial_reasons?: string[]; // Adverse action reasons
  metadata: {
    sanitized_at: string;
    sanitization_version: string;
  };
}

/**
 * Protected class information (stored in separate secure vault)
 * Linked to application via applicant_token
 */
export interface ProtectedClassData {
  applicant_token: string;
  race: 'white' | 'black' | 'hispanic' | 'asian' | 'native_american' | 'pacific_islander' | 'two_or_more' | 'not_provided';
  ethnicity: 'hispanic_latino' | 'not_hispanic_latino' | 'not_provided';
  sex: 'male' | 'female' | 'not_provided';
  age_bracket: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
  marital_status?: 'married' | 'unmarried' | 'separated';
}

/**
 * Disparate impact test result (80% rule)
 */
export interface DisparateImpactResult {
  protected_class: string; // e.g., "Black or African American"
  comparison_group: string; // e.g., "White (Non-Hispanic)"
  metric: 'approval_rate' | 'pricing' | 'denial_rate';
  sample_size_protected: number;
  sample_size_comparison: number;
  protected_class_rate: number; // 0-1 (e.g., 0.60 = 60% approval)
  comparison_group_rate: number; // 0-1 (e.g., 0.75 = 75% approval)
  impact_ratio: number; // protected / comparison (e.g., 0.60/0.75 = 0.80)
  disparate_impact_found: boolean; // true if ratio < 0.80
  statistical_significance: number; // p-value from chi-square test
  confidence_interval_95: [number, number]; // [lower, upper] bounds
  severity: 'none' | 'borderline' | 'moderate' | 'severe';
  regulatory_citation: string; // "15 USC §1691 - ECOA"
  recommended_action: 'no_action' | 'monitor' | 'investigate' | 'remediate' | 'legal_review';
}

/**
 * Regression analysis result
 * Controls for legitimate credit risk factors
 */
export interface RegressionAnalysisResult {
  protected_class: string;
  dependent_variable: 'approval' | 'interest_rate' | 'loan_amount';
  control_variables: string[]; // ['credit_score', 'dti', 'ltv', 'income']
  protected_class_coefficient: number; // Marginal effect
  protected_class_p_value: number; // Statistical significance
  protected_class_significant: boolean; // true if p < 0.05
  r_squared: number; // Model fit (0-1)
  sample_size: number;
  interpretation: string; // Human-readable explanation
  conclusion: 'no_discrimination' | 'possible_discrimination' | 'discrimination_detected';
}

/**
 * Matched-pair comparison
 * Identifies similar credit profiles with different outcomes
 */
export interface MatchedPairResult {
  pair_id: string;
  protected_applicant_token: string;
  comparison_applicant_token: string;
  protected_class: string;
  comparison_group: string;
  similarity_score: number; // 0-1 (how closely matched)
  credit_score_diff: number; // Absolute difference
  dti_diff: number;
  income_diff: number;
  protected_decision: 'approved' | 'denied';
  comparison_decision: 'approved' | 'denied';
  protected_interest_rate?: number;
  comparison_interest_rate?: number;
  outcome_disparity: boolean; // true if different outcomes despite similar credit
  pricing_disparity_bps?: number; // Basis points difference in interest rate
  explanation: string;
}

/**
 * Examiner Q&A preparation
 * STAR format (Situation, Task, Action, Result)
 */
export interface ExaminerQuestion {
  question_id: string;
  question_category: 'disparate_impact' | 'pricing' | 'redlining' | 'policies' | 'monitoring';
  anticipated_question: string;
  star_response: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  supporting_evidence: string[]; // References to analysis outputs
  regulatory_citations: string[];
  confidence: number; // 0-100 (how likely examiner will ask this)
}

/**
 * Agent SDK configuration for LoanDataAnalyzer
 */
export interface LoanDataAnalyzerConfig {
  // Claude API settings
  model: 'claude-sonnet-4-5-20250929' | 'claude-opus-4-5-20251101';
  max_tokens: number; // Recommended: 8000
  temperature: number; // Recommended: 0.0

  // 80% rule settings
  impact_ratio_threshold: number; // Default: 0.80
  minimum_sample_size: number; // Default: 30 per group
  statistical_significance_threshold: number; // Default: 0.05 (p < 0.05)

  // Regression analysis settings
  control_variables: string[]; // Default: ['credit_score', 'dti', 'ltv', 'income']
  regression_model: 'logistic' | 'linear' | 'both';

  // Matched-pair settings
  similarity_threshold: number; // Default: 0.90 (90% similar)
  max_credit_score_diff: number; // Default: 20 points
  max_dti_diff: number; // Default: 0.05 (5 percentage points)

  // Performance settings
  batch_size: number; // Applications per analysis, default: 1000
  parallel_workers: number; // Default: 4
}

/**
 * Input to LoanDataAnalyzer agent
 */
export interface LoanDataAnalyzerInput {
  applications: SanitizedLoanApplication[];
  protected_class_data: ProtectedClassData[];
  config: LoanDataAnalyzerConfig;
  session_id: string;
  analysis_period: {
    start_date: string;
    end_date: string;
  };
}

/**
 * Output from LoanDataAnalyzer agent
 */
export interface LoanDataAnalyzerOutput {
  session_id: string;
  processed_at: string;
  analysis_period: LoanDataAnalyzerInput['analysis_period'];
  disparate_impact_results: DisparateImpactResult[];
  regression_analyses: RegressionAnalysisResult[];
  matched_pairs: MatchedPairResult[];
  examiner_qna: ExaminerQuestion[];
  overall_risk_assessment: 'low' | 'moderate' | 'high' | 'critical';
  recommended_actions: string[];
  legal_review_required: boolean;
  performance_metrics: {
    total_duration_ms: number;
    applications_analyzed: number;
    protected_class_breakdowns: Record<string, number>;
    claude_api_calls: number;
    claude_tokens_used: number;
  };
}
```

---

## 80% Rule Calculation Examples

### Example 1: Classic Disparate Impact (Approval Rates)

**Scenario**: Mortgage lending analysis

- **White applicants**: 150 approved / 200 total = **75% approval rate**
- **Black applicants**: 45 approved / 75 total = **60% approval rate**
- **Impact Ratio**: 60% / 75% = **0.80** (exactly at threshold)

**Interpretation**: Borderline disparate impact. Requires further investigation via regression analysis to control for credit factors.

### Example 2: Clear Disparate Impact

**Scenario**: Auto loan approvals

- **White applicants**: 180 approved / 200 total = **90% approval rate**
- **Hispanic applicants**: 48 approved / 75 total = **64% approval rate**
- **Impact Ratio**: 64% / 90% = **0.71** (< 0.80)

**Finding**: **DISPARATE IMPACT DETECTED**
**Severity**: Moderate (ratio 0.71-0.75 = moderate, <0.70 = severe)
**Action**: Regression analysis required to determine if due to credit factors or discrimination

### Example 3: No Disparate Impact

**Scenario**: Personal loan approvals

- **White applicants**: 140 approved / 200 total = **70% approval rate**
- **Asian applicants**: 63 approved / 90 total = **70% approval rate**
- **Impact Ratio**: 70% / 70% = **1.00** (> 0.80)

**Finding**: No disparate impact
**Action**: Continue monitoring

---

## Database Schema

```sql
-- specs/fair-lending/schema.sql

CREATE TABLE fair_lending.loan_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id TEXT NOT NULL UNIQUE,
  applicant_token TEXT NOT NULL,
  loan_amount_requested NUMERIC(15, 2) NOT NULL,
  loan_purpose TEXT NOT NULL,
  property_value NUMERIC(15, 2),
  credit_score INTEGER NOT NULL CHECK (credit_score BETWEEN 300 AND 850),
  debt_to_income_ratio NUMERIC(5, 4) NOT NULL CHECK (debt_to_income_ratio BETWEEN 0 AND 1),
  loan_to_value_ratio NUMERIC(5, 4) CHECK (loan_to_value_ratio BETWEEN 0 AND 1),
  employment_status TEXT NOT NULL,
  annual_income NUMERIC(12, 2) NOT NULL,
  application_date DATE NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'denied', 'withdrawn', 'incomplete')),
  decision_date DATE,
  approved_amount NUMERIC(15, 2),
  interest_rate NUMERIC(6, 5) CHECK (interest_rate BETWEEN 0 AND 0.30),
  loan_term_months INTEGER,
  denial_reasons TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_applications_token (applicant_token),
  INDEX idx_applications_decision (decision),
  INDEX idx_applications_date (application_date DESC),
  INDEX idx_applications_credit_score (credit_score)
);

-- Protected class vault (separate schema with restricted access)
CREATE SCHEMA protected_class_vault;

CREATE TABLE protected_class_vault.applicant_demographics (
  applicant_token TEXT PRIMARY KEY,
  race TEXT NOT NULL,
  ethnicity TEXT NOT NULL,
  sex TEXT NOT NULL,
  age_bracket TEXT NOT NULL,
  marital_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Only compliance officers and legal can access
ALTER TABLE protected_class_vault.applicant_demographics ENABLE ROW LEVEL SECURITY;

-- Disparate impact analysis results
CREATE TABLE fair_lending.disparate_impact_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  protected_class TEXT NOT NULL,
  comparison_group TEXT NOT NULL,
  metric TEXT NOT NULL,
  impact_ratio NUMERIC(5, 4) NOT NULL,
  disparate_impact_found BOOLEAN NOT NULL,
  statistical_significance NUMERIC(6, 5),
  severity TEXT,
  analysis_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_impact_session (session_id),
  INDEX idx_impact_class (protected_class),
  INDEX idx_impact_ratio (impact_ratio)
);
```

---

## Test Specifications

```typescript
// Key test cases

describe('80% Rule Calculation', () => {
  it('should detect disparate impact when ratio < 0.80', async () => {
    // White: 90% approval, Black: 64% approval
    // Impact ratio: 0.71 < 0.80 = DISPARATE IMPACT
  });

  it('should pass when ratio >= 0.80', async () => {
    // White: 75%, Black: 60% = ratio 0.80 (borderline pass)
  });
});

describe('Regression Analysis', () => {
  it('should control for FICO, DTI, LTV in approval prediction', async () => {
    // Regression: approval ~ race + fico + dti + ltv
    // If race coefficient significant (p < 0.05) after controls = discrimination
  });
});

describe('Matched-Pair Testing', () => {
  it('should identify similar applicants with different outcomes', async () => {
    // Two applicants: FICO 720, DTI 35%, Income $80K
    // White approved at 4.5%, Black denied or approved at 5.2% = disparity
  });
});
```

---

## Legal Review Gate

```typescript
/**
 * If disparate impact detected, block workflow until General Counsel approval
 */
export class LegalReviewGate {
  async requestLegalReview(finding: DisparateImpactResult): Promise<void> {
    if (finding.disparate_impact_found && finding.severity !== 'none') {
      // Upload findings to restricted Box folder
      // Send urgent email to General Counsel
      // Poll for "APPROVED" or "REJECTED" comment
      // Block further processing until approval
    }
  }
}
```

---

## Performance Benchmarks

- **5,000 applications**: <10 seconds total
- **Statistical accuracy**: 99% for impact ratio calculations
- **False positive rate**: <5% (borderline cases flagged appropriately)

---

*Last Updated: February 15, 2026*
*Status: Ready for Implementation*
