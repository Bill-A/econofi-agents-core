# Econofi Agents — NOW / NEXT / LATER

**Project**: Econofi Compliance Agents — MDI/CDFI Bank Compliance Automation
**Repository**: `econofi-agents-core` (API + agents), `econofi-agents-ui` (demo UI)
**Methodology**: Spec-Driven Development + 3-Day Implementation Sprint
**Overall Status**: Day 1–3 Sprint Complete — Demo UI Ready — May 11 Demo Confirmed
**First Deliverable**: BSA/AML TransactionMonitor — regulation-stable, $59B industry spend, every bank, no framework uncertainty

*Last updated: May 6, 2026 — 3-day sprint complete; May 11 demo with Demetra confirmed*

---

## Summary

Six technical specifications are complete; a seventh (RegulatoryWatcher) is in progress. The 3-Day Implementation Sprint is complete for BSA/AML. BSA/AML agent, API routes, and demo UI are all implemented and test-green. CRA DataGuard is scaffolded and ready for implementation.

**First deliverable rationale**: BSA/AML is the highest-spend compliance burden ($59B/year), every bank has a BSA Officer with a budget, and the regulatory framework is stable. CRA module development continues in parallel but BSA/AML leads the sprint and the sales conversation.

**Critical product boundary — two distinct CRA products:**

| Product | What it does | Buyer | CRA hook |
|---|---|---|---|
| CRA DataGuard + NarrativeWriter (this repo) | HMDA LAR validation, auto-correction, CRA performance narrative generation | CRA Officer / compliance team | Exam prep narrative and data integrity |
| White-label financial platform (econofi-calculator repo) | Quarterly impact reports: LMI users served, census tract distribution, engagement metrics | MDI Executive | Community Development Test credit documentation |

The MDI executive sales pitch — mission alignment, CRA Community Development Test positioning, quarterly impact reports — is selling the **white-label financial platform**, not the CRA agent products. These are separate conversations with separate buyers. Do not conflate them in sprint planning or sales materials.

**Completion by layer:**

| Layer | Spec Status | Implementation Status | Sprint Priority |
|---|---|---|---|
| BSA/AML TransactionMonitor | Complete | **COMPLETE** — agent, API routes, 77 tests GREEN | Day 1 |
| CRA DataGuard | Complete | Scaffolded — agent, routes, tests, migrations committed | Day 2 |
| CRA NarrativeWriter | Complete | Scaffolded — agent, routes, tests committed | Week 1-2 |
| LIHTC/NMTC ComplianceMonitor | Complete | Not started | Week 5-6 |
| Fair Lending LoanDataAnalyzer | Complete | Not started | Week 5-6 |
| HTTP API Layer | Complete | **COMPLETE** — POST /v1/transactions/screen, GET /v1/alerts, GET /v1/alerts/:id, PATCH /v1/alerts/:id | Day 2 (BSA/AML endpoints) |
| RegulatoryWatcher | In Progress | Not started | Weeks 3-4 |

---

## NOW — Sprint Complete + Demo

*Status updated May 6, 2026 — sprint days 1–3 complete; demo UI shipped.*

### Repository Scaffold

- [x] Create implementation repo: `econofi-agents-core`
- [x] Initialize Node.js + TypeScript 5 + Jest — Node 22, TS 5.9, `jest.config.ts` committed
- [x] Configure ESLint + Prettier (TypeScript strict mode) — `.eslintrc.json`, `.prettierrc.json`, `.prettierignore` committed
- [x] `.env.example` committed with all required variables — `.env` fully populated (all 20 variables set)
- [x] CRA agents scaffolded: `DataGuard`, `NarrativeWriter`, `AutoCorrector`, `ChatAgent`, `PerformanceCalculator`, `PublicFileAssembler`, `SchemaValidator`
- [x] Shared infrastructure scaffolded: auth middleware, PII detector, FFIEC client, Supabase client, pino logger, env validation
- [x] CRA routes scaffolded: `POST /v1/cra/validate`, `POST /v1/cra/narrative`, `POST /v1/cra/chat`
- [x] CRA test files scaffolded: `dataGuard.test.ts`, `narrativeWriter.test.ts`, `chatAgent.test.ts`
- [x] Migrations committed: `001_create_bsa_aml_schema.sql` through `004_create_chat_schema.sql`
- [x] Install Supabase CLI and confirm `supabase start` runs local stack — CLI v2.90.0 installed; `supabase init` complete; local stack running
- [ ] **Confirm Supabase staging project has RLS enabled** — deferred; verify before pilot deployment, not required for sprint

### Test Data Preparation

- [x] Generate 100 synthetic BSA/AML transactions (mix: normal, structuring, velocity anomaly, round-dollar, dormant account activation) — committed to `tests/fixtures/synthetic/bsa-aml-transactions.json`
- [ ] Generate 5 synthetic LIHTC/NMTC investment records (mix: compliant, 30-day alert, overdue) — post-sprint
- [x] Store all fixtures in `tests/fixtures/synthetic/` with clear naming conventions — naming convention established

### Sprint Stakeholder

- [x] Demo participant confirmed — Demetra (CEO, co-founder acting as proxy BSA Officer) — **May 11, 2026**
- [x] Demo scenario brief: structuring pattern detection + alert dashboard + investigation workflow

### Dependencies to Confirm

- [x] Anthropic API key set — `ANTHROPIC_API_KEY` populated in `.env`
- [x] FFIEC access confirmed — public API, no key required; `FFIEC_GEOCODE_API_URL` set
- [x] AWS credentials set — `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` populated
- [ ] Supabase staging project tier confirmed sufficient for RLS + real-time — deferred; not required for sprint
- [x] Local database running — Supabase CLI local stack replaces standalone PostgreSQL; `supabase start` confirmed running

---

### Day 1 — BSA/AML TransactionMonitor (COMPLETE)

#### Morning: Core Detection Patterns

- [x] Copy test cases from `specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md` to `tests/bsa-aml/transactionMonitor.test.ts`
- [x] Run tests — all fail (RED phase confirmed)
- [x] Implement `TransactionMonitorAgent` TypeScript class
- [x] Implement structuring detection (deposits <$10K to evade CTR, 31 USC §5324)
- [x] Implement velocity anomaly detection (dormant account sudden activation)
- [x] Implement round-dollar pattern analysis
- [x] Implement geographic risk scoring (FATF blacklist/greylist countries)
- [x] Implement customer segmentation and peer comparison

#### Afternoon: Remaining Patterns + Alert Generation

- [x] Implement CTR threshold approach detection (multiple cash transactions near $10K)
- [x] Implement multiple account rapid movement detection
- [x] Implement shell entity indicator detection
- [x] Implement `SuspiciousActivityAlert` generation with SAR narrative support and regulatory citations
- [x] Implement PII sanitization (customer tokens passed to Claude — no names or SSNs)
- [x] Run full test suite against synthetic transaction fixtures

**Day 1 Validation Gate**: All TransactionMonitor unit tests pass (GREEN) — Structuring pattern detected on synthetic transaction sequence with 31 USC §5324 citation — Normal transaction returns `alert: null` — Single transaction screened within 200ms SLA

---

### Day 2 Morning — HTTP API Layer: BSA/AML Endpoints (COMPLETE)

- [x] `POST /v1/transactions/screen` — calls TransactionMonitor, synchronous, <200ms SLA
- [x] `GET /v1/alerts` — paginated alert list, bank-scoped via RLS
- [x] `GET /v1/alerts/:alert_id` — single alert detail
- [x] `PATCH /v1/alerts/:alert_id` — investigation status update, immutable audit trail
- [x] JWT authentication middleware (`authenticateRequest` + `extractBankId`)
- [x] PostgreSQL RLS context setter (`SET app.current_bank_id`)
- [x] Audit log writer (`api_audit_log` table — no UPDATE or DELETE)
- [x] PII detector at API boundary (reject 422 `PII_DETECTED` on SSN/account pattern match)
- [x] `ApiResponse<T>` envelope wrapper with `meta.request_id`, `meta.bank_id`, `meta.api_version`

**Day 2 Morning Validation Gate**: `POST /v1/transactions/screen` returns screening result — `GET /v1/alerts` returns bank-scoped results — `PATCH /v1/alerts/:alert_id` updates investigation status — PII in request body returns 422 `PII_DETECTED`

---

### Day 3 — Demo UI (COMPLETE)

**Demo UI repository**: `econofi-agents-ui` (Next.js 16, React 19, TypeScript strict, TDD)

#### Screens built

- [x] **Transaction Screener** (`/screen`) — Server Action, pre-populated structuring scenario (amount=$9,800, cash deposit, [PERSON_001]), 10/10 tests GREEN
- [x] **Alert Dashboard** (`/alerts`) — Server Component, paginated list, severity + status filters, risk score bars, "Investigate" link per row
- [x] **Alert Detail** (`/alerts/:alert_id`) — Server Component, investigation form, SAR reference field conditional on `sar_filed` status, status update via Server Action
- [x] **Demo seed script** — `npm run seed:demo` from `econofi-agents-core` — inserts 3 pre-built alerts (structuring HIGH, velocity CRITICAL, geographic MEDIUM); idempotent, re-runnable

#### Demo readiness checklist (complete before May 11)

```bash
# 1. Start Docker Desktop (from the app, not terminal)

# 2. econofi-agents-core — start local Supabase stack
npx supabase start
npx supabase db push          # apply migrations if not already applied
npm run seed:demo             # insert 3 demo alerts (idempotent, re-runnable)

# 3. econofi-agents-core — start API server
PORT=3001 npm run dev

# 4. econofi-agents-ui — start UI server (new terminal tab)
npm run dev
```

Verify before the call: `GET http://localhost:3001/v1/alerts` returns 3 seeded alerts, then walk all 3 screens end-to-end.

**Day 3 Validation Gate**: BSA Officer identifies at least one manual process the platform eliminates — Sprint retrospective notes captured in `docs/SPRINT_RETROSPECTIVE.md`

---

## NEXT — Alert Dashboard Deployment + CRA DataGuard

### Alert Dashboard — Full Stack Deployment (~half day)

TransactionMonitor (`econofi-demo`) is deployed at `econofi-demo.netlify.app` — pure client-side, no backend.
The Alert Dashboard (`econofi-agents-ui` + `econofi-agents-core`) requires three services deployed and wired together.

#### 1. Frontend — `econofi-agents-ui` → Vercel or Netlify

- [ ] Push `econofi-agents-ui` to a GitHub repo
- [ ] Connect repo to Vercel (preferred for Next.js) or Netlify
- [ ] Set build command: `npm run build`, output: `.next`
- [ ] Set environment variable: `API_URL=<deployed backend URL>`
- [ ] Deploy — confirm Alert Dashboard loads at production URL
- [ ] Set custom domain `app.econofi.app` (or similar) when ready

#### 2. Backend — `econofi-agents-core` → Railway or Render

- [ ] Push `econofi-agents-core` to a GitHub repo
- [ ] Create a new Railway or Render service (Node.js, free tier sufficient for demo)
- [ ] Set all environment variables from `.env` (exclude `DATABASE_URL` local — use cloud Supabase URL)
- [ ] Set `PORT=3001`, `NODE_ENV=production`
- [ ] Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to cloud project values (see step 3)
- [ ] Deploy — confirm `GET /v1/alerts` returns 200 with valid JWT

#### 3. Database — Switch local Supabase → cloud Supabase project

- [ ] Log in to supabase.com — the cloud project already exists (`ljhqickbsxxwmpsrvnpl`)
- [ ] Run migration `001_create_bsa_aml_schema.sql` against the cloud project (Supabase Studio SQL editor or `supabase db push --linked`)
- [ ] Grant schema permissions: `GRANT USAGE ON SCHEMA bsa_aml TO service_role; GRANT ALL ON ALL TABLES IN SCHEMA bsa_aml TO service_role;`
- [ ] Create `public.set_app_context(bank_id_value text)` wrapper function in cloud Studio (same SQL used locally)
- [ ] Re-run `npx ts-node scripts/seed-demo.ts` with `SUPABASE_URL` pointing to cloud project — seeds 4 demo alerts
- [ ] Confirm RLS is enabled on `bsa_aml.alerts` in the cloud project

#### 4. Wire and verify

- [ ] Update `API_URL` in Vercel/Netlify to point to the deployed Railway/Render backend URL
- [ ] Confirm `GET <backend>/v1/alerts` returns seeded alerts through the deployed UI
- [ ] Confirm SAR narrative panel appears when status is set to SAR Filed

---

### Day 2 Afternoon — CRA DataGuard (deferred from sprint)

- [ ] Generate 200 synthetic CRA loan records in HMDA LAR format (mix: valid, fixable, unfixable) — commit to `tests/fixtures/synthetic/cra-loan-records.json` before DataGuard TDD begins
- [ ] Copy test cases from `specs/cra/DATA_GUARD_SPEC.md` to `tests/cra/dataGuard.test.ts`
- [ ] Run tests — all fail (RED phase confirmed)
- [ ] Implement `DataGuardAgent` TypeScript class
- [ ] Implement schema validation against 12 CFR §228.42 (census tract, income category, loan type)
- [ ] Implement FFIEC API integration for census tract verification
- [ ] Implement auto-correction with confidence scoring (threshold: 0.80)
- [ ] Implement exception report generation (CRITICAL / HIGH / MEDIUM / LOW)
- [ ] Add CRA framework feature flag: `CRA_FRAMEWORK: '1995_legacy' | '2023_modern'`
- [ ] Wire `POST /v1/cra/validate` endpoint

**Validation Gate**: All DataGuard unit tests pass (GREEN) — Invalid census tract returns CRITICAL exception with 12 CFR §228.42 citation — `POST /v1/cra/validate` returns exception report via authenticated API

### Weeks 1–2: CRA NarrativeWriter + BSA/AML Full Build

- [ ] NarrativeWriter agent: implement narrative section generation for Lending Test, Investment Test, Service Test; CRA public file assembly per 12 CFR §228.43; `draft_status` on all outputs
- [ ] NarrativeWriter pipeline halt: refuse to run when DataGuard `critical_errors > 0`
- [ ] BSA/AML batch endpoint: `POST /v1/transactions/batch` (async, up to 50K transactions) + `GET /v1/transactions/batch/:job_id`
- [ ] CRA batch endpoint: `POST /v1/cra/batch` (async, up to 10K records) + `GET /v1/cra/reports/:job_id`
- [ ] Integration tests: DataGuard -> NarrativeWriter pipeline with real Supabase (staging)

**Milestone**: NarrativeWriter generates a complete DRAFT CRA narrative from 200 synthetic loan records. BSA/AML batch processes 50K transactions in under 5 minutes.

### Weeks 3–4: HTTP API Layer — Full Build

Complete remaining 12 post-sprint endpoints:

**BSA/AML** — `POST /v1/transactions/batch` (async, up to 50K) — `GET /v1/transactions/batch/:job_id` (poll)

**CRA** — `POST /v1/cra/batch` — `GET /v1/cra/reports/:job_id` — `GET /v1/cra/narrative/:job_id` — `POST /v1/cra/narrative` (enforces `UPSTREAM_CRITICAL_ERRORS` halt) — `POST /v1/cra/narrative/:job_id/acknowledge` (immutable acknowledgment log)

**Fair Lending** — `POST /v1/fair-lending/analyze` — `GET /v1/fair-lending/reports/:job_id` — `GET /v1/fair-lending/examiner-prep/:job_id`

**LIHTC/NMTC** — `POST /v1/lihtc-nmtc/scan` — `GET /v1/lihtc-nmtc/portfolio` — `POST /v1/lihtc-nmtc/investments/:id/certifications` — `POST /v1/lihtc-nmtc/certifications/:id/acknowledge`

**Shared** — Idempotency middleware (`X-Idempotency-Key`, 24-hour cache) — Rate limiting (per tier: Sandbox/Starter/Professional/Enterprise) — API key + HMAC-SHA256 for ISV partners — `openapi/v1.yaml` (OpenAPI 3.1) — Postman collection

**RegulatoryWatcher Agent** — Finalize spec — Implement scheduled poller for FinCEN, CFPB, OCC, FATF, FFIEC — Map detected changes to config table rows — Emit `regulatory.update_detected` webhook — `GET /v1/regulatory/updates` + `POST /v1/regulatory/updates/:id/acknowledge` — Schedule: daily Federal Register RSS + weekly FATF grey/black list diff

**Milestone**: Full Postman collection passes against staging. OpenAPI spec committed. RegulatoryWatcher detects a simulated threshold change and emits a correctly formed webhook.

---

## LATER — Weeks 5–8: Scale + Pilot

### Weeks 5–6: Fair Lending + ComplianceMonitor + Security Hardening

- [ ] Fair Lending LoanDataAnalyzer: 80% rule, regression with controls (FICO, DTI, LTV), matched-pair comparison, Legal Review Gate
- [ ] LIHTC/NMTC ComplianceMonitor: 90/60/30/7-day alerts, recapture risk scoring, DRAFT certification generation, daily EventBridge scan
- [ ] Integration tests: ComplianceMonitor -> NarrativeWriter (Investment Test input)
- [ ] SOC 2 Type II controls documented
- [ ] PII vault audit: confirm zero unmasked PII in any agent output or log
- [ ] AGENT BOUNDARIES stress-test: 10 adversarial prompts per agent — confirm all rejected
- [ ] Penetration test: JWT tampering, bank_id spoofing, RLS bypass attempts
- [ ] Data retention policy: BSA/AML 5 years, CRA 3 years, Fair Lending 25 months

**Milestone**: All five agents passing full unit test suites. Security assessment report signed off.

### Weeks 7–8: Pilot Preparation + BSA Officer Pilot

- [ ] Deploy to AWS staging with first MDI pilot bank's transaction data (anonymized, last 90 days)
- [ ] Run TransactionMonitor on pilot bank's real data — generate alert report for BSA Officer review
- [ ] Begin CRA DataGuard pilot if bank has upcoming exam cycle
- [ ] Prepare pilot bank presentation: alerts generated, false positive rate, time saved vs. manual review
- [ ] Draft pilot bank contract / LOI
- [ ] Schedule formal pilot kickoff meeting
- [ ] Use Day 3 BSA Officer feedback to finalize sales demo script

**Milestone**: Pilot bank BSA Officer reviews an alert report generated from their own transaction data and signs LOI or proceeds to pilot agreement.

---

## Demo Readiness

**Status: READY — CEO demo rescheduled to May 13, 2026**

TransactionMonitor deployed at `https://econofi-demo.netlify.app` — no local setup required.

Alert Dashboard runs locally. Start stack before the demo:

```bash
# 1. Start Docker Desktop

# 2. econofi-agents-core — start Supabase + seed + API
npx supabase start
npx ts-node -r tsconfig-paths/register scripts/seed-demo.ts
PORT=3001 npm run dev

# 3. econofi-agents-ui — start frontend (new terminal)
npm run dev
```

Demo UI (`econofi-agents-ui`) screens:
- About page — how to use the app + collapsible Demo Guide (5-minute walkthrough)
- Alert Dashboard — paginated, filterable, risk score bars
- Alert Detail — investigation form, SAR reference field, SAR narrative panel with Bank/CU toggle
- Transaction Screener — spot-check tool, secondary to dashboard

Seed data: **4 pre-built alerts** (structuring HIGH, velocity CRITICAL, geographic MEDIUM, round dollar HIGH).
Structuring alert amounts corrected to match TransactionMonitor: $9,200 / $9,400 / $9,150.

**5-minute demo path**: TransactionMonitor (localhost:5173 or econofi-demo.netlify.app) → transition to Alert Dashboard (localhost:3000) → investigate structuring alert → SAR Filed → narrative panel → download Word doc. Full script on the About page Demo Guide.

---

## Spec Files Reference

| Module | Spec File | Status | Build Priority |
|---|---|---|---|
| BSA/AML TransactionMonitor | `specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md` | Complete | Sprint Day 1 |
| CRA DataGuard | `specs/cra/DATA_GUARD_SPEC.md` | Complete | Sprint Day 2 |
| HTTP API Layer | `specs/api/API_LAYER_SPEC.md` | Complete | Sprint Day 2 |
| CRA NarrativeWriter | `specs/cra/CRA_NARRATIVE_AGENT_SPEC.md` | Complete | Week 1-2 |
| Fair Lending LoanDataAnalyzer | `specs/fair-lending/LOAN_DATA_ANALYZER_SPEC.md` | Complete | Week 5-6 |
| LIHTC/NMTC ComplianceMonitor | `specs/lihtc-nmtc/COMPLIANCE_MONITOR_SPEC.md` | Complete | Week 5-6 |
| RegulatoryWatcher | `specs/regulatory-watcher/REGULATORY_WATCHER_SPEC.md` | In Progress | Weeks 3-4 |

---

## Key Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| March 2026 | BSA/AML leads the sprint and the sales motion | Regulation-stable, $59B spend, every bank has a BSA Officer, no framework uncertainty |
| March 2026 | Section 1071 deprioritized — target 2027 cohort | 16-week sales cycle kills July 2026 first-mover play; real window is post-July replacement market |
| March 2026 | Call Report excluded from roadmap | Data transformation, not intelligence; crowded vendor market; wrong AI use case |
| March 2026 | CRA framework feature flag added to DataGuard + NarrativeWriter | 1995 vs 2023 CRA framework uncertainty is a correctness risk; flag lets banks choose their exam path |
| March 2026 | Regulatory thresholds stored in config table, not hardcoded | When FinCEN changes SAR threshold from $5K to $10K, update one row — not code |
| March 2026 | Adopt 3-Day Implementation Sprint (Design Sprint + Build) | Sprint-as-build validates specs with running code, not just docs |
| March 2026 | Add AGENT BOUNDARIES blocks to all 5 agent specs | Defines non-actions as explicitly as actions; reduces regulatory liability |
| March 2026 | Sequential pipeline: DataGuard must pass before NarrativeWriter runs | CRA narratives built on bad data expose the bank to regulatory risk |
| March 2026 | All NarrativeWriter + ComplianceMonitor outputs carry `draft_status` | Compliance officers must acknowledge before any regulatory submission |
| March 2026 | API Layer spec written before agents are built | Spec = shared contract; agents and routes built to the same interface |
| Feb 2026 | `claude-opus-4-6` for NarrativeWriter (temp 0.3) | Narrative quality requires highest capability model; low temp for regulatory language consistency |
| Feb 2026 | `claude-sonnet-4-6` for ComplianceMonitor (temp 0.0) | Deterministic covenant tracking; no creative interpretation |
| March 2026 | RegulatoryWatcher added as Module 6 (Weeks 3-4) | Regulatory threshold config table needs a watcher to detect when rows must be updated; closes the loop between spec design and live regulatory change |
| April 2026 | BSA/AML-first delivery order confirmed despite Sales Playbook recommending CRA-first | BSA/AML obligation is perpetual and universal — no exam window required to create urgency. CRA-first argument depends on exam timing urgency with no target MDI currently in that window. |
| April 2026 | Supabase CLI replaces standalone PostgreSQL for local dev | Supabase local stack provides PostgreSQL + RLS + Auth + Realtime locally; standalone PostgreSQL does not exercise RLS, making tests non-representative of production behavior |
| May 2026 | Demo UI triggered — confirmed meeting with Demetra (May 11) | Named compliance officer at target institution confirmed; NNL trigger condition met |
| May 2026 | Demo UI scoped to 3 screens; no Demo Setup in nav | Demo Setup is a pre-meeting operator task (seed script), not a BSA Officer workflow; showing it in nav is unprofessional in a compliance context |
| May 2026 | `bank_id` changed to UUID format in demo JWT | `bank_customer_mapping.bank_id` column is `UUID NOT NULL`; RLS policy casts to `::UUID`; non-UUID string would error at query time |
