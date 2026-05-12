/**
 * CRA NarrativeWriter Repository
 *
 * Persists NarrativeWriter generation results to Supabase.
 * Writes to: cra.generated_narratives, cra.narrative_audit_log
 *
 * All writes use Promise.allSettled — partial DB failure must not fail the API response.
 * All tables have RLS enabled. Bank context must be set before calling:
 *   await setBankContext(supabase, bankId)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../lib/logger';
import type { Database } from '../../types/database';
import type {
  NarrativeWriterInput,
  NarrativeWriterOutput,
} from '../../types/cra-narrative';

export class NarrativeWriterRepository {
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  // -------------------------------------------------------------------------
  // Persist full generation run
  // -------------------------------------------------------------------------

  async saveNarrativeRun(
    input: NarrativeWriterInput,
    output: NarrativeWriterOutput,
    bankId: string,
  ): Promise<void> {
    // Use allSettled — partial DB failure must not fail the API response
    const results = await Promise.allSettled([
      this.saveGeneratedNarrative(input, output, bankId),
      this.saveAuditLog(input, output, bankId),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error(
          { session_id: input.session_id, bank_id: bankId, reason: String(result.reason) },
          'NarrativeWriterRepository: DB write failed (non-blocking)',
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Individual write methods
  // -------------------------------------------------------------------------

  private async saveGeneratedNarrative(
    input: NarrativeWriterInput,
    output: NarrativeWriterOutput,
    _bankId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .schema('cra')
      .from('generated_narratives')
      .insert({
        session_id: output.session_id,
        bank_id: input.bank_id,
        reporting_year: input.config.reporting_year,
        evaluation_framework: input.config.evaluation_framework,
        narrative_sections: output.narrative_sections as unknown as object,
        performance_summary: output.performance_summary as unknown as object,
        public_file: output.public_file as unknown as object,
        anticipated_questions: output.anticipated_questions as unknown as object,
        community_impact_metrics: output.community_impact_metrics as unknown as object,
        document_url: output.document_url ?? null,
        is_complete: output.public_file.is_complete,
        claude_model: input.config.model,
        claude_tokens_used: output.performance_metrics.claude_tokens_used,
        generation_duration_ms: output.performance_metrics.total_duration_ms,
      });

    if (error !== null) {
      throw new Error(`saveGeneratedNarrative failed: ${error.message}`);
    }
  }

  private async saveAuditLog(
    input: NarrativeWriterInput,
    output: NarrativeWriterOutput,
    bankId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .schema('cra')
      .from('narrative_audit_log')
      .insert({
        session_id: output.session_id,
        bank_id: bankId,
        agent_name: 'NarrativeWriter',
        action: 'generate_narrative',
        reporting_year: input.config.reporting_year,
        input_record_count: input.validated_loans.length,
        output_narrative_id: null,
        claude_model: input.config.model,
        claude_tokens_used: output.performance_metrics.claude_tokens_used,
        duration_ms: output.performance_metrics.total_duration_ms,
        error_message: null,
      });

    if (error !== null) {
      throw new Error(`saveAuditLog failed: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Acknowledgment write (compliance officer sign-off)
  // -------------------------------------------------------------------------

  async saveAcknowledgment(
    sessionId: string,
    bankId: string,
    acknowledgedBy: string,
    acknowledgmentNote: string | undefined,
  ): Promise<void> {
    const note = acknowledgmentNote !== undefined ? acknowledgmentNote : null;

    const { error } = await this.supabase
      .schema('cra')
      .from('narrative_audit_log')
      .insert({
        session_id: sessionId,
        bank_id: bankId,
        agent_name: 'NarrativeWriter',
        action: `acknowledged_by:${acknowledgedBy}${note !== null ? `:note:${note}` : ''}`,
        reporting_year: null,
        input_record_count: null,
        output_narrative_id: null,
        claude_model: null,
        claude_tokens_used: null,
        duration_ms: null,
        error_message: null,
      });

    if (error !== null) {
      throw new Error(`saveAcknowledgment failed: ${error.message}`);
    }
  }
}
