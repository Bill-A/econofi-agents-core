# RegulatoryWatcher Agent — Technical Specification

**Module**: RegulatoryWatcher
**Version**: 0.1 (Stub — In Progress)
**Status**: Spec in progress — not yet complete
**Applies To**: All compliance modules (BSA/AML, CRA, Fair Lending, LIHTC/NMTC)
**Build Priority**: Weeks 3-4 (after HTTP API full build)

*Last updated: March 13, 2026*

---

## Purpose

The RegulatoryWatcher agent monitors authoritative regulatory sources for changes that affect compliance thresholds, rule frameworks, and geographic risk lists stored in the system's config table. When a relevant change is detected, it maps the change to the affected config table rows and affected modules, emits a `regulatory.update_detected` webhook, and generates a plain-English impact summary for the bank's compliance team.

This agent closes the loop between the architectural decision to store regulatory thresholds in a config table (not hardcode them) and the operational need to know *when* those rows must be updated.

---

## AGENT BOUNDARIES

**This agent DOES**:
- Monitor public regulatory feeds (RSS, REST APIs, HTML diffs) for rule changes
- Map detected changes to specific config table rows and compliance modules
- Emit `regulatory.update_detected` webhooks with structured impact summaries
- Surface changes for human review — all detected changes require compliance officer acknowledgment before config rows are updated
- Maintain an audit log of every detected change, its source URL, and its review status

**This agent DOES NOT**:
- Automatically update config table rows — a human compliance officer must acknowledge before any threshold changes
- Provide legal interpretation of regulatory changes
- Monitor non-public or subscription-only regulatory databases
- Replace legal counsel or regulatory affairs staff
- Take any action on behalf of the bank without explicit human acknowledgment

---

## Regulatory Sources

| Source | Feed Type | Polling Frequency | Affects |
| --- | --- | --- | --- |
| FinCEN (federalregister.gov, agency=FINCEN) | Federal Register RSS | Daily | BSA/AML thresholds (CTR, SAR, structuring limits) |
| CFPB (federalregister.gov, agency=CFPB) | Federal Register RSS | Daily | CRA (2023 rule), Section 1071, Fair Lending (ECOA, HMDA) |
| OCC (federalregister.gov, agency=OCC) | Federal Register RSS | Daily | National bank CRA exam rules |
| FATF | fatf-gafi.org/countries HTML diff | Weekly | Geographic risk lists (FATF blacklist/greylist) — affects BSA/AML geographic risk scoring |
| FFIEC | ffiec.gov census tract updates | Quarterly | CRA census tract validation data — affects DataGuard FFIEC API baseline |
| Federal Reserve | federalreserve.gov/supervisionreg RSS | Weekly | State member bank CRA rules |

---

## Config Table Integration

The RegulatoryWatcher maps detected rule changes to rows in the `regulatory_threshold_config` table. Each row carries:

```typescript
interface RegulatoryThresholdConfig {
  id: string;
  module: 'bsa-aml' | 'cra' | 'fair-lending' | 'lihtc-nmtc';
  threshold_key: string;          // e.g. 'CTR_THRESHOLD', 'SAR_MINIMUM_AMOUNT'
  current_value: string;          // stored as string to support numeric, boolean, list values
  regulatory_source: string;      // e.g. '31 USC §5313', '12 CFR §1003.4'
  effective_date: string;         // ISO 8601
  last_reviewed_at: string;       // ISO 8601
  last_reviewed_by: string;       // user_id of compliance officer who last acknowledged
  pending_change?: PendingChange; // populated by RegulatoryWatcher on detection
}

interface PendingChange {
  detected_at: string;
  source_url: string;
  proposed_value: string;
  impact_summary: string;         // plain-English summary for compliance officer
  federal_register_citation?: string;
  effective_date?: string;
  watcher_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  acknowledged_at?: string;
  acknowledged_by?: string;
}
```

---

## Detection Workflow

```
1. Scheduled poll fires (cron — daily for Federal Register, weekly for FATF)
2. RegulatoryWatcherAgent fetches feed / HTML
3. Diff against last-known state (stored in watcher_state table)
4. For each change detected:
   a. Classify: which module(s) and threshold_key(s) are affected?
   b. Generate impact_summary using claude-sonnet-4-6 (temp 0.1)
   c. Assign watcher_confidence (HIGH if direct numeric threshold change, MEDIUM if framework change, LOW if interpretive)
   d. Write PendingChange to regulatory_threshold_config row
   e. Emit regulatory.update_detected webhook
5. Compliance officer reviews webhook, acknowledges in dashboard
6. On acknowledgment: update current_value, clear pending_change, write audit log row
```

---

## Webhook Payload

```typescript
interface RegulatoryUpdateWebhook {
  event: 'regulatory.update_detected';
  detected_at: string;
  source: {
    name: string;           // e.g. 'FinCEN via Federal Register'
    url: string;
    feed_type: 'rss' | 'html_diff' | 'api';
  };
  affected_modules: Array<'bsa-aml' | 'cra' | 'fair-lending' | 'lihtc-nmtc'>;
  affected_threshold_keys: string[];   // e.g. ['SAR_MINIMUM_AMOUNT']
  impact_summary: string;              // plain-English, 2-4 sentences
  watcher_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  proposed_value?: string;
  federal_register_citation?: string;
  effective_date?: string;
  acknowledge_url: string;             // deep link to compliance dashboard
}
```

---

## API Endpoints (Weeks 3-4)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/regulatory/updates` | Paginated list of detected regulatory changes (bank-scoped) |
| GET | `/v1/regulatory/updates/:update_id` | Single detected change with full source detail |
| POST | `/v1/regulatory/updates/:update_id/acknowledge` | Compliance officer acknowledges + confirms config row update |
| GET | `/v1/regulatory/config` | Current regulatory threshold config table (read-only view) |

---

## Claude Model Selection

| Task | Model | Temp | Rationale |
| --- | --- | --- | --- |
| Impact summary generation | `claude-sonnet-4-6` | 0.1 | Plain-English compliance summary; low temp for regulatory language precision |
| Affected module classification | `claude-haiku-4-5-20251001` | 0.0 | Deterministic classification against known module/threshold taxonomy |

---

## AGENT BOUNDARIES (System Prompt Block — to be finalized)

```
You are the RegulatoryWatcher. You monitor public regulatory feeds for changes that affect
compliance thresholds managed by the Econofi compliance platform.

When you detect a change, you:
1. Identify which config table rows (by threshold_key) are affected
2. Write a plain-English impact summary (2-4 sentences) for a bank compliance officer
3. Assign a confidence level: HIGH (direct numeric threshold change with clear effective date),
   MEDIUM (framework or rule change requiring interpretation), LOW (interpretive guidance only)

You NEVER:
- Update config table values directly — all changes require human acknowledgment
- Provide legal advice or legal interpretation
- Monitor non-public or subscription-required regulatory sources
- Take any action beyond detection, classification, and notification
```

---

## Test Cases (Stub — to be expanded)

```typescript
describe('RegulatoryWatcherAgent', () => {
  it('detects FinCEN SAR threshold change and maps to SAR_MINIMUM_AMOUNT config row');
  it('emits regulatory.update_detected webhook with HIGH confidence on direct numeric change');
  it('emits MEDIUM confidence on CRA framework guidance change');
  it('does NOT auto-update config row — pending_change populated, current_value unchanged');
  it('marks FATF greylist addition and maps to BSA/AML geographic risk module');
  it('does NOT emit webhook if feed content is unchanged since last poll');
  it('writes immutable audit log row on compliance officer acknowledgment');
  it('rejects acknowledgment from user without compliance_officer scope');
});
```

---

## Open Questions (To Resolve Before Spec Finalization)

1. **FATF list format**: Is the FATF grey/black list available as structured data (JSON/XML) or HTML only? If HTML-only, what is the diff strategy?
2. **Federal Register search precision**: The FR RSS for FINCEN returns all notices. Need keyword filter list (structuring, CTR, SAR, Bank Secrecy Act) to avoid noise.
3. **Confidence scoring calibration**: What is the threshold for HIGH vs MEDIUM vs LOW? Draft: HIGH = explicit numeric value change in final rule; MEDIUM = proposed rule or interpretive letter; LOW = guidance document or FAQ update.
4. **Multi-bank fan-out**: When a federal change affects all bank customers, do we emit one webhook per bank or a single platform-level alert? Recommendation: per-bank (preserves bank-scoped audit trail).
5. **FFIEC census tract update cadence**: FFIEC updates census tract data periodically. RegulatoryWatcher should flag when DataGuard's FFIEC API baseline needs refresh — confirm whether FFIEC provides a versioned API or requires HTML diff.

---

## Dependencies

- `regulatory_threshold_config` table (built during Sprint Day 2 as part of BSA/AML config table work)
- `watcher_state` table (new — tracks last-known state per source to enable diffing)
- Webhook delivery infrastructure (built Weeks 3-4 in shared API layer)
- Federal Register API (public, no key required)
- FATF website (public HTML)

---

*Status: Stub. Open questions must be resolved before this spec is marked Complete. Assign to spec review during Weeks 1-2.*
