# BSA/AML Integration Architecture

**Audience**: Bank IT, BSA Officers, Compliance Leadership
**Status**: Pre-pilot reference — SOC 2 Type II in progress
**Last updated**: April 2026

---

## Overview

Econofi's TransactionMonitor screens every transaction for suspicious activity patterns — structuring, velocity anomalies, geographic risk, and round-dollar indicators — and surfaces prioritized alerts to the BSA Officer within the business day.

Integration requires no changes to a bank's core banking configuration. The bank deposits a standard transaction export file to a secure SFTP endpoint. Everything downstream is automated.

---

## Built for MDIs — Not Adapted for Them

Every major BSA/AML platform on the market was built for commercial banks and scaled down to community institutions as an afterthought. Econofi was designed from the ground up for Minority Depository Institutions and CDFIs. That distinction is not marketing — it changes how the detection logic works.

### MDI Transaction Patterns Are Different

MDI customers are more likely to conduct business in cash. A $4,000 cash deposit at three branches in one day can look like structuring to a commercial bank system trained on suburban branch patterns. For an MDI serving an underbanked community where cash is the primary medium of exchange, it may be entirely normal. A detection engine that cannot distinguish between these two contexts generates false alerts, erodes BSA Officer trust, and — if it leads to a Suspicious Activity Report filed against a legitimate customer — directly undermines the institution's community mission.

TransactionMonitor is calibrated for MDI-specific baselines:

- **Customer segmentation** accounts for retail, small business, nonprofit, and trust account profiles common at MDIs
- **Velocity thresholds** are set relative to each account's own 6-month behavioral history, not a commercial bank population average
- **Geographic risk** is evaluated in the context of the bank's Community Reinvestment Act assessment area — domestic transactions within the bank's designated service area are scored differently from equivalent transactions at commercial bank branches
- **Round-dollar detection** excludes patterns consistent with community lending repayments, government benefit deposits, and small business payroll — transaction types that are overrepresented at MDI customer bases

### The False Positive Problem Is a Mission Problem

At a commercial bank, a false positive SAR is a compliance annoyance. At an MDI, filing a SAR against a community member the institution exists to serve can damage a relationship that took years to build and has no substitute. The bank's MDI or CDFI designation depends on demonstrated commitment to serving its community. Systematic over-reporting caused by a detection engine calibrated for the wrong customer base is a regulatory and mission risk, not just an operational one.

### What This Means for the BSA Officer

The BSA Officer at an MDI spends a disproportionate amount of time justifying why an alert is a false positive — time that should go to genuine suspicious activity. Econofi's alert queue is designed to surface the transactions that actually warrant investigation, not every transaction that looks unfamiliar to a system built for a different kind of bank.

---

## Integration Paths

### Primary Path — SFTP Batch Ingestion

**Recommended for all institutions at initial deployment.**

The bank's core banking system already produces scheduled transaction export files for other purposes (reconciliation, reporting, existing vendor feeds). Econofi receives a copy of that file via a bank-scoped SFTP directory. No modifications to core banking configuration are required.

**How it works:**

1. The bank's core banking system generates a transaction export on its normal schedule (nightly or configurable to 4-hour intraday cycles).
2. The export file is delivered to a bank-scoped directory on Econofi's secure SFTP server.
3. Econofi's Ingestion Service detects the file, parses it, and sanitizes all PII before any transaction data reaches the AI screening layer.
4. Sanitized transactions are submitted to the TransactionMonitor agent in a single batch call.
5. Alerts are written to the bank's isolated alert queue.
6. The BSA Officer logs into the dashboard and sees a prioritized alert queue with SAR narrative drafts and regulatory citations.

**Supported file formats:**

| Format | Transaction types covered | Notes |
|---|---|---|
| BAI2 | Cash deposits, withdrawals, wire activity | Standard across Fiserv, Jack Henry, FIS |
| Nacha ACH | ACH debit and credit transactions | Universal |
| ISO 20022 (XML) | Wires, SEPA, modern payment rail activity | Newer core versions |
| Proprietary CSV | Core-specific exports | Bank provides column mapping at onboarding |

**Supported core banking systems:**

| Vendor | Platforms | Export capability |
|---|---|---|
| Fiserv | Premier, Precision, Cleartouch, Spectrum | BAI2, CSV scheduled exports |
| Jack Henry | Silverlake, CIF 20/20, Banno | BAI2, Nacha, CSV exports |
| FIS | IBS, Horizon, Metavante | BAI2, ISO 20022, CSV exports |

**Alert timeline:**

| Export schedule | Alert visible to BSA Officer |
|---|---|
| Nightly (default) | Next morning before 8:00 AM |
| 4-hour intraday | Within 4 hours of transaction posting |

Both schedules satisfy the 30-day SAR filing deadline under 31 CFR §1020.320.

---

### Secondary Path — Direct API Integration

**Available for institutions on modern core versions. Positioned as the preferred path for real-time use cases post-SOC 2 Type II certification.**

The bank's core banking system or a middleware layer calls `POST /v1/transactions/screen` at the time of transaction posting. The API returns synchronously within 200ms with either a null result (no suspicious activity) or a `SuspiciousActivityAlert` object containing the pattern detected, regulatory citation, and recommended action.

**Requirements:**
- Core banking system must support outbound API calls at transaction time
- SOC 2 Type II certification required before most bank IT departments will approve a direct connection
- Bank IT engagement required for integration build

**Alert timeline:** < 200ms from transaction posting.

---

## Data Flow — Detailed

```
Bank Core (Fiserv / Jack Henry / FIS)
    |
    | Scheduled export — BAI2, Nacha ACH, ISO 20022, or CSV
    |
    v
Econofi SFTP Server
    Bank-scoped directory (bank_id isolated)
    TLS 1.3 in transit
    AES-256 encryption at rest
    |
    | File arrival detected by Ingestion Service
    |
    v
Ingestion Service
    1. Format parser: file → RawTransaction[]
    2. PII sanitizer:
       - account_number  →  SHA-256 hash  (ACCT_HASH_xxxxx)
       - customer_name   →  token         ([PERSON_001])
       - SSN             →  SHA-256 hash
       - teller_id       →  token         ([EMPLOYEE_001])
       - counterparty    →  token         ([BUSINESS_007])
    3. No PII beyond this point in the pipeline
    |
    | POST /v1/transactions/batch
    | HMAC-SHA256 signed · Idempotency key · TLS 1.3
    |
    v
TransactionMonitor Agent
    Model: claude-sonnet-4-6
    Temperature: 0.0 (deterministic)

    Detection patterns:
    - Structuring: multiple sub-$10K deposits designed to evade CTR
      Regulatory basis: 31 USC §5324
    - Velocity anomaly: dormant account activation, volume/amount spikes
      Detection threshold: 3x transaction count or 5x amount vs. 6-month baseline
    - Geographic risk: FATF grey/blacklist jurisdiction transactions
      Data source: FATF grey/blacklist, OFAC SDN list
    - Round-dollar patterns: >80% of transactions at exact amounts
    - Multiple indicators: combination of above patterns
    |
    | SuspiciousActivityAlert generated for flagged patterns
    | alert_id, risk_score, regulatory_citation, SAR narrative draft
    |
    v
bsa_aml.alerts (Supabase — PostgreSQL + RLS)
    Row Level Security enforced at database layer
    bank_id isolation: no cross-tenant data access possible
    Data retention: 5 years per BSA requirements
    Audit log: append-only, no UPDATE or DELETE
    |
    | GET /v1/alerts (JWT authenticated, bank-scoped)
    |
    v
BSA Officer Dashboard
    - Alert queue sorted by severity (critical → high → medium → low)
    - Each alert includes:
        - Pattern detected and plain-English explanation
        - Transactions flagged (anonymized — no PII)
        - Regulatory citation (e.g., "31 USC §5324 — Structuring")
        - SAR narrative draft
        - Recommended action: monitor / investigate / file SAR / escalate
    - Investigation workflow:
        - PATCH /v1/alerts/:alert_id → update status
        - Status transitions: pending → in_progress → sar_filed / no_sar_warranted / false_positive
        - Every status change written to immutable audit log with officer token and timestamp
    - SAR filing: platform captures SAR reference number, links to alert, closes the record
```

---

## PII Handling

PII never reaches the AI screening layer. The sanitization boundary is enforced at the Ingestion Service before any data is submitted to the API.

| Data element | Handling | Format |
|---|---|---|
| Account number | SHA-256 hash | `ACCT_HASH_a3f7...` |
| Customer name | Token | `[PERSON_001]` |
| Social Security Number | SHA-256 hash | Not stored |
| Teller ID | Token | `[EMPLOYEE_012]` |
| Counterparty name (individual) | Token | `[PERSON_042]` |
| Counterparty name (business) | Token | `[BUSINESS_007]` |
| Branch code | Preserved | Not PII |
| Country code | Preserved | ISO 3166-1 alpha-2 |
| Transaction amount | Preserved | USD |
| Transaction type | Preserved | Enumerated type |

The API boundary enforces a PII scan on every POST body. Any request containing SSN patterns (`\d{3}-\d{2}-\d{4}`) or 9+ consecutive digits returns HTTP 422 `PII_DETECTED` and is not processed.

---

## Multi-Tenancy

Each bank operates in a completely isolated data environment enforced at the database layer — not just application logic.

- Every API request carries a JWT with a `bank_id` claim
- Before every database query: `SET app.current_bank_id = '{bank_id}'`
- PostgreSQL Row Level Security policies filter all reads and writes to the authenticated bank's records
- A bug in application code cannot expose one bank's data to another — RLS enforces the boundary at the database

---

## Security Summary

| Control | Implementation |
|---|---|
| Transit encryption | TLS 1.3 minimum — SFTP and API endpoints |
| At-rest encryption | AES-256 — Supabase managed |
| Authentication — platform | JWT (Bearer token), 8-hour expiry |
| Authentication — API/ISV | Long-lived API key + HMAC-SHA256 request signing |
| Multi-tenancy | PostgreSQL Row Level Security |
| PII boundary | Sanitization before API call — no raw PII in agent, alerts, or logs |
| Audit trail | Append-only `api_audit_log` and `alert_audit_log` — no UPDATE or DELETE policies |
| Idempotency | `X-Idempotency-Key` header — 24-hour deduplication window |
| Data retention | BSA/AML: 5 years per regulatory requirement |

SOC 2 Type II certification is in progress. Controls documentation available upon request under NDA.

---

## Onboarding Steps (SFTP Path)

1. **Econofi provisions a bank-scoped SFTP directory** — credentials and host key delivered securely
2. **Bank IT configures the core export** — points one copy of the existing scheduled export to the Econofi SFTP endpoint; no changes to existing exports
3. **Column mapping (CSV only)** — bank provides field-to-column mapping for proprietary CSV format; Econofi configures the parser
4. **Test file drop** — bank drops a sample file; Econofi confirms parsing and sanitization are correct
5. **Go-live** — scheduled export runs on the agreed cadence; BSA Officer receives alert queue access

Typical onboarding time: 1–2 weeks for SFTP path. Direct API path requires additional IT engagement.

---

## Frequently Asked Questions — Bank IT

**Does this require changes to our core banking configuration?**
No. The SFTP path uses your existing scheduled export. You add one additional export destination. Nothing else changes.

**Where is our transaction data stored?**
In a Supabase-managed PostgreSQL database on AWS. Your data is isolated from all other institutions at the database layer via Row Level Security. Transaction data is retained for 5 years per BSA requirements and then purged.

**Do you store customer PII?**
No. PII is sanitized before data enters the processing pipeline. We store only SHA-256 hashes of account numbers and SSNs, and anonymous tokens for customer and teller identities. The original PII never reaches our AI layer, database, or logs.

**What file formats do you support?**
BAI2, Nacha ACH, ISO 20022, and proprietary CSV. For CSV formats, we configure a field mapping at onboarding.

**What happens if the SFTP transfer fails?**
The Ingestion Service retries failed transfers with exponential backoff. The `X-Idempotency-Key` header on the batch API call ensures a file is never processed twice even if retried.

**When will you have SOC 2 Type II?**
SOC 2 Type II audit is in progress. We can share our controls documentation under NDA. For pilot engagements, we work with your CISO to address specific security requirements on a case-by-case basis.

**Can we use the direct API path instead of SFTP?**
Yes, if your core banking version supports outbound API calls. We recommend starting with SFTP to minimize IT lift and moving to direct API after SOC 2 is complete.
