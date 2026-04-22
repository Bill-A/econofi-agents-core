# BSA/AML Market Entry Pricing Strategy

**Prepared for**: Art and Steve
**Date**: April 2026
**Prepared by**: Econofi

---

## The Short Version

We are priced below the oldest, least capable product in the market. There is significant headroom — roughly 40–68% before we reach parity with the market leader. The path to full-price positioning runs through SOC 2 Type II certification and three to five live reference banks. Both are achievable within 12 months.

---

## Where We Are Priced Today

Our current annual subscription:

| MDI Asset Size | Econofi |
|---|---|
| Under $200M | $25,000 |
| ~$300M | $37,500 |
| ~$400M | $50,000 |
| ~$500M | $62,500 |

For context, the competitive landscape:

| Vendor | Community Bank Pricing | Product |
|---|---|---|
| Verafin (Nasdaq) | $40,000–$80,000/yr | Market leader — rule-based, legacy architecture, strong examiner familiarity |
| Alessa | $30,000–$60,000/yr | Mid-tier, limited AI capability |
| Patriot Officer | $25,000–$50,000/yr | Oldest product in the space, on-prem, largely unchanged for a decade |
| **Econofi** | **$25,000–$62,500/yr** | AI-native, cloud-only, MDI-focused |

We are priced at or below Patriot Officer. That is not a sustainable position for a product that is demonstrably more capable.

---

## Why Legacy Vendors Command a Premium

It is not the product. Verafin's detection logic is rule-based and has not fundamentally changed in years. The premium comes from three things:

**1. Examiner familiarity.** BSA examiners at the OCC, FDIC, and Federal Reserve have reviewed Verafin alert reports hundreds of times. They recognize the format and trust the output without asking questions. An unfamiliar vendor's reports create friction — the BSA Officer has to explain and defend the tool during an exam, on top of defending the findings.

**2. Vendor stability.** Bank procurement and boards ask one question about any new compliance vendor: "Will they be here in three years?" Nasdaq-backed Verafin has a clear answer. A new entrant without SOC 2 certification or a reference base does not — yet.

**3. Procurement momentum.** IT and legal teams at community banks reuse approved vendor templates. A known vendor gets approved in 30 days. A new vendor requires a full security review and takes 90–120 days. This is not a product problem — it is a process problem that SOC 2 solves.

None of these are product advantages. All three are solvable.

---

## The Three-Phase Pricing Roadmap

### Phase 1 — Pilot Period (Now, Pre-SOC 2)

**Objective**: Close the first three to five MDI pilot banks. Establish reference relationships. Survive the first exam cycle at each bank.

**Appropriate discount**: 25–30% below Verafin. This is honest — we are carrying real vendor risk for the bank and the discount compensates for it.

| Asset Size | Verafin midpoint | Recommended ceiling | Current price | Headroom available now |
|---|---|---|---|---|
| $200M | $48,500 | $35,000 | $25,000 | +$10,000 |
| $300M | $62,500 | $45,000 | $37,500 | +$7,500 |
| $400M | $76,500 | $55,000 | $50,000 | +$5,000 |
| $500M | $86,500 | $65,000 | $62,500 | +$2,500 |

We can raise prices immediately without losing the pilot opportunity. We are currently leaving $2,500–$10,000 per bank on the table relative to what procurement will accept today.

**Pilot terms**: Implementation fee waived for the first three banks. Named as "pilot pricing" explicitly. The waiver is a closing tool, not a concession — frame it that way.

---

### Phase 2 — Market Parity (Post-SOC 2, 3–10 Live Banks)

**Objective**: Retire the vendor risk discount. Price at Verafin parity with a modest growth discount maintained for competitive positioning.

**Trigger**: SOC 2 Type II certification complete. Three or more banks have passed at least one regulatory exam cycle using Econofi.

| Asset Size | Phase 2 target | vs. Phase 1 ceiling | vs. current |
|---|---|---|---|
| $200M | $42,000 | +20% | +68% |
| $300M | $55,000 | +22% | +47% |
| $400M | $67,500 | +23% | +35% |
| $500M | $77,500 | +19% | +24% |

SOC 2 is not a feature milestone. It is the pricing milestone. The product does not change — the procurement risk does.

---

### Phase 3 — MDI Specialist Premium (10+ Banks, Established Market Position)

**Objective**: Command a premium over Verafin on the basis of MDI specialization.

Verafin is a commercial bank product adapted for smaller institutions. It was not designed for the specific transaction patterns, customer demographics, or regulatory relationships of Minority Depository Institutions. Econofi was.

Once BSA examiners have seen Econofi output at multiple banks, and once MDI trade associations (NCIF, NBA, NAOBA) know the product by name, the examiner familiarity advantage inverts. We become the known quantity.

| Asset Size | Phase 3 target | vs. Verafin midpoint |
|---|---|---|
| $200M | $52,500 | +8% premium |
| $300M | $67,500 | +8% premium |
| $400M | $82,500 | +8% premium |
| $500M | $92,500 | +7% premium |

---

## Unit Economics — Why This Works

Direct cost to serve one bank for one year:

| Component | Annual cost |
|---|---|
| AI (Claude API) | ~$1 |
| Infrastructure | ~$50–75 |
| **Total direct COGS** | **~$75** |

The AI cost is not a typo. Our architecture sends only a pattern summary to the model — not the full transaction set. A nightly batch of 50,000 transactions costs less than a penny in API fees. This is a structural advantage over any rule-based system with server-side compute costs.

**Gross margin at Phase 1 pricing:**

| Asset Size | ACV | COGS | Gross Margin |
|---|---|---|---|
| $200M | $35,000 | $75 | 99.8% |
| $300M | $45,000 | $75 | 99.8% |
| $400M | $55,000 | $75 | 99.9% |
| $500M | $65,000 | $75 | 99.9% |

**At 10 banks, the fully-loaded model (including engineering, SOC 2 overhead, and customer success) reaches breakeven at the $200M tier and is profitable across all tiers above it. From bank 11 onward, each new bank adds near-zero marginal cost.**

---

## The Renewal Moat

The name recognition gap matters in year one. It is nearly irrelevant at renewal.

A BSA Officer who has used Econofi for 12 months — who has passed an exam with our alert reports and filed SARs using our narrative drafts — will not move to Verafin. The switching cost at renewal runs in our favor:

- Retraining the BSA Officer on a new system
- Re-mapping the core export to a new format
- Losing 12 months of alert history and baseline context
- Explaining the vendor change to the next examiner

**Churn in compliance software is low industry-wide.** We can price aggressively to acquire and hold price at renewal. The pilot pricing decision matters far less than getting through the first exam cycle.

---

## What We Are Asking For

The pilot banks should be closed at Phase 1 ceiling pricing — $35,000–$65,000 by tier — not at current pricing. We are leaving money on the table today that does not improve our competitive position.

SOC 2 Type II should be treated as the single highest-leverage business investment on the roadmap. It is the unlock for Phase 2 pricing across every bank we sign.

The MDI specialist position — Phase 3 — is a 2–3 year story, but the groundwork is laid now by how we build the product, how we talk about it, and which trade relationships we invest in.

The market is $40,000–$80,000 per bank per year for an aging product with no AI capability and no MDI focus. We have a better product. The pricing should reflect that within 12 months.
