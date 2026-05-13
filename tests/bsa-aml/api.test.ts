/**
 * BSA/AML API Route Tests (TDD)
 *
 * Tests written FIRST. All should fail (RED) until routes are implemented.
 * Uses Fastify inject() — no real network or database required.
 *
 * Covers:
 *   POST /v1/transactions/screen
 *   GET  /v1/alerts
 *   PATCH /v1/alerts/:alert_id
 *
 * Mock strategy: shared state objects captured by factory closures.
 * Per-test control is done by mutating the state object before each test.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Environment — must be set before any module under test is imported
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-key-for-bsa-api-tests-min-32-chars!!';

beforeAll(() => {
  process.env['JWT_SECRET'] = JWT_SECRET;
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
  process.env['SUPABASE_URL'] = 'https://test.supabase.co';
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';
  process.env['FFIEC_GEOCODE_API_URL'] = 'https://geomap.ffiec.gov/api/';
});

// ---------------------------------------------------------------------------
// Shared mock state — captured by factory closures below
// The factories reference this object by closure, so per-test mutations take effect.
// ---------------------------------------------------------------------------

const mockState = {
  analyzeAlerts: [] as unknown[],
  alertRowForPatch: null as unknown,
  alertsListResult: [] as unknown[],
  alertsListCount: 0,
  patchUpdateError: null as null | { message: string },
  insertError: null as null | { message: string },
};

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

jest.mock('../../src/lib/supabase', () => ({
  getServiceClient: jest.fn(() => ({
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    schema: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn(() => Promise.resolve({ error: mockState.insertError })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: mockState.patchUpdateError })),
        })),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(() =>
          Promise.resolve({
            data: mockState.alertsListResult,
            error: null,
            count: mockState.alertsListCount,
          }),
        ),
        single: jest.fn(() =>
          Promise.resolve({
            data: mockState.alertRowForPatch,
            error: mockState.alertRowForPatch === null ? { code: 'PGRST116' } : null,
          }),
        ),
      })),
    })),
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
      insert: jest.fn(() => Promise.resolve({ error: mockState.insertError })),
    })),
  })),
  setBankContext: jest.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// TransactionMonitor mock — returns mockState.analyzeAlerts per call
// ---------------------------------------------------------------------------

jest.mock('../../src/agents/bsa-aml/transactionMonitor', () => ({
  TransactionMonitor: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockImplementation(() =>
      Promise.resolve({
        session_id: 'screen-test-001',
        processed_at: new Date().toISOString(),
        transactions_analyzed: 1,
        alerts_generated: mockState.analyzeAlerts.length,
        alerts: mockState.analyzeAlerts,
        performance_metrics: {
          total_duration_ms: 12,
          avg_transaction_latency_ms: 12,
          claude_api_calls: 0,
          claude_tokens_used: 0,
        },
      }),
    ),
  })),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const normalTransaction = {
  transaction_id: 'TXN-001',
  account_hash: 'abc123hash',
  customer_token: '[PERSON_001]',
  amount: 500.00,
  transaction_type: 'cash_deposit',
  transaction_date: '2026-05-01T10:00:00Z',
  is_online_banking: false,
  metadata: {
    sanitized_at: '2026-05-01T10:00:01Z',
    sanitization_version: '1.0',
  },
};

const structuringAlert = {
  alert_id: 'ALT-2026-05-06-00001',
  account_hash: 'abc123hash',
  customer_token: '[PERSON_001]',
  risk_score: 85,
  alert_type: 'structuring',
  severity: 'high',
  transactions_flagged: [normalTransaction],
  suspicious_indicators: ['Three deposits under $10,000 in 3-day window'],
  regulatory_citation: '31 USC §5324 — Structuring transactions to evade reporting requirements',
  recommended_action: 'file_sar',
  confidence_score: 88,
  false_positive_probability: 0.12,
  created_at: '2026-05-06T00:00:00Z',
  expires_at: '2026-06-05T00:00:00Z',
};

const mockAlertRow = {
  id: 'uuid-123',
  alert_id: 'ALT-2026-05-06-00001',
  account_hash: 'abc123hash',
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
  created_at: '2026-05-06T00:00:00Z',
  expires_at: '2026-06-05T00:00:00Z',
  assigned_to: null,
  investigation_status: 'pending',
  investigation_notes: null,
  investigation_completed_at: null,
};

// ---------------------------------------------------------------------------
// Server + token setup
// ---------------------------------------------------------------------------

describe('BSA/AML API Routes', () => {
  let server: FastifyInstance;
  let validToken: string;

  beforeAll(async () => {
    const { buildServer } = await import('../../src/server');
    server = await buildServer();
    await server.ready();
    validToken = server.jwt.sign({
      sub: 'user-test-001',
      bank_id: 'bank-test-001',
      role: 'compliance_officer',
    });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    mockState.analyzeAlerts = [];
    mockState.alertRowForPatch = null;
    mockState.alertsListResult = [];
    mockState.alertsListCount = 0;
    mockState.patchUpdateError = null;
    mockState.insertError = null;
  });

  // =========================================================================
  // POST /v1/transactions/screen
  // =========================================================================

  describe('POST /v1/transactions/screen', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/transactions/screen',
        payload: { transaction: normalTransaction },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 PII_DETECTED when body contains SSN pattern', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/transactions/screen',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          transaction: {
            ...normalTransaction,
            description_sanitized: 'SSN 123-45-6789',
          },
        },
      });
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toBe('PII_DETECTED');
    });

    it('returns 400 for missing required transaction fields', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/transactions/screen',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { transaction: { amount: 500 } },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('returns 200 with alert: null for a normal transaction', async () => {
      mockState.analyzeAlerts = [];

      const res = await server.inject({
        method: 'POST',
        url: '/v1/transactions/screen',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { transaction: normalTransaction },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        success: boolean;
        data: { alert: null; screening_id: string; checked_patterns: string[] };
        meta: { bank_id: string; api_version: string; request_id: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.alert).toBeNull();
      expect(Array.isArray(body.data.checked_patterns)).toBe(true);
      expect(body.data.screening_id).toBeDefined();
    });

    it('returns structuring alert with 31 USC §5324 citation', async () => {
      mockState.analyzeAlerts = [structuringAlert];

      const res = await server.inject({
        method: 'POST',
        url: '/v1/transactions/screen',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { transaction: normalTransaction },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        data: {
          alert: {
            alert_type: string;
            severity: string;
            regulatory_citation: string;
          } | null;
        };
      };
      expect(body.data.alert).not.toBeNull();
      expect(body.data.alert?.alert_type).toBe('structuring');
      expect(body.data.alert?.severity).toBe('high');
      expect(body.data.alert?.regulatory_citation).toContain('31 USC §5324');
    });

    it('response envelope includes meta.request_id, meta.bank_id, meta.api_version', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/transactions/screen',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { transaction: normalTransaction },
      });

      const body = JSON.parse(res.body) as {
        meta: {
          request_id: string;
          bank_id: string;
          api_version: string;
          timestamp: string;
        };
      };
      expect(body.meta.request_id).toBeDefined();
      expect(body.meta.bank_id).toBe('bank-test-001');
      expect(body.meta.api_version).toBe('v1');
      expect(body.meta.timestamp).toBeDefined();
    });

    it('processes within 200ms SLA', async () => {
      const start = Date.now();
      await server.inject({
        method: 'POST',
        url: '/v1/transactions/screen',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { transaction: normalTransaction },
      });
      expect(Date.now() - start).toBeLessThan(200);
    });
  });

  // =========================================================================
  // GET /v1/alerts
  // =========================================================================

  describe('GET /v1/alerts', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/v1/alerts',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with alerts array and pagination meta', async () => {
      mockState.alertsListResult = [mockAlertRow];
      mockState.alertsListCount = 1;

      const res = await server.inject({
        method: 'GET',
        url: '/v1/alerts',
        headers: { authorization: `Bearer ${validToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        success: boolean;
        data: {
          alerts: unknown[];
          pagination: {
            total: number;
            page: number;
            per_page: number;
            total_pages: number;
          };
        };
        meta: { bank_id: string; api_version: string };
      };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.alerts)).toBe(true);
      expect(body.data.alerts).toHaveLength(1);
      expect(body.data.pagination.page).toBe(1);
      expect(body.data.pagination.total).toBe(1);
      expect(body.meta.api_version).toBe('v1');
    });

    it('returns 200 with empty array when no alerts exist', async () => {
      mockState.alertsListResult = [];
      mockState.alertsListCount = 0;

      const res = await server.inject({
        method: 'GET',
        url: '/v1/alerts',
        headers: { authorization: `Bearer ${validToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { data: { alerts: unknown[] } };
      expect(body.data.alerts).toHaveLength(0);
    });

    it('accepts severity and status filter query params without error', async () => {
      mockState.alertsListResult = [];
      mockState.alertsListCount = 0;

      const res = await server.inject({
        method: 'GET',
        url: '/v1/alerts?severity=high&status=pending&page=1&per_page=25',
        headers: { authorization: `Bearer ${validToken}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // PATCH /v1/alerts/:alert_id
  // =========================================================================

  describe('PATCH /v1/alerts/:alert_id', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        payload: { status: 'in_progress' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for an invalid status value', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { status: 'not_a_real_status' },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('returns 400 when status is sar_filed and sar_reference_number is missing', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { status: 'sar_filed' },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('returns 404 for an unknown alert_id', async () => {
      mockState.alertRowForPatch = null;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-DOES-NOT-EXIST',
        headers: { authorization: `Bearer ${validToken}` },
        payload: { status: 'in_progress' },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 200 and updated status on valid investigation status change', async () => {
      mockState.alertRowForPatch = mockAlertRow;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          status: 'in_progress',
          investigation_notes: 'Reviewing transaction pattern.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        success: boolean;
        data: { alert_id: string; investigation_status: string };
        meta: { bank_id: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.alert_id).toBe('ALT-2026-05-06-00001');
      expect(body.data.investigation_status).toBe('in_progress');
      expect(body.meta.bank_id).toBe('bank-test-001');
    });

    it('returns 200 when status is sar_filed and sar_reference_number is provided', async () => {
      mockState.alertRowForPatch = mockAlertRow;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          status: 'sar_filed',
          sar_reference_number: 'SAR-2026-001',
          investigation_notes: 'SAR filed with FinCEN.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        data: { investigation_status: string };
      };
      expect(body.data.investigation_status).toBe('sar_filed');
    });

    // -----------------------------------------------------------------------
    // Item 1 — "Don't file" closure reason (RED until implemented)
    // -----------------------------------------------------------------------

    it('returns 400 when no_sar_warranted is set without closure_reason_code', async () => {
      mockState.alertRowForPatch = mockAlertRow;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          status: 'no_sar_warranted',
          investigation_notes: 'Looked OK.',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('returns 400 when false_positive is set without closure_reason_code', async () => {
      mockState.alertRowForPatch = mockAlertRow;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          status: 'false_positive',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('returns 400 for an invalid closure_reason_code value', async () => {
      mockState.alertRowForPatch = mockAlertRow;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          status: 'no_sar_warranted',
          closure_reason_code: 'not_a_valid_reason',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('returns 200 for no_sar_warranted with a valid closure_reason_code', async () => {
      mockState.alertRowForPatch = mockAlertRow;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          status: 'no_sar_warranted',
          closure_reason_code: 'tanda_cycle',
          investigation_notes: 'Customer participates in a documented tanda rotation.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        data: { investigation_status: string; closure_reason_code: string };
      };
      expect(body.data.investigation_status).toBe('no_sar_warranted');
      expect(body.data.closure_reason_code).toBe('tanda_cycle');
    });

    it('returns 200 for false_positive with a valid closure_reason_code', async () => {
      mockState.alertRowForPatch = mockAlertRow;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          status: 'false_positive',
          closure_reason_code: 'system_false_positive',
          investigation_notes: 'Pattern matched tanda, not structuring.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        data: { investigation_status: string };
      };
      expect(body.data.investigation_status).toBe('false_positive');
    });

    it('response includes closure_reason_code in data when provided', async () => {
      mockState.alertRowForPatch = mockAlertRow;

      const res = await server.inject({
        method: 'PATCH',
        url: '/v1/alerts/ALT-2026-05-06-00001',
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          status: 'no_sar_warranted',
          closure_reason_code: 'prior_cdd_review',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        data: { closure_reason_code: string };
      };
      expect(body.data.closure_reason_code).toBe('prior_cdd_review');
    });
  });
});
