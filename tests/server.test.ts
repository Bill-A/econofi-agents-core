/**
 * Server smoke tests (TDD)
 *
 * Tests written FIRST. All should fail (RED) before buildServer() is implemented.
 * Uses Fastify inject() for in-process HTTP testing — no real network socket needed.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Environment setup — must happen before any imports that read process.env
// ---------------------------------------------------------------------------

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-secret-key-for-server-tests-min-32-chars';
  process.env['ANTHROPIC_API_KEY'] = 'test-anthropic-key';
  process.env['SUPABASE_URL'] = 'https://test.supabase.co';
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';
});

// ---------------------------------------------------------------------------
// Server tests
// ---------------------------------------------------------------------------

describe('Fastify Server', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    const { buildServer } = await import('../src/server');
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // -------------------------------------------------------------------------
  // Test 1: Health check
  // -------------------------------------------------------------------------

  it('GET /health returns 200 with status ok', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { status: string; version: string };
    expect(body.status).toBe('ok');
    expect(body.version).toBe('v1');
  });

  // -------------------------------------------------------------------------
  // Test 2: Validate route requires auth
  // -------------------------------------------------------------------------

  it('POST /v1/cra/validate without auth returns 401', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/cra/validate',
      payload: { loans: [] },
    });

    expect(response.statusCode).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Test 3: Narrative route requires auth
  // -------------------------------------------------------------------------

  it('POST /v1/cra/narrative without auth returns 401', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/cra/narrative',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Test 4: Chat route requires auth
  // -------------------------------------------------------------------------

  it('POST /v1/cra/chat without auth returns 401', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/cra/chat',
      payload: {
        narrative_session_id: 'nw-session-001',
        message: 'How did we do on the Lending Test?',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Test 5: Unknown route returns 404
  // -------------------------------------------------------------------------

  it('unknown route returns 404', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/unknown/route',
    });

    expect(response.statusCode).toBe(404);
  });
});
