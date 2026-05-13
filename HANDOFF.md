# Hand-off: BSA/AML Feature Build — Items 1, 2, 3

**Date:** 2026-05-12  
**Context:** This work was planned in a separate Claude Code session. Implementation should happen here in `econofi-agents-core`, with corresponding frontend changes in `econofi-agents-ui` handled separately.

---

## Background

The CEO demoed the BSA/AML platform and the outcome is to deepen the product for a pilot with a real BSA officer as Product Owner. Three items were prioritized:

1. **"Don't file" workflow** — structured closure reason when a BSA officer decides NOT to file a SAR
2. **Batch transaction intake** — CSV/array upload → TransactionMonitor → alerts created
3. **Exam-ready audit trail** — every status change on an alert logged with timestamp and actor

---

## What Already Exists (Do Not Rebuild)

### Data model — `migrations/001_create_bsa_aml_schema.sql`
The `bsa_aml.alerts` table already has:
- `investigation_status` TEXT with enum: `'pending' | 'in_progress' | 'sar_filed' | 'no_sar_warranted' | 'false_positive'`
- `investigation_notes` TEXT nullable
- `investigation_completed_at` TIMESTAMPTZ nullable (auto-set on closure)

The `no_sar_warranted` and `false_positive` statuses already flow through the full stack (DB → repo → route → UI types). The gaps are:
- No `closure_reason_code` field (structured reason, not just free text)
- No audit event log table

### Routes — `src/routes/bsa-aml/`
- `POST /v1/transactions/screen` — single transaction screener ✓
- `GET /v1/alerts` — list with filters ✓
- `PATCH /v1/alerts/:alert_id` — status update ✓
- `GET /v1/alerts/:alert_id/events` — **MISSING** (item 3)
- `POST /v1/transactions/batch` — **MISSING** (item 2)

### Repository — `src/agents/bsa-aml/alertRepository.ts`
- `saveAlert()`, `listAlerts()`, `updateAlertStatus()`, `findAlertById()` all exist
- `logAlertEvent()`, `getAlertEvents()` — **MISSING** (item 3)

---

## Tests Already Written (RED — all failing)

Three test files have been written. Run them to confirm RED before implementing:

```bash
npx jest tests/bsa-aml/api.test.ts tests/bsa-aml/api-events.test.ts tests/bsa-aml/api-batch.test.ts --no-coverage
```

### `tests/bsa-aml/api.test.ts`
Extended with 6 new tests at the bottom of the `PATCH /v1/alerts/:alert_id` describe block covering `closure_reason_code` validation:
- `no_sar_warranted` without closure_reason_code → 400
- `false_positive` without closure_reason_code → 400
- Invalid closure_reason_code value → 400
- `no_sar_warranted` + valid closure_reason_code → 200, returns `closure_reason_code` in response
- `false_positive` + valid closure_reason_code → 200
- Response includes `closure_reason_code` in data envelope

### `tests/bsa-aml/api-events.test.ts` (new file)
Covers `GET /v1/alerts/:alert_id/events`:
- 401 without auth
- 404 for unknown alert_id
- 200 with empty array for new alert
- Events include: `event_type`, `from_status`, `to_status`, `created_at`
- Multiple events returned in chronological order
- `closure_reason_code` included in event when status closed without SAR
- Standard response envelope with `meta.bank_id`, `meta.api_version`

### `tests/bsa-aml/api-batch.test.ts` (new file)
Covers `POST /v1/transactions/batch`:
- 401 without auth
- 400 for empty array
- 400 for missing `transactions` field
- 422 PII_DETECTED when any transaction contains SSN pattern
- 400 when any transaction has invalid fields
- 200 with `alerts_created: 0` when no suspicious activity
- 200 with alerts in data when suspicious activity detected
- 400 when array exceeds 500 transactions (max batch size)
- Response includes `transactions_submitted`, `alerts_created`, `alerts[]`, `batch_id`
- Standard response envelope
- 2000ms SLA for 10-transaction batch

---

## Implementation Plan

### Step 1: Migration (new file)

Create `migrations/005_bsa_aml_closure_and_events.sql`:

```sql
-- Item 1: closure reason on alerts
ALTER TABLE bsa_aml.alerts
  ADD COLUMN IF NOT EXISTS closure_reason_code TEXT
    CHECK (closure_reason_code IN (
      'tanda_cycle',
      'documented_business_purpose',
      'prior_cdd_review',
      'seasonal_income',
      'institutional_knowledge',
      'insufficient_evidence',
      'system_false_positive',
      'other'
    )),
  ADD COLUMN IF NOT EXISTS closure_reason_detail TEXT;

-- Item 3: audit event log
CREATE TABLE IF NOT EXISTS bsa_aml.alert_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id         TEXT NOT NULL,
  event_type       TEXT NOT NULL DEFAULT 'status_change',
  from_status      TEXT,
  to_status        TEXT NOT NULL,
  notes            TEXT,
  closure_reason_code TEXT,
  actor            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON bsa_aml.alert_events (alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON bsa_aml.alert_events (created_at);
```

Apply to local Supabase:
```bash
npx supabase db push
# or
npx supabase migration up
```

### Step 2: AlertRepository — new methods

In `src/agents/bsa-aml/alertRepository.ts`, add:

**`logAlertEvent()`**
```typescript
async logAlertEvent(params: {
  alert_id: string;
  from_status: string | null;
  to_status: string;
  notes?: string;
  closure_reason_code?: string;
  actor?: string;
}): Promise<void>
```
Inserts a row into `bsa_aml.alert_events`.

**`getAlertEvents(alertId: string)`**
Returns `alert_events` rows for the given `alert_id`, ordered by `created_at ASC`.

Also update **`updateAlertStatus()`** to:
1. Accept `closure_reason_code` and `closure_reason_detail` params
2. Save them to the `alerts` row
3. Call `logAlertEvent()` after the update

### Step 3: Update PATCH route

File: `src/routes/bsa-aml/alerts.ts` (or wherever the PATCH handler lives)

Update the Zod request schema:
```typescript
const CLOSURE_REASON_CODES = [
  'tanda_cycle',
  'documented_business_purpose', 
  'prior_cdd_review',
  'seasonal_income',
  'institutional_knowledge',
  'insufficient_evidence',
  'system_false_positive',
  'other',
] as const;

// In the Zod schema, add cross-field validation:
// - if status is 'no_sar_warranted' or 'false_positive', closure_reason_code is required
// - closure_reason_code must be one of the valid values above
```

Return `closure_reason_code` in the response data envelope.

### Step 4: New GET /v1/alerts/:alert_id/events route

New handler in `src/routes/bsa-aml/alerts.ts`:
1. Auth + bank context (same pattern as existing routes)
2. `findAlertById()` → 404 if not found
3. `getAlertEvents(alertId)` → return events array
4. Wrap in `buildSuccess()` envelope with `{ events, alert_id }`

Register route in the same `bsaAlertRoutes()` function.

### Step 5: New POST /v1/transactions/batch route

New file: `src/routes/bsa-aml/batch.ts`

Schema:
```typescript
z.object({
  transactions: z.array(SanitizedTransactionSchema).min(1).max(500),
  customer_contexts: z.array(CustomerContextSchema).optional(),
})
```

Handler:
1. Auth + PII check on all transactions (reject entire batch if any hit)
2. Validate each transaction with Zod (existing `SanitizedTransactionSchema`)
3. Run all transactions through a single `monitor.analyze()` call (TransactionMonitor accepts arrays)
4. Save any resulting alerts via `repository.saveAlert()`
5. Return: `{ batch_id, transactions_submitted, alerts_created, alerts[] }`

Register in `src/routes/index.ts` (or wherever routes are registered).

---

## Closure Reason Codes — Reference

These are the valid values for `closure_reason_code`. Use exactly these strings in the DB constraint, Zod enum, and TypeScript types:

| Code | Label | When to use |
|---|---|---|
| `tanda_cycle` | Tanda / rotating savings | Community rotating savings (tanda, susú, pardner) |
| `documented_business_purpose` | Documented business activity | Customer has documented legitimate reason on file |
| `prior_cdd_review` | Consistent with CDD profile | Activity matches customer's known profile from prior review |
| `seasonal_income` | Seasonal income / payroll | Seasonal cash patterns (farm labor, holiday retail, etc.) |
| `institutional_knowledge` | BSA officer institutional knowledge | Officer has specific documented knowledge of customer |
| `insufficient_evidence` | Insufficient evidence | Pattern does not meet SAR filing threshold |
| `system_false_positive` | System false positive | Detection algorithm error or known pattern |
| `other` | Other | Requires `closure_reason_detail` text |

---

## Key Files to Read First

Before implementing, read these files in full to understand existing patterns:

1. `src/agents/bsa-aml/alertRepository.ts` — understand `updateAlertStatus()` pattern
2. `src/routes/bsa-aml/` — list files, read the PATCH alerts handler for Zod + buildSuccess pattern
3. `migrations/001_create_bsa_aml_schema.sql` lines 116–144 — current alerts table schema
4. `src/lib/apiResponse.ts` — `buildSuccess()` and `buildError()` signatures
5. `tests/bsa-aml/api.test.ts` — understand mock pattern before writing implementation

---

## Directive: Test-First

**Run the tests first. Confirm RED. Then implement until GREEN.**

Do not implement anything before confirming the tests fail for the right reason (route not found, not a type error).

---

## What Is NOT In Scope Here

Frontend changes (`econofi-agents-ui`) will be handled in a separate session:
- "Close Without Filing" panel on alert detail (parallel to SAR narrative panel)
- Audit trail timeline component on alert detail page
- Batch upload page at `/screen/batch`
- Updated TypeScript types (`closure_reason_code`, event types)

This session: backend only.
