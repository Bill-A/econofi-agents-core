# Econofi Agents — NOW / NEXT / LATER

**Project**: Econofi Compliance Agents — MDI/CDFI Bank Compliance Automation
**Repository**: `econofi-agents-core`
**Methodology**: Spec-Driven Development + 3-Day Implementation Sprint
**Overall Status**: Specifications Complete — Implementation Sprint Ready to Begin
**First Deliverable**: BSA/AML TransactionMonitor — regulation-stable, $59B industry spend, every bank, no framework uncertainty

*Last updated: March 21, 2026 — Added product boundary clarification: CRA agent products vs. white-label platform CRA impact reports are distinct products with distinct buyers*

---

## Summary

Six technical specifications are complete; a seventh (RegulatoryWatcher) is in progress. The 3-Day Implementation Sprint can begin immediately. No code has been written yet — this is intentional; specs define the contracts that agents and API developers build toward.

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
| BSA/AML TransactionMonitor | Complete | Not started | Day 1 |
| CRA DataGuard | Complete | Not started | Day 2 |
| CRA NarrativeWriter | Complete | Not started | Week 1-2 |
| LIHTC/NMTC ComplianceMonitor | Complete | Not started | Week 5-6 |
| Fair Lending LoanDataAnalyzer | Complete | Not started | Week 5-6 |
| HTTP API Layer | Complete | Not started | Day 2 (BSA/AML endpoints) |
| RegulatoryWatcher | In Progress | Not started | Weeks 3-4 |

---

## NOW — Pre-Sprint Preparation

**Goal**: Everything in place to begin Day 1 of the 3-Day Implementation Sprint.

### Repository Scaffold

- [ ] Create implementation repo: `econofi-agents-core`
- [ ] Initialize Node.js 20 + TypeScript 5 + Jest
- [ ] Configure ESLint + Prettier (TypeScript strict mode)
- [ ] Set up PostgreSQL 15 local development environment
- [ ] Configure Supabase project (staging) with RLS enabled
- [ ] Add `.env.example` with all required environment variables:
  - `ANTHROPIC_API_KEY`
  - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  - `FFIEC_API_KEY` (CRA census tract validation)
  - `AWS_S3_BUCKET` (document storage)

### Test Data Preparation

- [ ] Generate 100 synthetic BSA/AML transactions (mix: normal, structuring, velocity anomaly, round-dollar, dormant account activation) — sprint Day 1 priority
- [ ] Generate 200 synthetic CRA loan records in HMDA LAR format (mix: valid, fixable, unfixable) — sprint Day 2 priority
- [ ] Generate 5 synthetic LIHTC/NMTC investment records (mix: compliant, 30-day alert, overdue) — post-sprint
- [ ] Store all fixtures in `tests/fixtures/` with clear naming conventions

### Sprint Stakeholder

- [ ] Identify BSA Officer at a target MDI bank for Day 3 demo (target: Liberty Bank, Citizens Trust, or Industrial Bank contact)
- [ ] Schedule 2-hour Day 3 demo session
- [ ] Prepare demo scenario brief: structuring pattern detection + alert dashboard + investigation workflow

### Dependencies to Confirm

- [ ] Anthropic API key provisioned with sufficient quota for `claude-sonnet-4-6` (TransactionMonitor) and `claude-opus-4-6` (NarrativeWriter)
- [ ] FFIEC API access confirmed for census tract validation
- [ ] Supabase project tier sufficient for RLS + real-time

---

## NEXT — 3-Day Implementation Sprint

### Pre-Sprint (1-2 days before sprint)

Completed when: scaffold repo initialized, test fixtures committed, BSA Officer demo confirmed.

---

### Day 1 — BSA/AML TransactionMonitor

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

## Key Decisions Log

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

---

*Last updated: March 21, 2026 — Added product boundary clarification: CRA agent products vs. white-label platform CRA impact reports are distinct products with distinct buyers*
