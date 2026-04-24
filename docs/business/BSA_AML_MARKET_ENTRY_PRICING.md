# BSA/AML Market Entry Pricing Strategy

**Prepared for**: Mentor Discussions
**Date**: April 22, 2026
**Prepared by**: M. Mtetwa for Econofi

---

## What We Are Building

Econofi's first product is TransactionMonitor — an AI-native BSA/AML compliance agent for Minority Depository Institutions (MDIs) and Community Development Financial Institutions (CDFIs).

Every bank in the United States is legally required to screen transactions for suspicious activity and file Suspicious Activity Reports (SARs) with FinCEN. For a community bank, this falls on a single BSA Officer who manually reviews hundreds of alerts, researches patterns, writes SAR narratives, and maintains an audit trail — all under the threat of significant regulatory sanctions if they miss something. This is an $80,000–$120,000/year person doing work that AI handles better and faster.

Our product:
- Screens every transaction every night for structuring, velocity anomalies, geographic risk, and round-dollar patterns
- Delivers a prioritized alert queue to the BSA Officer each morning with SAR narrative drafts included
- Maintains the immutable audit trail that regulators require
- Requires no changes to the bank's existing core banking system — the bank drops a file; everything else is automated

The target customer is an MDI or CDFI community bank with $200M–$500M in assets. There are approximately 150–200 institutions in this range. This is an underserved market — existing BSA/AML solutions were built for commercial banks and adapted down-market, not designed with MDI transaction patterns, customer demographics, or community lending context in mind.

---

## The Market We Are Entering

BSA/AML compliance software is a mature, sticky market. The actual competitive landscape at the $200M–$500M community bank tier is more nuanced than a single dominant vendor.

### Who the Actual Incumbent Is

For most MDIs at this asset size, the BSA/AML system is one of two things:

**1. The built-in module from their core banking vendor** — the most common situation, driven by cost and integration simplicity. FDIC data shows 76% of MDIs cite cost as their primary technology barrier; bundled core modules require no additional licensing and no data integration work.

| Core Vendor | BSA/AML Module | Notes |
|---|---|---|
| Fiserv (Premier, Precision) | AML Risk Manager (part of FCRM platform) | Native to the core; 1,200+ clients globally |
| Jack Henry (SilverLake, CIF 20/20) | Yellow Hammer BSA → Financial Crimes Defender | FCD launched October 2023; AI/ML-based; Carver Federal (MDI) is an early adopter |
| FIS (Horizon, IBS) | Prime Compliance Suite | Bundles BSA, OFAC, EDD, and legal reporting |

The core module trade-off: tighter integration and lower cost, but less sophisticated detection, more basic case management, and alert management UI that consistently draws BSA Officer complaints. The #1 recurring finding in community bank BSA/AML audits (NETBankAudit, 2024) is incorrect data mapping between core and AML system — a problem that disappears when both are from the same vendor, but reappears when a bank moves to a third-party solution.

**2. Abrigo BAM+** — the dominant dedicated third-party BSA/AML solution at this asset tier. Abrigo (formerly Banker's Toolbox, founded 2000) serves 2,400+ community banks and credit unions. It holds the ABA Preferred Service Provider designation and won the 2025 FinTech Breakthrough Award for Best AML Solution. It has genuine ML-based detection, behavioral analytics, and recently added a generative AI "AML Assistant" for alert triage and narrative drafting — the same category of capability Econofi offers. Pricing is not publicly disclosed; industry estimates for a $200M–$500M institution range from $20,000–$50,000/year.

### Where Verafin Actually Sits

Verafin (acquired by Nasdaq in 2021 for $2.75B) is real competition but not the primary incumbent at the $200M MDI tier. Post-acquisition, Verafin has moved upmarket toward $500M+ banks and larger institutions where its consortium data network (2,700 institutions, 800 million entity profiles) justifies a higher price point. It is present across all segments, but a $200M MDI is more likely on a core module or Abrigo than on Verafin.

Verafin has genuine ML capability (deployed since 2019) and since 2024 has shipped an AI Entity Research Copilot and Agentic Sanctions Analyst. It is a technically sophisticated competitor, not a legacy rules engine. Its pricing is not publicly disclosed; estimates for mid-market community banks range from $40,000–$80,000/year.

*All vendor pricing figures are industry estimates. No vendor in this market publishes rates publicly.*

---

## Our Pricing

Annual subscription, determined by total bank assets per the most recent FDIC call report:

| MDI Asset Size | Annual Subscription |
|---|---|
| Under $200M | $25,000 |
| ~$300M | $37,500 |
| ~$400M | $50,000 |
| ~$500M | $62,500 |

One-time implementation fee (covers SFTP provisioning, core export configuration, BSA Officer onboarding):

| Asset Size | Implementation Fee |
|---|---|
| Under $300M | $10,000 |
| $300M–$400M | $12,500 |
| $500M | $15,000 |

**Pilot terms**: Implementation fee waived for the first three MDI banks. Named explicitly as pilot pricing at signing.

Standard contract terms: 3% annual escalator, 10% discount for 3-year commitment, asset growth ratchet at renewal.

---

## Where We Stand vs. the Market

The relevant comparison for a $200M MDI is Abrigo BAM+ (the most likely third-party incumbent) and the core banking module (the most likely bundled incumbent):

| Asset Size | Core module (est.) | Abrigo BAM+ (est.) | Verafin (est.) | **Econofi** |
|---|---|---|---|---|
| $200M | $0 (bundled) | $20,000–$30,000 | $40,000–$55,000 | **$25,000** |
| $300M | $0 (bundled) | $25,000–$35,000 | $50,000–$65,000 | **$37,500** |
| $400M | $0 (bundled) | $30,000–$40,000 | $60,000–$75,000 | **$50,000** |
| $500M | $0 (bundled) | $35,000–$50,000 | $70,000–$80,000 | **$62,500** |

Two distinct sales conversations emerge from this:

**Displacing a core module:** The bank is currently paying $0 for BSA/AML (it is bundled with their core). The ask is $25,000–$62,500 for a standalone product. The case is entirely about what the core module is failing to catch, what an exam finding will cost, and what a BSA Officer's time is worth. This is a harder sale but a larger opportunity — most MDIs are on core modules.

**Displacing Abrigo BAM+:** We are priced above Abrigo at the $200M–$300M tier. The case is MDI specialization, modern architecture, and the quality of the AI-generated SAR narrative drafts vs. Abrigo's rules-based scenarios with ML layered on top. At $400M+, we are priced competitively with Abrigo.

---

## Why We Are Not Priced at Market Today

New vendors in compliance software carry three costs for the bank that justify a discount against established players:

**1. Examiner unfamiliarity.** BSA examiners know Abrigo and Verafin reports. An unfamiliar vendor's output requires the BSA Officer to explain the tool during an exam — on top of defending the actual findings. This is real friction.

**2. Vendor stability risk.** Bank procurement asks: "Will they be here in three years?" SOC 2 Type II certification is the industry's answer. Until we have it, a pricing discount is honest and appropriate.

**3. Security review overhead.** A known vendor clears IT/legal in 30 days. A new vendor takes 90–120 days of internal IT bandwidth. SOC 2 largely resolves this.

None of these are product disadvantages. All three are solvable within 12 months. SOC 2 is the single most important investment on the current roadmap — it is a pricing unlock, not a compliance checkbox.

---

## The Three-Phase Pricing Roadmap

### Phase 1 — Pilot (Now, Pre-SOC 2)

Close the first three to five pilot banks. The reference customer is worth more than the margin difference at this stage.

| Asset Size | Current price | Phase 1 ceiling | Headroom |
|---|---|---|---|
| $200M | $25,000 | $32,000 | +$7,000 |
| $300M | $37,500 | $42,000 | +$4,500 |
| $400M | $50,000 | $52,000 | +$2,000 |
| $500M | $62,500 | $62,500 | at ceiling |

Phase 1 ceiling is set at Abrigo mid-range — appropriate for a product without SOC 2 competing against an established player with a comparable feature set.

### Phase 2 — Market Parity (Post-SOC 2, 3–10 Live Banks)

SOC 2 and a completed exam cycle at three or more banks retires the discount. We price at the top of the Abrigo range, below Verafin, and grow from there.

| Asset Size | Phase 2 target | vs. current |
|---|---|---|
| $200M | $38,000 | +52% |
| $300M | $50,000 | +33% |
| $400M | $62,500 | +25% |
| $500M | $75,000 | +20% |

### Phase 3 — MDI Specialist Premium (10+ Banks)

Once MDI trade associations (NCIF, NBA, NAOBA) know the product and BSA examiners have seen the output at multiple institutions, a specialist premium is defensible. No competitor — Verafin, Abrigo, or the core modules — was built for this customer. We were.

| Asset Size | Phase 3 target | vs. Verafin est. |
|---|---|---|
| $200M | $50,000 | at midpoint |
| $300M | $65,000 | at midpoint |
| $400M | $80,000 | at midpoint |
| $500M | $90,000 | slightly below |

---

## The Economics

Direct cost to deliver BSA/AML for one bank for one year:

| Component | Annual cost |
|---|---|
| AI (Claude API — per-batch pattern analysis) | ~$1 |
| Infrastructure (database, compute, file transfer, storage) | ~$50–75 |
| **Total direct cost** | **~$75** |

The AI cost is structural, not incidental. Our architecture sends only a pattern summary to the model — not raw transaction data. A nightly batch of 50,000 transactions costs less than one cent in API fees. This is a meaningful advantage over any system doing transaction-level ML inference at scale.

**Gross margin at pilot pricing:**

| Asset Size | ACV | Direct Cost | Gross Margin |
|---|---|---|---|
| $200M | $25,000 | $75 | 99.7% |
| $300M | $37,500 | $75 | 99.8% |
| $400M | $50,000 | $75 | 99.9% |
| $500M | $62,500 | $75 | 99.9% |

Fully-loaded (engineering, SOC 2, customer success), the model reaches breakeven at approximately 10 banks. Every bank above that is near-zero marginal cost.

---

## The Value Case for the Bank

A BSA Officer at a community bank earns $80,000–$120,000/year. Econofi reduces investigation time through automated alert triage, pre-drafted SAR narratives, and a prioritized queue that replaces hours of manual review.

The time-savings estimate below is directional — 65% is drawn from industry benchmarks for AI-assisted compliance workflows and has not yet been validated in our own pilot. We will replace this figure with measured data from the first three banks.

| Bank Size | BSA Officer Cost | Time Saved (est. 65%) | Value to Bank | Econofi Price | Bank ROI |
|---|---|---|---|---|---|
| $200M | $100,000 | $65,000 | $65,000 | $25,000 | **2.6x** |
| $300M | $110,000 | $71,500 | $71,500 | $37,500 | **1.9x** |
| $400M | $115,000 | $74,750 | $74,750 | $50,000 | **1.5x** |
| $500M | $120,000 | $78,000 | $78,000 | $62,500 | **1.2x** |

At $200M, the labor savings argument leads. At $500M, the conversation shifts to risk: a single FinCEN enforcement action carries $1M–$5M in fines, plus remediation costs and potential loss of MDI designation — an existential consequence for an institution whose mission depends on that designation.

---

## The Renewal Moat

The unfamiliarity discount matters at first sale. It is nearly irrelevant at renewal.

A BSA Officer who has used Econofi for 12 months — who has passed an exam with our alert reports and filed SARs using our narrative drafts — will not move to Abrigo or Verafin. Switching costs run entirely in our favor: retraining staff, re-mapping the core export, losing 12 months of behavioral baselines, and explaining the vendor change to the next examiner.

Compliance software churn is structurally low across the industry. Price to acquire; hold at renewal.

---

## What We Need to Execute This

1. **Close the first three pilot banks at current pricing.** The implementation fee waiver is the closing tool. Reference customers are the asset — optimize for that, not for margin.

2. **Complete SOC 2 Type II within 12 months.** This unlocks Phase 2 pricing across every bank we sign.

3. **Get through the first exam cycle at each pilot bank.** One BSA Officer showing an examiner our dashboard and having the output accepted without question is the proof point that changes every subsequent sales conversation.

4. **Know which incumbent we are displacing before the first meeting.** Core module vs. Abrigo vs. Verafin requires a different conversation. Ask the prospect before pitching.
