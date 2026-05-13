/**
 * Fastify server factory.
 *
 * Called by src/index.ts at startup and by tests via inject().
 * Registers all plugins and routes. Does not bind to a port -- that is
 * done by the caller (index.ts uses listen(), tests use inject()).
 */

import Fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { logger } from './lib/logger';
import { env } from './lib/env';
import { craValidateRoutes } from './routes/cra/validate';
import { craNarrativeRoutes } from './routes/cra/narrative';
import { craChatRoutes } from './routes/cra/chat';
import { bsaTransactionRoutes } from './routes/bsa-aml/transactions';
import { bsaAlertRoutes } from './routes/bsa-aml/alerts';
import { bsaBatchRoutes } from './routes/bsa-aml/batch';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false }); // We use pino directly

  // Register JWT plugin -- required before authenticateRequest middleware can run
  await server.register(fastifyJwt, { secret: env.JWT_SECRET });

  // Health check (no auth)
  server.get('/health', async () => ({ status: 'ok', version: 'v1' }));

  // Register all agent routes
  await server.register(bsaTransactionRoutes);
  await server.register(bsaBatchRoutes);
  await server.register(bsaAlertRoutes);
  await server.register(craValidateRoutes);
  await server.register(craNarrativeRoutes);
  await server.register(craChatRoutes);

  logger.debug('Fastify server built with all routes registered');

  return server;
}
