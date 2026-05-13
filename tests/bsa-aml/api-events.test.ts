/**
 * BSA/AML Alert Events API Tests (TDD — Item 3: Exam-ready audit trail)
 *
 * Tests written FIRST. All should fail (RED) until the endpoint is implemented.
 *
 * Covers:
 *   GET  /v1/alerts/:alert_id/events
 *
 * Events are logged on every investigation status change and capture:
 *   - from_status, to_status, notes, timestamp
 * This trail is the exam-ready audit package.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

const JWT_SECRET = 'test-secret-key-for-events-api-tests-min-32-chars!!';

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

const mockEventsState = {
  eventsResult: [] as unknown[],
  eventsError: null as null | { message: string },
  alertRowForLookup: null as unknown,
};

const mockAlertRow = {
  id: 'uuid-evt-001',
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
  investigation_status: 'in_progress',
  investigation_notes: 'Reviewing.',
  investigation_completed_at: null,
  closure_reason_code: null,
  closure_reason_detail: null,
};

const mockEvent = {
  id: 'evt-uuid-001',
  alert_id: 'ALT-2026-05-06-00001',
  event_type: 'status_change',
  from_status: 'pending',
  to_status: 'in_progress',
  notes: 'Started investigation.',
  created_at: '2026-05-06T10:00:00Z',
  actor: 'compliance_officer',
};

// ---------------------------------------------------------------------------
// Supabase mock — differentiates between alerts and alert_events tables
// ---------------------------------------------------------------------------

jest.mock('../../src/lib/supabase', () => ({
  getServiceClient: jest.fn(() => ({
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    schema: jest.fn(() => ({
      from: jest.fn((table: string) => {
        if (table === 'alert_events') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn(() =>
              Promise.resolve({
                data: mockEventsState.eventsError ? null : mockEventsState.eventsResult,
                error: mockEventsState.eventsError,
              }),
            ),
            insert: jest.fn(() => Promise.resolve({ error: null })),
          };
        }
        // Default: alerts table
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null })),
          })),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
          single: jest.fn(() =>
            Promise.resolve({
              data: mockEventsState.alertRowForLookup,
              error: mockEventsState.alertRowForLookup === null ? { code: 'PGRST116' } : null,
            }),
          ),
        };
      }),
    })),
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  })),
  setBankContext: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../src/agents/bsa-aml/transactionMonitor', () => ({
  TransactionMonitor: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockImplementation(() =>
      Promise.resolve({
        session_id: 'screen-evt-001',
        processed_at: new Date().toISOString(),
        transactions_analyzed: 1,
        alerts_generated: 0,
        alerts: [],
        performance_metrics: { total_duration_ms: 5, avg_transaction_latency_ms: 5, claude_api_calls: 0, claude_tokens_used: 0 },
      }),
    ),
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /v1/alerts/:alert_id/events', () => {
  let server: FastifyInstance;
  let validToken: string;

  beforeAll(async () => {
    const { buildServer } = await import('../../src/server');
    server = await buildServer();
    await server.ready();
    validToken = server.jwt.sign({
      sub: 'user-evt-001',
      bank_id: 'bank-test-001',
      role: 'compliance_officer',
    });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    mockEventsState.eventsResult = [];
    mockEventsState.eventsError = null;
    mockEventsState.alertRowForLookup = null;
  });

  it('returns 401 without Authorization header', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/v1/alerts/ALT-2026-05-06-00001/events',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for an unknown alert_id', async () => {
    mockEventsState.alertRowForLookup = null;

    const res = await server.inject({
      method: 'GET',
      url: '/v1/alerts/ALT-DOES-NOT-EXIST/events',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with empty events array for a new alert', async () => {
    mockEventsState.alertRowForLookup = mockAlertRow;
    mockEventsState.eventsResult = [];

    const res = await server.inject({
      method: 'GET',
      url: '/v1/alerts/ALT-2026-05-06-00001/events',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: { events: unknown[]; alert_id: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.alert_id).toBe('ALT-2026-05-06-00001');
    expect(Array.isArray(body.data.events)).toBe(true);
    expect(body.data.events).toHaveLength(0);
  });

  it('returns events with required fields: event_type, from_status, to_status, created_at', async () => {
    mockEventsState.alertRowForLookup = mockAlertRow;
    mockEventsState.eventsResult = [mockEvent];

    const res = await server.inject({
      method: 'GET',
      url: '/v1/alerts/ALT-2026-05-06-00001/events',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        events: Array<{
          event_type: string;
          from_status: string;
          to_status: string;
          created_at: string;
        }>;
      };
    };
    const event = body.data.events[0];
    expect(event).toBeDefined();
    expect(event?.event_type).toBe('status_change');
    expect(event?.from_status).toBe('pending');
    expect(event?.to_status).toBe('in_progress');
    expect(event?.created_at).toBeDefined();
  });

  it('returns multiple events in chronological order (oldest first)', async () => {
    mockEventsState.alertRowForLookup = mockAlertRow;
    mockEventsState.eventsResult = [
      { ...mockEvent, to_status: 'in_progress', created_at: '2026-05-06T10:00:00Z' },
      { ...mockEvent, id: 'evt-uuid-002', from_status: 'in_progress', to_status: 'no_sar_warranted', created_at: '2026-05-06T11:00:00Z' },
    ];

    const res = await server.inject({
      method: 'GET',
      url: '/v1/alerts/ALT-2026-05-06-00001/events',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { events: Array<{ to_status: string }> };
    };
    expect(body.data.events).toHaveLength(2);
    expect(body.data.events[0]?.to_status).toBe('in_progress');
    expect(body.data.events[1]?.to_status).toBe('no_sar_warranted');
  });

  it('includes closure_reason_code in event when status closed without SAR', async () => {
    mockEventsState.alertRowForLookup = mockAlertRow;
    mockEventsState.eventsResult = [
      {
        ...mockEvent,
        from_status: 'in_progress',
        to_status: 'no_sar_warranted',
        closure_reason_code: 'tanda_cycle',
        notes: 'Customer participates in a tanda rotation.',
      },
    ];

    const res = await server.inject({
      method: 'GET',
      url: '/v1/alerts/ALT-2026-05-06-00001/events',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { events: Array<{ closure_reason_code: string }> };
    };
    expect(body.data.events[0]?.closure_reason_code).toBe('tanda_cycle');
  });

  it('returns events inside standard response envelope with meta', async () => {
    mockEventsState.alertRowForLookup = mockAlertRow;

    const res = await server.inject({
      method: 'GET',
      url: '/v1/alerts/ALT-2026-05-06-00001/events',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      meta: { bank_id: string; api_version: string; request_id: string };
    };
    expect(body.success).toBe(true);
    expect(body.meta.bank_id).toBe('bank-test-001');
    expect(body.meta.api_version).toBe('v1');
    expect(body.meta.request_id).toBeDefined();
  });
});
