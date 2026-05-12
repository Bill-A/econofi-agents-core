import 'dotenv/config';
import { createServiceClient } from '../src/lib/supabase';

const DEMO_BANK_ID = '00000000-0000-0000-0000-000000000001';

const ACCOUNTS = [
  { account_hash: 'a8f3c92e4b1d5f7a3c2b1e9d0f8a7b6c', customer_token: '[PERSON_001]' },
  { account_hash: 'b1c4d7e2f5a8b3c6d9e0f3a6b9c2d5e8', customer_token: '[PERSON_002]' },
  { account_hash: 'c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7', customer_token: '[PERSON_003]' },
  { account_hash: 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8', customer_token: '[PERSON_004]' },
];

const ALERTS = [
  {
    alert_id: 'ALT-2026-05-04-00001',
    account_hash: 'a8f3c92e4b1d5f7a3c2b1e9d0f8a7b6c',
    customer_token: '[PERSON_001]',
    risk_score: 87,
    alert_type: 'structuring',
    severity: 'high',
    suspicious_indicators: [
      'Three cash deposits of $9,200, $9,400, and $9,150 across three branches within 5-day window',
      'All deposits below $10,000 CTR threshold — pattern consistent with deliberate avoidance',
      'No corresponding business activity increase to explain deposit frequency',
    ],
    regulatory_citation: '31 USC §5324 — Structuring transactions to evade reporting requirements',
    recommended_action: 'file_sar',
    confidence_score: 88,
    false_positive_probability: 0.12,
    transactions_flagged: [
      {
        transaction_id: 'txn-demo-001a',
        account_hash: 'a8f3c92e4b1d5f7a3c2b1e9d0f8a7b6c',
        customer_token: '[PERSON_001]',
        amount: 9200,
        transaction_type: 'cash_deposit',
        transaction_date: '2026-05-01T09:15:00Z',
        is_online_banking: false,
        metadata: { sanitized_at: '2026-05-01T09:15:00Z', sanitization_version: '1.0' },
      },
      {
        transaction_id: 'txn-demo-001b',
        account_hash: 'a8f3c92e4b1d5f7a3c2b1e9d0f8a7b6c',
        customer_token: '[PERSON_001]',
        amount: 9400,
        transaction_type: 'cash_deposit',
        transaction_date: '2026-05-02T11:30:00Z',
        is_online_banking: false,
        metadata: { sanitized_at: '2026-05-02T11:30:00Z', sanitization_version: '1.0' },
      },
      {
        transaction_id: 'txn-demo-001c',
        account_hash: 'a8f3c92e4b1d5f7a3c2b1e9d0f8a7b6c',
        customer_token: '[PERSON_001]',
        amount: 9150,
        transaction_type: 'cash_deposit',
        transaction_date: '2026-05-03T14:00:00Z',
        is_online_banking: false,
        metadata: { sanitized_at: '2026-05-03T14:00:00Z', sanitization_version: '1.0' },
      },
    ],
    expires_at: '2026-06-04T00:00:00Z',
    investigation_status: 'pending',
  },
  {
    alert_id: 'ALT-2026-05-05-00001',
    account_hash: 'b1c4d7e2f5a8b3c6d9e0f3a6b9c2d5e8',
    customer_token: '[PERSON_002]',
    risk_score: 94,
    alert_type: 'velocity_anomaly',
    severity: 'critical',
    suspicious_indicators: [
      '11 wire transfers totaling $284,000 in 48-hour window — 6x account baseline',
      'All outbound wires to 4 previously unused counterparty accounts',
      'Account average for 6-month period: 1.8 wire transfers per month',
      'No customer contact or business documentation on file for new counterparties',
    ],
    regulatory_citation: '31 USC §5318(g) — Suspicious activity report filing obligations',
    recommended_action: 'escalate_immediately',
    confidence_score: 96,
    false_positive_probability: 0.04,
    transactions_flagged: [
      {
        transaction_id: 'txn-demo-002a',
        account_hash: 'b1c4d7e2f5a8b3c6d9e0f3a6b9c2d5e8',
        customer_token: '[PERSON_002]',
        amount: 28000,
        transaction_type: 'wire_out',
        transaction_date: '2026-05-05T08:00:00Z',
        is_online_banking: true,
        metadata: { sanitized_at: '2026-05-05T08:00:00Z', sanitization_version: '1.0' },
      },
    ],
    expires_at: '2026-06-05T00:00:00Z',
    investigation_status: 'in_progress',
  },
  {
    alert_id: 'ALT-2026-05-06-00001',
    account_hash: 'c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7',
    customer_token: '[PERSON_003]',
    risk_score: 62,
    alert_type: 'geographic_risk',
    severity: 'medium',
    suspicious_indicators: [
      'Wire transfer to high-risk jurisdiction (counterparty country: IR)',
      'Destination country flagged under OFAC SDN watch list monitoring',
      'Customer has no documented international business relationships',
    ],
    regulatory_citation: '31 CFR Part 560 — Iranian Transactions and Sanctions Regulations',
    recommended_action: 'investigate',
    confidence_score: 71,
    false_positive_probability: 0.29,
    transactions_flagged: [
      {
        transaction_id: 'txn-demo-003a',
        account_hash: 'c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7',
        customer_token: '[PERSON_003]',
        amount: 15500,
        transaction_type: 'wire_out',
        transaction_date: '2026-05-06T10:45:00Z',
        is_online_banking: false,
        metadata: { sanitized_at: '2026-05-06T10:45:00Z', sanitization_version: '1.0' },
      },
    ],
    expires_at: '2026-06-06T00:00:00Z',
    investigation_status: 'pending',
  },
  {
    alert_id: 'ALT-2026-05-07-00001',
    account_hash: 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8',
    customer_token: '[PERSON_004]',
    risk_score: 73,
    alert_type: 'round_dollar',
    severity: 'high',
    suspicious_indicators: [
      'Six consecutive round-dollar wire transfers: $5,000, $10,000, $15,000, $20,000, $10,000, $5,000 over 9 days',
      'Round-dollar amounts rarely occur in legitimate business wire activity',
      'All transfers to a single previously unknown counterparty account',
      'Account opened 6 weeks prior — consistent with layering setup period',
    ],
    regulatory_citation: '31 CFR §1020.320 — SAR filing requirements for suspicious transaction patterns',
    recommended_action: 'file_sar',
    confidence_score: 79,
    false_positive_probability: 0.21,
    transactions_flagged: [
      {
        transaction_id: 'txn-demo-004a',
        account_hash: 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8',
        customer_token: '[PERSON_004]',
        amount: 5000,
        transaction_type: 'wire_out',
        transaction_date: '2026-05-01T10:00:00Z',
        is_online_banking: true,
        metadata: { sanitized_at: '2026-05-01T10:00:00Z', sanitization_version: '1.0' },
      },
      {
        transaction_id: 'txn-demo-004b',
        account_hash: 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8',
        customer_token: '[PERSON_004]',
        amount: 10000,
        transaction_type: 'wire_out',
        transaction_date: '2026-05-03T11:15:00Z',
        is_online_banking: true,
        metadata: { sanitized_at: '2026-05-03T11:15:00Z', sanitization_version: '1.0' },
      },
      {
        transaction_id: 'txn-demo-004c',
        account_hash: 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8',
        customer_token: '[PERSON_004]',
        amount: 15000,
        transaction_type: 'wire_out',
        transaction_date: '2026-05-05T09:30:00Z',
        is_online_banking: true,
        metadata: { sanitized_at: '2026-05-05T09:30:00Z', sanitization_version: '1.0' },
      },
      {
        transaction_id: 'txn-demo-004d',
        account_hash: 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8',
        customer_token: '[PERSON_004]',
        amount: 20000,
        transaction_type: 'wire_out',
        transaction_date: '2026-05-07T14:00:00Z',
        is_online_banking: true,
        metadata: { sanitized_at: '2026-05-07T14:00:00Z', sanitization_version: '1.0' },
      },
      {
        transaction_id: 'txn-demo-004e',
        account_hash: 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8',
        customer_token: '[PERSON_004]',
        amount: 10000,
        transaction_type: 'wire_out',
        transaction_date: '2026-05-08T10:45:00Z',
        is_online_banking: true,
        metadata: { sanitized_at: '2026-05-08T10:45:00Z', sanitization_version: '1.0' },
      },
      {
        transaction_id: 'txn-demo-004f',
        account_hash: 'd3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8',
        customer_token: '[PERSON_004]',
        amount: 5000,
        transaction_type: 'wire_out',
        transaction_date: '2026-05-09T13:20:00Z',
        is_online_banking: true,
        metadata: { sanitized_at: '2026-05-09T13:20:00Z', sanitization_version: '1.0' },
      },
    ],
    expires_at: '2026-06-07T00:00:00Z',
    investigation_status: 'pending',
  },
];

async function seedDemo(): Promise<void> {
  const supabase = createServiceClient();

  process.stdout.write('Upserting bank_customer_mapping entries...\n');
  for (const account of ACCOUNTS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('bank_customer_mapping') as any).upsert(
      { bank_id: DEMO_BANK_ID, ...account },
      { onConflict: 'bank_id,account_hash' },
    );
    if (error !== null) {
      throw new Error(`bank_customer_mapping upsert failed: ${(error as { message: string }).message}`);
    }
  }
  process.stdout.write(`  ${ACCOUNTS.length} accounts mapped to bank ${DEMO_BANK_ID}\n`);

  process.stdout.write('Removing existing demo alerts...\n');
  const alertIds = ALERTS.map((a) => a.alert_id);
  const { error: deleteError } = await supabase
    .schema('bsa_aml')
    .from('alerts')
    .delete()
    .in('alert_id', alertIds);
  if (deleteError !== null) {
    throw new Error(`Alert cleanup failed: ${deleteError.message}`);
  }

  process.stdout.write('Inserting demo alerts...\n');
  for (const alert of ALERTS) {
    const { error } = await supabase.schema('bsa_aml').from('alerts').insert(alert);
    if (error !== null) {
      throw new Error(`Alert insert failed (${alert.alert_id}): ${error.message}`);
    }
    process.stdout.write(`  ${alert.alert_id}  ${alert.severity.toUpperCase().padEnd(8)}  ${alert.alert_type}\n`);
  }

  process.stdout.write('\nDemo seed complete. 3 alerts ready for bank-demo-001.\n');
}

seedDemo().catch((err: unknown) => {
  process.stderr.write(`Seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
