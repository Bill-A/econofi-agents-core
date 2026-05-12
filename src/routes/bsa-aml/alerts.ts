/**
 * GET  /v1/alerts
 * GET  /v1/alerts/:alert_id
 * PATCH /v1/alerts/:alert_id
 *
 * Alert management endpoints for BSA/AML investigation workflow.
 *
 * GET  — paginated list with optional severity/status/date filters
 * PATCH — update investigation status; sar_filed requires sar_reference_number
 *
 * Auth: Bearer JWT required
 * PII: Rejected at boundary (422 PII_DETECTED)
 * RLS: Bank-scoped via app.current_bank_id Supabase context
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AlertRepository } from '../../agents/bsa-aml/alertRepository';
import { authenticateRequest, extractBankId } from '../../middleware/auth';
import { piiDetectorMiddleware } from '../../middleware/piiDetector';
import { buildSuccess, buildError } from '../../lib/apiResponse';
import type { InvestigationStatus } from '../../types/database';

// ---------------------------------------------------------------------------
// GET /v1/alerts — query param schema
// ---------------------------------------------------------------------------

const ListAlertsQuerySchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['pending', 'in_progress', 'sar_filed', 'no_sar_warranted', 'false_positive']).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).default(25),
});

// ---------------------------------------------------------------------------
// PATCH /v1/alerts/:alert_id — body schema
// ---------------------------------------------------------------------------

const PatchAlertBodySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'sar_filed', 'no_sar_warranted', 'false_positive']),
  investigation_notes: z.string().optional(),
  sar_reference_number: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

async function listAlertsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const bankId = extractBankId(request);
  const requestId = uuidv4();
  const startMs = Date.now();

  const parsed = ListAlertsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    await reply.status(400).send(
      buildError('INVALID_REQUEST', 'Invalid query parameters', bankId, requestId, parsed.error.flatten()),
    );
    return;
  }

  const { severity, status, from_date, to_date, page, per_page } = parsed.data;

  const repository = new AlertRepository();
  const { alerts, count } = await repository.listAlerts(
    bankId,
    { severity, status, from_date, to_date },
    { page, per_page },
  );

  const totalPages = Math.ceil(count / per_page);

  await reply.status(200).send(
    buildSuccess(
      {
        alerts,
        pagination: { total: count, page, per_page, total_pages: totalPages },
      },
      bankId,
      requestId,
      Date.now() - startMs,
    ),
  );
}

// ---------------------------------------------------------------------------
// GET single alert handler
// ---------------------------------------------------------------------------

async function getAlertHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const bankId = extractBankId(request);
  const requestId = uuidv4();
  const { alert_id: alertId } = request.params as { alert_id: string };

  const repository = new AlertRepository();
  const alert = await repository.findAlertById(alertId, bankId);

  if (alert === null) {
    await reply.status(404).send(
      buildError('NOT_FOUND', `Alert ${alertId} not found`, bankId, requestId),
    );
    return;
  }

  await reply.status(200).send(buildSuccess(alert, bankId, requestId));
}

// ---------------------------------------------------------------------------
// PATCH handler
// ---------------------------------------------------------------------------

async function patchAlertHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const bankId = extractBankId(request);
  const requestId = uuidv4();
  const { alert_id: alertId } = request.params as { alert_id: string };

  const parsed = PatchAlertBodySchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send(
      buildError('INVALID_REQUEST', 'Request body validation failed', bankId, requestId, parsed.error.flatten()),
    );
    return;
  }

  const { status, investigation_notes, sar_reference_number } = parsed.data;

  if (status === 'sar_filed' && (sar_reference_number === undefined || sar_reference_number.trim() === '')) {
    await reply.status(400).send(
      buildError(
        'INVALID_REQUEST',
        'sar_reference_number is required when status is sar_filed',
        bankId,
        requestId,
      ),
    );
    return;
  }

  const repository = new AlertRepository();

  const existing = await repository.findAlertById(alertId, bankId);
  if (existing === null) {
    await reply.status(404).send(
      buildError('NOT_FOUND', `Alert ${alertId} not found`, bankId, requestId),
    );
    return;
  }

  await repository.updateAlertStatus(
    alertId,
    { status: status as InvestigationStatus, investigation_notes, sar_reference_number },
    bankId,
  );

  await reply.status(200).send(
    buildSuccess(
      { alert_id: alertId, investigation_status: status },
      bankId,
      requestId,
    ),
  );
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function bsaAlertRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/alerts',
    { preHandler: [authenticateRequest] },
    listAlertsHandler,
  );

  fastify.get(
    '/v1/alerts/:alert_id',
    { preHandler: [authenticateRequest] },
    getAlertHandler,
  );

  fastify.patch(
    '/v1/alerts/:alert_id',
    { preHandler: [authenticateRequest, piiDetectorMiddleware] },
    patchAlertHandler,
  );
}
