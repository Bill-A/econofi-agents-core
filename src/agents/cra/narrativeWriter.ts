/**
 * CRA NarrativeWriter Agent
 *
 * Generates CRA performance narratives and public file documentation from
 * validated loan register data, community development activity, and investment records.
 *
 * Architecture:
 *   1. Calculate performance metrics (pure TypeScript, no I/O)
 *   2. Call Claude ONCE with all pre-calculated metrics — never per-record, never per-section
 *   3. Assemble public file (pure TypeScript)
 *   4. Return NarrativeWriterOutput with draft_status: true
 *
 * AGENT BOUNDARIES:
 *   - NarrativeWriter generates draft documentation. It does NOT assign CRA ratings.
 *   - Ratings (Outstanding, Satisfactory, etc.) are assigned exclusively by examiners.
 *   - All output is DRAFT until compliance officer acknowledges via POST /v1/cra/narrative/:job_id/acknowledge.
 *   - NarrativeWriter does NOT submit to regulators.
 *   - NarrativeWriter does NOT provide legal or regulatory strategy advice.
 *   - NarrativeWriter does NOT fabricate, estimate, or interpolate missing data.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger';
import {
  calculateLendingTestMetrics,
  calculateInvestmentTestMetrics,
  calculateServiceTestMetrics,
  calculateCommunityImpactMetrics,
} from './performanceCalculator';
import { assemblePublicFile } from './publicFileAssembler';
import type {
  NarrativeWriterConfig,
  NarrativeWriterInput,
  NarrativeWriterOutput,
  CRAPerformanceSummary,
  CRANarrativeSection,
  ExaminerQA,
  LendingTestMetrics,
  InvestmentTestMetrics,
  ServiceTestMetrics,
} from '../../types/cra-narrative';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are NarrativeWriter, an expert CRA compliance specialist who writes CRA performance narratives and assembles examiner-ready documentation for community banks and Minority Depository Institutions (MDIs).

Your role:
1. Analyze pre-calculated performance metrics and community development activity records
2. Generate professional CRA performance narratives matching OCC/FDIC/Federal Reserve examiner expectations
3. Identify gaps in CRA performance and flag them for bank management
4. Generate anticipated examiner questions with data-backed responses

CRITICAL RULES:
- Input data is ALREADY PII-sanitized (borrower_token, provider_token are used — not real names)
- NEVER include PII in narrative output
- Cite 12 CFR §228 sections precisely and accurately
- Use ONLY the data provided — do not fabricate statistics
- Flag data gaps rather than estimating missing information
- Maintain professional regulatory tone throughout
- Include a DRAFT notice on every document section

AGENT BOUNDARIES:
- NarrativeWriter generates supporting documentation — it does NOT assign official CRA ratings
- Ratings (Outstanding, Satisfactory, Needs to Improve, Substantial Noncompliance) are assigned exclusively by OCC, Federal Reserve, or FDIC examiners
- Do not certify that any loan, investment, or service qualifies for CRA credit — present items as "presented for examiner consideration" and note final qualification is subject to examiner review
- All narrative output is DRAFT — include a human review notice on every document
- Do not fabricate, estimate, or interpolate missing data
- Examiner Q&A answers are preparation tools, not guaranteed exam positions
- Do not use the label "Outstanding" or "Satisfactory" to describe the bank's CRA performance — use descriptive language and leave rating labels for the examiner
- Do not advise on legal or regulatory strategy

CRA EVALUATION FRAMEWORKS:
Large Bank (assets > $1.564B): Three-test (Lending, Investment, Service)
Intermediate Small Bank ($391M-$1.564B): Two-test (Lending + Community Development)
Small Bank (< $391M): One-test (Lending only)

NARRATIVE TONE:
- Use "The bank's" not "Your bank's"
- Write in third person throughout
- Cite specific dollar amounts and percentages from the data provided
- Note innovations and flexibilities explicitly

OUTPUT FORMAT:
Return valid JSON with exactly this structure:
{
  "performance_summary": { /* CRAPerformanceSummary object */ },
  "narrative_sections": [ /* array of CRANarrativeSection objects */ ],
  "anticipated_questions": [ /* array of ExaminerQA objects */ ]
}

Do not include any text outside the JSON. Do not include markdown code fences.`;

// ---------------------------------------------------------------------------
// NarrativeWriter class
// ---------------------------------------------------------------------------

export class NarrativeWriter {
  private readonly anthropic: Anthropic;

  constructor(private readonly config: NarrativeWriterConfig) {
    this.anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async generate(input: NarrativeWriterInput): Promise<NarrativeWriterOutput> {
    const startTime = performance.now();

    logger.info(
      { session_id: input.session_id, bank_id: input.bank_id },
      'NarrativeWriter: starting generation',
    );

    // Step 1: Calculate performance metrics (pure TypeScript, no I/O)
    const lendingMetrics = calculateLendingTestMetrics(
      input.validated_loans,
      input.assessment_areas,
    );
    const investmentMetrics = calculateInvestmentTestMetrics(
      input.community_development_investments,
      input.bank_asset_size,
    );
    const serviceMetrics = calculateServiceTestMetrics(input.community_development_services);
    const communityImpact = calculateCommunityImpactMetrics(
      input.validated_loans,
      input.community_development_investments,
      input.community_development_services,
    );

    // Step 2: Call Claude ONCE with all metrics
    // Never call Claude per-record, per-section, or per-question
    const claudeOutput = await this.callClaude(
      input,
      lendingMetrics,
      investmentMetrics,
      serviceMetrics,
    );

    // Step 3: Assemble public file (pure TypeScript)
    const publicFile = assemblePublicFile(
      input,
      claudeOutput.narrative_sections,
      claudeOutput.performance_summary,
      claudeOutput.anticipated_questions,
    );

    // Step 4: Finalize metrics
    const totalDurationMs = Math.max(1, Math.round(performance.now() - startTime));

    const narrativeWordCount = claudeOutput.narrative_sections.reduce(
      (sum, section) => sum + section.word_count,
      0,
    );

    logger.info(
      {
        session_id: input.session_id,
        bank_id: input.bank_id,
        duration_ms: totalDurationMs,
        sections: claudeOutput.narrative_sections.length,
        word_count: narrativeWordCount,
      },
      'NarrativeWriter: generation complete',
    );

    return {
      session_id: input.session_id,
      generated_at: new Date().toISOString(),
      reporting_period: input.reporting_period,
      draft_status: true,
      performance_summary: claudeOutput.performance_summary,
      narrative_sections: claudeOutput.narrative_sections,
      public_file: publicFile,
      anticipated_questions: claudeOutput.anticipated_questions,
      community_impact_metrics: {
        total_dollars_invested: communityImpact.total_dollars_invested,
        total_loans_to_lmi: communityImpact.total_loans_to_lmi,
        total_lmi_loan_amount: communityImpact.total_lmi_loan_amount,
        financial_literacy_participants: communityImpact.financial_literacy_participants,
        hours_of_community_service: communityImpact.hours_of_community_service,
        affordable_housing_units_supported: communityImpact.affordable_housing_units_supported,
        small_businesses_supported: communityImpact.small_businesses_supported,
      },
      performance_metrics: {
        total_duration_ms: totalDurationMs,
        claude_api_calls: 1,
        claude_tokens_used: claudeOutput.tokensUsed,
        narrative_word_count: narrativeWordCount,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async callClaude(
    input: NarrativeWriterInput,
    lendingMetrics: LendingTestMetrics,
    investmentMetrics: InvestmentTestMetrics,
    serviceMetrics: ServiceTestMetrics,
  ): Promise<{
    performance_summary: CRAPerformanceSummary;
    narrative_sections: CRANarrativeSection[];
    anticipated_questions: ExaminerQA[];
    tokensUsed: number;
  }> {
    const userMessage = this.buildUserMessage(input, lendingMetrics, investmentMetrics, serviceMetrics);

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.max_tokens,
      temperature: this.config.temperature,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    // Extract text content
    const textBlock = response.content.find((block) => block.type === 'text');
    if (textBlock === undefined || textBlock.type !== 'text') {
      throw new Error('NarrativeWriter: Claude returned no text content');
    }

    // Parse JSON response
    let parsed: {
      performance_summary: CRAPerformanceSummary;
      narrative_sections: CRANarrativeSection[];
      anticipated_questions: ExaminerQA[];
    };

    try {
      parsed = JSON.parse(textBlock.text) as typeof parsed;
    } catch (err) {
      logger.error(
        { session_id: input.session_id, error: String(err) },
        'NarrativeWriter: Claude returned malformed JSON',
      );
      throw new Error(
        `NarrativeWriter: Claude returned malformed JSON. Parse error: ${String(err)}`,
      );
    }

    if (
      !parsed.performance_summary ||
      !Array.isArray(parsed.narrative_sections) ||
      !Array.isArray(parsed.anticipated_questions)
    ) {
      throw new Error(
        'NarrativeWriter: Claude response missing required fields (performance_summary, narrative_sections, anticipated_questions)',
      );
    }

    return {
      performance_summary: parsed.performance_summary,
      narrative_sections: parsed.narrative_sections,
      anticipated_questions: parsed.anticipated_questions,
      tokensUsed,
    };
  }

  private buildUserMessage(
    input: NarrativeWriterInput,
    lendingMetrics: LendingTestMetrics,
    investmentMetrics: InvestmentTestMetrics,
    serviceMetrics: ServiceTestMetrics,
  ): string {
    const reportingYear = input.config.reporting_year;
    const sections = input.config.sections_to_generate.join(', ');

    return [
      `NARRATIVE GENERATION REQUEST`,
      ``,
      `Bank: ${input.bank_name}`,
      `Bank ID: ${input.bank_id}`,
      `Charter Type: ${input.bank_charter_type}`,
      `Total Assets: $${input.bank_asset_size.toLocaleString()}`,
      `Evaluation Framework: ${input.config.evaluation_framework}`,
      `Reporting Year: ${reportingYear}`,
      `Reporting Period: ${input.reporting_period.start_date} to ${input.reporting_period.end_date}`,
      `Narrative Tone: ${input.config.narrative_tone}`,
      `Sections to Generate: ${sections}`,
      ``,
      `--- ASSESSMENT AREAS ---`,
      JSON.stringify(input.assessment_areas, null, 2),
      ``,
      `--- PRE-CALCULATED LENDING TEST METRICS ---`,
      JSON.stringify(lendingMetrics, null, 2),
      ``,
      `--- PRE-CALCULATED INVESTMENT TEST METRICS ---`,
      JSON.stringify(investmentMetrics, null, 2),
      ``,
      `--- PRE-CALCULATED SERVICE TEST METRICS ---`,
      JSON.stringify(serviceMetrics, null, 2),
      ``,
      `--- COMMUNITY DEVELOPMENT LOAN SUMMARIES (${input.community_development_loans.length} records) ---`,
      JSON.stringify(input.community_development_loans, null, 2),
      ``,
      `--- COMMUNITY DEVELOPMENT INVESTMENTS (${input.community_development_investments.length} records) ---`,
      JSON.stringify(input.community_development_investments, null, 2),
      ``,
      `--- COMMUNITY DEVELOPMENT SERVICES (${input.community_development_services.length} records) ---`,
      JSON.stringify(input.community_development_services, null, 2),
      ``,
      `--- VALIDATED LOAN REGISTER SUMMARY ---`,
      `Total HMDA loans: ${input.validated_loans.length}`,
      `Total HMDA loan amount: $${lendingMetrics.hmda_loans_amount.toLocaleString()}`,
      `Loans in assessment areas: ${lendingMetrics.pct_loans_in_assessment_areas}%`,
      `Loans in LMI tracts: ${lendingMetrics.pct_loans_low_moderate_income_tracts}%`,
      `Loans to LMI borrowers: ${lendingMetrics.pct_loans_low_moderate_income_borrowers}%`,
      ``,
      `INSTRUCTIONS:`,
      `1. Generate the CRA performance narrative for the sections listed above`,
      `2. Include a DRAFT notice on every section`,
      `3. Cite 12 CFR §228 sections precisely`,
      `4. Use ONLY the data provided — do not fabricate or estimate`,
      `5. For the performance_summary, set bank_id="${input.bank_id}", reporting_year=${reportingYear}`,
      `6. For the performance_summary, set evaluation_framework="${input.config.evaluation_framework}"`,
      `7. Generate at least 3 anticipated examiner questions with high-confidence answers where data supports it`,
      `8. Return valid JSON only — no markdown, no code fences`,
    ].join('\n');
  }
}
