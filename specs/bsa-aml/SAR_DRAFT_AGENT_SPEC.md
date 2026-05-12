# BSA/AML SARDraftAgent: Technical Implementation Specification

**Module**: BSA/AML Compliance
**Agent**: SARDraftAgent
**Version**: 0.1 (stub — build trigger: post-May 11 demo validation)
**Regulatory Basis**: 31 CFR §1020.320 (Suspicious Activity Reports), FinCEN SAR form instructions (FinCEN Form 111)

---

## Executive Summary

The SARDraftAgent produces FinCEN SAR-formatted narrative drafts for alerts escalated by the TransactionMonitor. A BSA Officer iterates conversationally — asking the agent to strengthen sections, add transactions, or clarify the regulatory basis — until the draft meets filing quality. All output carries `draft_status = true`. The agent never files autonomously. Filing requires explicit BSA Officer acknowledgment.

### Problem Being Solved

Manual SAR narrative writing takes 3–5 hours per filing for BSA Officers at community banks. The bottleneck is translating raw alert data and transaction history into the precise, citation-supported narrative language required by FinCEN. SARDraftAgent automates the first draft, reducing that to a review-and-iterate workflow.

### Key Capabilities

1. **SAR Narrative Generation**: Produces Part V narrative text structured per FinCEN SAR form instructions
2. **Conversational Iteration**: BSA Officer refines the draft via natural language ("Strengthen the structuring section", "Add the March 12 deposit")
3. **Regulatory Citation**: Cites applicable statutes (31 USC §5324, §5318(g), 31 CFR §1020.320) inline
4. **Transaction Grounding**: References specific transactions from `bsa_aml.transactions` by date, amount, and pattern type — never by account number or name
5. **Draft Lifecycle Management**: Creates, versions, and archives drafts; tracks BSA Officer edits

---

## AGENT BOUNDARIES

**The SARDraftAgent MUST NOT:**

- File or submit a SAR to FinCEN, BSA E-Filing, or any regulatory system
- Transmit draft content to any external system without explicit BSA Officer acknowledgment
- Make a legal determination that a SAR must be filed (it surfaces patterns; the BSA Officer decides)
- Retain or log any PII — all inputs must be pre-sanitized by the orchestrator
- Auto-approve or auto-acknowledge any draft
- Access the acknowledgment endpoint (`POST /v1/bsa-aml/sar/:draft_id/acknowledge`) on behalf of the user

These are hard constraints, not configuration options. They exist because 31 CFR §1020.320 places the filing obligation on the financial institution's responsible officer, not on automated software.

---

## Model Assignment

| Field | Value |
|---|---|
| Model | `claude-opus-4-6` |
| Temperature | 0.3 |
| Rationale | Narrative quality requires highest capability; low temperature maintains regulatory language consistency across iterations |

Same model tier as NarrativeWriter — SAR narratives are regulatory documents reviewed by FinCEN examiners.

---

## Data Dependencies

### Prerequisites (must be satisfied before build begins)

| Dependency | Source | Status | Notes |
|---|---|---|---|
| Alert record | `bsa_aml.alerts` | Available | Alert ID, severity, pattern type, risk score |
| Transaction history | `bsa_aml.transactions` | Blocked | Requires SFTP ingestion backfill (Weeks 3–4) |
| Customer history | `bsa_aml.customer_history` | Blocked | 90-day baseline empty at onboarding |
| Pattern analysis | `bsa_aml.pattern_analyses` | Available | TransactionMonitor output |

The SFTP backfill spec (`SFTP_INGESTION_SPEC.md` — not yet written) is a hard prerequisite. Without historical transactions, the agent cannot ground its narrative in specific transaction evidence, reducing draft quality below filing standard.

### Inputs (all pre-sanitized — no PII)

```typescript
interface SARDraftInput {
  alert_id: string;               // bsa_aml.alerts primary key
  bank_id: string;                // UUID, from JWT
  customer_token: string;         // [PERSON_001] — never a name or SSN
  account_hash: string;           // SHA-256 of account number
  transaction_window_days: number; // How far back to pull (default: 90)
  iteration_context?: string;     // BSA Officer instruction for this iteration
  prior_draft_id?: string;        // If iterating on an existing draft
}
```

### Outputs

```typescript
interface SARDraftOutput {
  draft_id: string;               // UUID, primary key in bsa_aml.sar_drafts
  alert_id: string;
  bank_id: string;
  draft_status: true;             // Hardcoded — never false
  narrative_text: string;         // FinCEN SAR Part V narrative
  regulatory_citations: string[]; // ['31 USC §5324', '31 CFR §1020.320']
  transaction_refs: string[];     // Dates and amounts cited in narrative
  created_at: string;             // ISO 8601
  version: number;                // Increments on each iteration
  acknowledged_at: null;          // Always null until BSA Officer acknowledges
  acknowledged_by: null;          // Always null until acknowledged
}
```

---

## API Contract (placeholder)

```
POST /v1/bsa-aml/sar/draft
  Body: SARDraftInput
  Returns: ApiResponse<SARDraftOutput>

GET /v1/bsa-aml/sar/:draft_id
  Returns: ApiResponse<SARDraftOutput>

POST /v1/bsa-aml/sar/:draft_id/iterate
  Body: { instruction: string }
  Returns: ApiResponse<SARDraftOutput>  (new version, prior version archived)

POST /v1/bsa-aml/sar/:draft_id/acknowledge
  Body: { officer_id: string; officer_signature: string }
  Returns: ApiResponse<{ acknowledged_at: string; acknowledged_by: string }>
  Note: This endpoint transitions the draft out of draft_status — BSA Officer action only
```

All responses use the standard `ApiResponse<T>` envelope with `meta.request_id`, `meta.bank_id`, `meta.api_version`.

---

## Database Schema (placeholder)

```sql
-- migrations/NNN_sar_drafts.sql
CREATE TABLE bsa_aml.sar_drafts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id            UUID NOT NULL REFERENCES bsa_aml.alerts(id),
  bank_id             UUID NOT NULL,
  draft_status        BOOLEAN NOT NULL DEFAULT TRUE,
  narrative_text      TEXT NOT NULL,
  regulatory_citations TEXT[] NOT NULL DEFAULT '{}',
  transaction_refs    TEXT[] NOT NULL DEFAULT '{}',
  version             INTEGER NOT NULL DEFAULT 1,
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bsa_aml.sar_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY sar_drafts_bank_isolation ON bsa_aml.sar_drafts
  USING (bank_id = current_setting('app.current_bank_id')::UUID);
```

---

## System Prompt (placeholder)

The system prompt will follow the same structure as TransactionMonitor — see `TRANSACTION_MONITOR_SPEC.md` for the pattern. Key elements:

- Role: BSA compliance analyst specializing in SAR narrative writing
- Constraints: Draft only, no filing authority, cite specific statutes, use tokenized identifiers
- Output format: FinCEN SAR Part V narrative structure
- Iteration protocol: When `iteration_context` is present, revise the prior narrative per instruction; do not discard unchanged sections

---

## Test Specifications (placeholder)

Tests live in `tests/bsa-aml/SARDraftAgent.test.ts`.

| Test Case | Input | Expected Output |
|---|---|---|
| Structuring narrative | Alert ALT-2026-05-04-00001, 90-day window | Narrative cites 31 USC §5324, references 3 deposits, draft_status = true |
| Velocity narrative | Alert ALT-2026-05-05-00001, 90-day window | Narrative cites 31 USC §5318(g), references 11 wires, draft_status = true |
| Iteration: strengthen section | Prior draft + "Strengthen the structuring section" | New version, unchanged sections preserved, version incremented |
| Acknowledgment gate | Attempt to access acknowledge endpoint without officer_id | 422 MISSING_OFFICER_CONTEXT |
| PII in input | Request body containing SSN pattern | 422 PII_DETECTED, nothing passed to Claude |
| No historical data | alert_id valid, customer_history empty | Draft generated with disclaimer noting limited transaction history |

---

## Build Priority and Trigger

**Do not begin building until:**

1. May 11 demo with Demetra confirms SARDraft is the priority workflow
2. SFTP ingestion backfill spec is written and sprint is scheduled
3. `bsa_aml.transactions` contains at minimum 90 days of historical data for test customers

**Provisional build slot**: Weeks 3–4 (after SFTP ingestion), parallel with or immediately after `SFTP_INGESTION_SPEC.md` delivery.

---

## Open Questions

- **Chat interface scope**: Does the BSA Officer interact via a conversational UI (chat panel) or via structured form fields? Chat panel matches the "talk to an analyst" intent from the May 6 research session; form fields are safer for regulatory defensibility. Decide before sprint planning.
- **Version archiving**: Should prior draft versions be surfaced in the UI, or only the current version? Audit trail requirement suggests all versions must be retained; display scope is a product decision.
- **Acknowledgment ceremony**: What constitutes a sufficient acknowledgment? Digital signature, checkbox + typed name, or MFA-backed approval? Community bank examiner expectations vary.
- **CTR narrative support**: The same agent could draft Currency Transaction Reports. Out of scope for now but the architecture should not preclude it.
