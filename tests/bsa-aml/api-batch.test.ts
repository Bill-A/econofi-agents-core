/**
 * BSA/AML Batch Transaction Intake API Tests (TDD — Item 2)
 *
 * Tests written FIRST. All should fail (RED) until the endpoint is implemented.
 *
 * Covers:
 *   POST /v1/transactions/batch
 *
 * Accepts an array of sanitized transactions, runs each through TransactionMonitor,
 * persists any resulting alerts, and returns a processing summary.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

const JWT_SECRET = 'test-secret-key-for-batch-api-tests-min-32-chars!!!';

beforeAll(() => {
  process.env['JWT_SECRET'] = JWT_SECRET;
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
  process.env['SUPABASE_URL'] = 'https://test.supabase.co';
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';
  process.env['FFIEC_GEOCODE_API_URL'] = 'https://geomap.ffiec.gov/api/';
});

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------

const mockBatchState = {
  analyzeAlerts: [] as unknown[],
  insertError: null as null | { message: string },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../src/lib/supabase', () => ({
  getServiceClient: jest.fn(() => ({
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    schema: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn(() => Promise.resolve({ error: mockBatchState.insertError })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
        single: jest.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } })),
      })),
    })),
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
      insert: jest.fn(() => Promise.resolve({ error: mockBatchState.insertError })),
    })),
  })),
  setBankContext: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../src/agents/bsa-aml/transactionMonitor', () => ({
  TransactionMonitor: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockImplementation(() =>
      Promise.resolve({
        session_id: 'batch-test-001',
        processed_at: new Date().toISOString(),
        transactions_analyzed: 1,
        alerts_generated: mockBatchState.analyzeAlerts.length,
        alerts: mockBatchState.analyzeAlerts,
        performance_metrics: { total_duration_ms: 10, avg_transaction_latency_ms: 10, claude_api_calls: 0, claude_tokens_used: 0 },
      }),
    ),
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeTx = (overrides: Record<string, unknown> = {}) => ({
  transaction_id: `TXN-BATCH-${Math.random().toString(36).slice(2, 8)}`,
  account_hash: 'batchhash001',
  customer_token: '[PERSON_001]',
  amount: 500.00,
  transaction_type: 'cash_deposit',
  transaction_date: '2026-05-10T10:00:00Z',
  is_online_banking: false,
  metadata: {
    sanitized_at: '2026-05-10T10:00:01Z',
    sanitization_version: '1.0',
  },
  ...overrides,
});

const structuringAlert = {
  alert_id: 'ALT-2026-05-10-00001',
  account_hash: 'batchhash001',
  customer_token: '[PERSON_001]',
  risk_score: 85,
  alert_type: 'structuring',
  severity: 'high',
  transactions_flagged: [],
  suspicious_indicators: ['Three deposits under $10,000'],
  regulatory_citation: '31 USC §5324',
  recommended_action: 'file_sar',
  confidence_score: 88,
  false_positive_probability: 0.12,
  created_at: '2026-05-10T00:00:00Z',
  expires_at: '2026-06-09T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /v1/transactions/batch', () => {
  let server: FastifyInstance;
  let validToken: string;

  beforeAll(async () => {
    const { buildServer } = await import('../../src/server');
    server = await buildServer();
    await server.ready();
    validToken = server.jwt.sign({
      sub: 'user-batch-001',
      bank_id: 'bank-test-001',
      role: 'compliance_officer',
    });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    mockBatchState.analyzeAlerts = [];
    mockBatchState.insertError = null;
  });

  it('returns 401 without Authorization header', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      payload: { transactions: [makeTx()] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for an empty transactions array', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { transactions: [] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 when transactions is missing from payload', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 422 PII_DETECTED when any transaction contains PII', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        transactions: [
          makeTx({ description_sanitized: 'SSN 123-45-6789' }),
          makeTx(),
        ],
      },
    });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('PII_DETECTED');
  });

  it('returns 400 when any transaction has invalid fields', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        transactions: [
          makeTx(),
          { amount: -500 }, // invalid — missing required fields
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 200 with zero alerts when no suspicious activity detected', async () => {
    mockBatchState.analyzeAlerts = [];

    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { transactions: [makeTx(), makeTx()] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: {
        transactions_submitted: number;
        alerts_created: number;
        alerts: unknown[];
        batch_id: string;
      };
    };
    expect(body.success).toBe(true);
    expect(body.data.transactions_submitted).toBe(2);
    expect(body.data.alerts_created).toBe(0);
    expect(body.data.alerts).toHaveLength(0);
    expect(body.data.batch_id).toBeDefined();
  });

  it('returns 200 with alert in data when suspicious activity detected', async () => {
    mockBatchState.analyzeAlerts = [structuringAlert];

    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        transactions: [
          makeTx({ amount: 9200, transaction_date: '2026-05-01T10:00:00Z' }),
          makeTx({ amount: 9400, transaction_date: '2026-05-02T10:00:00Z' }),
          makeTx({ amount: 9150, transaction_date: '2026-05-03T10:00:00Z' }),
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        transactions_submitted: number;
        alerts_created: number;
        alerts: Array<{ alert_type: string; severity: string }>;
      };
    };
    expect(body.data.transactions_submitted).toBe(3);
    expect(body.data.alerts_created).toBeGreaterThan(0);
    expect(body.data.alerts[0]?.alert_type).toBe('structuring');
    expect(body.data.alerts[0]?.severity).toBe('high');
  });

  it('returns 400 when transactions array exceeds maximum batch size (500)', async () => {
    const tooMany = Array.from({ length: 501 }, () => makeTx());

    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { transactions: tooMany },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('response includes meta.bank_id, meta.api_version, meta.request_id', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { transactions: [makeTx()] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      meta: { bank_id: string; api_version: string; request_id: string };
    };
    expect(body.meta.bank_id).toBe('bank-test-001');
    expect(body.meta.api_version).toBe('v1');
    expect(body.meta.request_id).toBeDefined();
  });

  it('processes within 2000ms SLA for a 10-transaction batch', async () => {
    const start = Date.now();
    await server.inject({
      method: 'POST',
      url: '/v1/transactions/batch',
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        transactions: Array.from({ length: 10 }, () => makeTx()),
      },
    });
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
