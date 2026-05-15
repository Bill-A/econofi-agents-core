# Econofi Agents — NOW / NEXT / LATER

**Project**: Econofi Compliance Agents — MDI/CDFI Bank Compliance Automation
**Repository**: `econofi-agents-core` (API + agents), `econofi-agents-ui` (demo UI)
**Methodology**: Spec-Driven Development + 3-Day Implementation Sprint
**Overall Status**: Day 1–3 Sprint Complete — CEO Demo Complete — Post-Demo Sprint: Items 1–3 Complete — Frontend Sprint: Items 1–3 Complete — Full Stack Deployed
**First Deliverable**: BSA/AML TransactionMonitor — regulation-stable, $59B industry spend, every bank, no framework uncertainty

*Last updated: May 15, 2026 — Full stack deployed and verified end-to-end: 15 demo alerts loading at econofi-bsa-dashboard.netlify.app, audit trail endpoint live, migration 005 applied to cloud DB*

---

## Summary

Six technical specifications are complete; a seventh (RegulatoryWatcher) is in progress. The 3-Day Implementation Sprint is complete for BSA/AML. BSA/AML agent, API routes, and demo UI are all implemented and test-green. CRA DataGuard is scaffolded and ready for implementation.

**Post-demo outcome (May 2026)**: CEO demo confirmed BSA/AML as the lead product. Next phase deepens the product for a pilot with a real BSA Officer as Product Owner. Three items were prioritized (see HANDOFF.md and Post-Demo Sprint section below). Tests for all three items are already written and RED — implementation is next.

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

## Production Data Ingestion Architecture

*Confirmed May 13, 2026. This is the production pipeline. The REST batch endpoint is an internal interface, not the bank-facing intake path.*

Banks do not call REST APIs. Core banking systems (Fiserv, Jack Henry, FIS) export transaction data as batch files and deliver them via SFTP. The correct architecture is:

```
Bank Core System (Fiserv / Jack Henry / FIS)
      ↓  SFTP
AWS Transfer Family  — managed SFTP service, delivers directly into S3; no self-managed SFTP server
      ↓
S3 Bucket (FedRAMP Moderate — standard AWS regions; FedRAMP High — AWS GovCloud)
  [raw bank files: CSV / fixed-width / JSON, PII intact]
      ↓  S3 event notification → Lambda trigger
PII Sanitizer / Tokenizer  (new service — Lambda or ECS)
  · Parse bank file format (format varies by core system)
  · Customer names     →  [PERSON_001], [PERSON_002], ...
  · SSNs               →  [SSN_REDACTED]
  · Account numbers    →  SHA-256 hash
  · Token map          →  stored in KMS-encrypted vault (never in main DB)
      ↓
POST /v1/transactions/batch  (sanitized — no PII reaches this layer or Claude)
      ↓
TransactionMonitor → Claude API  (sees only tokens and hashes)
      ↓
bsa_aml.alerts → Alert Dashboard
```

### De-tokenization vault — required for SAR filing

FinCEN SAR forms require real customer name, SSN, and account number. The token-to-PII mapping must be stored in a separate, KMS-encrypted vault (AWS Secrets Manager or dedicated vault service). De-tokenization is a controlled, explicitly acknowledged action:

- BSA Officer clicks "Prepare SAR Filing" (acknowledged action, not automatic)
- System calls vault → populates SAR form fields with real PII
- Vault access is written to an immutable audit log (who, when, which alert)
- De-tokenized data never persists outside the SAR draft — it is passed to the form only

This vault is distinct from the main Supabase database. The main DB stores only tokens and hashes. This is a hard architectural constraint.

### Implications for the REST batch endpoint

`POST /v1/transactions/batch` is the **internal interface** between the PII Sanitizer and TransactionMonitor — not a bank-facing API. Banks never call it directly. The endpoint remains correct as-is; the SFTP → S3 → Sanitizer pipeline calls it after sanitization.

### Items not yet in roadmap (pre-pilot requirement)

- [ ] AWS Transfer Family SFTP endpoint — one per pilot bank, scoped to their S3 prefix
- [ ] S3 bucket with FedRAMP-appropriate region, KMS encryption at rest, VPC endpoint (no public internet)
- [ ] PII Sanitizer service — Lambda (files < 50MB) or ECS Fargate (larger batches); handles CSV, fixed-width, JSON
- [ ] Token vault — KMS + Secrets Manager; token-to-PII mapping; TTL aligned with BSA 5-year retention requirement
- [ ] De-tokenization workflow — explicit BSA Officer acknowledgment → vault call → SAR form population → audit log
- [ ] S3 event → Lambda trigger wiring → `POST /v1/transactions/batch` call
- [ ] File format adapters for at least Fiserv and Jack Henry export formats (pilot bank will dictate which)

---

## COMPLETED — 3-Day Sprint + Demo UI

*Closed May 12, 2026 — sprint days 1–3 complete; CEO demo done.*

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

- [x] **About / Demo Guide** (`/about`) — static Server Component; platform pitch, 3-step workflow cards, pre-seeded scenario cards; collapsible 5-minute Demo Guide for BSA Officer walkthrough
- [x] **Transaction Screener** (`/screen`) — Server Action, pre-populated structuring scenario (amount=$9,200, cash deposit, [PERSON_001]), 10/10 tests GREEN
- [x] **Alert Dashboard** (`/alerts`) — Server Component, paginated list, severity + status filters, risk score bars, "Investigate" link per row
- [x] **Alert Detail** (`/alerts/:alert_id`) — Server Component; investigation form, SAR reference field; SAR narrative panel with Bank/CU toggle and Word doc download; status update via Server Action
- [x] **Demo seed script** — `npm run seed:demo` from `econofi-agents-core` — inserts **4** pre-built alerts (structuring HIGH, velocity CRITICAL, geographic MEDIUM, round-dollar HIGH); idempotent, re-runnable; structuring amounts corrected to match TransactionMonitor ($9,200 / $9,400 / $9,150)

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

## COMPLETED — Post-Demo Sprint: Items 1–3

*Closed May 12, 2026 — all three items GREEN, 132/132 tests passing, migration applied to local DB.*

### Item 1: "Don't File" Workflow — Structured Closure Reason ✓

- [x] `migrations/005_bsa_aml_closure_and_events.sql` — `closure_reason_code` + `closure_reason_detail` on `bsa_aml.alerts`
- [x] `alertRepository.ts` — `updateAlertStatus()` saves closure fields
- [x] PATCH route Zod schema — `closure_reason_code` required for `no_sar_warranted` / `false_positive`; invalid code → 400
- [x] `closure_reason_code` returned in PATCH response envelope
- [x] 5 new tests GREEN (`tests/bsa-aml/api.test.ts`)

### Item 2: Batch Transaction Intake ✓

- [x] `src/routes/bsa-aml/batch.ts` — `POST /v1/transactions/batch`, max 500, PII-guarded
- [x] Registered in `src/server.ts`
- [x] 10 tests GREEN (`tests/bsa-aml/api-batch.test.ts`), 2000ms SLA confirmed

### Item 3: Exam-Ready Audit Trail ✓

- [x] `migrations/005_bsa_aml_closure_and_events.sql` — `bsa_aml.alert_events` table, append-only RLS
- [x] `alertRepository.ts` — `logAlertEvent()` + `getAlertEvents()`; every `updateAlertStatus()` call writes an immutable event row
- [x] `GET /v1/alerts/:alert_id/events` route registered
- [x] 7 tests GREEN (`tests/bsa-aml/api-events.test.ts`)

**Apply migration to local DB** (multi-statement files require Docker exec — `supabase db query -f` does not support them):
```bash
docker cp migrations/005_bsa_aml_closure_and_events.sql supabase_db_econofi-agents-core:/tmp/005.sql
docker exec supabase_db_econofi-agents-core psql -U postgres -d postgres -f /tmp/005.sql
```

---

## COMPLETED — Frontend Sprint: Items 1–3

*Closed May 14, 2026 — all three UI items GREEN, 42/42 tests passing.*

**TDD applied throughout.** Every component started with a failing test. RED confirmed before any implementation.

### UI Item 1: "Close Without Filing" Panel ✓

**COMPLETE** — May 13, 2026. 9/9 tests GREEN.

- [x] `ClosureReasonPanel` component (`components/ClosureReasonPanel.tsx`) — amber-styled panel, 8 closure reason codes, optional detail textarea
- [x] Wired into `InvestigationForm` for `no_sar_warranted` and `false_positive` statuses
- [x] `CLOSURE_REASON_CODES`, `ClosureReasonCode`, `CLOSURE_REASON_LABELS` added to `lib/types.ts`
- [x] `closure_reason_code` and `closure_reason_detail` added to `BsaAmlAlert` type
- [x] `updateAlertStatus` in `lib/api.ts` extended to accept closure fields
- [x] `actions.ts` forwards closure fields from form submission

### UI Polish ✓

- [x] Demo banner added to nav — amber strip, all pages (`components/Nav.tsx`)
- [x] Home page moved from `/about` to `/` — full home page with hero, how-to steps, demo guide, scenario cards; `/about` redirects to `/`
- [x] Nav active-link logic fixed for `/` (exact match only)
- [x] `econofi-demo` demo banner added — `SetupStep` and `AppHeader`, matching amber style
- [x] `econofi-demo` `SetupStep` label corrected: `/ TransactionMonitor` → `/ bsa-aml-transactions-feed`
- [x] `econofi-demo` README rewritten and `CLAUDE.md` created
- [x] Open Sans applied globally as body font (was only on nav); Inter removed from body
- [x] Font sizes increased throughout `/alerts`, `/screen`, `/` — all table text, form labels, inputs, badges bumped to `text-base`/`text-lg`; `max-w-7xl` removed from alerts (full-width table); `max-w-2xl` on /screen widened to `max-w-3xl`

### UI Item 2: Batch Screener (Developer / Demo Tool) ✓

**COMPLETE** — May 13, 2026. 13/13 tests GREEN.

- [x] Tab toggle on `/screen` — "Screen One" / "Batch Screen" (`app/screen/page.tsx` rewritten as client component)
- [x] `BatchScreenForm` component (`app/screen/BatchScreenForm.tsx`) — JSON textarea pre-populated with 3-transaction structuring example, live count indicator, "Screen Batch" / "Analyzing N transactions..." button
- [x] `BatchResultsView` — submitted/alerts counts, per-alert links to `/alerts/:alert_id`, "Screen Another Batch" reset
- [x] `PII_DETECTED` 422 error state with clear message
- [x] `batchScreenAction` Server Action in `app/screen/actions.ts`
- [x] `batchScreenTransactions()` added to `lib/api.ts`
- [x] Developer/demo tool note shown when batch tab is active

### UI Item 3: Audit Trail Timeline ✓

**COMPLETE** — May 14, 2026. 10/10 tests GREEN.

- [x] `AlertEvent` interface added to `lib/types.ts`
- [x] `getAlertEvents(alertId)` added to `lib/api.ts` — calls `GET /v1/alerts/:id/events`, correctly extracts `envelope.data.events`
- [x] `AuditTrail` component (`components/AuditTrail.tsx`) — vertical timeline, from→to status transition, formatted date, closure reason human-readable label, notes; empty state "No events recorded yet."
- [x] Wired into alert detail page — `getAlert` and `getAlertEvents` fetched in parallel with `Promise.all`
- [x] `router.refresh()` added to `InvestigationForm` after successful update — audit trail updates automatically without page reload
- [x] `useRouter` mock added to `InvestigationForm.test.tsx`

**Note for demo**: backend server (`econofi-agents-core`) must be restarted after pulling latest code — the `GET /v1/alerts/:id/events` route was added in the post-demo sprint and requires a fresh `PORT=3001 npm run dev`.

---

## COMPLETED — Deployment

*Closed May 15, 2026 — full stack deployed and verified end-to-end.*

### Alert Dashboard — Full Stack Deployment (~half day)

TransactionMonitor (`econofi-demo`) is deployed at `econofi-demo.netlify.app` — pure client-side, no backend.
The Alert Dashboard (`econofi-agents-ui` + `econofi-agents-core`) requires three services deployed and wired together.

#### 1. Frontend — `econofi-agents-ui` → Netlify ✓

- [x] Push `econofi-agents-ui` to GitHub — `github.com/Bill-A/econofi-agents-ui`
- [x] Connect repo to Netlify — project name: `econofi-bsa-dashboard`
- [x] Set env vars: `API_URL` (placeholder), `DEMO_JWT_SECRET`
- [x] Deploy — site live at `econofi-bsa-dashboard.netlify.app`
- [x] Home and Transaction Screener pages confirmed loading
- [x] Update `API_URL` to deployed backend URL — `https://econofi-agents-core-production.up.railway.app`
- [x] Confirm Alert Dashboard loads alerts end-to-end — 15 alerts loading
- [ ] Set custom domain `app.econofi.app` (or similar) when ready

#### 2. Backend — `econofi-agents-core` → Railway ✓

- [x] Push `econofi-agents-core` to a GitHub repo — `github.com/Bill-A/econofi-agents-core`
- [x] Create a new Railway service (Node.js)
- [x] Set all environment variables from `.env`
- [x] Set `PORT=3001`, `NODE_ENV=production`
- [x] Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to cloud project values
- [x] Deploy — `GET /v1/alerts` returns 200 with valid JWT
- [x] Fix: added `ws` package as realtime transport (Node.js 20 lacks native WebSocket)

#### 3. Database — Cloud Supabase project ✓

- [x] Create new Supabase project (US East region)
- [x] Run migrations `001` through `005` against the cloud project
- [x] Grant schema permissions: `GRANT ALL ON ALL TABLES IN SCHEMA bsa_aml TO service_role, postgres`
- [x] Create `public.set_app_context(bank_id_value text)` wrapper function
- [x] Seed 15 demo alerts via `scripts/seed-cloud.sql` (run in Supabase Studio)
- [x] RLS enabled on `bsa_aml.alerts` and `bsa_aml.alert_events`
- [x] RLS enabled on `public.bank_customer_mapping`
- [x] `bsa_aml` and `cra` schemas added to Supabase Data API exposed schemas

#### 4. Wire and verify ✓

- [x] Update `API_URL` in Netlify to Railway backend URL
- [x] Confirm alert dashboard loads 15 alerts end-to-end
- [x] Confirm audit trail endpoint returns 200 (`GET /v1/alerts/:id/events`)
- [x] Confirm SAR narrative panel appears when status is set to SAR Filed

---

## NOW — BSA/AML Demo Enhancements

*Status: May 15, 2026 — Full stack deployed. Deepening demo before pilot outreach.*

### 1. Audit Trail Events — Seed Historical Investigation Records

The audit trail is the strongest exam-readiness differentiator but currently shows "No events recorded yet" on every alert. Pre-seeding realistic event sequences on resolved and in-progress alerts makes the feature tangible.

- [x] Run `scripts/seed-audit-events.sql` in Supabase Studio SQL Editor — 12 events across 8 alerts confirmed
- [x] Verify `GET /v1/alerts/ALT-2026-04-20-00001/events` returns 2 events (pending > in_progress > sar_filed)
- [x] Verify `GET /v1/alerts/ALT-2026-04-15-00001/events` returns 2 events (tanda closure)

### 2. SAR Narrative Quality Review

- [ ] Read `lib/narratives.ts` against the FinCEN SAR form sections — confirm language and structure hold up under BSA Officer review
- [ ] Identify any sections that are generic or missing required FinCEN fields
- [ ] Update narrative template if gaps found

### 3. Demo Path — Home Page

- [ ] Update Demo Guide on `/` (About page) to reference `ALT-2026-05-11-00001` by ID — BSA Officer following along should not have to hunt for the right alert
- [ ] Confirm 5-minute walkthrough path works end-to-end on deployed stack

### 4. Product Guide — TransactionMonitor

- [ ] Review `docs/marketing/TRANSACTION_MONITOR_GUIDE.md` (written May 15)
- [ ] Capture screenshots at `econofi-bsa-dashboard.netlify.app` for each slug
- [ ] Send to pilot prospect contact as leave-behind before LOI conversation

---

## NEXT — CRA DataGuard + Full API Build

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

**Status: COMPLETE — CEO demo done; post-demo sprint (Items 1–3) is active NOW work**

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
| May 2026 | Post-demo sprint scoped to Items 1–3 before any new module work | CEO demo confirmed BSA/AML as lead product; deepening for pilot takes priority over CRA DataGuard or new module starts |
| May 2026 | Closure reason codes are structured enum, not free text | FinCEN examiners review SAR declination decisions; structured codes make audit trails machine-readable and exam-defensible |
| May 2026 | Batch intake capped at 500 transactions per call | Keeps synchronous SLA manageable; async batch endpoint (POST /v1/transactions/batch with job_id polling) planned for Weeks 3–4 for 50K+ loads |
| May 2026 | Tests written RED before implementation begins (enforced) | All three post-demo test files exist and fail before any implementation file is touched; this is the non-negotiable TDD gate for every coding task in this repo |
| May 2026 | Production intake path is SFTP → S3 (FedRAMP) → PII Sanitizer → API, not direct REST | Banks use core banking export files delivered via SFTP; they do not call REST APIs. AWS Transfer Family lands files in S3. Lambda/ECS PII Sanitizer tokenizes before data reaches Claude or the main DB. |
| May 2026 | De-tokenization vault is a separate service, not in main DB | FinCEN SARs require real PII. Token-to-PII mapping is stored in KMS-encrypted vault (Secrets Manager). De-tokenization is an explicit, audited BSA Officer action — never automatic. |
| May 2026 | Batch upload UI is a developer/demo tool, not the production intake path | In production, bulk transaction intake happens through the SFTP pipeline. The UI batch page serves demos, integration testing, and manual spot-checks only. It is labeled and scoped accordingly. |
| May 2026 | `router.refresh()` added to InvestigationForm after status update | AuditTrail is a server component; `revalidatePath` alone marks cache stale but does not re-render in the current view. `router.refresh()` triggers a live re-fetch so the audit trail updates without a manual page reload. |
| May 2026 | GET /v1/alerts/:id/events response wraps array as `{ alert_id, events }` — UI must extract `.events` | Frontend `getAlertEvents` must read `envelope.data.events`, not `envelope.data` directly. Discovered when audit trail showed empty despite events in DB. |
| May 2026 | Pilot deployment is singleton (one Supabase project per bank); multi-tenant after RLS pen test | BSA data is SAR-adjacent — a bank examiner asking "is our data co-resident with other banks?" needs a clean "no." RLS isolation is technically sound but not the same as physical separation. Singleton at pilot scale costs nothing extra (one additional Supabase project). Multi-tenant is the GA architecture but only after JWT tampering + bank_id spoofing + RLS bypass pen test is complete and signed off. Contract language: dedicated database instance per institution during pilot. |
