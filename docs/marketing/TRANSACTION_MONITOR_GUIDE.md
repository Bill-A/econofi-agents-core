# Econofi TransactionMonitor
## Product Guide for BSA Officers

**Version 1.0 — May 2026**
**For**: BSA Officers at MDIs, CDFIs, community banks, and credit unions

---

## The Problem This Solves

You already know your obligations under the Bank Secrecy Act. 31 USC §5318(g) requires you to file a Suspicious Activity Report within 30 days of detecting suspicious activity. 31 CFR §1020.320 requires you to document every decision — including the decision *not* to file.

The problem is not knowing the rules. The problem is time.

At a community bank or credit union, you may be the only person responsible for BSA compliance. You are reviewing transaction reports manually, applying your own judgment to hundreds of flagged items, writing SAR narratives from scratch, and maintaining documentation that can withstand an OCC or NCUA examination. Every one of those tasks takes time you don't have.

Econofi TransactionMonitor is built specifically for institutions like yours — MDIs, CDFIs, community banks, credit unions — where BSA compliance is one person's full-time responsibility and the margin for error is zero.

---

## What TransactionMonitor Does

TransactionMonitor analyzes transaction data and surfaces alerts when patterns are consistent with suspicious activity under the Bank Secrecy Act. It applies six detection patterns, assigns a risk score, cites the relevant regulation, and delivers the alert directly to your dashboard.

You review. You decide. You document. TransactionMonitor makes each of those steps faster and more defensible.

**Six detection patterns:**

| Pattern | What It Detects | Regulation |
|---|---|---|
| Structuring | Multiple sub-$10,000 cash deposits designed to avoid CTR filing | 31 USC §5324 |
| Velocity Anomaly | Dormant account activation, rapid in/out movements | 31 USC §5318(g) |
| Geographic Risk | Transfers to/from FATF grey-list or black-list jurisdictions | 31 USC §5318(g) |
| Round Dollar | Unusual round-dollar patterns inconsistent with customer profile | 31 USC §5318(g) |
| Multiple Indicators | Two or more patterns present simultaneously — highest risk tier | 31 USC §5324, §5318(g) |
| Customer Deviation | Transaction volume or type significantly outside customer baseline | 31 USC §5318(g) |

Every alert includes:
- Risk score (0–100)
- Severity classification (Low / Medium / High / Critical)
- Specific transactions flagged, with amounts and dates
- Suspicious indicators in plain language
- Regulatory citation
- Recommended action (Monitor / Investigate / File SAR / Escalate Immediately)

---

## Built for MDI and CDFI Customer Populations

Generic BSA systems generate false positives on transactions that are completely normal for MDI and CDFI customers. Tanda savings circles, remittance patterns, agricultural payroll, and informal economy cash flows look suspicious to a system calibrated for suburban retail banking.

TransactionMonitor includes closure reason codes that reflect the legitimate economic activity of your customer population:

- **Tanda cycle** — Rotating savings and credit association (ROSCA/tanda) confirmed with documented participants
- **Documented business purpose** — Seasonal payroll, agricultural wages, verified business cash use
- **Institutional knowledge** — Prior CDD review on file; activity is consistent with known customer profile
- **Seasonal income** — Recurring seasonal cash activity with documented source

When you close an alert with one of these codes, the decision is recorded in an immutable audit log with your name, timestamp, and notes. An examiner reviewing your BSA program sees a documented, reasoned decision — not a gap.

---

## The Dashboard

`[SCREENSHOT: Alert dashboard — full list view with severity badges, risk score bars, status filters]`

The Alert Dashboard shows every open and resolved alert for your institution, sorted by most recent. Each row shows:

- Alert ID and date
- Customer token (no PII displayed)
- Alert type and severity badge
- Risk score bar
- Current investigation status
- Link to full detail

**Status filters** let you focus on what needs action: Pending, In Progress, SAR Filed, No SAR Warranted, False Positive.

**Severity filters** let you clear low-risk items quickly and spend time on Critical and High alerts.

Try it: [econofi-bsa-dashboard.netlify.app](https://econofi-bsa-dashboard.netlify.app)

---

## Investigating an Alert

Click any alert to open the detail view.

`[SCREENSHOT: Alert detail — structuring alert ALT-2026-05-11-00001, showing transactions, indicators, regulatory citation, risk score]`

The detail view shows:

**Transaction evidence** — Every flagged transaction with amount, date, type, and whether it was online or branch. Not a summary — the actual records.

**Suspicious indicators** — Plain-language description of why each pattern was flagged. Written to be useful to you, not to a developer.

**Regulatory citation** — The specific statute that applies. This goes directly into your documentation.

**Recommended action** — Based on the pattern and risk score: Monitor, Investigate, File SAR, or Escalate Immediately.

**Confidence score and false positive probability** — Transparency about certainty. A 91% confidence score on a structuring alert means something different than 64%.

### Updating Status

`[SCREENSHOT: Investigation form — status dropdown, notes field, Save button]`

The investigation form lets you:

1. Change the status (Pending → In Progress → SAR Filed or No SAR Warranted or False Positive)
2. Add investigation notes in plain text
3. For closures that don't result in a SAR: select a structured closure reason code and add detail

Every status change writes an immutable event to the audit trail. You cannot edit or delete past events. This is by design — BSA examiners expect to see the full history of a decision, including when it was made and by whom.

---

## The "Don't File" Decision

Closing an alert without filing a SAR is a legitimate and frequently correct decision. But it must be documented.

31 CFR §1020.320 requires institutions to maintain records of SAR declination decisions. "I looked at it and decided it was fine" is not sufficient documentation under examination.

When you close an alert as No SAR Warranted or False Positive, TransactionMonitor requires you to:

1. Select a structured closure reason code
2. Add a free-text explanation
3. Confirm the status change

`[SCREENSHOT: Closure reason panel — amber-styled, showing reason code dropdown and detail text field]`

The result is a machine-readable, examiner-readable record that answers the question every BSA examiner asks: "How did you decide not to file?"

---

## SAR Narrative Draft

When you set an alert to SAR Filed, a narrative draft appears automatically.

`[SCREENSHOT: SAR narrative panel — showing draft text, Bank/Credit Union toggle, highlighted placeholder sections]`

The narrative draft is pre-populated with:
- The subject description (using your tokenized customer reference — you will add the real name before filing)
- The transaction description drawn directly from the flagged transactions
- The regulatory basis for filing
- MDI context section — a reminder to review your institution's CDD records before filing
- Placeholders for the sections only you can complete: subject's date of birth, account number, your institution's information, and the filing date

**The Bank / Credit Union toggle** adjusts the institutional language throughout the narrative — "bank" vs. "credit union," "branch" vs. "office."

**The narrative is editable inline.** Click any section and type. The document is yours to complete before filing.

**Download as Word doc.** The Word document preserves the formatting, highlights placeholders in amber for review, and includes the DRAFT watermark. Remove the watermark and the DRAFT designation only after your compliance officer has reviewed and approved the narrative for filing.

This is a draft aid. Filing is solely your institution's responsibility. Econofi does not submit to FinCEN on your behalf.

---

## The Audit Trail

`[SCREENSHOT: Audit trail timeline — showing three events: pending → in_progress (with notes) → sar_filed (with notes), timestamps and actor names]`

Every alert carries a complete, immutable history of every status change:

- Who changed the status
- When (date and time)
- What it changed from and to
- Notes entered at the time of the change
- Closure reason code, if applicable

The audit trail cannot be edited, backdated, or deleted. It is the factual record of your BSA process.

When an OCC examiner or NCUA examiner reviews your BSA program, they will look at whether your institution has a documented, consistent process for identifying, investigating, and resolving suspicious activity alerts. The audit trail is that documentation — automatically maintained for every alert, without additional steps from you.

---

## What TransactionMonitor Does Not Do

These boundaries are hard constraints, not features to be added later.

**TransactionMonitor does not file SARs.** Filing is your decision. The platform produces a draft narrative and documents your workflow. The act of filing with FinCEN BSA E-Filing is yours alone.

**TransactionMonitor does not make legal determinations.** The risk score and recommended action are analytical outputs, not legal conclusions. Your judgment as a BSA Officer — informed by your knowledge of the customer and the institution — is what matters.

**TransactionMonitor does not access PII.** Customer names, Social Security numbers, and account numbers are never processed by the detection engine. The system works on tokenized data and account hashes. The SAR narrative draft contains placeholder tokens ([PERSON_001]) where real customer information must be inserted by you before filing.

**TransactionMonitor does not replace your BSA program.** It is a tool to support a BSA Officer — not to replace the judgment, training, and institutional knowledge that BSA compliance requires.

---

## Getting Started — Live Demo

A working demo environment is available at:

**[econofi-bsa-dashboard.netlify.app](https://econofi-bsa-dashboard.netlify.app)**

The demo is pre-loaded with 15 alerts across all six detection patterns and all five status states. No login required.

**Suggested 5-minute walkthrough:**

1. Open the Alert Dashboard. Review the full alert list — note the severity distribution and status mix.

2. Find alert `ALT-2026-05-11-00001` — Structuring, Critical, risk score 91. This is a three-branch, three-day sub-threshold deposit pattern on [PERSON_006]. Open it.

3. Review the transactions, indicators, and regulatory citation. Note the recommended action: File SAR.

4. Scroll to the Investigation Form. Change the status to SAR Filed. Add a brief note. Click Save.

5. The SAR Narrative Draft panel appears. Toggle between Bank and Credit Union. Click Download Word doc. Review the document — note the placeholder sections in amber.

6. Scroll to the Audit Trail. The status change you just made is recorded with your timestamp.

7. Return to the dashboard. Find `ALT-2026-04-15-00001` — Structuring, High, closed No SAR Warranted. Open it. Review the closure reason (Tanda cycle) and the investigation notes. Review the audit trail — two events showing the full investigation lifecycle.

The demo resets periodically. All data is synthetic — no real customer information.

---

## Next Steps

To discuss a pilot for your institution — including running TransactionMonitor against your own transaction data — contact:

**Bill Allen**
Econofi / Agile Innovation Labs
bill@agileinnov.com

Pilot participants work directly with the Econofi team to configure the system for their institution's customer profile, review the first set of real alerts, and provide feedback that shapes the product roadmap.

Pilot participation does not require a production deployment. The first phase uses a manual data export from your core banking system — no SFTP integration, no IT project required.

---

*Econofi TransactionMonitor is compliance automation infrastructure for community financial institutions. It is not legal advice and does not constitute a BSA compliance program. Institutions are solely responsible for their BSA/AML obligations under applicable law.*
