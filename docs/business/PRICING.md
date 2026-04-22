# Econofi BSA/AML Pricing Model

**Audience**: Internal — sales, finance, founder
**Last updated**: April 2026

---

## Base Annual Subscription

Pricing tiers are determined by the bank's total assets as of the most recent call report filed with the FDIC prior to the contract or renewal date.

| MDI Asset Size | Annual Subscription |
|---|---|
| Under $200M | $25,000 |
| $300M | $37,500 |
| $400M | $50,000 |
| $500M | $62,500 |

---

## Fee Schedule

### One-Time Implementation Fee

| Asset Size | Implementation Fee |
|---|---|
| Under $200M | $10,000 |
| $300M | $10,000 |
| $400M | $12,500 |
| $500M | $15,000 |

Covers: SFTP provisioning, core export column mapping, test file validation, BSA Officer dashboard onboarding.

**Pilot pricing**: Implementation fee waived for first three MDI pilot banks. Frame explicitly at signing — "pilot pricing, implementation fee waived." Do not waive silently.

### Year 1 Total (standard)

| Asset Size | Annual Sub | Impl Fee | Year 1 Total |
|---|---|---|---|
| Under $200M | $25,000 | $10,000 | $35,000 |
| $300M | $37,500 | $10,000 | $47,500 |
| $400M | $50,000 | $12,500 | $62,500 |
| $500M | $62,500 | $15,000 | $77,500 |

---

## Contract Terms

### Annual Escalator

3% fixed annual increase applied at each renewal. No negotiation — state in the contract, not in the sales conversation.

### Multi-Year Discount

10% off the annual subscription for a 3-year commitment. Increases total contract value while giving the bank budget certainty. Bank procurement and boards respond well to multi-year stability.

| Asset Size | 1-yr ACV | 3-yr ACV (–10%) | 3-yr TCV |
|---|---|---|---|
| Under $200M | $25,000 | $22,500 | $67,500 |
| $300M | $37,500 | $33,750 | $101,250 |
| $400M | $50,000 | $45,000 | $135,000 |
| $500M | $62,500 | $56,250 | $168,750 |

### Asset Growth Ratchet

When a bank's total assets cross a tier threshold, the subscription steps up to the next tier at the next annual renewal. Clause language:

> "Annual subscription fee is determined by the bank's total assets as of the most recent call report filed with the FDIC prior to the renewal date."

State this clearly in the contract. Asset ratchets are standard and expected. Surprises at renewal cause cancellations.

### Minimum Term

1-year minimum. Push for 3-year. Banks prefer multi-year vendor commitments — examiners ask about vendor stability, and month-to-month signals startup risk.

---

## Competitive Position

| Vendor | Community Bank Pricing | Notes |
|---|---|---|
| Verafin (Nasdaq) | $40,000–$80,000/yr | Most common BSA/AML tool at MDI-sized banks |
| Alessa | $30,000–$60,000/yr | Lighter product, less AI |
| Patriot Officer | $25,000–$50,000/yr | Legacy, on-prem option |
| **Econofi** | **$25,000–$62,500/yr** | AI-native, cloud-only, MDI-focused |

A $200M MDI currently on Verafin is paying $40,000–$50,000/year. Econofi at $25,000 is a 40–50% reduction with a more capable product. Lead with value delivered, not cost comparison — but the cost comparison closes deals.

---

## Unit Economics

### Direct Cost to Serve (per bank, per year)

| Component | Annual Cost |
|---|---|
| Claude API (claude-sonnet-4-6) | ~$1 |
| Infrastructure (Supabase, compute, SFTP, S3) | ~$50–75 |
| **Total direct COGS** | **~$51–76** |

Claude API cost is driven by alert volume, not transaction volume. The agent sends only a pattern summary to Claude — not the full transaction set. A nightly batch of 50,000 transactions costs less than $0.01 in API fees.

### Gross Margin

| Asset Size | ACV | Direct COGS | Gross Margin |
|---|---|---|---|
| Under $200M | $25,000 | ~$75 | ~99.7% |
| $300M | $37,500 | ~$75 | ~99.8% |
| $400M | $50,000 | ~$75 | ~99.8% |
| $500M | $62,500 | ~$75 | ~99.9% |

### Overhead Allocation (shared across banks)

| Cost | Annual | Per-bank at 10 banks |
|---|---|---|
| Engineering | $150,000–$200,000 | $15,000–$20,000 |
| SOC 2 Type II (ongoing) | $10,000 | $1,000 |
| Customer success | $50,000 | $5,000 |
| Legal / compliance review | $15,000–$20,000 | $1,500–$2,000 |
| **Total overhead/bank** | | **~$22,500–$28,000** |

At 10 banks, the $200M tier ($25K ACV) is close to breakeven on a fully-loaded basis. Profitable from bank 11 onward with near-zero marginal cost.

At 5 pilot banks, overhead allocation exceeds revenue at the bottom tier. This is the pilot investment period — the goal is reference customers and SOC 2 completion, not profitability.

---

## Pricing Guardrails

**Do not offer:**
- Per-transaction pricing — community banks budget in fixed line items; variable cost models require CFO approval and create churn risk
- Per-alert fees — penalizes the bank for the product working correctly; implies low confidence in false positive rates
- Per-SAR fees — same problem
- Annual increases above 5% — anything above CPI + 2% requires board approval at most community banks
- Month-to-month terms — signals vendor instability to bank examiners

**Do not discount below:**
- $20,000 ACV at any tier — below this, the bank does not take the vendor relationship seriously and examiner credibility suffers
- Implementation fee below $5,000 — free implementation signals the product is not enterprise-grade

---

## Value Justification for Sales Conversations

A BSA Officer at a community bank costs $80,000–$120,000/year in salary plus benefits. Econofi reduces investigation time by 60–70% through automated alert triage, SAR narrative drafts, and prioritized queuing.

| Bank Size | BSA Officer Cost | Time Saved (65%) | Value Delivered | Econofi Price | ROI |
|---|---|---|---|---|---|
| $200M | $100,000 | $65,000 | $65,000 | $25,000 | 2.6x |
| $300M | $110,000 | $71,500 | $71,500 | $37,500 | 1.9x |
| $400M | $115,000 | $74,750 | $74,750 | $50,000 | 1.5x |
| $500M | $120,000 | $78,000 | $78,000 | $62,500 | 1.2x |

Lead with the $200M case — 2.6x ROI is the cleanest story. The $500M case is still a strong buy at 1.2x, but the conversation is more about risk reduction (FinCEN enforcement actions, exam findings) than labor savings.
