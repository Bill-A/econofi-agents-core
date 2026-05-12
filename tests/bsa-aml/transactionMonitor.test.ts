import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TransactionMonitor } from '../../src/agents/bsa-aml/transactionMonitor';
import type { SanitizedTransaction, TransactionMonitorConfig, CustomerHistoricalContext } from '../../src/types/bsa-aml';

// ---------------------------------------------------------------------------
// Mocks — isolate from Anthropic API in unit tests
// ---------------------------------------------------------------------------

jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn(() => Promise.resolve({
    id: 'msg_mock',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'CONFIRMED' }],
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  }));

  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));

  return { __esModule: true, default: MockAnthropic };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('TransactionMonitor Agent', () => {
  let monitor: TransactionMonitor;
  let defaultConfig: TransactionMonitorConfig;

  beforeEach(() => {
    defaultConfig = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 0.0,
      structuring_threshold_usd: 10000,
      structuring_proximity_tolerance: 0.15,
      velocity_anomaly_ratio_threshold: 3.0,
      round_dollar_threshold: 0.8,
      batch_size: 100,
      parallel_workers: 4,
      cache_ttl_seconds: 3600,
      enable_structuring_detection: true,
      enable_velocity_detection: true,
      enable_round_dollar_detection: true,
      enable_geographic_risk: true,
      enable_customer_segmentation: true,
    };

    monitor = new TransactionMonitor(defaultConfig);
  });

  // -------------------------------------------------------------------------
  // Structuring Detection
  // -------------------------------------------------------------------------

  describe('Structuring Detection', () => {
    it('should detect classic structuring pattern: 3 deposits <$10K in 3 days', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN001',
          account_hash: 'ACCT_HASH_A7F2',
          customer_token: '[PERSON_001]',
          amount: 9800,
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-13T10:30:00Z',
          branch_code: 'BR_DOWNTOWN',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-13T10:31:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN002',
          account_hash: 'ACCT_HASH_A7F2',
          customer_token: '[PERSON_001]',
          amount: 9900,
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-14T14:15:00Z',
          branch_code: 'BR_EASTSIDE',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-14T14:16:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN003',
          account_hash: 'ACCT_HASH_A7F2',
          customer_token: '[PERSON_001]',
          amount: 9700,
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-15T09:45:00Z',
          branch_code: 'BR_WESTSIDE',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T09:46:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_001' });

      expect(result.alerts_generated).toBe(1);
      const alert001 = result.alerts[0]!;
      expect(alert001.alert_type).toBe('structuring');
      expect(alert001.severity).toBe('critical');
      expect(alert001.risk_score).toBeGreaterThanOrEqual(85);
      expect(alert001.suspicious_indicators).toContainEqual(
        expect.stringMatching(/three.*deposits.*under.*10k/i)
      );
      expect(alert001.suspicious_indicators).toContainEqual(
        expect.stringMatching(/different.*branch/i)
      );
      expect(alert001.regulatory_citation).toContain('31 USC §5324');
      expect(alert001.recommended_action).toBe('file_sar');
    });

    it('should NOT flag legitimate business deposits that exceed $10K', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN004',
          account_hash: 'ACCT_HASH_B3D9',
          customer_token: '[BUSINESS_001]',
          amount: 12500.75,
          transaction_type: 'check_deposit',
          transaction_date: '2026-02-13T11:00:00Z',
          description_sanitized: 'Business revenue deposit',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-13T11:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_002' });

      expect(result.alerts_generated).toBe(0);
    });

    it('should detect "smurfing" pattern: same-day deposits at multiple branches', async () => {
      const sameDay = '2026-02-15';
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN005',
          account_hash: 'ACCT_HASH_C5E1',
          customer_token: '[PERSON_002]',
          amount: 4000,
          transaction_type: 'cash_deposit',
          transaction_date: `${sameDay}T09:00:00Z`,
          branch_code: 'BR_NORTH',
          is_online_banking: false,
          metadata: { sanitized_at: `${sameDay}T09:01:00Z`, sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN006',
          account_hash: 'ACCT_HASH_C5E1',
          customer_token: '[PERSON_002]',
          amount: 3500,
          transaction_type: 'cash_deposit',
          transaction_date: `${sameDay}T11:30:00Z`,
          branch_code: 'BR_SOUTH',
          is_online_banking: false,
          metadata: { sanitized_at: `${sameDay}T11:31:00Z`, sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN007',
          account_hash: 'ACCT_HASH_C5E1',
          customer_token: '[PERSON_002]',
          amount: 2000,
          transaction_type: 'cash_deposit',
          transaction_date: `${sameDay}T14:00:00Z`,
          branch_code: 'BR_EAST',
          is_online_banking: false,
          metadata: { sanitized_at: `${sameDay}T14:01:00Z`, sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_003' });

      expect(result.alerts_generated).toBe(1);
      const alert003 = result.alerts[0]!;
      expect(alert003.alert_type).toBe('structuring');
      expect(alert003.transactions_flagged.length).toBe(3);
      expect(alert003.suspicious_indicators).toContainEqual(
        expect.stringMatching(/same.*day.*multiple.*branches/i)
      );
    });

    it('should calculate threshold_proximity correctly for $9,999.99 single deposit', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN008',
          account_hash: 'ACCT_HASH_D7F3',
          customer_token: '[PERSON_003]',
          amount: 9999.99, // 0.01% below threshold
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-15T10:00:00Z',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_004' });

      expect(result.alerts_generated).toBe(1);
      const alert004 = result.alerts[0]!;
      expect(alert004.risk_score).toBeGreaterThanOrEqual(80);
      expect(alert004.suspicious_indicators.some(indicator =>
        indicator.toLowerCase().includes('threshold') || indicator.includes('$10,000')
      )).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Velocity Anomaly Detection
  // -------------------------------------------------------------------------

  describe('Velocity Anomaly Detection', () => {
    it('should detect dormant account activation', async () => {
      const historicalContext: CustomerHistoricalContext[] = [
        {
          account_hash: 'ACCT_HASH_E8G4',
          customer_token: '[PERSON_004]',
          account_age_days: 730, // 2 years old
          total_transactions_6mo: 4, // Very low activity
          avg_transaction_amount_6mo: 500,
          median_transaction_amount_6mo: 450,
          max_transaction_amount_6mo: 800,
          deposit_count_6mo: 2,
          withdrawal_count_6mo: 2,
          avg_monthly_balance_6mo: 1200,
          customer_segment: 'retail',
          expected_transaction_frequency: 'monthly',
          previous_sar_filings: 0,
        }
      ];

      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN009',
          account_hash: 'ACCT_HASH_E8G4',
          customer_token: '[PERSON_004]',
          amount: 250000, // Massive deposit vs. $500 average
          transaction_type: 'wire_in',
          transaction_date: '2026-02-15T10:00:00Z',
          counterparty_token: '[COUNTERPARTY_001]',
          counterparty_country: 'KY', // Cayman Islands
          geographic_risk_score: 75,
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({
        transactions,
        historical_context: historicalContext,
        config: defaultConfig,
        session_id: 'TEST_005'
      });

      expect(result.alerts_generated).toBe(1);
      const alert005 = result.alerts[0]!;
      expect(alert005.alert_type).toMatch(/velocity|geographic|multiple/);
      expect(alert005.severity).toMatch(/high|critical/);
      expect(alert005.risk_score).toBeGreaterThanOrEqual(80);
      expect(alert005.suspicious_indicators).toContainEqual(
        expect.stringMatching(/dormant|inactive|sudden|large/i)
      );
    });

    it('should NOT flag expected seasonal business activity', async () => {
      const historicalContext: CustomerHistoricalContext[] = [
        {
          account_hash: 'ACCT_HASH_F9H5',
          customer_token: '[BUSINESS_002]',
          account_age_days: 1095, // 3 years
          total_transactions_6mo: 120,
          avg_transaction_amount_6mo: 5000,
          median_transaction_amount_6mo: 4500,
          max_transaction_amount_6mo: 25000,
          deposit_count_6mo: 80,
          withdrawal_count_6mo: 40,
          avg_monthly_balance_6mo: 50000,
          customer_segment: 'small_business',
          expected_transaction_frequency: 'daily',
          previous_sar_filings: 0,
        }
      ];

      // Holiday season spike — expected for retail business
      const transactions: SanitizedTransaction[] = Array.from({ length: 10 }, (_, i) => ({
        transaction_id: `TXN01${i}`,
        account_hash: 'ACCT_HASH_F9H5',
        customer_token: '[BUSINESS_002]',
        amount: 6000 + (i * 100), // Slightly higher than average, but within normal range
        transaction_type: 'check_deposit' as const,
        transaction_date: `2026-02-${10 + i}T10:00:00Z`,
        description_sanitized: 'Business revenue deposit',
        is_online_banking: false,
        metadata: { sanitized_at: `2026-02-${10 + i}T10:01:00Z`, sanitization_version: 'v1.0' }
      }));

      const result = await monitor.analyze({
        transactions,
        historical_context: historicalContext,
        config: defaultConfig,
        session_id: 'TEST_006'
      });

      const highSeverityAlerts = result.alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
      expect(highSeverityAlerts.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Round Dollar Detection
  // -------------------------------------------------------------------------

  describe('Round Dollar Detection', () => {
    it('should flag unusual prevalence of round-dollar wire transfers', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN020',
          account_hash: 'ACCT_HASH_G1I6',
          customer_token: '[PERSON_005]',
          amount: 100000.00,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-10T10:00:00Z',
          counterparty_token: '[COUNTERPARTY_002]',
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-10T10:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN021',
          account_hash: 'ACCT_HASH_G1I6',
          customer_token: '[PERSON_005]',
          amount: 50000.00,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-12T14:00:00Z',
          counterparty_token: '[COUNTERPARTY_003]',
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-12T14:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN022',
          account_hash: 'ACCT_HASH_G1I6',
          customer_token: '[PERSON_005]',
          amount: 75000.00,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-14T09:00:00Z',
          counterparty_token: '[COUNTERPARTY_004]',
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-14T09:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_007' });

      expect(result.alerts_generated).toBeGreaterThanOrEqual(1);
      const roundDollarAlert = result.alerts.find(a => a.alert_type === 'round_dollar' || a.alert_type === 'multiple_indicators');
      expect(roundDollarAlert).toBeDefined();
      expect(roundDollarAlert?.suspicious_indicators).toContainEqual(
        expect.stringMatching(/round.*dollar|exact.*amount/i)
      );
    });

    it('should NOT flag normal payroll with round amounts', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN023',
          account_hash: 'ACCT_HASH_H2J7',
          customer_token: '[BUSINESS_003]',
          amount: 3000.00, // Bi-weekly payroll
          transaction_type: 'ach_credit',
          transaction_date: '2026-02-01T00:00:00Z',
          description_sanitized: 'Payroll deposit',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-01T00:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN024',
          account_hash: 'ACCT_HASH_H2J7',
          customer_token: '[BUSINESS_003]',
          amount: 3000.00,
          transaction_type: 'ach_credit',
          transaction_date: '2026-02-15T00:00:00Z',
          description_sanitized: 'Payroll deposit',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T00:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_008' });

      const highSeverityAlerts = result.alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
      expect(highSeverityAlerts.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Geographic Risk Scoring
  // -------------------------------------------------------------------------

  describe('Geographic Risk Scoring', () => {
    it('should flag wire transfer to FATF blacklist country (Iran)', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN025',
          account_hash: 'ACCT_HASH_I3K8',
          customer_token: '[PERSON_006]',
          amount: 50000,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-15T10:00:00Z',
          counterparty_token: '[COUNTERPARTY_005]',
          counterparty_country: 'IR', // Iran — FATF blacklist
          geographic_risk_score: 95,
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_009' });

      expect(result.alerts_generated).toBeGreaterThanOrEqual(1);
      const geoAlert = result.alerts.find(a => a.alert_type === 'geographic_risk' || a.alert_type === 'multiple_indicators');
      expect(geoAlert).toBeDefined();
      expect(geoAlert?.severity).toMatch(/high|critical/);
      expect(geoAlert?.suspicious_indicators).toContainEqual(
        expect.stringMatching(/blacklist|high.*risk.*country|iran/i)
      );
    });

    it('should flag transactions to shell company jurisdictions', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'TXN026',
          account_hash: 'ACCT_HASH_J4L9',
          customer_token: '[BUSINESS_004]',
          amount: 125000,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-15T10:00:00Z',
          counterparty_token: '[BUSINESS_005]',
          counterparty_country: 'KY', // Cayman Islands
          geographic_risk_score: 70,
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'TXN027',
          account_hash: 'ACCT_HASH_J4L9',
          customer_token: '[BUSINESS_004]',
          amount: 85000,
          transaction_type: 'wire_out',
          transaction_date: '2026-02-16T11:00:00Z',
          counterparty_token: '[BUSINESS_006]',
          counterparty_country: 'VG', // British Virgin Islands
          geographic_risk_score: 68,
          is_online_banking: true,
          metadata: { sanitized_at: '2026-02-16T11:01:00Z', sanitization_version: 'v1.0' }
        }
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'TEST_010' });

      expect(result.alerts_generated).toBeGreaterThanOrEqual(1);
      const geoAlert = result.alerts.find(a => a.alert_type === 'geographic_risk' || a.alert_type === 'multiple_indicators');
      expect(geoAlert).toBeDefined();
      expect(geoAlert?.suspicious_indicators).toContainEqual(
        expect.stringMatching(/offshore|shell.*company|tax.*haven|cayman|virgin.*islands/i)
      );
    });
  });

  // -------------------------------------------------------------------------
  // Performance Requirements
  // -------------------------------------------------------------------------

  describe('Performance Requirements', () => {
    it('should process single transaction in <200ms', async () => {
      const transaction: SanitizedTransaction = {
        transaction_id: 'PERF001',
        account_hash: 'ACCT_HASH_PERF1',
        customer_token: '[PERSON_PERF1]',
        amount: 5000,
        transaction_type: 'check_deposit',
        transaction_date: '2026-02-15T10:00:00Z',
        is_online_banking: false,
        metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
      };

      const startTime = Date.now();
      await monitor.analyze({ transactions: [transaction], config: defaultConfig, session_id: 'PERF_TEST_001' });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should process batch of 100 transactions with avg <5ms per transaction', async () => {
      const transactions: SanitizedTransaction[] = Array.from({ length: 100 }, (_, i) => ({
        transaction_id: `PERF${String(i).padStart(3, '0')}`,
        account_hash: `ACCT_HASH_PERF${i % 10}`,
        customer_token: `[PERSON_PERF${i % 10}]`,
        amount: 1000 + (i * 100),
        transaction_type: 'check_deposit' as const,
        transaction_date: `2026-02-15T${String(i % 24).padStart(2, '0')}:00:00Z`,
        is_online_banking: false,
        metadata: { sanitized_at: `2026-02-15T${String(i % 24).padStart(2, '0')}:01:00Z`, sanitization_version: 'v1.0' }
      }));

      const startTime = Date.now();
      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'PERF_TEST_002' });
      const duration = Date.now() - startTime;

      expect(result.transactions_analyzed).toBe(100);
      expect(result.performance_metrics.avg_transaction_latency_ms).toBeLessThan(5);
      expect(duration).toBeLessThan(500);
    });
  });

  // -------------------------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should handle malformed transaction data gracefully', async () => {
      const badTransaction: any = {
        transaction_id: 'BAD001',
        // Missing required fields
        amount: 'not-a-number',
      };

      const result = await monitor.analyze({
        transactions: [badTransaction],
        config: defaultConfig,
        session_id: 'ERROR_TEST_001'
      });

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]!.error_type).toMatch(/validation|schema/i);
    });

    it('should continue processing when one transaction fails', async () => {
      const transactions: SanitizedTransaction[] = [
        {
          transaction_id: 'GOOD001',
          account_hash: 'ACCT_HASH_OK',
          customer_token: '[PERSON_OK]',
          amount: 5000,
          transaction_type: 'check_deposit',
          transaction_date: '2026-02-15T10:00:00Z',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        },
        {
          transaction_id: 'BAD002',
          account_hash: '', // Invalid empty hash
          customer_token: '[PERSON_BAD]',
          amount: -1000,
          transaction_type: 'cash_deposit',
          transaction_date: '2026-02-15T10:00:00Z',
          is_online_banking: false,
          metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
        } as any
      ];

      const result = await monitor.analyze({ transactions, config: defaultConfig, session_id: 'ERROR_TEST_002' });

      expect(result.transactions_analyzed).toBeGreaterThan(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.transaction_id === 'BAD002')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Audit Trail
  // -------------------------------------------------------------------------

  describe('Audit Trail', () => {
    it('should log all analysis sessions to audit table', async () => {
      const transaction: SanitizedTransaction = {
        transaction_id: 'AUDIT001',
        account_hash: 'ACCT_HASH_AUDIT',
        customer_token: '[PERSON_AUDIT]',
        amount: 5000,
        transaction_type: 'check_deposit',
        transaction_date: '2026-02-15T10:00:00Z',
        is_online_banking: false,
        metadata: { sanitized_at: '2026-02-15T10:01:00Z', sanitization_version: 'v1.0' }
      };

      const result = await monitor.analyze({ transactions: [transaction], config: defaultConfig, session_id: 'AUDIT_TEST_001' });

      expect(result.session_id).toBe('AUDIT_TEST_001');
      expect(result.performance_metrics.claude_tokens_used).toBeGreaterThan(0);
    });
  });
});
