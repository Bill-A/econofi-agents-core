/**
 * CRA DataGuard Repository
 *
 * Persists DataGuard validation results to Supabase.
 * All writes go to the cra schema: loan_records, validation_errors,
 * auto_corrections, audit_log.
 *
 * All tables have RLS enabled. Bank context must be set before calling:
 *   await setBankContext(supabase, bankId)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { Database } from '../../types/database';
import type {
  DataGuardInput,
  DataGuardOutput,
  LoanValidationError,
  LoanAutoCorrection,
  SanitizedLoanRecord,
} from '../../types/cra';

export class DataGuardRepository {
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  // -------------------------------------------------------------------------
  // Persist full validation run
  // -------------------------------------------------------------------------

  async saveValidationRun(
    input: DataGuardInput,
    output: DataGuardOutput,
    bankId: string,
  ): Promise<void> {
    // Write all in parallel — failures in one section don't block others
    await Promise.allSettled([
      this.saveLoanRecords(output.validated_records),
      this.saveValidationErrors(output.errors),
      this.saveAutoCorrections(output.corrections),
      this.saveAuditLog(input, output, bankId),
    ]);
  }

  // -------------------------------------------------------------------------
  // Individual write methods
  // -------------------------------------------------------------------------

  private async saveLoanRecords(records: SanitizedLoanRecord[]): Promise<void> {
    if (records.length === 0) return;

    const rows = records.map((r) => ({
      loan_id: r.loan_id,
      borrower_token: r.borrower_token,
      census_tract: r.census_tract,
      msa_md: r.msa_md,
      loan_amount: r.loan_amount,
      loan_origination_date: r.loan_origination_date,
      loan_purpose: r.loan_purpose,
      loan_type: r.loan_type,
      annual_revenue: r.annual_revenue ?? null,
      naics_code: r.naics_code ?? null,
      income_level: r.income_level ?? null,
      tract_income_level: r.tract_income_level,
      tract_minority_percentage: r.tract_minority_percentage ?? null,
      tract_median_income: r.tract_median_income ?? null,
      tract_population: r.tract_population ?? null,
      geocoding_quality: r.geocoding_quality,
      validated_at: new Date().toISOString(),
    }));

    // Upsert — re-running validation on the same loan register is idempotent
    await this.supabase
      .schema('cra')
      .from('loan_records')
      .upsert(rows, { onConflict: 'loan_id' });
  }

  private async saveValidationErrors(errors: LoanValidationError[]): Promise<void> {
    if (errors.length === 0) return;

    const rows = errors.map((e) => ({
      loan_id: e.loan_id,
      field: e.field,
      error_type: e.error_type,
      severity: e.severity,
      current_value: e.current_value !== null && e.current_value !== undefined
        ? String(e.current_value)
        : null,
      expected_value: e.expected_value !== null && e.expected_value !== undefined
        ? String(e.expected_value)
        : null,
      suggested_correction: e.suggested_correction ?? null,
      regulatory_requirement: e.regulatory_requirement,
      auto_correctable: e.auto_correctable,
      resolved: false,
    }));

    await this.supabase
      .schema('cra')
      .from('validation_errors')
      .insert(rows);
  }

  private async saveAutoCorrections(corrections: LoanAutoCorrection[]): Promise<void> {
    if (corrections.length === 0) return;

    const rows = corrections.map((c) => ({
      loan_id: c.loan_id,
      field: c.field,
      original_value: c.original_value !== null && c.original_value !== undefined
        ? String(c.original_value)
        : null,
      corrected_value: String(c.corrected_value),
      correction_type: c.correction_type,
      confidence: c.confidence,
      corrected_at: c.audit_trail.corrected_at,
      corrected_by: c.audit_trail.corrected_by,
      correction_rule: c.audit_trail.correction_rule,
    }));

    await this.supabase
      .schema('cra')
      .from('auto_corrections')
      .insert(rows);
  }

  private async saveAuditLog(
    input: DataGuardInput,
    output: DataGuardOutput,
    bankId: string,
  ): Promise<void> {
    const inputHash = createHash('sha256')
      .update(JSON.stringify({ session_id: input.session_id, loan_count: input.loans.length }))
      .digest('hex');

    const outputHash = createHash('sha256')
      .update(JSON.stringify(output.summary))
      .digest('hex');

    await this.supabase
      .schema('cra')
      .from('audit_log')
      .insert({
        session_id: output.session_id,
        agent_name: 'DataGuard',
        action: 'validate_batch',
        input_hash: inputHash,
        output_hash: outputHash,
        records_processed: output.summary.total_records,
        errors_found: output.errors.length,
        auto_corrections_applied: output.corrections.length,
        claude_model: input.config.model,
        claude_tokens_used: output.performance_metrics.claude_tokens_used,
        ffiec_api_calls: output.performance_metrics.ffiec_api_calls,
        duration_ms: output.performance_metrics.total_duration_ms,
        created_by: bankId,
      });
  }
}
