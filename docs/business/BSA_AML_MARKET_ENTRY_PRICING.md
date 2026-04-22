# BSA/AML Market Entry Pricing Strategy

**Prepared for**: Mentor DIscussions
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

The target customer is an MDI or CDFI community bank with $200M–$500M in assets. There are approximately 150–200 institutions in this range. This is an underserved market — the major BSA/AML vendors treat these banks as small commercial accounts, not as a segment worth building for.

---

## The Market We Are Entering

BSA/AML compliance software is a mature, sticky market with well-known vendors. The relevant competitive set at the community bank tier:

| Vendor | Annual Pricing (community banks) | Product Reality |
|---|---|---|
| Verafin (acquired by Nasdaq, 2021) | $40,000–$80,000/yr (estimated — pricing not public) | Market leader at MDI-sized banks. Genuine ML capability and, since 2024, generative AI tooling. Large consortium data network across 2,700 institutions. Built for commercial banks, adapted down-market. Strong examiner familiarity — BSA regulators know this product by name. |
| Alessa | $30,000–$60,000/yr | Mid-market. More limited AI capability than Verafin. Less common at MDIs. |
| Patriot Officer | $25,000–$50,000/yr | Oldest product in the space. On-premises option. Largely unchanged for a decade. Genuinely rule-based. |

**The market is real and paying.** A $200M MDI is currently paying an estimated $40,000–$55,000 per year for BSA/AML compliance software — software built for commercial banks, not MDIs, with MDI-specific transaction patterns, customer demographics, and community lending context treated as an afterthought. That bank has no MDI-native option — until now.

*Note: Verafin pricing is not publicly disclosed. The figures above are industry estimates. Treat as directional, not quoted.*

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
| Under $200M | $10,000 |
| $300M–$400M | $10,000–$12,500 |
| $500M | $15,000 |

**Pilot terms**: Implementation fee waived for the first three MDI banks. Named explicitly as pilot pricing at signing.

Standard contract terms: 3% annual escalator, 10% discount for 3-year commitment, asset growth ratchet at renewal.

---

## Where We Stand vs. the Market

| Asset Size | Patriot Officer (low end) | Verafin (midpoint) | **Econofi** |
|---|---|---|---|
| $200M | $25,000 | $48,500 | **$25,000** |
| $300M | $32,000 | $62,500 | **$37,500** |
| $400M | $40,000 | $76,500 | **$50,000** |
| $500M | $48,000 | $86,500 | **$62,500** |

We are currently priced at Patriot Officer — the oldest, least capable product in the space. This is intentional for the pilot phase but is not our long-term position. There is 40–68% of headroom between our current price and Verafin at the $200M tier.

---

## Why We Are Not Priced at Market Today

Legacy vendors command a premium for three things that have nothing to do with product quality:

**1. Examiner familiarity.** BSA examiners at the OCC and FDIC have seen Verafin alert reports hundreds of times. They recognize the format, trust the methodology, and move on. An unfamiliar vendor's output requires the BSA Officer to explain and defend the tool during an exam — on top of defending the actual findings. This is a real cost to the bank and a real barrier for us.

**2. Vendor stability.** Bank boards and procurement committees ask one question about any new compliance vendor: "Will they be here in three years?" Nasdaq-backed Verafin has a clear answer. We do not — yet. SOC 2 Type II certification is the industry's answer to this question, and we are pursuing it. Until it is complete, a pricing discount is honest and appropriate.

**3. Procurement precedent.** IT and legal teams at community banks reuse approved vendor templates. A known vendor gets approved in 30 days. A new vendor requires a full security review — 90 to 120 days and meaningful internal IT bandwidth. SOC 2 largely resolves this.

None of these are product disadvantages. All three are solvable within 12 months.

---

## The Three-Phase Pricing Roadmap

### Phase 1 — Pilot (Now, Pre-SOC 2)

Close the first three to five MDI pilot banks. Price at 25–30% below Verafin — an honest discount for vendor risk that does not undervalue the product.

| Asset Size | Recommended ceiling | Current price | Headroom |
|---|---|---|---|
| $200M | $35,000 | $25,000 | +$10,000 |
| $300M | $45,000 | $37,500 | +$7,500 |
| $400M | $55,000 | $50,000 | +$5,000 |
| $500M | $65,000 | $62,500 | +$2,500 |

We are currently leaving $2,500–$10,000 per bank on the table. The pilot banks will close at current pricing. Future pilots should be at the ceiling.

### Phase 2 — Market Parity (Post-SOC 2, 3–10 Live Banks)

SOC 2 Type II certification eliminates the procurement risk discount. Three or more banks with a completed exam cycle eliminate the examiner familiarity gap. At this stage, we price at Verafin parity with a modest discount maintained as a competitive growth posture.

| Asset Size | Phase 2 target | vs. current |
|---|---|---|
| $200M | $42,000 | +68% |
| $300M | $55,000 | +47% |
| $400M | $67,500 | +35% |
| $500M | $77,500 | +24% |

SOC 2 is the single highest-leverage business investment on the current roadmap. It is not a compliance checkbox — it is a pricing unlock.

### Phase 3 — MDI Specialist Premium (10+ Banks)

Once BSA examiners have seen Econofi output at multiple banks and MDI trade associations know the product by name, the examiner familiarity advantage inverts. Verafin is a commercial bank product adapted for smaller institutions. Econofi is built for MDIs. A specialist premium over Verafin becomes defensible.

| Asset Size | Phase 3 target | vs. Verafin |
|---|---|---|
| $200M | $52,500 | +8% |
| $300M | $67,500 | +8% |
| $400M | $82,500 | +8% |
| $500M | $92,500 | +7% |

---

## The Economics

Direct cost to deliver BSA/AML for one bank for one year:

| Component | Annual cost |
|---|---|
| AI (Claude API — per-batch analysis) | ~$1 |
| Infrastructure (database, compute, file transfer, storage) | ~$50–75 |
| **Total direct cost** | **~$75** |

The AI cost is not a rounding error — it is structural. Our architecture sends only a pattern summary to the model, not raw transaction data. A nightly batch of 50,000 transactions costs less than one cent in API fees. This advantage compounds: every bank we add is near-zero marginal cost.

**Gross margin at pilot pricing:**

| Asset Size | ACV | Direct Cost | Gross Margin |
|---|---|---|---|
| $200M | $25,000 | $75 | 99.7% |
| $300M | $37,500 | $75 | 99.8% |
| $400M | $50,000 | $75 | 99.9% |
| $500M | $62,500 | $75 | 99.9% |

Fully-loaded (including engineering, SOC 2 overhead, and customer success allocated across banks), the model reaches breakeven at approximately 10 banks at the $200M tier. Every bank above that adds near-zero marginal cost.

---

## The Value Case for the Bank

A BSA Officer at a community bank earns $80,000–$120,000/year. Econofi reduces their investigation time by 60–70% through automated alert triage, pre-drafted SAR narratives, and a prioritized queue that replaces hours of manual transaction review.

| Bank Size | BSA Officer Cost | Time Saved (est. 65%) | Value to Bank | Econofi Price | Bank ROI |
|---|---|---|---|---|---|
| $200M | $100,000 | $65,000 | $65,000 | $25,000 | **2.6x** |
| $300M | $110,000 | $71,500 | $71,500 | $37,500 | **1.9x** |
| $400M | $115,000 | $74,750 | $74,750 | $50,000 | **1.5x** |
| $500M | $120,000 | $78,000 | $78,000 | $62,500 | **1.2x** |

The 2.6x ROI at the $200M tier is a strong opening argument. At the $500M tier, the conversation shifts from labor savings to risk reduction — a single FinCEN enforcement action carries $1M–$5M in fines plus remediation costs and reputational damage that threatens the institution's MDI designation.

---

## The Renewal Moat

The name recognition gap is real when a bank is making its first decision. It is nearly irrelevant at renewal.

A BSA Officer who has used Econofi for 12 months — who has passed a regulatory exam with our alert reports and filed SARs using our narrative drafts — will not move to Verafin. The switching cost runs entirely in our favor: retraining staff, re-mapping the core export, losing 12 months of alert history and behavioral baselines, and explaining the vendor change to the next examiner.

Churn in compliance software is structurally low. Price to acquire, hold at renewal.

---

## What We Need to Execute This

1. **Close pilot banks at current pricing.** The first three banks establish the reference base. The implementation fee waiver is the closing tool.

2. **Complete SOC 2 Type II.** This is the pricing unlock, not a product milestone. Target: within 12 months.

3. **Survive the first exam cycle at each pilot bank.** One BSA Officer telling an examiner "we use Econofi" and having the examiner accept the output is worth more than any marketing investment.

4. **Raise prices to Phase 1 ceiling immediately** for banks four and five. We are leaving money on the table today without any competitive reason to do so.

The market is paying an estimated $40,000–$80,000 per year for software built for commercial banks, with no MDI-specific design and no understanding of the communities these institutions serve. We have a product built for this customer from the ground up. The path to market pricing is SOC 2 and reference customers — both of which are within reach this year.
