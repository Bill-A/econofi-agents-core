# Econofi Agents — NOW / NEXT / LATER

**Project**: Econofi Compliance Agents — MDI/CDFI Bank Compliance Automation
**Repository**: `econofi-agents-core`
**Methodology**: Spec-Driven Development + 3-Day Implementation Sprint
**Overall Status**: BSA/AML TransactionMonitor — implementation complete, 92/92 tests passing. Day 2 (API layer + CRA DataGuard) ready to begin.
**First Deliverable**: BSA/AML TransactionMonitor — complete. Active pilot outreach: Seaway Self Help Credit Union (meeting May 1, 2026).

*Last updated: April 30, 2026 — Sprint 2 Blocks 1–3 + nav/UI polish complete*

---

## Summary

Six technical specifications are complete; a seventh (RegulatoryWatcher) is in progress. The 3-Day Implementation Sprint can begin immediately. CRA agent scaffolding (DataGuard, NarrativeWriter, shared infrastructure, migrations) is in place; BSA/AML agent implementation begins on Day 1.

**First deliverable rationale**: BSA/AML is the highest-spend compliance burden ($59B/year), every bank has a BSA Officer with a budget, and the regulatory framework is stable. CRA module development continues in parallel but BSA/AML leads the sprint and the sales conversation.

**Critical product boundary — two distinct CRA products:**

| Product | What it does | Buyer | CRA hook |
| --- | --- | --- | --- |
| CRA DataGuard + NarrativeWriter (this repo) | HMDA LAR validation, auto-correction, CRA performance narrative generation | CRA Officer / compliance team | Exam prep narrative and data integrity |
| White-label financial platform (econofi-calculator repo) | Quarterly impact reports: LMI users served, census tract distribution, engagement metrics | MDI Executive | Community Development Test credit documentation |

The MDI executive sales pitch — mission alignment, CRA Community Development Test positioning, quarterly impact reports — is selling the **white-label financial platform**, not the CRA agent products. These are separate conversations with separate buyers. Do not conflate them in sprint planning or sales materials.

**Completion by layer:**

| Layer | Spec Status | Implementation Status | Sprint Priority |
| --- | --- | --- | --- |
| BSA/AML TransactionMonitor | Complete | Not started — Day 1 begins sprint | Day 1 |
| CRA DataGuard | Complete | Scaffolded — agent, routes, tests, migrations committed | Day 2 |
| CRA NarrativeWriter | Complete | Scaffolded — agent, routes, tests committed | Week 1-2 |
| LIHTC/NMTC ComplianceMonitor | Complete | Not started | Week 5-6 |
| Fair Lending LoanDataAnalyzer | Complete | Not started | Week 5-6 |
| HTTP API Layer | Complete | Scaffolded — shared middleware, Supabase client, pino logger committed | Day 2 (BSA/AML endpoints) |
| RegulatoryWatcher | In Progress | Not started | Weeks 3-4 |

---

## NOW — Pre-Sprint Preparation

**Goal**: Everything in place to begin Day 1 of the 3-Day Implementation Sprint.

*Status updated April 22, 2026 — pre-sprint preparation complete. All blocking items resolved. Sprint ready to begin.*

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
- [x] **Install Supabase CLI and confirm `supabase start` runs local stack** — CLI v2.90.0 installed; `supabase init` complete; local stack running
- [ ] **Confirm Supabase staging project has RLS enabled** — deferred; verify before pilot deployment, not required for sprint

### Test Data Preparation

- [x] Generate 100 synthetic BSA/AML transactions (mix: normal, structuring, velocity anomaly, round-dollar, dormant account activation) — committed to `tests/fixtures/synthetic/bsa-aml-transactions.json`
- [ ] Generate 5 synthetic LIHTC/NMTC investment records (mix: compliant, 30-day alert, overdue) — post-sprint
- [x] Store all fixtures in `tests/fixtures/synthetic/` with clear naming conventions — naming convention established

### Sprint Stakeholder

- [x] Day 3 demo participant confirmed — CEO with AI assistant proxying as BSA Officer
- [ ] Prepare demo scenario brief: structuring pattern detection + alert dashboard + investigation workflow

### Dependencies to Confirm

- [x] Anthropic API key set — `ANTHROPIC_API_KEY` populated in `.env`
- [x] FFIEC access confirmed — public API, no key required; `FFIEC_GEOCODE_API_URL` set
- [x] AWS credentials set — `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` populated
- [ ] **Supabase staging project tier confirmed sufficient for RLS + real-time** — deferred; not required for sprint
- [x] **Local database running** — Supabase CLI local stack replaces standalone PostgreSQL; `supabase start` confirmed running

---

### Day 1 — BSA/AML TransactionMonitor (NOW — In Progress)

**Morning: Core Detection Patterns**

- [ ] Copy test cases from `specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md` to `tests/bsa-aml/transactionMonitor.test.ts`
- [ ] Run tests — all fail (RED phase confirmed)
- [ ] Implement `TransactionMonitorAgent` TypeScript class
- [ ] Implement structuring detection (deposits <$10K to evade CTR, 31 USC §5324)
- [ ] Implement velocity anomaly detection (dormant account sudden activation)
- [ ] Implement round-dollar pattern analysis
- [ ] Implement geographic risk scoring (FATF blacklist/greylist countries)
- [ ] Implement customer segmentation and peer comparison

**Afternoon: Remaining Patterns + Alert Generation**

- [ ] Implement CTR threshold approach detection (multiple cash transactions near $10K)
- [ ] Implement multiple account rapid movement detection
- [ ] Implement shell entity indicator detection
- [ ] Implement `SuspiciousActivityAlert` generation with SAR narrative support and regulatory citations
- [ ] Implement PII sanitization (customer tokens passed to Claude — no names or SSNs)
- [ ] Run full test suite against synthetic transaction fixtures

**Day 1 Validation Gate**:
- All TransactionMonitor unit tests pass (GREEN)
- Structuring pattern detected on synthetic transaction sequence with 31 USC §5324 citation
- Normal transaction returns `alert: null`
- Single transaction screened within 200ms SLA

---

## NEXT — Remaining Sprint + Post-Sprint

### Pre-Sprint

Completed — scaffold initialized, BSA/AML fixtures committed, 77 tests green, demo participant confirmed.

---

### Day 2 — HTTP API Layer (BSA/AML) + CRA DataGuard

**Morning: HTTP API Layer — BSA/AML Endpoints**

Wire the Sprint Required BSA/AML endpoints using Fastify:

- [ ] `POST /v1/transactions/screen` — calls TransactionMonitor, synchronous, <200ms SLA
- [ ] `GET /v1/alerts` — paginated alert list, bank-scoped via RLS
- [ ] `PATCH /v1/alerts/:alert_id` — investigation status update, immutable audit trail

Shared infrastructure (build once, used by all modules):

- [ ] JWT authentication middleware (`authenticateRequest` + `extractBankId`)
- [ ] PostgreSQL RLS context setter (`SET app.current_bank_id`)
- [ ] Audit log writer (`api_audit_log` append-only table — no UPDATE or DELETE)
- [ ] PII detector at API boundary (reject 422 `PII_DETECTED` on SSN/account pattern match)
- [ ] `ApiResponse<T>` envelope wrapper with `meta.request_id`, `meta.bank_id`, `meta.api_version`

**Day 2 Morning Validation Gate**:
- `POST /v1/transactions/screen` returns structuring alert within 200ms
- `GET /v1/alerts` returns bank-scoped results only (RLS confirmed via cross-tenant test)
- `PATCH /v1/alerts/:alert_id` writes immutable audit log row
- PII in request body returns 422 `PII_DETECTED`

**Afternoon: CRA DataGuard**

- [ ] Generate 200 synthetic CRA loan records in HMDA LAR format (mix: valid, fixable, unfixable) — commit to `tests/fixtures/synthetic/cra-loan-records.json` before DataGuard TDD begins
- [ ] Copy test cases from `specs/cra/DATA_GUARD_SPEC.md` to `tests/cra/dataGuard.test.ts`
- [ ] Run tests — all fail (RED phase confirmed)
- [ ] Implement `DataGuardAgent` TypeScript class
- [ ] Implement schema validation against 12 CFR §228.42 (census tract, income category, loan type)
- [ ] Implement FFIEC API integration for census tract verification
- [ ] Implement auto-correction with confidence scoring (threshold: 0.80)
- [ ] Implement exception report generation (CRITICAL / HIGH / MEDIUM / LOW)
- [ ] Add CRA framework feature flag: `CRA_FRAMEWORK: '1995_legacy' | '2023_modern'` — controls evaluation criteria path; stored in regulatory threshold config table, not hardcoded
- [ ] Wire `POST /v1/cra/validate` endpoint

**Day 2 Afternoon Validation Gate**:
- All DataGuard unit tests pass (GREEN)
- Invalid census tract returns CRITICAL exception with 12 CFR §228.42 citation
- `POST /v1/cra/validate` returns exception report via authenticated API

---

### Day 3 — BSA Officer Demo + Refinement

**Morning: Demo Session**

Scenario flow (2 hours with BSA Officer at target MDI bank):

1. Submit batch of synthetic transactions -> `POST /v1/transactions/screen`
2. Review alert dashboard -> `GET /v1/alerts` -> see structuring and velocity anomaly alerts
3. Update investigation status -> `PATCH /v1/alerts/:alert_id` -> confirm audit trail entry
4. Walk through SAR narrative support output and regulatory citations (31 USC §5324, 31 CFR §1020.320)
5. Discuss how the platform replaces current manual review process

**Afternoon: Refinement**

- [ ] Capture top 3 priority fixes from BSA Officer feedback
- [ ] Implement fixes
- [ ] Re-run full test suite — confirm GREEN

**Day 3 Validation Gate**:
- BSA Officer identifies at least one manual process the platform eliminates
- Sprint retrospective notes captured in `docs/SPRINT_RETROSPECTIVE.md`

---

## LATER — 8-Week Post-Sprint Roadmap

### Weeks 1–2: CRA NarrativeWriter + BSA/AML Full Build

- [ ] NarrativeWriter agent: implement narrative section generation for Lending Test, Investment Test, Service Test; CRA public file assembly per 12 CFR §228.43; `draft_status` on all outputs
- [ ] NarrativeWriter pipeline halt: refuse to run when DataGuard `critical_errors > 0`
- [ ] BSA/AML batch endpoint: `POST /v1/transactions/batch` (async, up to 50K transactions) + `GET /v1/transactions/batch/:job_id`
- [ ] CRA batch endpoint: `POST /v1/cra/batch` (async, up to 10K records) + `GET /v1/cra/reports/:job_id`
- [ ] Integration tests: DataGuard -> NarrativeWriter pipeline with real Supabase (staging)

**Milestone**: NarrativeWriter generates a complete DRAFT CRA narrative from 200 synthetic loan records. BSA/AML batch processes 50K transactions in under 5 minutes.

---

### Weeks 3–4: HTTP API Layer — Full Build

Complete remaining 12 post-sprint endpoints:

**BSA/AML**
- [ ] `POST /v1/transactions/batch` (async, up to 50K transactions)
- [ ] `GET /v1/transactions/batch/:job_id` (poll)

**CRA**
- [ ] `POST /v1/cra/batch` (async, up to 10K records)
- [ ] `GET /v1/cra/reports/:job_id`
- [ ] `GET /v1/cra/narrative/:job_id`
- [ ] `POST /v1/cra/narrative` (triggers NarrativeWriter; enforces UPSTREAM_CRITICAL_ERRORS halt)
- [ ] `POST /v1/cra/narrative/:job_id/acknowledge` (immutable acknowledgment log)

**Fair Lending**
- [ ] `POST /v1/fair-lending/analyze` (async regression analysis)
- [ ] `GET /v1/fair-lending/reports/:job_id`
- [ ] `GET /v1/fair-lending/examiner-prep/:job_id`

**LIHTC/NMTC**
- [ ] `POST /v1/lihtc-nmtc/scan`
- [ ] `GET /v1/lihtc-nmtc/portfolio`
- [ ] `POST /v1/lihtc-nmtc/investments/:id/certifications`
- [ ] `POST /v1/lihtc-nmtc/certifications/:id/acknowledge`

**Shared**
- [ ] Idempotency middleware (`X-Idempotency-Key`, 24-hour cache)
- [ ] Rate limiting (per tier: Sandbox/Starter/Professional/Enterprise)
- [ ] Webhook delivery (HMAC-SHA256 signed, retry with backoff)
- [ ] API key + HMAC-SHA256 authentication for ISV partners
- [ ] Generate `openapi/v1.yaml` (OpenAPI 3.1 — machine-readable contract)
- [ ] Postman collection for all endpoints

**RegulatoryWatcher Agent**
- [ ] Finalize `specs/regulatory-watcher/REGULATORY_WATCHER_SPEC.md`
- [ ] Implement `RegulatoryWatcherAgent` — scheduled poller for FinCEN, CFPB, OCC, FATF, FFIEC
- [ ] Map detected changes to config table rows and affected modules
- [ ] Emit `regulatory.update_detected` webhook with plain-English impact summary
- [ ] Wire `GET /v1/regulatory/updates` + `POST /v1/regulatory/updates/:id/acknowledge`
- [ ] Schedule: daily Federal Register RSS + weekly FATF grey/black list diff
- [ ] Integration test: simulated FinCEN SAR threshold change updates `SAR_MINIMUM_AMOUNT` config row and emits webhook

**Milestone**: Full Postman collection passes against staging. OpenAPI spec committed. RegulatoryWatcher detects a simulated threshold change and emits a correctly formed webhook.

---

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

---

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

A client demo is not on the critical path. The sprint produces working code; the test fixtures committed during Day 1 pre-sprint preparation serve as demo data if a client meeting materializes.

If a confirmed meeting with a BSA Officer or CRA Officer arises before the sprint is complete, a scripted demo can be assembled without rebuilding anything:

- **Input data**: The synthetic transaction and LAR fixtures already committed to `tests/fixtures/`
- **Output data**: SAR narratives, exception reports, and CRA narrative drafts generated by prompting Claude directly (not the agent pipeline) and pre-loaded into Supabase
- **UI**: A Next.js shell (8 screens: 4 BSA/AML, 4 CRA) reading from pre-loaded Supabase data
- **Effort**: 3.5-5.5 days if triggered — do not build speculatively

Trigger condition: a confirmed meeting with a named compliance officer at a target institution. Aspirational targets do not trigger demo build.

---

## Spec Files Reference

| Module | Spec File | Status | Build Priority |
| --- | --- | --- | --- |
| BSA/AML TransactionMonitor | `specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md` | Complete | Sprint Day 1 |
| CRA DataGuard | `specs/cra/DATA_GUARD_SPEC.md` | Complete | Sprint Day 2 |
| HTTP API Layer | `specs/api/API_LAYER_SPEC.md` | Complete | Sprint Day 2 |
| CRA NarrativeWriter | `specs/cra/CRA_NARRATIVE_AGENT_SPEC.md` | Complete | Week 1-2 |
| Fair Lending LoanDataAnalyzer | `specs/fair-lending/LOAN_DATA_ANALYZER_SPEC.md` | Complete | Week 5-6 |
| LIHTC/NMTC ComplianceMonitor | `specs/lihtc-nmtc/COMPLIANCE_MONITOR_SPEC.md` | Complete | Week 5-6 |
| RegulatoryWatcher | `specs/regulatory-watcher/REGULATORY_WATCHER_SPEC.md` | In Progress | Weeks 3-4 |

---

---

## Marketing Initiatives — Rolling Wave Plan

**IMPORTANT — for Claude Code sessions picking up this document:**
This section is a separate work stream from the product engineering sprints above.
It runs on its own independent cadence.

- The product engineering side uses **Day 1 / Day 2 / Week 1–2** etc. as
  calendar-anchored time units tied to the 3-Day Implementation Sprint.
- The marketing side uses **Sprint 1 / Sprint 2** etc. as scope buckets only —
  they have no implied calendar alignment to the product engineering timeline.
- "SAR Library Sprint 1" does NOT mean the same calendar period as "Product Day 1"
  or "Product Week 1." They are sequenced and prioritized independently.
- These sprints are executed in separate Claude Code sessions focused exclusively
  on the SAR library build. Do not conflate with the compliance agent implementation.

Full spec: `docs/marketing/sar-narrative-library/SAR_NARRATIVE_LIBRARY_SPEC.md`

**Rationale**: The SAR Narrative Library builds examiner-credibility and BSA Officer
brand recognition before a product sale — the exact visibility gap that delays pilots.
It is the highest-ROI marketing investment at this stage: free to host, demonstrates
the NarrativeWriter output, generates a warm lead list of BSA Officers.

### Sprint 1 — Infrastructure + 4 Templates (NOW)

**Goal**: Live, usable library. One template per primary pattern category.
**Stack**: Astro + Netlify + HubSpot tracking + HubSpot form embed
**URL**: `sar.econofi.app` (Cloudflare CNAME → Netlify, orange cloud)
**Code**: `econofi-sar-library/` — see `DEPLOY.md` for deployment steps

**Code complete (Claude Code session):**
- [x] Astro project scaffold — base layout, HubSpot tracking placeholder, mobile-responsive
- [x] Library index page — 4 category cards, available/coming-soon per template
- [x] Template STR-002: Smurfing — 31 USC §5324, MDI Context callout
- [x] Template VEL-001: Dormant Account — velocity anomaly, MDI Context callout
- [x] Template GEO-001: FATF Blacklist — geographic risk, FATF source citation
- [x] Template RDW-001: Wire Concentration — round-dollar pattern
- [x] Copy-to-clipboard on every template page
- [x] Legal disclaimer on every template page
- [x] HubSpot form embed code in TemplateLayout (commented — activate after HubSpot setup)

**Deployment (manual steps — follow `econofi-sar-library/DEPLOY.md`):**
- [ ] Push to GitHub — create repo, `git push`
- [ ] Connect to Netlify — build: `npm run build`, publish: `dist`
- [ ] Cloudflare DNS — CNAME `sar` → Netlify site URL, orange cloud
- [ ] Add custom domain `sar.econofi.app` in Netlify — SSL auto-provisions
- [ ] Replace `YOUR_HUB_ID` in BaseLayout.astro with numeric HubSpot Hub ID
- [ ] Create Word download form in HubSpot — activate embed in TemplateLayout.astro
- [ ] Verify HubSpot tracking — page visits appear in Traffic Analytics within 24 hours

**Validation gate**: A BSA Officer can land on the library, find a template,
read the MDI Context callout, and copy or download the narrative in under
2 minutes. HubSpot contact record is created on Word download.

---

### Sprint 2 — Full MVP Template Set + Search + Workflows (NOW — In Progress)

**Goal**: Complete the 12-template MVP set. Add Fuse.js search.
Activate HubSpot lead nurture workflows.

**Block 1 complete (2026-04-30):**
- [x] 8 new SAR narrative templates — STR-003, STR-004, VEL-002, VEL-004, GEO-002, RDW-002, MUL-001, MUL-002
- [x] Multiple Indicators category added to library index and nav
- [x] All category index pages updated — available counts reflect new templates
- [x] 18-page build passes; deployed to sar.econofi.app

**Block 2 complete (2026-04-30):**
- [x] Word `.docx` files per template — 12 files, ~12KB each, amber-highlighted placeholders, MDI Context callout
- [x] `scripts/generate-docx.mjs` — `npm run generate-docx` rebuilds all files
- [x] Download delivery: localStorage + `/download-ready/` page + HubSpot form redirect
- [x] HubSpot form "On-submit action" set to Redirect → `https://sar.econofi.app/download-ready/`
- [x] Validated end-to-end: form submit → redirect → "Your document is ready" → .docx downloads

**Block 3 complete (2026-04-30):**
- [x] Fuse.js client-side search — 12-template index, searches by pattern code (weight 3), title (weight 2), keywords (weight 1), category (weight 0.5)
- [x] Search input on library index — category grid hides while active, restores on clear
- [x] Search border fix — `gray-200` was invisible against white background; changed to `gray-400`

**Block 3 UI polish complete (2026-04-30):**
- [x] Nav: "SAR Library" tab → `/` added to all pages
- [x] Nav: Open Sans 16px, link color `#eff2fb`, hover `#42e8e0` — matches econofi.app nav
- [x] Nav: active-item state — `#00a4b4` text + 2px underline + bold; server-side path detection

**Remaining blocks:**
- [ ] Update subscription form — email-only form → pattern-specific HubSpot list
- [ ] HubSpot Workflow 1 — first download → 3-day delay → educational email on that pattern
- [ ] HubSpot Workflow 2 — 3 downloads → warm lead flag → sales notification
- [ ] Custom contact properties — `sar_library_download_count`, `first_pattern_downloaded`, `patterns_downloaded`
- [ ] Sitemap submission to Google Search Console

**Validation gate**: 3+ downloads trigger Workflow 2. Fuse.js returns relevant
results for "structuring" and "dormant account" queries.

---

### Sprint 3 — Credit Union Variants + Update Alerts (NEXT)

**Goal**: Credit union-specific content. FATF Watch email operational.

- [ ] Institution type toggle (bank / credit union) on each template — CU-specific MDI Context callout
- [ ] NCUA BSA citations alongside FinCEN citations for credit union audiences
- [ ] HubSpot Workflow 3 — template update alert email to pattern subscribers
- [ ] HubSpot Workflow 4 — FATF Watch email to all `sar_library_visitor` contacts
- [ ] Internal FATF update process documented — FATF meeting → update templates → trigger Workflow 3

**Validation gate**: A credit union BSA Officer (e.g. Seaway follow-up contact)
receives the correct CU-variant template with NCUA citations. First FATF Watch
email deployed to subscriber list.

---

### Sprint 4 — Authority + Distribution (LATER)

**Goal**: Industry recognition. Organic search traction. Benchmark survey launch.

- [ ] MDI Compliance Burden survey — 10 questions, distributed to SAR library subscriber list
- [ ] NBA / NAOBA outreach — submit library as free resource to National Bankers Association newsletter
- [ ] SEO audit — review keyword rankings for target clusters, update meta and content
- [ ] Benchmark report — publish aggregated survey results as free PDF
- [ ] Cross-link: TransactionMonitor product page → SAR library and back

**Validation gate**: SAR library appears in Google Search Console for at least
3 target keyword clusters. Benchmark survey has 25+ responses.

---

| Date | Decision | Rationale |
| --- | --- | --- |
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
| April 2026 | BSA/AML-first delivery order confirmed despite Sales Playbook (Apr 13, 2026) recommending CRA-first | Sales Playbook CRA-first argument depends on exam timing urgency (12-18 months from CRA exam). No target MDI in that window is currently identified. BSA/AML obligation is perpetual and universal — no exam window required to create urgency. Order revisited when a qualified CRA exam-timed target is in the pipeline. |
| April 2026 | Supabase CLI replaces standalone PostgreSQL for local dev | Supabase local stack provides PostgreSQL + RLS + Auth + Realtime locally; standalone PostgreSQL does not exercise RLS, making tests non-representative of production behavior |
| April 2026 | SAR Narrative Library as primary marketing investment | Free to host; demonstrates NarrativeWriter output without a demo; generates warm BSA Officer lead list; no competitor provides MDI-specific SAR narrative context. Full spec: `docs/marketing/sar-narrative-library/SAR_NARRATIVE_LIBRARY_SPEC.md` |
| April 2026 | SAR library hosted at `sar.econofi.app` (subdomain, not subdirectory) | `www.econofi.app` resolves grey-cloud to HubSpot CDN — Cloudflare Worker cannot intercept. Subdomain via Cloudflare CNAME (orange cloud) → Netlify is zero-risk and deploys in under 10 minutes |
| April 2026 | Rolling wave planning — Sprint 1 fully specified, Sprint 2–3 outlined, Sprint 4 themes | SAR library is unvalidated; BSA Officer behavior after Sprint 1 informs Sprint 2 scope. Full backlog upfront is waste. |
| April 2026 | Master sales deck (16 slides) with audience routing — bank vs. credit union | CRA slides not applicable to credit unions; hiding slides per audience is lower maintenance than separate decks. Spec: `docs/marketing/SALES_DECK_REVISION.md` |
| April 2026 | Seaway Self Help Credit Union identified as pilot credit union prospect (meeting May 1) | Division of Self-Help Federal CU ($2.3B assets, CDFI-certified); price on Seaway division assets (~$200M–$400M), not parent consolidated assets. Account brief: `docs/business/prospects/SEAWAY_SELF_HELP_CREDIT_UNION.md` |

---

*Last updated: April 30, 2026*
