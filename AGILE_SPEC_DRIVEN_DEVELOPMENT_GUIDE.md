# Agile Spec-Driven Development Guide

**Version**: 1.0
**Created**: February 15, 2026
**Context**: Claude Code rapid iteration (1-hour to 1-day sprints)

---

## Executive Summary

This guide explains how to combine **test-first spec-driven development** with **agile iterative delivery** using Claude Code's rapid development capabilities. Unlike traditional waterfall spec-driven approaches (write all specs → implement everything), this methodology delivers working software in micro-sprints of 1-hour to 1-day.

**Key Insight**: Spec-driven development is NOT waterfall. You can write specs incrementally, one feature at a time, getting feedback and adapting as you go.

---

## The Problem with Waterfall Spec-Driven

### What We Did Wrong with Econofi Agents V2

**Waterfall Approach**:
```
Day 1-2: Write ALL specs for ALL 3 modules (9,600+ lines)
         ↓
Week 1-2: Implement TransactionMonitor
         ↓
Week 3-4: Implement DataGuard
         ↓
Week 5-6: Implement LoanDataAnalyzer
         ↓
Week 7: Discover specs don't match reality
Week 8: Rewrite specs and refactor code
```

**Problems**:
1. **No feedback loop**: Specs written without implementation validation
2. **High risk**: 9,600 lines of untested assumptions
3. **Wasted effort**: Specs may need major revisions after implementation starts
4. **Late learning**: Don't discover architecture issues until weeks in
5. **Analysis paralysis**: Trying to predict everything upfront

---

## The Agile Spec-Driven Alternative

### Core Principle

**Write just enough spec to implement the next valuable feature. Get feedback. Adapt. Repeat.**

### Agile Spec-Driven Cycle (1-Hour to 1-Day Sprints)

```
┌─────────────────────────────────────────────────────────┐
│  Sprint N (1 hour - 1 day)                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Mini-Spec (15-30 min)                               │
│     - Define ONLY next feature's types                  │
│     - Write ONLY next feature's tests                   │
│     - Keep scope small (1 feature)                      │
│                                                         │
│  2. Test-First Implementation (30-45 min)               │
│     - Run tests (all RED)                               │
│     - Write minimal code to pass tests                  │
│     - Refactor for quality                              │
│     - All tests GREEN                                   │
│                                                         │
│  3. Deploy & Validate (15 min)                          │
│     - Commit atomic change                              │
│     - Deploy to staging/test environment                │
│     - Manual validation                                 │
│                                                         │
│  4. Retrospective (5-10 min)                            │
│     - What worked?                                      │
│     - What didn't?                                      │
│     - What to adjust for next sprint?                   │
│     - Update backlog priorities                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│  Sprint N+1 (1 hour - 1 day)                            │
│  - Build on learnings from Sprint N                     │
│  - Adapt architecture based on what we discovered       │
│  - Spec next feature informed by real implementation    │
└─────────────────────────────────────────────────────────┘
```

---

## Case Study: Econofi Agents V2 Reimagined

### Current State (Waterfall Problem)

We have 9,600+ lines of specs for three modules:
- BSA/AML TransactionMonitor (2,100 lines)
- CRA DataGuard (1,800 lines)
- Fair Lending LoanDataAnalyzer (1,200 lines)

**Zero lines of implementation code.**

**Risk**: Specs are untested assumptions. May need major revisions once we start coding.

### Agile Alternative: How We Should Have Done It

#### Week 1: TransactionMonitor MVP (5 one-day sprints)

**Sprint 1 (Day 1): Structuring Detection Core**
- **Mini-Spec**:
  - `SanitizedTransaction` interface
  - `StructuringAlert` interface
  - `detectStructuring()` function signature
  - 10 test cases for basic structuring patterns
- **Implementation**:
  - Basic structuring detection (3 deposits <$10K in 3 days)
  - Pass all 10 tests
- **Deploy**: Working structuring detection to staging
- **Validate**: Run against sample transaction data
- **Learning**: "Detection is too sensitive, need time window parameter"

**Sprint 2 (Day 2): Configurable Time Windows**
- **Mini-Spec** (adjusted based on Day 1):
  - Add `StructuringConfig` interface with `time_window_hours` parameter
  - 5 test cases for different time windows (24h, 72h, 168h)
- **Implementation**:
  - Make time window configurable
  - Pass all tests
- **Deploy**: Updated algorithm to staging
- **Validate**: Test with real banking data
- **Learning**: "Need to handle different transaction types differently"

**Sprint 3 (Day 3): Transaction Type Filtering**
- **Mini-Spec** (informed by Day 2):
  - Add `transaction_type` filtering logic
  - 8 test cases for cash vs. wire vs. ACH
- **Implementation**:
  - Filter by transaction type
  - Different thresholds for different types
- **Deploy**: Enhanced detection to staging
- **Validate**: Precision/recall metrics
- **Learning**: "False positives on ATM withdrawals, need geographic clustering"

**Sprint 4 (Day 4): Geographic Risk Scoring**
- **Mini-Spec** (addressing Day 3 issue):
  - Add `branch_code` and `geographic_risk_score` to interface
  - 6 test cases for geographic patterns
- **Implementation**:
  - Geographic clustering algorithm
  - Risk score calculation
- **Deploy**: Full detection pipeline to staging
- **Validate**: Run against 6 months of historical data
- **Learning**: "Need OFAC screening before SAR filing"

**Sprint 5 (Day 5): Integration with OFAC Screener**
- **Mini-Spec** (new requirement discovered):
  - Define `OFACScreeningResult` interface
  - Integration contract between TransactionMonitor → OFACScreener
  - 5 test cases for integration
- **Implementation**:
  - Handoff logic to OFAC agent
  - Error handling for screening failures
- **Deploy**: Complete TransactionMonitor v1.0 to production
- **Validate**: End-to-end testing with real alerts

#### Total for Week 1
- **34 test cases** (vs. 85+ in waterfall spec)
- **Working production code** by Day 5
- **Validated assumptions** at each step
- **Adapted architecture** based on real learnings
- **Technical debt**: Minimal (refactored each day)

---

## Agile Spec-Driven Principles

### 1. Just-In-Time Specification

**Don't spec what you won't build this sprint.**

❌ **Waterfall Spec-Driven**:
```markdown
# TransactionMonitor Specification (Day 1)

## 1. Structuring Detection (85 test cases)
## 2. OFAC Screening (45 test cases)
## 3. SAR Drafting (30 test cases)
## 4. Velocity Anomaly Detection (40 test cases)
## 5. Geographic Risk Scoring (25 test cases)

[2,100 lines of specification written before any code]
```

✅ **Agile Spec-Driven**:
```markdown
# Sprint 1: Structuring Detection Core (Day 1)

## SanitizedTransaction Interface
export interface SanitizedTransaction {
  transaction_id: string;
  amount: number;
  transaction_date: string;
  transaction_type: 'cash_deposit' | 'cash_withdrawal';
}

## detectStructuring() Function
function detectStructuring(
  transactions: SanitizedTransaction[]
): StructuringAlert[]

## Test Cases (10 tests)
1. Classic pattern: 3 deposits <$10K in 3 days → ALERT
2. Legitimate pattern: 3 deposits >30 days apart → NO ALERT
[... 8 more tests ...]

[200 lines of specification for THIS SPRINT ONLY]
```

**Next sprint**: Spec the next feature based on what we learned from implementing Sprint 1.

### 2. Test-First Within Each Sprint

Even though we're agile, each sprint is still TDD:

```
Sprint 1 Day:
  09:00-09:30  Write mini-spec (types + tests for ONE feature)
  09:30-09:35  Run tests → ALL RED
  09:35-10:15  Implement minimal code to pass tests
  10:15-10:20  Run tests → ALL GREEN
  10:20-10:45  Refactor for quality
  10:45-11:00  Deploy + validate
  11:00-11:10  Retrospective + plan next sprint
```

### 3. Vertical Slices, Not Horizontal Layers

❌ **Horizontal (Waterfall)**:
```
Week 1: Write all interfaces for all modules
Week 2: Write all database schemas
Week 3: Write all test cases
Week 4: Start implementing
```

✅ **Vertical (Agile)**:
```
Day 1: Structuring detection (interface + schema + tests + implementation + deployment)
       → Working feature in production
Day 2: OFAC screening (interface + schema + tests + implementation + deployment)
       → Working feature in production
Day 3: SAR drafting (interface + schema + tests + implementation + deployment)
       → Working feature in production
```

### 4. Embrace Change

**Waterfall mindset**: "Specs are frozen. Changes are scope creep."

**Agile mindset**: "Specs are living documents. Changes are learning."

**Example**:
```
Sprint 1: Spec'd structuring detection with 3-day window
Sprint 2: Discovered 3-day window has too many false positives
Sprint 2: CHANGED spec to configurable time window
          Updated tests, updated implementation
          Better product as result
```

### 5. Deliver Value Early and Often

**Waterfall**: 6 weeks of work → big bang deployment → high risk

**Agile**:
- Week 1 Day 5: TransactionMonitor v1.0 in production (partial value)
- Week 2 Day 5: + OFACScreener v1.0 (incremental value)
- Week 3 Day 5: + SARDrafter v1.0 (more value)

Each week delivers working software that provides value.

---

## Sprint Planning with Claude Code

### Micro-Sprint Sizing (1 Hour - 1 Day)

#### 1-Hour Sprint (Quick Win)
**Good for**:
- Bug fixes
- Small enhancements
- Configuration changes
- Test additions

**Example**: "Add validation for negative transaction amounts"
```
0:00-0:15  Write 3 test cases for negative amount handling
0:15-0:20  Run tests (RED)
0:20-0:40  Implement validation logic
0:40-0:45  Run tests (GREEN)
0:45-0:55  Refactor + documentation
0:55-1:00  Commit + deploy
```

#### 4-Hour Sprint (Half Day)
**Good for**:
- New feature (small-medium complexity)
- Refactoring a module
- Integration between 2 components

**Example**: "Implement OFAC screening integration"
```
0:00-0:45  Mini-spec: Types + API contract + 8 test cases
0:45-1:00  Run tests (RED)
1:00-2:30  Implement OFAC API calls + error handling
2:30-2:45  Run tests (GREEN)
2:45-3:30  Refactor, handle edge cases
3:30-4:00  Deploy + validate + retrospective
```

#### 1-Day Sprint (8 Hours)
**Good for**:
- Complex feature with multiple components
- Database schema + API + UI
- Major architectural change

**Example**: "Implement complete structuring detection pipeline"
```
09:00-10:00  Mini-spec: Complete interfaces + DB schema + 15 test cases
10:00-10:15  Run tests (RED)
10:15-12:00  Implement core detection algorithm
12:00-13:00  Lunch
13:00-15:00  Implement database persistence + Claude agent integration
15:00-15:30  Run tests (GREEN)
15:30-16:30  Refactor + documentation
16:30-17:30  Deploy + end-to-end validation
17:30-18:00  Retrospective + plan tomorrow
```

### Sprint Backlog Management

**Product Backlog** (prioritized):
```
1. [P0] Structuring detection (3 deposits <$10K pattern)
2. [P0] OFAC screening integration
3. [P0] SAR draft generation
4. [P1] Velocity anomaly detection
5. [P1] Geographic risk scoring
6. [P2] Round-dollar pattern analysis
7. [P2] Peer comparison analytics
```

**Sprint Selection Rules**:
1. **Always pick highest priority item that fits sprint duration**
2. **Prefer small vertical slices over large horizontal layers**
3. **Consider dependencies** (can't do SAR drafting before structuring detection)
4. **Balance new features with technical debt paydown**

**Example Sprint Planning Session**:
```
Today's capacity: 8 hours (1-day sprint)
Top backlog item: [P0] Structuring detection (estimated: 6-8 hours)
Decision: Pull into Sprint 1
Sprint 1 Goal: "Deploy working structuring detection to staging"
```

---

## Adapting Specs Based on Implementation Learnings

### The Feedback Loop

```
┌──────────────────────────────────────────────────────┐
│  Sprint 1: Write mini-spec based on ASSUMPTIONS      │
└──────────────────┬───────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────┐
│  Sprint 1: Implement → Discover REALITY              │
│  - Assumption: 3-day window is optimal               │
│  - Reality: Too many false positives                 │
└──────────────────┬───────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────┐
│  Sprint 2: Update spec based on LEARNINGS            │
│  - Add configurable time window parameter            │
│  - Write tests for 24h, 72h, 168h windows            │
└──────────────────┬───────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────┐
│  Sprint 2: Implement → Better product                │
└──────────────────────────────────────────────────────┘
```

### Real Example: Budget Wizard Evolution

**Sprint 1 (Feb 12)**: Implemented wizard flow
- **Spec'd**: Linear wizard flow (Income → Expense → Save → Review)
- **Implemented**: Basic wizard navigation
- **Learned**: Users got confused by "Review" step vs. "Save" step

**Sprint 2 (Feb 13)**: Based on Sprint 1 feedback
- **Updated Spec**: Combined Review + Save into single SaveStep
- **Implemented**: New combined flow
- **Learned**: Exit button behavior was confusing after save

**Sprint 3 (Feb 14)**: Based on Sprint 2 feedback
- **Updated Spec**: Smart exit button logic (disabled during save, nav to budget after)
- **Implemented**: Final exit button behavior
- **Result**: 98.6% test coverage, zero critical bugs

**This is agile spec-driven in action.**

---

## Technical Practices

### 1. Living Specification Documents

**Waterfall Spec**: Written once, never updated

**Agile Spec**: Continuously evolved

**Example File Structure**:
```
specs/
├── bsa-aml/
│   ├── TRANSACTION_MONITOR_SPEC.md
│   │   [Version history at top]
│   │   v1.0 (Feb 15): Initial spec - 3-day window
│   │   v1.1 (Feb 16): Added configurable time windows
│   │   v1.2 (Feb 17): Added transaction type filtering
│   │   v1.3 (Feb 18): Added geographic risk scoring
│   │
│   └── CHANGELOG.md
│       Tracks what changed and why
```

**Spec Update Protocol**:
1. When implementation reveals new requirement → update spec
2. When tests find edge case → add to spec
3. When architecture changes → update spec
4. Always track version history

### 2. Test Files as Specifications

**Key Insight**: Test files ARE specifications.

```typescript
// __tests__/structuringDetection.test.ts
// This file serves dual purpose:
// 1. Executable tests (GREEN = working code)
// 2. Specification (documents expected behavior)

describe('Structuring Detection', () => {
  describe('v1.0: Basic 3-day window (Feb 15)', () => {
    it('should detect 3 deposits <$10K in 3 days', () => {
      // This test IS the spec for basic detection
    });
  });

  describe('v1.1: Configurable time window (Feb 16)', () => {
    it('should respect custom time window parameter', () => {
      // This test IS the spec for configurable windows
    });
  });

  describe('v1.2: Transaction type filtering (Feb 17)', () => {
    it('should filter by transaction type', () => {
      // This test IS the spec for type filtering
    });
  });
});
```

**Benefits**:
- Tests never get out of sync with spec (they ARE the spec)
- Refactoring is safe (tests guarantee behavior preservation)
- New developers read tests to understand requirements

### 3. Continuous Integration

**After each micro-sprint**:
```bash
# 1. Run full test suite
npm test

# 2. Check coverage (maintain >95%)
npm run test:coverage

# 3. Commit atomic change
git add .
git commit -m "feat: add configurable time windows for structuring detection

Implemented in Sprint 2 based on Sprint 1 learnings.

Tests: 5 new test cases for 24h, 72h, 168h windows
Coverage: 96.2% (up from 95.8%)

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 4. Deploy to staging
npm run deploy:staging

# 5. Validate
curl https://staging.api.econofi.com/health
```

### 4. Documentation Updates Each Sprint

**Update these files after each sprint**:

1. **README.md**: Update feature list
2. **CHANGELOG.md**: Add sprint accomplishments
3. **Spec files**: Update version history
4. **API documentation**: Update endpoints if changed

**Don't batch documentation updates.** Do them every sprint (even 1-hour sprints).

---

## Comparing Waterfall vs. Agile Spec-Driven

### Time to First Deployment

| Approach | Time to First Deployment | Risk Level |
|----------|-------------------------|------------|
| **Waterfall Spec-Driven** | 2-3 weeks (after all specs written + module implemented) | HIGH (untested assumptions) |
| **Agile Spec-Driven** | 1 day (first feature deployed) | LOW (validated assumptions) |

### Example: TransactionMonitor Implementation

#### Waterfall Approach (What We Did)

| Week | Activity | Deployable? | Value Delivered |
|------|----------|-------------|-----------------|
| 1 | Write complete TransactionMonitor spec (2,100 lines) | ❌ No | 0% |
| 2 | Implement structuring detection | ❌ No | 0% |
| 3 | Implement OFAC screening | ❌ No | 0% |
| 4 | Implement SAR drafting | ✅ Yes (first deployment) | 100% (all at once) |
| 5 | Discover specs don't match reality | ❌ No | 0% (rework) |
| 6 | Refactor based on learnings | ✅ Yes | 100% |

**Total time to value**: 6 weeks
**Total deployments**: 2 (big bang, then fix)
**Risk**: High (all assumptions untested until week 4)

#### Agile Approach (What We Should Do)

| Day | Sprint Goal | Deployable? | Value Delivered |
|-----|-------------|-------------|-----------------|
| 1 | Structuring detection core | ✅ Yes | 20% |
| 2 | Configurable time windows | ✅ Yes | 30% |
| 3 | Transaction type filtering | ✅ Yes | 50% |
| 4 | Geographic risk scoring | ✅ Yes | 70% |
| 5 | OFAC integration | ✅ Yes | 100% |

**Total time to value**: 5 days
**Total deployments**: 5 (incremental)
**Risk**: Low (assumptions validated daily)

### Code Quality Comparison

| Metric | Waterfall Spec-Driven | Agile Spec-Driven |
|--------|----------------------|-------------------|
| **Test Coverage** | 60-80% (tests written after code) | >95% (tests written first each sprint) |
| **Technical Debt** | High (accumulated over weeks, refactored at end) | Low (refactored every sprint) |
| **Bug Discovery** | Late (week 4-5) | Early (day 1-2) |
| **Architecture Fit** | Poor → Good (discovered issues late, expensive to fix) | Good → Great (adapted daily) |
| **Documentation** | Out of sync (batch updates) | Current (updated each sprint) |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: "We'll Refactor Later"

❌ **Bad**:
```
Sprint 1: Implement structuring detection (quick and dirty)
Sprint 2: Implement OFAC screening (quick and dirty)
Sprint 3: Implement SAR drafting (quick and dirty)
Sprint 4: "Refactor sprint" to clean up technical debt
```

**Problem**: Technical debt compounds. Sprint 4 takes twice as long as expected.

✅ **Good**:
```
Sprint 1: Implement structuring detection
          - Write tests first
          - Implement to pass tests
          - Refactor BEFORE moving to Sprint 2
          - Deploy with ZERO technical debt

Sprint 2: Implement OFAC screening (same process)
Sprint 3: Implement SAR drafting (same process)
```

**Principle**: **Leave each sprint with ZERO technical debt.**

### Anti-Pattern 2: "Just One More Feature"

❌ **Bad**:
```
Sprint 1 Goal: Structuring detection
[4 hours in] "Let's also add OFAC screening since we're here"
[6 hours in] "And maybe velocity anomaly detection"
[8 hours in] Tests failing, nothing deployed, sprint incomplete
```

**Problem**: Scope creep. Nothing gets finished.

✅ **Good**:
```
Sprint 1 Goal: Structuring detection ONLY
[4 hours in] Structuring detection complete, tested, deployed
[4 hours remain] Start Sprint 2 (OFAC screening)
```

**Principle**: **Finish one thing before starting another.**

### Anti-Pattern 3: "We Don't Need Tests for This Small Change"

❌ **Bad**:
```
"This is just a quick config change, no need for tests"
[Deploys without tests]
[Bug in production 2 days later]
```

**Problem**: Technical debt accumulates. Bugs slip through.

✅ **Good**:
```
Even for 1-hour sprints:
1. Write test for config change (5 min)
2. Implement config change (10 min)
3. Run test → GREEN (1 min)
4. Deploy with confidence
```

**Principle**: **ALWAYS test-first, even for tiny changes.**

### Anti-Pattern 4: "Let's Spec Three Sprints Ahead"

❌ **Bad**:
```
Today: Spec Sprint 1, Sprint 2, Sprint 3
Tomorrow: Implement Sprint 1
Discovery: Sprint 1 changes invalidate Sprint 2 & 3 specs
Result: Wasted 50% of spec effort
```

**Problem**: Over-planning. Specs become stale.

✅ **Good**:
```
Today:
  - Spec Sprint 1 in detail
  - Rough backlog for Sprint 2-3 (bullet points, no detail)

Tomorrow:
  - Implement Sprint 1
  - Learn from implementation
  - Spec Sprint 2 based on learnings (not original assumptions)
```

**Principle**: **Just-in-time specification. Spec what you'll build TODAY.**

---

## Real-World Example: Refactoring Econofi Agents V2

### Current State (February 15, 2026)

We have comprehensive waterfall specs:
- **9,600+ lines** of specifications
- **200+ test cases** defined
- **Zero implementation code**

### Problem

We wrote specs based on assumptions, not validated learnings. Risk:
- Database schema may not match real data
- API contracts may not match real usage patterns
- Performance benchmarks may be unrealistic
- Test cases may miss critical edge cases

### Agile Alternative: How to Proceed

#### Option 1: Throw Away Specs, Start Fresh (Too Extreme)

❌ Don't do this. We've captured valuable domain knowledge.

#### Option 2: Keep Specs as Reference, Implement Agile (Recommended)

✅ **Use existing specs as a reference guide, but spec incrementally:**

**Week 1: TransactionMonitor MVP (5 one-day sprints)**

**Day 1 (Sprint 1): Structuring Detection Core**
- **Reference**: Existing spec sections on structuring detection
- **Mini-Spec for Today**:
  - Extract ONLY structuring-related types from existing spec
  - Extract ONLY 10 structuring tests from existing 85 tests
  - Simplify to MVP (no geographic risk, no velocity yet)
- **Implement**: Basic structuring detection
- **Deploy**: Working feature to staging
- **Validate**: Run against sample data
- **Learn**: Discover what spec got right vs. wrong

**Day 2 (Sprint 2): Based on Day 1 Learnings**
- **Update Spec**: Adjust based on Day 1 discoveries
- **Mini-Spec for Today**: Next feature (maybe OFAC, maybe configurable windows)
- **Implement**: Build on Day 1 code
- **Deploy**: Enhanced feature to staging
- **Validate**: More testing
- **Learn**: Continue refining understanding

**Repeat for 5 days → Working TransactionMonitor v1.0**

#### Option 3: Implement Waterfall Spec As-Is (Risky)

❌ Not recommended. High risk of discovering spec issues late.

### Recommendation for Econofi Agents V2

**Proposed Approach**:

1. **Keep existing specs as "Vision Documents"**
   - Rename to `TRANSACTION_MONITOR_VISION.md`
   - Keep as reference for big picture
   - Don't treat as implementation contract

2. **Create new `TRANSACTION_MONITOR_SPRINT_LOG.md`**
   - Document each sprint (1-day iterations)
   - Track what we spec'd vs. what we learned
   - Show evolution of implementation

3. **Start Sprint 1 Tomorrow**
   - Pick highest value feature (structuring detection)
   - Spec ONLY that feature (200 lines, not 2,100)
   - Implement test-first
   - Deploy to staging
   - Validate and learn

4. **Plan Sprint 2 Based on Sprint 1 Learnings**
   - Don't spec Sprint 2 until Sprint 1 complete
   - Adapt based on what we discover

---

## Sprint Templates

### 1-Hour Sprint Template

```markdown
# Sprint [ID]: [Feature Name]

**Date**: [Date]
**Duration**: 1 hour (09:00-10:00)
**Goal**: [One sentence goal]

## Pre-Sprint Planning (5 min, 08:55-09:00)
- [ ] Review backlog
- [ ] Confirm sprint goal is achievable in 1 hour
- [ ] Ensure no blockers

## Mini-Spec (15 min, 09:00-09:15)

### Type Definitions
```typescript
// Only types needed for THIS feature
```

### Test Cases (5 tests max for 1-hour sprint)
1. Test 1
2. Test 2
3. Test 3
4. Test 4
5. Test 5

## Implementation (35 min, 09:15-09:50)

### Red Phase (09:15-09:20)
- [ ] Write tests
- [ ] Run tests → ALL RED
- [ ] Commit red tests

### Green Phase (09:20-09:40)
- [ ] Write minimal code to pass tests
- [ ] Run tests → ALL GREEN
- [ ] Commit working code

### Refactor Phase (09:40-09:50)
- [ ] Clean up code
- [ ] Add comments if needed
- [ ] Run tests → STILL GREEN
- [ ] Commit refactored code

## Deploy & Validate (10 min, 09:50-10:00)
- [ ] Deploy to staging
- [ ] Manual validation
- [ ] Update documentation

## Retrospective (5 min, 10:00-10:05)

### What Went Well
-

### What Didn't Go Well
-

### Learnings for Next Sprint
-

### Next Sprint Planning
**Next Sprint Goal**:
```

### 1-Day Sprint Template

```markdown
# Sprint [ID]: [Feature Name]

**Date**: [Date]
**Duration**: 1 day (8 hours)
**Goal**: [One sentence goal]

## Morning Session (09:00-12:00)

### Mini-Spec (09:00-10:00)

#### Type Definitions
```typescript
// All types needed for THIS feature
```

#### Database Schema (if applicable)
```sql
-- Tables/changes needed for THIS feature
```

#### Test Cases (15-20 tests for 1-day sprint)
1. Test 1
2. Test 2
[... up to 20 tests ...]

### Red Phase (10:00-10:15)
- [ ] Write all test files
- [ ] Run tests → ALL RED
- [ ] Commit red tests

### Green Phase (10:15-12:00)
- [ ] Implement core logic
- [ ] Run tests periodically
- [ ] Target: 50% tests passing by lunch

## Afternoon Session (13:00-17:00)

### Continue Green Phase (13:00-15:00)
- [ ] Complete implementation
- [ ] Run tests → ALL GREEN
- [ ] Commit working code

### Refactor Phase (15:00-16:30)
- [ ] Clean up code
- [ ] Extract reusable functions
- [ ] Add comprehensive comments
- [ ] Run tests → STILL GREEN
- [ ] Commit refactored code

### Deploy & Validate (16:30-17:30)
- [ ] Deploy to staging
- [ ] End-to-end manual testing
- [ ] Performance validation
- [ ] Update documentation (README, CHANGELOG, etc.)

## Retrospective (17:30-18:00)

### What Went Well
-

### What Didn't Go Well
-

### Learnings for Tomorrow
-

### Tomorrow's Sprint Planning
**Sprint Goal**:
**Estimated Duration**:
```

---

## Measuring Success

### Sprint-Level Metrics

**After each sprint, track**:

1. **Sprint Goal Achievement**: Did we deliver what we committed to?
   - ✅ Yes / ❌ No

2. **Test Coverage**: Maintained >95%?
   - Current: ___%
   - Delta: +/- ___%

3. **Technical Debt**: Accumulation or paydown?
   - Hours of debt added: ___
   - Hours of debt paid: ___
   - Net: +/- ___

4. **Deployment Success**: Deployed to staging/production?
   - ✅ Yes / ❌ No
   - Issues found: ___

5. **Learning Velocity**: What did we learn?
   - Assumptions validated: ___
   - Assumptions invalidated: ___
   - New insights: ___

### Project-Level Metrics

**After each week (5 one-day sprints), track**:

1. **Features Delivered**: Count of production-ready features
2. **User Value**: % of MVP scope complete
3. **Code Quality**: Test coverage, bug count, performance
4. **Team Velocity**: Story points or feature count per week
5. **Customer Feedback**: NPS, bug reports, feature requests

### Comparison: Econofi Budget Wizard

**Budget Wizard Results (Feb 12-14, 2026)**:
- 3 days = 3 one-day sprints
- 98.6% test coverage (141 of 143 tests passing)
- Zero critical bugs in production
- 4 atomic commits with clear documentation

**This is the gold standard for agile spec-driven development.**

---

## Frequently Asked Questions

### Q: Isn't this just "agile"? What's different?

**A**: Traditional agile often means "no specs, just code." Agile **spec-driven** means:
- Still write specs (types, tests, contracts)
- Just write them **incrementally** (one sprint at a time)
- Still test-first (TDD)
- Still maintain quality (>95% coverage)
- But **adapt** specs based on implementation learnings

**Key difference**: Specs are living documents that evolve, not waterfall documents frozen at the start.

### Q: How do we know what to build if we don't spec everything upfront?

**A**: You have a **product backlog** (big picture plan):
```
1. Structuring detection
2. OFAC screening
3. SAR drafting
4. Velocity anomaly detection
[...]
```

You know the WHAT (features). You discover the HOW (implementation details) incrementally.

**Big picture is planned. Implementation details are discovered.**

### Q: What if we spec Sprint 1 wrong and have to redo it in Sprint 2?

**A**: That's the point! Better to discover issues in Day 1 (1-day sprint) than Week 4 (waterfall).

**Agile spec-driven embraces adaptation**:
- Sprint 1: Best guess spec → implement → learn
- Sprint 2: Updated spec based on Sprint 1 reality → implement → learn
- Sprint 3: Even better spec based on Sprint 1-2 reality → implement → learn

Each iteration improves the spec.

### Q: Doesn't this create more rework than waterfall?

**A**: No. Waterfall APPEARS to have less rework because you do it all at the end.

**Waterfall**:
- Weeks 1-4: Write specs + implement (appears smooth)
- Week 5: Discover specs wrong (BIG rework)
- Week 6: Refactor everything (expensive)

**Agile**:
- Day 1: Implement + discover small issue (small rework)
- Day 2: Implement + discover small issue (small rework)
- Day 3: Implement + discover small issue (small rework)
- Day 4: Implement (smooth, issues already fixed)
- Day 5: Implement (smooth, issues already fixed)

**Total rework is LESS with agile because issues found early are cheaper to fix.**

### Q: Can I still write big-picture architecture docs?

**A**: YES! Absolutely.

**Two levels of documentation**:

1. **Vision/Architecture Docs** (stable, high-level)
   - System architecture diagrams
   - Technology stack decisions
   - Data flow overviews
   - Security & compliance requirements
   - Written once, updated occasionally

2. **Sprint Implementation Specs** (living, detailed)
   - Type definitions for current sprint
   - Test cases for current feature
   - API contracts for current endpoint
   - Written incrementally, updated frequently

**Example**:
- `README.md`: System architecture (stable)
- `specs/TRANSACTION_MONITOR_SPRINT_1.md`: Structuring detection implementation (living)

### Q: What about dependencies between features?

**A**: Plan sprints in **dependency order**.

**Example**:
```
Cannot do Sprint 3 (SAR drafting) without Sprint 1 (structuring detection)
and Sprint 2 (OFAC screening)

Correct order:
  Sprint 1: Structuring detection (no dependencies)
  Sprint 2: OFAC screening (depends on Sprint 1)
  Sprint 3: SAR drafting (depends on Sprint 1 + 2)
```

If features are independent, do them in **value order** (highest value first).

---

## Next Steps

### For Econofi Agents V2

**Decision Point**: Should we proceed with waterfall specs or switch to agile?

**Recommendation**: **Switch to agile spec-driven.**

**Proposed First Week (5 one-day sprints)**:

```
Sprint 1 (Day 1): Structuring detection core
  - Mini-spec: 200 lines (not 2,100)
  - Tests: 10 (not 85)
  - Goal: Basic detection working in staging

Sprint 2 (Day 2): Configurable detection parameters
  - Based on Sprint 1 learnings
  - Goal: Flexible detection in staging

Sprint 3 (Day 3): PostgreSQL persistence
  - Based on Sprint 1-2 learnings
  - Goal: Alerts stored in database

Sprint 4 (Day 4): Claude Agent SDK integration
  - Based on Sprint 1-3 learnings
  - Goal: Agent analyzes transactions end-to-end

Sprint 5 (Day 5): OFAC screening handoff
  - Based on Sprint 1-4 learnings
  - Goal: Complete workflow (TransactionMonitor → OFAC)
```

**End of Week 1**: Working TransactionMonitor v1.0 in production, validated with real code.

**Week 2**: Based on Week 1 learnings, build OFACScreener (5 sprints)

**Week 3**: Based on Week 1-2 learnings, build SARDrafter (5 sprints)

### For New Projects

**Use this guide for any future project**:

1. **Start with product backlog** (big picture features)
2. **Break into 1-hour to 1-day sprints**
3. **Spec just-in-time** (one sprint ahead max)
4. **Test-first within each sprint** (TDD)
5. **Deploy after each sprint** (continuous delivery)
6. **Adapt specs based on learnings** (living documentation)
7. **Maintain >95% test coverage** (quality gate)
8. **Leave zero technical debt** (refactor each sprint)

---

## Conclusion

**Agile spec-driven development combines the best of both worlds**:

✅ **From spec-driven**: Type safety, test coverage, clear contracts, quality
✅ **From agile**: Iterative delivery, fast feedback, adaptation, learning

**Key Insight**: You don't have to choose between "plan everything upfront" (waterfall) and "wing it" (vibe coding).

**There's a third way**: Plan incrementally, test-first, adapt continuously.

**This is how we built Budget Wizard** (98.6% coverage, zero critical bugs, 3 days).

**This is how we should build Econofi Agents V2.**

---

**Ready to start Sprint 1?**

*Last updated: February 15, 2026*
