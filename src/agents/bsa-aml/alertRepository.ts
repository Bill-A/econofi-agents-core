/**
 * AlertRepository — Supabase persistence for BSA/AML alerts.
 *
 * All queries run after setBankContext() sets app.current_bank_id,
 * which activates the bsa_aml.alerts RLS isolation policy.
 *
 * Schema: bsa_aml — separate namespace from public and cra.
 * Audit trail writes are fire-and-forget (non-blocking).
 */

import { getServiceClient, setBankContext } from '../../lib/supabase';
import { DatabaseError } from '../../types/bsa-aml';
import type { SuspiciousActivityAlert } from '../../types/bsa-aml';
import type { BsaAmlAlert, BsaAmlAlertEvent, InvestigationStatus } from '../../types/database';

export interface ListAlertsFilters {
  readonly severity?: string;
  readonly status?: string;
  readonly from_date?: string;
  readonly to_date?: string;
}

export interface ListAlertsPagination {
  readonly page: number;
  readonly per_page: number;
}

export interface AlertStatusUpdate {
  readonly status: InvestigationStatus;
  readonly from_status?: string;
  readonly investigation_notes?: string;
  readonly sar_reference_number?: string;
  readonly closure_reason_code?: string;
  readonly closure_reason_detail?: string;
}

export class AlertRepository {
  async saveAlert(alert: SuspiciousActivityAlert, bankId: string): Promise<void> {
    const supabase = getServiceClient();
    await setBankContext(supabase, bankId);

    // Ensure account_hash is mapped to this bank so RLS SELECT policies work
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('bank_customer_mapping') as any).upsert(
      {
        bank_id: bankId,
        account_hash: alert.account_hash,
        customer_token: alert.customer_token,
      },
      { onConflict: 'bank_id,account_hash' },
    );

    const { error } = await supabase
      .schema('bsa_aml')
      .from('alerts')
      .insert({
        alert_id: alert.alert_id,
        account_hash: alert.account_hash,
        customer_token: alert.customer_token,
        risk_score: alert.risk_score,
        alert_type: alert.alert_type,
        severity: alert.severity,
        transactions_flagged: alert.transactions_flagged,
        suspicious_indicators: alert.suspicious_indicators,
        regulatory_citation: alert.regulatory_citation,
        recommended_action: alert.recommended_action,
        confidence_score: alert.confidence_score,
        false_positive_probability: alert.false_positive_probability,
        expires_at: alert.expires_at,
        investigation_status: 'pending' as InvestigationStatus,
      });

    if (error !== null) {
      throw new DatabaseError(`Failed to persist alert ${alert.alert_id}: ${error.message}`);
    }
  }

  async listAlerts(
    bankId: string,
    filters: ListAlertsFilters,
    pagination: ListAlertsPagination,
  ): Promise<{ alerts: BsaAmlAlert[]; count: number }> {
    const supabase = getServiceClient();
    await setBankContext(supabase, bankId);

    const offset = (pagination.page - 1) * pagination.per_page;
    const rangeEnd = offset + pagination.per_page - 1;

    let query = supabase
      .schema('bsa_aml')
      .from('alerts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.severity !== undefined) {
      query = query.eq('severity', filters.severity);
    }
    if (filters.status !== undefined) {
      query = query.eq('investigation_status', filters.status);
    }
    if (filters.from_date !== undefined) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters.to_date !== undefined) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error, count } = await query.range(offset, rangeEnd);

    if (error !== null) {
      throw new DatabaseError(`Failed to list alerts: ${error.message}`);
    }

    return {
      alerts: (data as BsaAmlAlert[]) ?? [],
      count: count ?? 0,
    };
  }

  async findAlertById(alertId: string, bankId: string): Promise<BsaAmlAlert | null> {
    const supabase = getServiceClient();
    await setBankContext(supabase, bankId);

    const { data, error } = await supabase
      .schema('bsa_aml')
      .from('alerts')
      .select('*')
      .eq('alert_id', alertId)
      .single();

    if (error !== null) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(`Failed to find alert ${alertId}: ${error.message}`);
    }

    return data as BsaAmlAlert;
  }

  async updateAlertStatus(
    alertId: string,
    update: AlertStatusUpdate,
    bankId: string,
  ): Promise<void> {
    const supabase = getServiceClient();
    await setBankContext(supabase, bankId);

    const completedStatuses: InvestigationStatus[] = ['sar_filed', 'no_sar_warranted', 'false_positive'];
    const isCompleted = completedStatuses.includes(update.status);

    const updatePayload: Record<string, unknown> = {
      investigation_status: update.status,
      investigation_notes: update.investigation_notes ?? null,
      investigation_completed_at: isCompleted ? new Date().toISOString() : null,
    };

    if (update.closure_reason_code !== undefined) {
      updatePayload['closure_reason_code'] = update.closure_reason_code;
    }
    if (update.closure_reason_detail !== undefined) {
      updatePayload['closure_reason_detail'] = update.closure_reason_detail;
    }

    const { error } = await supabase
      .schema('bsa_aml')
      .from('alerts')
      .update(updatePayload)
      .eq('alert_id', alertId);

    if (error !== null) {
      throw new DatabaseError(`Failed to update alert ${alertId}: ${error.message}`);
    }

    await this.logAlertEvent({
      alert_id: alertId,
      from_status: update.from_status ?? null,
      to_status: update.status,
      notes: update.investigation_notes,
      closure_reason_code: update.closure_reason_code,
      bankId,
    });
  }

  async logAlertEvent(params: {
    alert_id: string;
    from_status: string | null;
    to_status: string;
    notes?: string;
    closure_reason_code?: string;
    actor?: string;
    bankId: string;
  }): Promise<void> {
    const supabase = getServiceClient();
    await setBankContext(supabase, params.bankId);

    const { error } = await supabase
      .schema('bsa_aml')
      .from('alert_events')
      .insert({
        alert_id: params.alert_id,
        event_type: 'status_change',
        from_status: params.from_status,
        to_status: params.to_status,
        notes: params.notes ?? null,
        closure_reason_code: params.closure_reason_code ?? null,
        actor: params.actor ?? null,
      });

    if (error !== null) {
      throw new DatabaseError(`Failed to log event for alert ${params.alert_id}: ${error.message}`);
    }
  }

  async getAlertEvents(alertId: string): Promise<BsaAmlAlertEvent[]> {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .schema('bsa_aml')
      .from('alert_events')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: true });

    if (error !== null) {
      throw new DatabaseError(`Failed to fetch events for alert ${alertId}: ${error.message}`);
    }

    return (data as BsaAmlAlertEvent[]) ?? [];
  }
}
