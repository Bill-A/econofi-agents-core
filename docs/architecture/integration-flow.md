# BSA/AML Integration Flow Diagrams

Two versions for presentation use. Render with any Mermaid-compatible tool (GitHub, Notion, VS Code with Mermaid extension).

---

## Version A — "How It Works" (BSA Officer / Executive audience)

```mermaid
flowchart TD
    A["Your Core Banking System\n(Fiserv / Jack Henry / FIS)"]
    B["Econofi Secure SFTP\nTLS 1.3 in transit · AES-256 at rest"]
    C["Ingestion Service\nFormat parsing · PII sanitization\nNo PII beyond this point"]
    D["AI Transaction Screening\nEvery transaction analyzed:\nStructuring · Velocity anomalies\nGeographic risk · Round-dollar patterns"]
    E["bsa_aml.alerts\nBank-scoped · Immutable · 5-year retention"]
    F["BSA Officer Dashboard\nAlert queue · SAR narrative drafts\nInvestigation workflow · Audit trail"]
    G["BSA Officer\nReview · Investigate · File SAR if warranted"]

    A -->|"Daily file export\nNothing changes on your end"| B
    B -->|"Automated processing\nwithin minutes of file arrival"| C
    C -->|"POST /v1/transactions/batch\nSanitized transactions only"| D
    D -->|"Alerts generated\nwith regulatory citations"| E
    E -->|"GET /v1/alerts\nSeverity-sorted · Bank-scoped"| F
    F --> G

    style A fill:#1C273A,color:#fff
    style B fill:#1C273A,color:#fff
    style C fill:#1C273A,color:#fff
    style D fill:#00B4CC,color:#fff
    style E fill:#1C273A,color:#fff
    style F fill:#00B4CC,color:#fff
    style G fill:#E8703A,color:#fff
```

**Timeline:** File drop at 6:00 AM → batch processed → alerts in dashboard by 8:00 AM.
BSA Officer sees same-day alerts before the branch opens.

---

## Version B — Integration Architecture (Bank IT audience)

```mermaid
flowchart TD
    subgraph BANK ["Bank Infrastructure"]
        CORE["Core Banking System\nFiserv Premier / Precision\nJack Henry Silverlake / CIF 20/20\nFIS IBS / Horizon"]
        EXPORT["Scheduled Export\nNightly or 4-hour intraday cycle"]
        CORE --> EXPORT
    end

    subgraph INGEST ["Econofi Ingestion Layer"]
        SFTP["Secure SFTP\nBank-scoped directory\nTLS 1.3 · AES-256 at rest"]
        PARSER["Format Parser\nBAI2 · Nacha ACH\nISO 20022 · CSV"]
        PII["PII Sanitizer\naccount_number → SHA-256 hash\ncustomer_name → PERSON_001\nSSN → hashed\nNo PII beyond this point"]
        SFTP --> PARSER --> PII
    end

    subgraph AGENT ["Econofi AI Layer"]
        BATCH["POST /v1/transactions/batch\nUp to 50,000 transactions\nIdempotency · HMAC-SHA256 auth"]
        TM["TransactionMonitor Agent\nClaude claude-sonnet-4-6 · temp 0.0\nDeterministic pattern detection"]
        BATCH --> TM
    end

    subgraph STORE ["Data Layer — Supabase"]
        DB["bsa_aml.alerts\nPostgreSQL + Row Level Security\nBank isolation enforced at DB layer\n5-year retention per BSA"]
    end

    subgraph SURFACE ["BSA Officer Interface"]
        DASH["Alert Dashboard\nGET /v1/alerts\nSeverity-sorted · Bank-scoped"]
        INV["Investigation Workflow\nPATCH /v1/alerts/:id\nImmutable audit trail"]
        DASH --> INV
    end

    EXPORT -->|"BAI2 / CSV / ISO 20022\nfile drop"| SFTP
    PII -->|"SanitizedTransaction JSON"| BATCH
    TM -->|"SuspiciousActivityAlert\n31 USC 5324 citation\nSAR narrative draft"| DB
    DB --> DASH

    RT["Secondary Path\nDirect API — modern cores\nPOST /v1/transactions/screen\n200ms SLA · synchronous"]
    CORE -.->|"Real-time event\npost-SOC 2 only"| RT
    RT -.->|"Alert or null"| DB

    style BANK fill:#f5f5f5,stroke:#1C273A
    style INGEST fill:#f5f5f5,stroke:#1C273A
    style AGENT fill:#e8f7fa,stroke:#00B4CC
    style STORE fill:#f5f5f5,stroke:#1C273A
    style SURFACE fill:#fef3ee,stroke:#E8703A
    style RT stroke:#999,stroke-dasharray: 5 5
```

---

## Timeline Comparison

| Integration Path | File/Event → Alert Visible | Requirement |
|---|---|---|
| SFTP nightly batch | Next morning, before 8:00 AM | Default — works with all core versions |
| SFTP intraday (4-hour) | Within 4 hours of transaction | Requires bank to configure scheduled export |
| Direct API (synchronous) | < 200ms | Modern core version + SOC 2 Type II complete |

All three paths satisfy the 30-day SAR filing deadline under 31 CFR §1020.320.

---

## Supported File Formats (Primary Path)

| Format | Description | Cores |
|---|---|---|
| BAI2 | Cash management standard — deposits, withdrawals, wire activity | Fiserv, Jack Henry, FIS |
| Nacha ACH | ACH debit/credit transactions | All cores |
| ISO 20022 (XML) | Modern wire and payment standard | Newer core versions |
| Proprietary CSV | Core-specific export format | All cores — bank provides column mapping |

---

## Security Properties

| Property | Implementation |
|---|---|
| Transit encryption | TLS 1.3 minimum — SFTP and API |
| At-rest encryption | AES-256 — Supabase managed |
| PII boundary | Sanitized before API call — no PII in agent, alerts, or logs |
| Multi-tenancy | PostgreSQL Row Level Security — `SET app.current_bank_id` before every query |
| Audit trail | Append-only `api_audit_log` — no UPDATE or DELETE |
| Authentication | JWT (bank platform) · HMAC-SHA256 (ISV/direct API) |
