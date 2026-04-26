# BSA/AML TransactionMonitor — Agent Narrative

**Module**: BSA/AML Compliance
**Spec**: `specs/bsa-aml/TRANSACTION_MONITOR_SPEC.md`
**Implementation**: `src/agents/bsa-aml/transactionMonitor.ts`
**Regulatory basis**: 31 USC §5318(g) (Suspicious Activity Reporting), §5324 (Structuring)

---

## The Problem It Solves

Every bank in the United States must monitor transactions for suspicious activity and file a Suspicious Activity Report (SAR) with FinCEN within 30 days of detection. At a community bank, this responsibility falls on a single BSA Officer — one person reviewing hundreds of alerts, researching transaction patterns across multiple accounts, writing SAR narratives, and maintaining an audit trail that will survive a regulatory examination.

The tools available to that BSA Officer were not built for the bank they work at.

BSA/AML software has historically been built for commercial banks: large, high-volume institutions with suburban branch networks, business account-heavy customer bases, and transaction patterns that reflect the financial behavior of middle-income and commercial customers. The major vendors — Abrigo BAM+, Verafin, and the built-in modules from Fiserv, Jack Henry, and FIS — adapted those systems down to smaller institutions. The detection logic, the behavioral baselines, the alert thresholds, and the customer segmentation models all carry assumptions baked in from commercial bank data.

Minority Depository Institutions are not small commercial banks. Their customers, transaction patterns, community context, and mission are different. Applying commercial bank detection logic to an MDI does not produce accurate results. It produces false positives — alerts that the BSA Officer must spend time investigating and closing, alerts that may result in SARs filed against community members the bank exists to serve.

TransactionMonitor is the first BSA/AML agent built specifically for MDIs. The detection logic, baselines, and alert calibration reflect MDI transaction reality, not commercial bank assumptions.

---

## What Makes MDI Transactions Different

### Cash is primary, not exceptional

In underbanked communities — the communities MDIs were chartered to serve — cash remains the dominant medium of exchange. A BSA Officer at a commercial bank may see a $4,000 cash deposit at three branches in one day and correctly flag it as potential smurfing. A BSA Officer at an MDI in an underbanked neighborhood sees this pattern regularly as normal customer behavior: multiple family members pooling cash, a small business owner depositing daily register receipts at the nearest branch, a community vendor making runs to different locations.

A detection engine trained on commercial bank populations will fire on these patterns. One calibrated for MDI customer behavior will not — or will assign them a substantially lower risk score that reflects the actual probability of suspicious intent.

### Customer profiles are different

MDI customers are more likely to be:

- **Retail customers with limited banking history** — accounts that look "dormant" by commercial bank standards but reflect the intermittent banking relationship common among underbanked individuals
- **Small informal businesses** — vendors, contractors, and sole proprietors whose cash deposit patterns do not fit commercial business account models
- **Nonprofits and community organizations** — entities with irregular revenue cycles, grant-funded deposit patterns, and large one-time inflows that would trigger velocity alerts in a standard system
- **Multi-generational households** — multiple family members sharing account access, creating multi-party transaction patterns uncommon at commercial banks

### Geographic context matters

MDIs operate in specific geographic communities — their Community Reinvestment Act assessment area is the bank's stated service territory. A $50,000 wire transfer from a business in the bank's CRA assessment area carries different context than the same transfer from a shell company jurisdiction. Standard BSA/AML systems treat geography as a binary risk flag (high-risk country or not). TransactionMonitor incorporates CRA assessment area context as a signal: domestic transactions within the bank's designated community carry a different baseline expectation than transactions outside it.

### The false positive problem is a mission problem

At a commercial bank, a false positive SAR is an operational cost — BSA Officer time spent closing an alert. At an MDI, filing a SAR against a community member the institution exists to serve can destroy a relationship that took years to build. MDI customers who are SAR subjects may face difficulty opening accounts, obtaining loans, or conducting business — consequences that fall hardest on the people and communities the bank's charter is designed to protect.

Systematic over-reporting, caused by detection logic calibrated for the wrong customer population, is not just an operational inefficiency. It is a mission failure and, if it results in discriminatory patterns in who gets reported, a fair lending and civil rights risk.

---

## How TransactionMonitor Works

### What it receives

Every transaction that flows through the bank's core system — cash deposits, withdrawals, wire transfers, ACH activity, check deposits — is exported nightly as a sanitized batch. PII is stripped by the orchestration layer before TransactionMonitor sees any data: account numbers become SHA-256 hashes, customer names become tokens (`[PERSON_001]`), teller IDs become tokens (`[EMPLOYEE_012]`). The agent never sees raw customer information.

### What it detects

**Structuring (31 USC §5324)**
Multiple cash deposits below the $10,000 Currency Transaction Report threshold, timed and distributed to avoid triggering a CTR. TransactionMonitor groups deposits by account across a 3-day sliding window, detects same-day multi-branch patterns (smurfing), and flags single transactions within 1% of the CTR threshold. The critical calibration: the proximity window accounts for MDI customer behavior, where legitimate cash deposits cluster in similar amounts for reasons unrelated to CTR avoidance.

**Velocity anomaly**
A dormant account suddenly receiving a large wire. A customer whose 6-month average is $500/month suddenly transacting at $50,000. The baseline is each account's own history — not a population average — so a small business that triples revenue in December does not trigger the same alert as a retail account that has been inactive for two years and receives a $250,000 wire from the Cayman Islands.

**Round-dollar patterns**
Wire transfers at exact amounts ($100,000, $50,000, $75,000) in a pattern inconsistent with normal business activity. The key exclusion: payroll ACH credits, government benefit deposits, and loan repayments — transaction types that are round by design and overrepresented in MDI customer activity — do not contribute to the round-dollar ratio.

**Geographic risk**
Transactions involving FATF blacklist countries (Iran, North Korea, Myanmar), FATF greylist jurisdictions, and known offshore shell company locations (Cayman Islands, British Virgin Islands, Panama). Geographic risk scoring is additive — it raises the overall alert risk score when combined with other indicators, rather than triggering standalone alerts for borderline jurisdictions.

### What it produces

For every suspicious pattern detected, TransactionMonitor generates a `SuspiciousActivityAlert` containing:

- **Risk score** (0–100) and severity level (low / medium / high / critical)
- **Suspicious indicators** in plain English — specific to what was observed, not generic boilerplate
- **Regulatory citation** — the specific statute or regulation the pattern implicates
- **Transactions flagged** — the sanitized transaction records that constitute the evidence
- **Recommended action** — monitor / investigate / file SAR / escalate immediately
- **Confidence score** and false positive probability estimate

The BSA Officer sees a prioritized queue sorted by severity. Each alert includes enough context to make an investigation decision without opening a separate system.

### What it does not do

TransactionMonitor does not file SARs. Filing a SAR requires human judgment and explicit authorization under 31 CFR §1020.320 and the bank's own SAR decision policy. The agent surfaces evidence and a recommended action. The BSA Officer decides.

TransactionMonitor does not make legal determinations. A risk score of 100 does not mean money laundering occurred. It means the pattern warrants human investigation.

TransactionMonitor does not attempt to re-identify sanitized data. If a pattern requires PII to confirm, the alert is flagged for human investigation. The agent works only with what the sanitized data contains.

---

## The Competitive Context

Every other BSA/AML system on the market — Abrigo BAM+, Verafin, Fiserv AML Risk Manager, Jack Henry Financial Crimes Defender, FIS Prime Compliance Suite — was designed for commercial banks and adapted to community institutions. Several now include genuine AI and ML capabilities. The technology gap is not the differentiator.

The differentiator is the customer model. Those systems were trained on, calibrated for, and validated against commercial bank transaction populations. Their behavioral baselines reflect commercial bank customers. Their false positive thresholds were set for commercial bank contexts.

TransactionMonitor is calibrated for MDIs. The baselines, the thresholds, the customer segmentation, the false positive tuning — all of it is built around the transaction patterns and customer demographics of the institutions it serves.

That is not a marketing distinction. It is the reason MDI BSA Officers currently spend more time closing false positives than investigating genuine suspicious activity. And it is the problem TransactionMonitor is built to fix.
