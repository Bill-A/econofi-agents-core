# Econofi Agents — Compliance Infrastructure for MDI/CDFI Banks

**Version**: 2.0
**Status**: BSA/AML TransactionMonitor complete — Alert Dashboard deployed — CRA DataGuard next
**Methodology**: Spec-Driven Development + TDD

For the rolling implementation plan, see [`docs/project/NOW-NEXT-LATER.md`](docs/project/NOW-NEXT-LATER.md).

---

## Architecture Overview

### Technology Stack

- **Runtime**: Node.js 22 + TypeScript 5 strict mode
- **AI**: Anthropic Claude API (Sonnet for detection, Opus for narrative)
- **Database**: PostgreSQL 15 via Supabase (RLS enforced, schema-namespaced)
- **File Storage**: AWS S3 (FedRAMP Moderate, KMS encryption)
- **API**: Fastify 4, JWT auth, bank-scoped RLS context

### Production Data Ingestion Pipeline

Banks do not call REST APIs directly. Core banking systems export transaction data as batch files via SFTP. The production pipeline:

```
Bank Core System (Fiserv / Jack Henry / FIS)
      ↓  SFTP
AWS Transfer Family
      ↓
S3 Bucket (FedRAMP Moderate, KMS encrypted)
  [raw bank files: CSV / fixed-width / JSON, PII intact]
      ↓  S3 event → Lambda trigger
PII Sanitizer / Tokenizer
  · Names → [PERSON_001]   · SSNs → [SSN_REDACTED]
  · Account numbers → SHA-256 hash
  · Token map → KMS-encrypted vault (never in main DB)
      ↓
POST /v1/transactions/batch  (sanitized — no PII)
      ↓
TransactionMonitor → Claude API  (tokens and hashes only)
      ↓
bsa_aml.alerts → Alert Dashboard
```

`POST /v1/transactions/batch` is an internal interface between the sanitizer and TransactionMonitor — banks never call it directly.

### Multi-Agent Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    AWS S3 (FEDRAMP MODERATE)                      │
│  - Raw banking documents (CSV, Excel, PDF)                       │
│  - PII-containing data (NEVER sent to Claude)                    │
│  - Audit trail (immutable append-only logs)                      │
└────────────────────┬─────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│              PII SANITIZER  (Lambda / ECS)                        │
│  - Parse bank file format (varies by core system)                │
│  - Strip ALL PII → tokens and hashes                             │
│  - Store token-to-PII mapping in KMS vault                       │
└────────────────────┬─────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│               HTTP API LAYER  (Fastify, /v1/)                     │
│                                                                  │
│  POST /v1/transactions/screen    POST /v1/transactions/batch     │
│  POST /v1/cra/validate           POST /v1/cra/narrative          │
│  POST /v1/fair-lending/analyze   GET  /v1/alerts                 │
│  PATCH /v1/alerts/:id            GET  /v1/alerts/:id/events      │
│                                                                  │
│  Middleware: JWT auth → Bank RLS → PII detector →                │
│             Idempotency → Audit log                              │
└────────┬───────────────────────────────────────┬─────────────────┘
         ↓                                       ↓
┌──────────────────────────┐          ┌──────────────────────────┐
│  CLAUDE API              │          │  Alert Dashboard UI       │
│  Zero Data Retention     │          │  (econofi-agents-ui)      │
│                          │          └──────────────────────────┘
│  BSA/AML:                │
│  - TransactionMonitor    │
│                          │
│  CRA:                    │
│  - DataGuard             │
│  - NarrativeWriter       │
│                          │
│  Fair Lending:           │
│  - LoanDataAnalyzer      │
└────────────┬─────────────┘
             ↓
┌──────────────────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL 15 + RLS)                       │
│  - Sanitized transaction data                                    │
│  - Alerts, audit trail, investigation workflow                   │
│  - Schema namespaces: bsa_aml., cra., fair_lending.              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Module Specifications

### 0. HTTP API Layer

**Spec**: [`specs/api/API_LAYER_SPEC.md`](specs/api/API_LAYER_SPEC.md)

JWT and HMAC authentication, bank-scoped RLS, PII detection at boundary, idempotency keys, async job pattern, immutable audit log. All agents exposed through the same API — the Alert Dashboard UI is a thin client on the same endpoints external developers use.

---

### 1. BSA/AML TransactionMonitor

**Status**: Complete — 77 tests GREEN

**Regulatory basis**: 31 USC §5318(g), §5324 (Bank Secrecy Act)

**Spec**: [`specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md`](specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md)

Detection patterns: structuring (deposits <$10K to evade CTR), velocity anomaly (dormant account activation), round-dollar patterns, geographic risk (FATF), customer peer comparison, multiple-account rapid movement, shell entity indicators.

**SLA**: <200ms per transaction

---

### 2. CRA DataGuard

**Status**: Scaffolded — implementation next

**Regulatory basis**: 12 CFR §228.42 (Community Reinvestment Act)

**Spec**: [`specs/cra/DATA_GUARD_SPEC.md`](specs/cra/DATA_GUARD_SPEC.md)

Schema validation, census tract verification (FFIEC geocoding API), data quality checks, auto-correction with audit trail, exception reporting. `critical_errors > 0` blocks NarrativeWriter — bad data must not reach narrative generation.

**SLA**: <5 seconds for 10,000 loan records

---

### 3. CRA NarrativeWriter

**Status**: Scaffolded

**Regulatory basis**: 12 CFR §228 Subpart B, §228.43 (CRA Performance Evaluation and Public File)

**Spec**: [`specs/cra/CRA_NARRATIVE_AGENT_SPEC.md`](specs/cra/CRA_NARRATIVE_AGENT_SPEC.md)

Generates complete CRA performance narratives (Lending, Investment, Service tests), CRA public file components, and anticipated examiner Q&A. Downstream of DataGuard — requires `critical_errors === 0`. All output carries `draft_status = true`; compliance officer must explicitly acknowledge before regulatory use.

**SLA**: <30 seconds for complete annual narrative

---

### 4. Fair Lending LoanDataAnalyzer

**Status**: Not started — Week 5-6

**Regulatory basis**: 15 USC §1691 (Equal Credit Opportunity Act)

**Spec**: [`specs/fair-lending/LOAN_DATA_ANALYZER_SPEC.md`](specs/fair-lending/LOAN_DATA_ANALYZER_SPEC.md)

80% rule calculation, regression analysis (FICO/DTI/LTV controls), matched-pair testing, statistical significance (chi-square, p-values), examiner Q&A preparation. Surfaces statistical patterns — does NOT make legal determinations.

**SLA**: <10 seconds for 5,000 loan applications

---

### 5. LIHTC/NMTC ComplianceMonitor

**Status**: Not started — Week 5-6

**Regulatory basis**: IRC §42 (LIHTC), IRC §45D (NMTC)

**Spec**: [`specs/lihtc-nmtc/COMPLIANCE_MONITOR_SPEC.md`](specs/lihtc-nmtc/COMPLIANCE_MONITOR_SPEC.md)

Covenant schedule tracking across full statutory holding periods (15 years LIHTC, 7 years NMTC), 90/60/30/7-day deadline alerts, draft compliance certifications, recapture risk scoring. Qualifying investments feed into CRA NarrativeWriter as Community Development Test input. Does NOT certify compliance — draft status always.

**SLA**: <2 seconds single investment, <10 seconds full portfolio scan

---

## Sequential Pipeline Dependencies

**CRA pipeline** (hard gate — enforced):

```
DataGuard → NarrativeWriter
```

`critical_errors > 0` → NarrativeWriter returns HTTP 422 `UPSTREAM_CRITICAL_ERRORS`. CRA narratives built on bad data expose the bank to regulatory risk.

**LIHTC/NMTC → CRA** (daily scan, event-driven):

```
ComplianceMonitor → NarrativeWriter (Investment Test input)
```

Daily ComplianceMonitor scan must complete before on-demand NarrativeWriter generation to ensure investment status is current.

BSA/AML and Fair Lending pipelines run independently.

---

## PII Handling

**Zero PII reaches the Claude API.** Sanitization is the orchestrator's responsibility.

```typescript
// Raw (stays in S3 / vault only)
"John Smith deposited $9,800 at account 123-456-7890"

// Sanitized (what reaches Claude)
"[PERSON_001] deposited $9,800 at account ACCT_HASH_A7F2"
```

Token-to-PII mappings are stored in a KMS-encrypted vault separate from the main database. De-tokenization is an explicit, audited BSA Officer action — required for SAR filing with real customer names and SSNs.

PII detection runs at the API boundary as defense-in-depth. Any request containing SSN or account number patterns returns HTTP 422 `PII_DETECTED`.

---

## Database Conventions

- Schema namespaces: `bsa_aml.`, `cra.`, `fair_lending.`, `lihtc_nmtc.`
- All tables: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Audit tables append-only — no UPDATE or DELETE policies
- RLS enabled on all bank-scoped tables
- Bank context: `SET app.current_bank_id = '...'` before each query
- Migrations: `migrations/NNN_description.sql` — apply in order

---

## Running Locally

```bash
# 1. Start Docker Desktop

# 2. Start local Supabase stack
npx supabase start
npx supabase db push          # applies all migrations

# 3. Start API server
PORT=3001 npm run dev

# 4. Seed demo alerts (idempotent)
npm run seed:demo

# 5. Start UI (econofi-agents-ui repo)
npm run dev
```

See `.env.example` for all required environment variables.

---

## Security & Compliance

- **BSA/AML retention**: 5 years (31 CFR §1020.430)
- **CRA retention**: 3 years (12 CFR §228.42)
- **Fair Lending retention**: 3 years (12 CFR §1002.12)
- **Uptime SLA**: 99.9%

---

## Performance Requirements

| Agent | Operation | Target |
|---|---|---|
| TransactionMonitor | Single transaction | <200ms |
| TransactionMonitor | Daily batch (50K tx) | <5 minutes |
| DataGuard | 10K loan records | <5 seconds |
| LoanDataAnalyzer | 5K applications | <10 seconds |
| ComplianceMonitor | Full portfolio scan | <10 seconds |

---

## Cost (Per Bank, Monthly Infrastructure)

| Component | Monthly |
|---|---|
| Claude API (1M tokens) | $100 |
| Supabase | $25 |
| AWS S3 (500 GB) | $75 |
| Compute (Railway / ECS) | $60 |
| **Total** | **~$260** |

Pricing tiers: $50K–$90K/year → 75–81% gross margin.

---

© 2026 Agile Innovation Labs — Proprietary
