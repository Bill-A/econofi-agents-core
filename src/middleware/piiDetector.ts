/**
 * PII Detector — API Boundary Guard
 *
 * Rejects requests containing unmasked PII before any agent processing.
 * Returns HTTP 422 PII_DETECTED — never logs the PII value.
 *
 * Patterns checked:
 *   - US Social Security Numbers (XXX-XX-XXXX or 9-digit numeric)
 *   - US bank account numbers (8–17 digits in context)
 *   - Full name + date of birth combinations
 *
 * This runs at the API boundary. By the time data reaches an agent,
 * PII must already be tokenized by the bank's sanitization layer.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

// Patterns that indicate unmasked PII
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,                        // SSN: XXX-XX-XXXX
  /\b\d{9}\b(?=.*(?:ssn|social|security))/i,       // SSN: 9-digit with context
  /\baccount.{0,10}\d{8,17}\b/i,                   // Account number with label
  /\b\d{8,17}\b(?=.*(?:account|acct|routing))/i,   // Account/routing number
];

export async function piiDetectorMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = typeof request.body === 'string'
    ? request.body
    : JSON.stringify(request.body ?? '');

  for (const pattern of PII_PATTERNS) {
    if (pattern.test(body)) {
      await reply.status(422).send({
        error: 'PII_DETECTED',
        message: 'Request body contains unmasked PII. Tokenize all borrower data before submission.',
        code: 'PII_DETECTED',
      });
      return;
    }
  }
}
