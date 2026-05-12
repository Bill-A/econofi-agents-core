/**
 * JWT Authentication Middleware
 *
 * Validates Bearer token, extracts bank_id, sets Supabase RLS context.
 * All agent routes require authentication.
 *
 * Token payload shape: { sub: userId, bank_id: bankId, role: 'compliance_officer' | 'admin' }
 *
 * Note: @fastify/jwt must be registered on the Fastify server before these
 * middleware functions are used. See src/server.ts for plugin registration.
 */

import '@fastify/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface JWTPayload {
  sub: string;
  bank_id: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  bankId: string;
  role: string;
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    await reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Authorization header with Bearer token required',
    });
    return;
  }

  try {
    // @fastify/jwt augments request with jwtVerify — registered on server bootstrap
    await (request as FastifyRequest & { jwtVerify: () => Promise<void> }).jwtVerify();
  } catch {
    await reply.status(401).send({
      error: 'INVALID_TOKEN',
      message: 'JWT token is invalid or expired',
    });
  }
}

export function extractBankId(request: FastifyRequest): string {
  const user = request.user as JWTPayload;
  return user.bank_id;
}

export function extractUser(request: FastifyRequest): AuthenticatedUser {
  const payload = request.user as JWTPayload;
  return {
    userId: payload.sub,
    bankId: payload.bank_id,
    role: payload.role,
  };
}
