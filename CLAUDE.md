# Econofi Agents Core — Project Standards

This file is read by Claude Code at the start of every session.
All contributors (human and AI) must follow these standards without exception.

---

## Project Overview

Compliance automation agents for MDI/CDFI community banks.

| Module | Spec | Build Priority |
|---|---|---|
| BSA/AML TransactionMonitor | `specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md` | Day 1 |
| CRA DataGuard | `specs/cra/DATA_GUARD_SPEC.md` | Day 2 |
| CRA NarrativeWriter | `specs/cra/CRA_NARRATIVE_AGENT_SPEC.md` | Week 1-2 |
| Fair Lending LoanDataAnalyzer | `specs/fair-lending/LOAN_DATA_ANALYZER_SPEC.md` | Week 5-6 |
| LIHTC/NMTC ComplianceMonitor | `specs/lihtc-nmtc/COMPLIANCE_MONITOR_SPEC.md` | Week 5-6 |

---

## Code Style

### No Emojis
**Zero emoji characters anywhere in code, comments, log messages, error messages, or string literals.**

This is a professional banking compliance product. Emoji in logs, errors, or output strings are unprofessional and may appear in audit trails reviewed by bank examiners and regulators.

Applies to: all `.ts`, `.js`, `.sql`, `.md` files in this repository.

The ESLint `no-restricted-syntax` rule in `.eslintrc.json` enforces this for code.
CLAUDE.md enforces it for all other file types.

### TypeScript
- Strict mode always (`tsconfig.json` — `strict: true`, `noImplicitAny`, `strictNullChecks`)
- No `any` type except in test files (where it is a warning, not an error)
- Explicit return types on all functions
- `readonly` on interfaces where data should not be mutated after creation
- No `as` type assertions except when the TypeScript compiler cannot infer and you have a concrete reason
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use `zod` for all runtime validation of external input (API requests, CSV uploads)

### Naming
- Files: `camelCase.ts` for modules, `PascalCase.ts` for classes
- Database tables: `snake_case` in schema namespaces (`bsa_aml.`, `cra.`)
- TypeScript types: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Functions: `camelCase`

### Logging
Use `pino` logger. Never use `console.log` in production code (ESLint warns on `no-console`).

```typescript
import { logger } from '@lib/logger';
logger.info({ session_id, records: count }, 'DataGuard validation complete');
```

Log format: structured JSON in production, pretty-printed in development.

---

## Test-Driven Development (TDD)

**Every feature starts with a failing test. No exceptions.**

1. Copy test cases from the spec file to the test file
2. Run tests — confirm RED
3. Implement until GREEN
4. Refactor

Coverage thresholds (enforced by Jest):
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

Test files: `tests/{module}/*.test.ts`
Fixtures: `tests/fixtures/synthetic/*.json` (committed) or `tests/fixtures/real/` (gitignored)

---

## PII Handling

**PII must be sanitized before any data reaches a Claude API call.**

Rules:
1. Never pass borrower names, SSNs, account numbers, or addresses to Claude
2. Use token format: `[PERSON_001]`, `[BUSINESS_001]`, `[EMPLOYEE_001]`
3. Use `account_hash` (SHA-256) for transaction lookups — never raw account numbers
4. Log PII violations at `error` level and return HTTP 422 `PII_DETECTED`
5. The PII detector middleware runs at the API boundary before any agent is called

Sanitization is the orchestrator's responsibility — by the time data reaches an agent, it must be clean.

---

## Agent Boundaries

Each agent spec defines an `AGENT BOUNDARIES` block that lists what the agent must NOT do.
These are hard constraints, not guidelines.

Summary:
- **TransactionMonitor**: flags patterns, does NOT file SARs autonomously
- **DataGuard**: validates data quality, does NOT determine CRA credit eligibility
- **NarrativeWriter**: generates draft narratives, does NOT submit to regulators without acknowledgment
- **LoanDataAnalyzer**: surfaces statistical patterns, does NOT make legal determinations
- **ComplianceMonitor**: tracks deadlines and generates draft certifications, does NOT certify compliance

All NarrativeWriter and ComplianceMonitor outputs carry `draft_status = true`.
A compliance officer must explicitly acknowledge (`POST /v1/cra/narrative/:job_id/acknowledge`) before any document is used for regulatory purposes.

---

## Claude Model Assignments

| Agent | Model | Temperature | Rationale |
|---|---|---|---|
| TransactionMonitor | `claude-sonnet-4-6` | 0.0 | Deterministic pattern detection |
| DataGuard | `claude-sonnet-4-6` | 0.0 | Deterministic validation |
| NarrativeWriter | `claude-opus-4-6` | 0.3 | Narrative quality requires highest capability; low temp for regulatory language consistency |
| LoanDataAnalyzer | `claude-sonnet-4-6` | 0.0 | Deterministic statistical analysis |
| ComplianceMonitor | `claude-sonnet-4-6` | 0.0 | Deterministic covenant tracking |

Do not change model assignments without updating this table and documenting the reason.

---

## Database Conventions

- Schema namespaces: `bsa_aml.`, `cra.`, `fair_lending.`, `lihtc_nmtc.`
- All tables have `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- All tables have `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Audit log tables are append-only: no UPDATE or DELETE policies
- RLS is enabled on all tables that contain bank-scoped data
- Bank context set via: `SET app.current_bank_id = '...'` before each query
- Regulatory thresholds stored in `cra.regulatory_config` (not hardcoded)

Migration files: `migrations/NNN_description.sql` — apply in order.

---

## API Conventions

- All responses use `ApiResponse<T>` envelope with `meta.request_id`, `meta.bank_id`, `meta.api_version`
- Authentication: JWT (`Authorization: Bearer <token>`)
- PII in request body: return 422 `PII_DETECTED` (never log the PII value)
- Idempotency: `X-Idempotency-Key` header, 24-hour cache
- Async jobs: POST returns `job_id`, GET `/:job_id` polls for status
- Audit log: every state-changing API call writes an immutable audit row

---

## Pipeline Sequencing

CRA pipeline has a hard gate:
- DataGuard MUST complete with `critical_errors === 0` before NarrativeWriter runs
- If `critical_errors > 0`, NarrativeWriter returns HTTP 422 `UPSTREAM_CRITICAL_ERRORS`

This is a correctness requirement, not a performance optimization.
CRA narratives built on bad data expose the bank to regulatory risk.

---

## CRA Framework Feature Flag

The CRA regulatory framework (1995 vs 2023) is configurable per bank.
Stored in `cra.regulatory_config` table, key `CRA_FRAMEWORK`.
Default: `1995_legacy` (most community banks are still under legacy rules).

Do not hardcode CRA evaluation criteria. Always read from the config table.

---

## Work Streams — Do Not Conflate

This repository contains two independent work streams running on separate cadences.
They are executed in separate Claude Code sessions. Do not mix their terminology.

| Work Stream | Sessions | Cadence Labels | Spec Location |
|---|---|---|---|
| Product Engineering | Sessions focused on `src/`, `tests/`, `migrations/` | Day 1, Day 2, Week 1-2, Week 5-6 | `specs/` |
| SAR Narrative Library | Sessions focused on `docs/marketing/sar-narrative-library/` | Sprint 1, Sprint 2, Sprint 3, Sprint 4 | `docs/marketing/sar-narrative-library/SAR_NARRATIVE_LIBRARY_SPEC.md` |

**SAR Library Sprint 1 is NOT the same calendar period as Product Day 1.**
They are scope buckets on independent tracks. See `docs/project/NOW-NEXT-LATER.md` for full rolling wave plan.

---

## Environment

Node 20+, TypeScript 5 strict, Jest 29, Fastify 4, Supabase (PostgreSQL 15 + RLS).

See `.env.example` for all required environment variables.
See `migrations/` for database schema in apply order.
