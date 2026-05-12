/**
 * Econofi Agents Core — Entry Point
 *
 * Compliance automation agents:
 *   - BSA/AML TransactionMonitor
 *   - CRA DataGuard
 *   - CRA NarrativeWriter
 *   - CRA ChatAgent
 *   - Fair Lending LoanDataAnalyzer
 *   - LIHTC/NMTC ComplianceMonitor
 *
 * See: specs/ for full implementation specifications
 * See: CLAUDE.md for project standards and conventions
 */

// Validate environment at startup -- fails fast if required vars are missing
import './lib/env';
import { buildServer } from './server';
import { logger } from './lib/logger';

async function main(): Promise<void> {
  const server = await buildServer();
  const port = parseInt(process.env['PORT'] ?? '3000', 10);
  const host = process.env['HOST'] ?? '0.0.0.0';

  await server.listen({ port, host });
  logger.info({ port, host }, 'Econofi Agents Core server started');
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
