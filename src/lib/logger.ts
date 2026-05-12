/**
 * Structured logger using pino.
 * Never use console.log in production code.
 *
 * Format: structured JSON in production, pretty-printed in development.
 * Log level controlled by LOG_LEVEL environment variable (default: 'info').
 *
 * Usage:
 *   import { logger } from '@lib/logger';
 *   logger.info({ session_id, records: count }, 'DataGuard validation complete');
 */

import pino from 'pino';

const isDevelopment = process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'test';
const logLevel = process.env['LOG_LEVEL'] ?? 'info';

export const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'econofi-agents-core',
  },
  redact: {
    // Prevent accidental PII logging — these fields should never appear in logs
    paths: ['*.ssn', '*.account_number', '*.borrower_name', '*.address'],
    remove: true,
  },
});
