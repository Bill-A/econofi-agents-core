# Pilot MVP → Full Production — Time Estimate

**As of**: May 14, 2026
**Current state**: Demo complete (local stack, synthetic data, 42/42 tests GREEN). Deployment is the immediate next step.

---

## Pilot MVP — ~3 Claude Code Days

Goal: one real BSA Officer working real alerts from their own transaction data.
No SFTP pipeline required. Manual data ingestion script bridges the gap.

| Work | Days | Notes |
|---|---|---|
| Full stack deployment (Vercel + Railway + cloud Supabase) | 0.5 | Already spec'd in NNL; cloud Supabase project exists (`ljhqickbsxxwmpsrvnpl`) |
| Real JWT auth + bank onboarding | 1.0 | Replace hardcoded demo JWT; provision bank_id + credentials per pilot bank |
| Manual sanitizer script (CSV export → tokenized JSON → `POST /v1/transactions/batch`) | 0.5 | One-time script per pilot bank; replaces SFTP pipeline for pilot phase |
| De-tokenization vault (Secrets Manager, BSA Officer acknowledge flow, audit log) | 1.0 | Required for SAR filing with real customer names/SSNs |

**Total: ~3 days**

What the pilot bank gets:
- Working Alert Dashboard at a real URL (no localhost)
- Real transaction data → real alerts → real investigation workflow
- SAR narrative draft as Word doc (BSA Officer fills in FinCEN reference number manually)
- Immutable audit trail for every status change

What the pilot bank does NOT get at this stage:
- Automated SFTP file delivery (data ingestion is a one-time manual run)
- FinCEN e-filing integration (SAR draft only)
- Multi-bank isolation (single tenant for pilot)

---

## Full Production — ~7 Additional Claude Code Days

Goal: multi-bank SaaS, automated file delivery, exam-ready audit trail, FinCEN filing.
Begins after pilot LOI is signed and pilot bank's core system is confirmed (Fiserv / Jack Henry / FIS).

| Work | Days | Notes |
|---|---|---|
| SFTP → S3 → Lambda PII Sanitizer | 3.0 | AWS Transfer Family; FedRAMP S3; Lambda tokenizer; file format adapter for pilot bank's core system (Fiserv or Jack Henry — build one, not both, based on actual pilot bank) |
| Async batch processing (50K+ transactions, job_id polling) | 1.0 | Current batch endpoint is synchronous, capped at 500; large bank files require async |
| Rate limiting + idempotency middleware | 0.5 | Per-tier rate limits; `X-Idempotency-Key` 24-hour cache |
| Multi-tenant RLS hardening + penetration test | 1.0 | JWT tampering, bank_id spoofing, RLS bypass attempts; enable RLS on `bank_customer_mapping` in cloud |
| FinCEN e-filing integration | 1.5 | BSA E-Filing System API; populates SAR form fields from de-tokenization vault; submits and captures FinCEN reference number |

**Total: ~7 additional days (10 days from current state)**

Not Claude Code work:
- SOC 2 Type II controls documentation
- Data retention enforcement (BSA 5-year, CRA 3-year)
- Pilot bank contract / LOI
- FinCEN BSA E-Filing System credentials (bank-sponsored, not vendor-sponsored)

---

## Recommended Sequence

```
NOW        Deploy stack → get to a real URL
           (0.5 day — this session)

PILOT      Sign LOI with first pilot bank
PREP       Build real auth + manual sanitizer script + vault
           (2.5 days)

PILOT      Run pilot bank's last 90 days of transactions
           Real BSA Officer works real alerts
           Collect feedback

POST-LOI   Build SFTP pipeline for pilot bank's core system
           Async batch, rate limiting, multi-tenant hardening
           (7 days)

GA         FinCEN e-filing, SOC 2, additional bank onboarding
```

Do not build the SFTP pipeline before signing a pilot LOI — the file format adapter
depends on which core banking system the pilot bank uses. Building for Fiserv before
knowing the pilot bank uses Jack Henry is wasted work.

---

## Key Constraint

The de-tokenization vault is the hardest architectural piece and has no shortcuts.
FinCEN SAR forms require real customer names, SSNs, and account numbers.
The token-to-PII mapping must be stored separately from the main database (KMS-encrypted vault),
and de-tokenization must be an explicit, audited BSA Officer action.

This cannot be deferred past the pilot — a SAR draft with `[PERSON_001]` instead of a real name
is not a submittable SAR. The vault must be in place before the pilot bank can use the output
for regulatory purposes.
