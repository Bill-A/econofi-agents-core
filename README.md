# Econofi Agents V2: Technical Implementation Specifications

**Version**: 2.0 (Specification-Driven)
**Created**: February 15, 2026
**Last Updated**: March 2026
**Status**: Specifications Complete — Ready for Implementation Sprint
**Methodology**: Design Sprint + Test-First Spec-Driven Development

---

## Overview

This repository contains **implementation-ready technical specifications** for the Econofi Agents compliance automation platform. Unlike V1 (which contained business/product specs), V2 provides complete technical specifications — TypeScript types, PostgreSQL schemas, TDD test cases, API contracts, Claude Agent SDK configs, and Agent Boundaries — ready for direct implementation.

### Design Philosophy

#### Spec-Driven + Sprint-as-Build > Sequential Waterfall

Specifications are complete. The next step is not a long implementation phase — it is a compressed **3-Day Implementation Sprint** that produces a running prototype by day three. This approach, adapted from Google's Design Sprint methodology, integrates validation with implementation so that working code emerges from the sprint, not just refined documents.

The specification work already done (analogous to a Design Sprint's Day 1-2) gives the sprint a major head start: architecture is decided, types are defined, test cases are written, and agent boundaries are established. The sprint collapses the spec-to-prototype gap that typically takes months.

#### 3-Day Implementation Sprint Plan

##### Pre-Sprint (1 day before)

- Stand up Node.js + TypeScript project scaffold
- Configure Claude Agent SDK credentials and Supabase connection
- Load test data: 100 synthetic transactions (mix: normal, structuring, velocity anomaly), 200 anonymized CRA loan records
- Identify one BSA Officer at a target MDI bank for Day 3 validation demo

##### Day 1 — BSA/AML TransactionMonitor Running

- Morning: Implement TransactionMonitor agent against existing spec and test suite (`specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md`)
- Afternoon: Run end-to-end screening on synthetic transaction batch; verify all 8 detection patterns fire correctly and SAR alert generation works
- End of day: Single transaction screened and returned within 200ms; structuring pattern detected with regulatory citation
- Validation gate: All TransactionMonitor unit tests pass; structuring and velocity anomaly patterns detected; normal transaction returns null alert

##### Day 2 — HTTP API Layer (BSA/AML) + CRA DataGuard

- Morning: Expose TransactionMonitor through HTTP API layer (`specs/api/API_LAYER_SPEC.md`); wire `POST /v1/transactions/screen`, `GET /v1/alerts`, `PATCH /v1/alerts/:alert_id`; confirm bank-scoped auth, PII boundary, and immutable audit log
- Afternoon: Implement CRA DataGuard against spec (`specs/cra/DATA_GUARD_SPEC.md`); validate synthetic loan records; confirm CRITICAL exception blocks downstream pipeline
- End of day: BSA/AML endpoints callable via authenticated POST; DataGuard flags invalid census tract as CRITICAL and returns exception report
- Validation gate: `POST /v1/transactions/screen` returns alert within 200ms; `GET /v1/alerts` returns bank-scoped results; DataGuard CRITICAL exception blocks NarrativeWriter

##### Day 3 — BSA Officer Demo + Refinement

- Morning: Demo the end-to-end BSA/AML pipeline to a BSA Officer at a target MDI bank; walk through transaction screening, alert generation, investigation status workflow, and audit trail
- Afternoon: Capture feedback, implement the three highest-priority fixes
- End of day: Refined prototype with documented feedback log and updated implementation roadmap
- Validation gate: BSA Officer identifies at least one manual process the platform eliminates or reduces

#### Benefits of the Sprint Approach

1. **Rapid validation with real implementation**: Working code, not whiteboard diagrams, is the sprint artifact
2. **Technical feasibility confirmed in 72 hours**: Any spec gaps or integration problems surface during the sprint, not six weeks later
3. **Stakeholder alignment before full build**: MDI compliance officer feedback on Day 3 shapes the full implementation — before significant resources are committed
4. **Agent boundaries tested under fire**: Real data reveals whether AGENT BOUNDARIES are calibrated correctly — too restrictive or not restrictive enough
5. **Demo-ready for MDI sales**: A working prototype from Day 3 is a sales tool for the next MDI conversation

#### Design Philosophy Principles

Based on the success of the Budget Wizard implementation (98.6% test coverage via spec-driven development), all specifications include:

1. ✅ **TypeScript type definitions** — Complete interfaces ready to implement
2. ✅ **Database schemas** — PostgreSQL DDL with migrations
3. ✅ **Test cases FIRST** — TDD approach with expected inputs/outputs
4. ✅ **API contracts** — Function signatures, parameters, return types
5. ✅ **Claude Agent SDK patterns** — Integration examples
6. ✅ **Agent Boundaries** — Explicit limits on what each agent does NOT do (legal, regulatory, and safety guardrails)
7. ✅ **Error handling** — Comprehensive failure scenarios
8. ✅ **Performance benchmarks** — SLAs and metrics

---

## Architecture Overview

### Technology Stack

- **Runtime**: Node.js 20+ with TypeScript 5.x
- **AI Framework**: Claude Agent SDK (Anthropic)
- **Database**: PostgreSQL 15+ with Row Level Security (RLS)
- **File Storage**: AWS S3 (FedRAMP High, SSE-KMS, SOC 2, ISO 27001, PCI DSS)
- **Message Queue**: Redis for agent handoffs
- **Infrastructure**: AWS (ECS Fargate, RDS, ElastiCache)

### Multi-Agent Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    AWS S3 (FEDRAMP HIGH AUTHORIZED)               │
│  - Raw banking documents (CSV, Excel, PDF)                       │
│  - PII-containing data (NEVER sent to Claude)                    │
│  - Audit trail (immutable append-only logs)                      │
└────────────────────┬─────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│              ORCHESTRATOR (Data Sanitization Layer)               │
│  - Extract structured data from banking documents                │
│  - Strip ALL PII (SSN → SSN_HASH_xxx, Name → [PERSON_001])      │
│  - Create anonymized tokens with secure mapping                  │
│  - Store PII mapping in separate PostgreSQL vault                │
└────────────────────┬─────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│               HTTP API LAYER  (spec: specs/api/)                  │
│                                                                  │
│  POST /v1/transactions/screen    POST /v1/transactions/batch     │
│  POST /v1/cra/validate           POST /v1/cra/batch              │
│  POST /v1/fair-lending/analyze   GET  /v1/alerts                 │
│                                                                  │
│  Middleware: Auth (JWT/HMAC) → Bank RLS → PII detector →         │
│             Idempotency → Rate limiter → Audit log               │
│                                                                  │
│  Consumers:  Platform UI (internal)  |  ISV / bank developers    │
│              ─────────────────────────────────────────────────   │
│              Same endpoints. Same auth. Same audit trail.        │
└────────┬───────────────────────────────────────┬─────────────────┘
         ↓ (agent service calls)                 ↓ (external API)
┌──────────────────────────┐          ┌──────────────────────────┐
│  CLAUDE API (Bedrock)    │          │  Platform UI / ISV App   │
│  Zero Data Retention     │          │  (thin client on top of  │
│                          │          │   the same HTTP API)     │
│  BSA/AML Module:         │          └──────────────────────────┘
│  - TransactionMonitor    │
│  - OFACScreener          │
│  - SARDrafter            │
│                          │
│  CRA Module:             │
│  - DataGuard             │
│  - LendScope             │
│  - ComplianceGen         │
│                          │
│  Fair Lending Module:    │
│  - LoanDataAnalyzer      │
│  - RedliningDetector     │
│  - PricingAuditor        │
└────────────┬─────────────┘
             ↓
┌──────────────────────────────────────────────────────────────────┐
│              POSTGRESQL DATABASE (RDS with RLS)                   │
│  - Sanitized transaction data                                    │
│  - Analysis results and flagged items                            │
│  - Compliance reports and audit trail                            │
│  - PII mapping vault (separate schema, restricted access)        │
└──────────────────────────────────────────────────────────────────┘
```

### API-First Architecture Principle

Every agent is exposed through the HTTP API layer. The platform UI is a thin client that calls the same endpoints as external consumers — there are no internal shortcuts or direct service-layer calls from the UI. This means:

- The external API product requires zero refactoring: it is the same API, already production-proven by the platform.
- One sales motion lands an ISV partner; the same code serves both the platform and the ISV's embedded integration.
- Bank-scoped RLS applies equally to platform UI calls and external API calls — no separate access control logic.

See [`specs/api/API_LAYER_SPEC.md`](specs/api/API_LAYER_SPEC.md) for the full API specification including TypeScript interfaces, authentication, rate limits, idempotency, audit trail, and test cases.

### Sequential Pipeline Architecture

Two explicit sequential pipelines govern agent execution order. An upstream failure halts the downstream agent rather than passing bad data forward.

**CRA Documentation Pipeline** (process: sequential)

```
DataGuard → NarrativeWriter
```

DataGuard validates loan register data and resolves census tract codes. NarrativeWriter consumes `DataGuardOutput.validated_records`. If `DataGuardOutput.summary.critical_errors > 0`, NarrativeWriter does not run — critical data errors block narrative generation until resolved.

**LIHTC/NMTC to CRA Pipeline** (process: sequential, event-driven)

```
ComplianceMonitor → NarrativeWriter (Investment Test input)
```

ComplianceMonitor maintains the LIHTC/NMTC portfolio status. Qualifying investments with `status !== 'recaptured'` are passed to NarrativeWriter as `community_development_investments` for the CRA Investment Test section. The daily ComplianceMonitor scan runs before any on-demand NarrativeWriter generation to ensure investment status is current.

**BSA/AML and Fair Lending pipelines** run independently — no cross-module sequential dependency.

---

## Module Specifications

### 0. HTTP API Layer

**Purpose**: Clean HTTP API wrapping all compliance agents. The platform UI and external ISV/bank developers use identical endpoints. API-first as architecture, platform-first as go-to-market.

**Specification**: [`specs/api/API_LAYER_SPEC.md`](specs/api/API_LAYER_SPEC.md)

**Key Features**:

- JWT and HMAC-signed API key authentication, bank-scoped by default
- PII detection at the API boundary (defense in depth — backstop behind Orchestrator)
- Idempotency keys on all POST operations (prevents duplicate SAR submissions)
- Async job pattern for batch operations with webhook callbacks
- Immutable `api_audit_log` table (append-only, RLS-enforced)
- Versioned from day one (`/v1/`), 12-month deprecation policy

**Implementation repo**: `econofi-agents-api`

---

### 1. BSA/AML TransactionMonitor

**Purpose**: Real-time suspicious transaction detection (structuring, velocity anomalies, round-dollar patterns)

**Regulatory Basis**: 31 USC §5318(g), §5324 (Bank Secrecy Act)

**Specification**: [`specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md`](specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md)

**Key Features**:

- Structuring detection (deposits <$10K to evade CTR reporting)
- Velocity anomaly detection (dormant accounts suddenly active)
- Round-dollar pattern analysis (exact amounts vs. normal business)
- Geographic risk scoring (high-risk jurisdictions)
- Customer segmentation and peer comparison

**Performance SLA**: <200ms per transaction analysis, 99.9% uptime

---

### 2. CRA DataGuard

**Purpose**: Automated loan register validation and quality assurance

**Regulatory Basis**: 12 CFR §228.42 (Community Reinvestment Act)

**Specification**: [`specs/cra/DATA_GUARD_SPEC.md`](specs/cra/DATA_GUARD_SPEC.md)

**Key Features**:

- Schema validation (required fields per CRA regulation)
- Census tract code verification (FFIEC geocoding API)
- Data quality checks (missing values, invalid ranges)
- Auto-correction with audit trail
- Exception reporting with severity classification

**Performance SLA**: <5 seconds for 10,000 loan records, 100% accuracy

---

### 3. Fair Lending LoanDataAnalyzer

**Purpose**: Disparate impact testing using 80% rule (EEOC framework)

**Regulatory Basis**: 15 USC §1691 (Equal Credit Opportunity Act)

**Specification**: [`specs/fair-lending/LOAN_DATA_ANALYZER_SPEC.md`](specs/fair-lending/LOAN_DATA_ANALYZER_SPEC.md)

**Key Features**:

- 80% rule calculation (protected class approval rate / comparison group)
- Regression analysis controlling for FICO, DTI, LTV
- Matched-pair testing (similar credit profiles, different outcomes)
- Statistical significance testing (chi-square, p-values)
- Examiner Q&A preparation

**Performance SLA**: <10 seconds for 5,000 loan applications, 95% confidence intervals

---

### 4. CRA NarrativeWriter

**Purpose**: Auto-generates CRA performance narratives and assembles examiner-ready public file documentation for MDIs and community banks

**Regulatory Basis**: 12 CFR §228 Subpart B (CRA Performance Evaluation), 12 CFR §228.43 (CRA Public File)

**Specification**: [`specs/cra/CRA_NARRATIVE_AGENT_SPEC.md`](specs/cra/CRA_NARRATIVE_AGENT_SPEC.md)

**Key Features**:

- Generates complete CRA performance narratives covering Lending, Investment, and Service tests
- Maps community development lending, investment, and service activity against CRA assessment areas by census tract
- Produces required CRA public file components per 12 CFR §228.43 (assessment area list, CD loan list, annual activity report)
- Generates anticipated examiner Q&A with data-backed responses
- Supports Large Bank and Intermediate Small Bank evaluation frameworks
- Downstream consumer of DataGuard validated loan records

**Econofi differentiation**: Community development activity from Econofi financial literacy platform qualifies as CRA Community Development Services — documentation is generated directly from platform activity, not imported from a separate system.

**Target buyer**: Chief Compliance Officer, Community Development Officer, CEO at MDIs with $200M-$1B in assets

**Performance SLA**: <30 seconds for complete annual CRA narrative, 100% regulatory citation accuracy

---

### 5. LIHTC/NMTC ComplianceMonitor

**Purpose**: Tracks LIHTC and NMTC investor compliance covenants across the full statutory holding periods — 15 years for LIHTC, 7 years for NMTC

**Regulatory Basis**: IRC §42 (LIHTC), IRC §45D (NMTC), 26 CFR §1.42-5 (LIHTC Monitoring), 26 CFR §1.45D-1 (NMTC)

**Specification**: [`specs/lihtc-nmtc/COMPLIANCE_MONITOR_SPEC.md`](specs/lihtc-nmtc/COMPLIANCE_MONITOR_SPEC.md)

**Key Features**:

- Real-time covenant schedule for all active LIHTC/NMTC investments
- Proactive deadline alerts at 90/60/30/7 days before due date
- Draft compliance certifications (LIHTC annual owner certifications, NMTC substantially-all test)
- Recapture risk scoring with dollar exposure calculation (risk declines over 7-year NMTC period)
- Portfolio dashboard showing aggregate covenant health and recapture exposure
- Daily scheduled scan with webhook notifications to compliance officers
- Integration with CRA NarrativeWriter — qualifying investments feed directly into CRA narrative

**Market context**: LIHTC and NMTC were made permanent July 4, 2025. CRA-motivated institutions provide >80% of LIHTC and NMTC equity investment, creating a growing multi-year compliance obligation for every MDI and CDFI that participates in tax credit deals.

**Target buyer**: Community development officers, compliance officers, and operations teams at CDFIs and MDIs that actively participate in LIHTC and NMTC deals

**Performance SLA**: <2 seconds for single investment status check, <10 seconds for full portfolio scan, 0% deadline miss rate

---

## Development Workflow

### Specification Status

All five agent specifications are complete and implementation-ready:

- ✅ TypeScript type definitions, database schemas, TDD test cases, API contracts, Agent Boundaries
- ✅ Sequential pipeline dependencies documented (DataGuard → NarrativeWriter, ComplianceMonitor → NarrativeWriter)
- ✅ Claude Agent SDK configurations with system prompts, tools, and model selections
- ✅ Agent Boundaries established for all five agents (no autonomous regulatory determinations)

### 8-Week Post-Sprint Implementation Roadmap

The 3-Day Implementation Sprint (see Design Philosophy above) produces the working prototype. This roadmap governs the full build after the sprint concludes.

#### Weeks 1–2: BSA/AML Full Build + CRA Pipeline

- BSA/AML TransactionMonitor: all 8 detection patterns complete; batch endpoint live (50K transactions async)
- CRA DataGuard + NarrativeWriter sequential pipeline end-to-end; CRA framework feature flag implemented (`1995_legacy` | `2023_modern`)
- Bank-scoped RLS enforced across all agents
- Target: all TransactionMonitor and DataGuard unit tests green; alert pipeline runs on real anonymized transaction data

#### Weeks 3–4: HTTP API Layer — Full Build

- Complete remaining 13 post-sprint endpoints (batch transaction screening, CRA batch, Fair Lending analysis, LIHTC/NMTC certifications)
- JWT and HMAC authentication with bank isolation
- Async job pattern for batch operations with webhook callbacks
- Idempotency keys on all POST operations
- OpenAPI 3.1 spec (`openapi/v1.yaml`) and Postman collection generated
- Target: all 18 endpoints documented and passing integration tests

#### Weeks 5–6: Fair Lending + ComplianceMonitor + Security

- Fair Lending LoanDataAnalyzer: disparate impact, regression, matched-pair analysis
- LIHTC/NMTC ComplianceMonitor: daily scheduled scan, 90/60/30/7-day alerts, draft certifications
- SOC 2 Type II controls documented; PII vault separation verified; AGENT BOUNDARIES stress-tested
- Target: security review sign-off; all five agents passing full unit test suites

#### Weeks 7–8: Pilot Preparation + BSA Officer Demo

- Deploy to staging with first MDI pilot bank's transaction data (anonymized)
- Run TransactionMonitor on pilot bank's last 90 days of transactions — present alert report to BSA Officer
- Begin CRA narrative pilot if bank has upcoming exam cycle
- Refine based on BSA Officer feedback from Day 3 sprint demo
- Target: pilot bank BSA Officer signs off on alert report; LOI or pilot agreement initiated

---

## Security & Compliance

### PII Protection Strategy

**CRITICAL REQUIREMENT**: Zero PII sent to Claude API

1. **Pre-Processing (Orchestrator)**:
   ```typescript
   // BEFORE Claude processing
   const raw = "John Smith deposited $9,800 at account 123-456-7890";

   // AFTER sanitization
   const sanitized = "[PERSON_001] deposited $9,800 at account ACCT_HASH_A7F2";
   ```

2. **Secure Mapping Storage**:
   ```sql
   -- Separate PostgreSQL schema with restricted RLS
   CREATE SCHEMA pii_vault;

   CREATE TABLE pii_vault.token_mapping (
     token_id TEXT PRIMARY KEY,
     original_value TEXT ENCRYPTED,
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- RLS: Only orchestrator service role can access
   ALTER TABLE pii_vault.token_mapping ENABLE ROW LEVEL SECURITY;
   ```

3. **AWS S3 FedRAMP High Storage**:
   - Raw documents NEVER leave S3
   - Pre-signed URLs for temporary access
   - Immutable audit logs

### Regulatory Compliance

- **BSA/AML**: 5-year data retention (31 CFR §1020.430)
- **CRA**: 3-year retention (12 CFR §228.42)
- **Fair Lending**: 3-year retention (12 CFR §1002.12)
- **SOC 2 Type II**: Security and availability controls
- **GLBA**: Financial privacy requirements

---

## Performance Requirements

### Latency SLAs

| Agent | Operation | Target Latency | Max Throughput |
|-------|-----------|----------------|----------------|
| TransactionMonitor | Single transaction | <200ms | 500 tx/sec |
| TransactionMonitor | Daily batch (50K tx) | <5 minutes | - |
| DataGuard | 10K loan records | <5 seconds | 2K records/sec |
| LoanDataAnalyzer | 5K applications | <10 seconds | 500 apps/sec |

### Availability SLA

- **Uptime**: 99.9% (43 minutes downtime/month max)
- **Data Durability**: 99.999999999% (11 nines - PostgreSQL RDS)
- **Disaster Recovery**: <4 hour RTO, <1 hour RPO

---

## Cost Projections (Per Bank Customer)

### Infrastructure COGS

| Component | Monthly Cost | Annual Cost |
|-----------|--------------|-------------|
| Claude API (1M tokens/month) | $100 | $1,200 |
| PostgreSQL RDS (db.t3.medium) | $73 | $876 |
| AWS S3 (500 GB) | $75 | $900 |
| Redis ElastiCache (cache.t3.micro) | $13 | $156 |
| ECS Fargate (2 vCPU, 4 GB) | $60 | $720 |
| **Total Infrastructure** | **$321** | **$3,852** |

### Additional Costs

| Component | Annual Cost |
|-----------|-------------|
| Support & Maintenance | $8,000 |
| Security & Compliance Audits | $5,000 |
| **Total COGS** | **$16,852** |

### Pricing vs. COGS

- **Starter**: $50,000/year → 75% gross margin
- **Professional**: $65,000/year → 74% gross margin
- **Enterprise**: $90,000/year → 81% gross margin

---

## Next Steps

1. **Review Specifications**: Validate completeness and accuracy
2. **Initialize Project**: Set up Node.js + TypeScript project
3. **Write Tests First**: Implement test cases from specs
4. **Implement Agents**: Code to pass tests
5. **Deploy Infrastructure**: AWS CDK for production

---

## Contributing

This is a specification repository. Implementation will occur in separate deployment repos:

- `econofi-agents-core` - Shared libraries and types
- `econofi-agents-bsa-aml` - BSA/AML module implementation
- `econofi-agents-cra` - CRA module implementation
- `econofi-agents-fair-lending` - Fair Lending module implementation

---

## License

Proprietary - Econofi Financial Technologies
© 2026 Bill Allen / Agile Innovation LLC

---

Last Updated: March 2026
