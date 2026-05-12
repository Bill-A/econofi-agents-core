/**
 * TransactionMonitor Agent
 *
 * BSA/AML suspicious transaction detection.
 * Model: claude-sonnet-4-6, temperature 0.0 (deterministic pattern detection)
 *
 * AGENT BOUNDARIES:
 * - Flags suspicious patterns — does NOT file SARs autonomously
 * - SAR filing requires human authorization per 31 CFR §1020.320
 * - Does not determine guilt or innocent intent
 * - Does not recommend prosecution or law enforcement referral
 * - Risk scores are decision-support tools, not determinations
 *
 * PII CONTRACT:
 * Input data must be pre-sanitized by the orchestrator before reaching this agent.
 * account_hash (SHA-256), customer_token ([PERSON_XXX]), counterparty_token ([BUSINESS_XXX]).
 * No raw PII ever enters this layer.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@lib/logger';
import {
  SanitizedTransaction,
  CustomerHistoricalContext,
  TransactionMonitorConfig,
  TransactionMonitorInput,
  TransactionMonitorOutput,
  SuspiciousActivityAlert,
  AlertType,
  AlertSeverity,
  RecommendedAction,
  ValidationError,
} from '../../types/bsa-aml';

// ---------------------------------------------------------------------------
// FATF risk classifications
// ---------------------------------------------------------------------------

const FATF_BLACKLIST_COUNTRIES = new Set(['IR', 'KP', 'MM']); // Iran, North Korea, Myanmar

const FATF_GREYLIST_COUNTRIES = new Set([
  'AE', 'TR', 'PH', 'PK', 'ZA', 'SS', 'SY', 'YE', 'TN', 'VU',
]);

const SHELL_COMPANY_JURISDICTIONS = new Set([
  'KY', // Cayman Islands
  'VG', // British Virgin Islands
  'PA', // Panama
  'LI', // Liechtenstein
  'MC', // Monaco
  'BZ', // Belize
]);

// ---------------------------------------------------------------------------
// Detection threshold constants (overridden by config at runtime)
// ---------------------------------------------------------------------------

const STRUCTURING_WINDOW_DAYS = 3;
const ROUND_DOLLAR_PRECISION = 0.01;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRoundDollar(amount: number): boolean {
  return Math.abs(amount - Math.round(amount)) < ROUND_DOLLAR_PRECISION;
}

function daysBetween(dateA: string, dateB: string): number {
  const msA = new Date(dateA).getTime();
  const msB = new Date(dateB).getTime();
  return Math.abs(msA - msB) / (1000 * 60 * 60 * 24);
}

function sameDayUTC(dateA: string, dateB: string): boolean {
  return dateA.substring(0, 10) === dateB.substring(0, 10);
}

function generateAlertId(): string {
  const now = new Date();
  const datePart = now.toISOString().substring(0, 10);
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `ALT-${datePart}-${seq}`;
}

function expiresAt(createdAt: string): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

function validateTransaction(tx: unknown): void {
  if (!tx || typeof tx !== 'object') {
    throw new ValidationError('Transaction must be an object', 'transaction', tx);
  }

  const t = tx as Partial<SanitizedTransaction>;

  if (typeof t.transaction_id !== 'string' || !t.transaction_id) {
    throw new ValidationError('transaction_id is required', 'transaction_id', t.transaction_id);
  }

  if (typeof t.account_hash !== 'string' || !t.account_hash.trim()) {
    throw new ValidationError('account_hash is required and must be non-empty', 'account_hash', t.account_hash);
  }

  if (typeof t.amount !== 'number' || isNaN(t.amount) || t.amount < 0) {
    throw new ValidationError('amount must be a non-negative number', 'amount', t.amount);
  }
}

// ---------------------------------------------------------------------------
// Internal pattern match type
// ---------------------------------------------------------------------------

interface PatternMatch {
  alert_type: AlertType;
  severity: AlertSeverity;
  risk_score: number;
  transactions_flagged: SanitizedTransaction[];
  suspicious_indicators: string[];
  regulatory_citation: string;
  recommended_action: RecommendedAction;
  confidence_score: number;
  false_positive_probability: number;
}

// ---------------------------------------------------------------------------
// Pattern detectors
// ---------------------------------------------------------------------------

function detectStructuring(
  transactions: SanitizedTransaction[],
  thresholdUsd: number
): PatternMatch[] {
  const alerts: PatternMatch[] = [];
  const proximityMin = thresholdUsd * 0.85; // within 15% of threshold

  const byAccount = new Map<string, SanitizedTransaction[]>();
  for (const tx of transactions) {
    const bucket = byAccount.get(tx.account_hash) ?? [];
    bucket.push(tx);
    byAccount.set(tx.account_hash, bucket);
  }

  for (const [, accountTxs] of byAccount) {
    const cashDeposits = accountTxs.filter(tx =>
      tx.transaction_type === 'cash_deposit' &&
      tx.amount < thresholdUsd &&
      tx.amount >= proximityMin
    );

    if (cashDeposits.length === 0) continue;

    const sorted = [...cashDeposits].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    // Build non-overlapping clusters: greedily extend from each anchor, skip already-used transactions
    const used = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      const anchor = sorted[i];
      if (!anchor || used.has(anchor.transaction_id)) continue;

      const cluster: SanitizedTransaction[] = [anchor];

      for (let j = i + 1; j < sorted.length; j++) {
        const candidate = sorted[j];
        if (!candidate || used.has(candidate.transaction_id)) continue;
        if (daysBetween(anchor.transaction_date, candidate.transaction_date) <= STRUCTURING_WINDOW_DAYS) {
          cluster.push(candidate);
        }
      }

      if (cluster.length < 2) continue;

      // Mark all transactions in this cluster as used so they don't appear in a subsequent smaller cluster
      for (const tx of cluster) {
        used.add(tx.transaction_id);
      }

      const indicators: string[] = [];
      const uniqueBranches = new Set(cluster.map(tx => tx.branch_code).filter((b): b is string => !!b));
      const firstDate = cluster[0]?.transaction_date ?? '';
      const isSameDay = cluster.every(tx => sameDayUTC(tx.transaction_date, firstDate));

      const thresholdK = (thresholdUsd / 1000).toFixed(0) + 'K';
      if (cluster.length >= 3) {
        indicators.push(
          `Three deposits under $${thresholdK} within ${STRUCTURING_WINDOW_DAYS} days`
        );
      } else {
        indicators.push(
          `Multiple deposits under $${thresholdK} within ${STRUCTURING_WINDOW_DAYS} days`
        );
      }

      if (uniqueBranches.size > 1) {
        indicators.push(`Different branch locations used: ${cluster.length} branches`);
      }

      if (isSameDay && uniqueBranches.size > 1) {
        indicators.push(`Same-day deposits at multiple branches (${uniqueBranches.size} distinct branches)`);
      }

      const totalAmount = cluster.reduce((sum, tx) => sum + tx.amount, 0);
      const nearCeiling = cluster.filter(tx => tx.amount >= thresholdUsd * 0.99).length;
      if (nearCeiling > 0) {
        indicators.push(`Amount within 1% of $${thresholdUsd.toLocaleString()} CTR threshold`);
      } else {
        indicators.push(
          `Cumulative amount $${totalAmount.toFixed(2)} approaches $${thresholdUsd.toLocaleString()} CTR threshold`
        );
      }

      const severity: AlertSeverity = cluster.length >= 3 ? 'critical' : 'high';
      const riskScore = cluster.length >= 3 ? (uniqueBranches.size > 1 ? 92 : 87) : 80;

      alerts.push({
        alert_type: 'structuring',
        severity,
        risk_score: riskScore,
        transactions_flagged: cluster,
        suspicious_indicators: indicators,
        regulatory_citation: '31 USC §5324 — Structuring transactions to evade reporting requirements',
        recommended_action: cluster.length >= 3 ? 'file_sar' : 'investigate',
        confidence_score: cluster.length >= 3 ? 90 : 75,
        false_positive_probability: cluster.length >= 3 ? 0.08 : 0.18,
      });
    }
  }

  return alerts;
}

function detectSmurfing(
  transactions: SanitizedTransaction[],
  alreadyClustered: Set<string>
): PatternMatch[] {
  const alerts: PatternMatch[] = [];

  const byAccount = new Map<string, SanitizedTransaction[]>();
  for (const tx of transactions) {
    if (alreadyClustered.has(tx.transaction_id)) continue;
    if (tx.transaction_type !== 'cash_deposit') continue;
    const bucket = byAccount.get(tx.account_hash) ?? [];
    bucket.push(tx);
    byAccount.set(tx.account_hash, bucket);
  }

  for (const [, accountTxs] of byAccount) {
    // Group by date (YYYY-MM-DD)
    const byDate = new Map<string, SanitizedTransaction[]>();
    for (const tx of accountTxs) {
      const date = tx.transaction_date.substring(0, 10);
      const bucket = byDate.get(date) ?? [];
      bucket.push(tx);
      byDate.set(date, bucket);
    }

    for (const [, dayTxs] of byDate) {
      if (dayTxs.length < 3) continue;

      const branches = new Set(dayTxs.map(tx => tx.branch_code).filter((b): b is string => !!b));
      if (branches.size < 2) continue;

      const total = dayTxs.reduce((sum, tx) => sum + tx.amount, 0);

      alerts.push({
        alert_type: 'structuring',
        severity: 'high',
        risk_score: 82,
        transactions_flagged: dayTxs,
        suspicious_indicators: [
          `Same-day deposits at multiple branches (${branches.size} distinct branches) — possible smurfing`,
          `${dayTxs.length} cash deposits totaling $${total.toLocaleString()} split across branches on a single day`,
        ],
        regulatory_citation: '31 USC §5324 — Structuring transactions to evade reporting requirements',
        recommended_action: 'investigate',
        confidence_score: 80,
        false_positive_probability: 0.15,
      });

      for (const tx of dayTxs) {
        alreadyClustered.add(tx.transaction_id);
      }
    }
  }

  return alerts;
}

function detectSingleTransactionThresholdProximity(
  transactions: SanitizedTransaction[],
  thresholdUsd: number,
  alreadyClustered: Set<string>
): PatternMatch[] {
  const alerts: PatternMatch[] = [];

  // Only flag standalone transactions not already covered by a multi-tx structuring cluster
  const proximate = transactions.filter(tx =>
    !alreadyClustered.has(tx.transaction_id) &&
    (tx.transaction_type === 'cash_deposit' || tx.transaction_type === 'cash_withdrawal') &&
    tx.amount < thresholdUsd &&
    tx.amount >= thresholdUsd * 0.99
  );

  for (const tx of proximate) {
    alerts.push({
      alert_type: 'structuring',
      severity: 'high',
      risk_score: 82,
      transactions_flagged: [tx],
      suspicious_indicators: [
        `Single cash transaction of $${tx.amount.toFixed(2)} is within 1% of the $${thresholdUsd.toLocaleString()} CTR reporting threshold`,
        `Amount proximity to $${thresholdUsd.toLocaleString()} threshold suggests possible avoidance of Currency Transaction Report`,
      ],
      regulatory_citation: '31 USC §5324 — Structuring transactions to evade reporting requirements',
      recommended_action: 'investigate',
      confidence_score: 78,
      false_positive_probability: 0.22,
    });
  }

  return alerts;
}

function detectVelocityAnomalies(
  transactions: SanitizedTransaction[],
  historicalContext: Map<string, CustomerHistoricalContext>,
  ratioThreshold: number
): PatternMatch[] {
  const alerts: PatternMatch[] = [];

  const byAccount = new Map<string, SanitizedTransaction[]>();
  for (const tx of transactions) {
    const bucket = byAccount.get(tx.account_hash) ?? [];
    bucket.push(tx);
    byAccount.set(tx.account_hash, bucket);
  }

  for (const [accountHash, accountTxs] of byAccount) {
    const history = historicalContext.get(accountHash);
    if (!history) continue;

    const avgMonthly6mo = history.total_transactions_6mo / 6;
    const currentCount = accountTxs.length;

    const isDormant = history.total_transactions_6mo <= 6 && history.account_age_days >= 180;
    const largeWires = accountTxs.filter(tx =>
      (tx.transaction_type === 'wire_in' || tx.transaction_type === 'wire_out') &&
      tx.amount > history.avg_transaction_amount_6mo * 5
    );

    if (isDormant && largeWires.length > 0) {
      const largestWire = [...largeWires].sort((a, b) => b.amount - a.amount)[0];
      if (!largestWire) continue;

      const indicators: string[] = [
        `Dormant account with ${history.total_transactions_6mo} transactions in past 6 months suddenly active`,
        `Large wire transfer of $${largestWire.amount.toLocaleString()} vs. historical average of $${history.avg_transaction_amount_6mo.toLocaleString()}`,
        `Account inactive for an extended period prior to large transaction`,
      ];

      if (largestWire.counterparty_country) {
        const country = largestWire.counterparty_country;
        if (SHELL_COMPANY_JURISDICTIONS.has(country)) {
          indicators.push(`Wire from known shell company jurisdiction (${country})`);
        } else if (FATF_BLACKLIST_COUNTRIES.has(country)) {
          indicators.push(`Wire from FATF-listed high-risk country (${country})`);
        }
      }

      const hasGeoRisk = largeWires.some(tx =>
        tx.counterparty_country &&
        (FATF_BLACKLIST_COUNTRIES.has(tx.counterparty_country) || SHELL_COMPANY_JURISDICTIONS.has(tx.counterparty_country))
      );

      alerts.push({
        alert_type: hasGeoRisk ? 'multiple_indicators' : 'velocity_anomaly',
        severity: 'critical',
        risk_score: hasGeoRisk ? 95 : 85,
        transactions_flagged: largeWires,
        suspicious_indicators: indicators,
        regulatory_citation: '31 CFR §1020.320 — Suspicious Activity Report requirements; FinCEN Advisory FIN-2014-A007',
        recommended_action: 'escalate_immediately',
        confidence_score: 88,
        false_positive_probability: 0.05,
      });
      continue;
    }

    if (avgMonthly6mo > 0 && currentCount > avgMonthly6mo * ratioThreshold) {
      alerts.push({
        alert_type: 'velocity_anomaly',
        severity: 'high',
        risk_score: 78,
        transactions_flagged: accountTxs,
        suspicious_indicators: [
          `Transaction count ${currentCount} exceeds ${ratioThreshold}x monthly baseline of ${avgMonthly6mo.toFixed(1)}`,
          `Sudden increase in account activity inconsistent with historical pattern`,
        ],
        regulatory_citation: '31 CFR §1020.320 — Suspicious Activity Report requirements',
        recommended_action: 'investigate',
        confidence_score: 72,
        false_positive_probability: 0.20,
      });
    }
  }

  return alerts;
}

function detectRoundDollar(
  transactions: SanitizedTransaction[],
  threshold: number
): PatternMatch[] {
  const alerts: PatternMatch[] = [];

  const byAccount = new Map<string, SanitizedTransaction[]>();
  for (const tx of transactions) {
    const bucket = byAccount.get(tx.account_hash) ?? [];
    bucket.push(tx);
    byAccount.set(tx.account_hash, bucket);
  }

  for (const [, accountTxs] of byAccount) {
    const wires = accountTxs.filter(tx =>
      tx.transaction_type === 'wire_out' || tx.transaction_type === 'wire_in'
    );

    if (wires.length < 2) continue;

    const roundWires = wires.filter(tx => isRoundDollar(tx.amount));
    const ratio = roundWires.length / wires.length;

    if (ratio >= threshold) {
      const totalRound = roundWires.reduce((sum, tx) => sum + tx.amount, 0);
      alerts.push({
        alert_type: 'round_dollar',
        severity: 'medium',
        risk_score: 70,
        transactions_flagged: roundWires,
        suspicious_indicators: [
          `${Math.round(ratio * 100)}% of wire transfers are exact round-dollar amounts`,
          `Round-dollar pattern: ${roundWires.map(tx => `$${tx.amount.toLocaleString()}`).join(', ')}`,
          `Total round-dollar wire activity: $${totalRound.toLocaleString()}`,
        ],
        regulatory_citation: '31 CFR §1020.320 — Suspicious Activity Report requirements; FinCEN SAR Activity Review',
        recommended_action: 'investigate',
        confidence_score: 68,
        false_positive_probability: 0.28,
      });
    }
  }

  return alerts;
}

function detectGeographicRisk(
  transactions: SanitizedTransaction[]
): PatternMatch[] {
  const alerts: PatternMatch[] = [];

  const byAccount = new Map<string, SanitizedTransaction[]>();
  for (const tx of transactions) {
    if (tx.counterparty_country) {
      const bucket = byAccount.get(tx.account_hash) ?? [];
      bucket.push(tx);
      byAccount.set(tx.account_hash, bucket);
    }
  }

  for (const [, accountTxs] of byAccount) {
    const blacklistTxs = accountTxs.filter(tx =>
      tx.counterparty_country && FATF_BLACKLIST_COUNTRIES.has(tx.counterparty_country)
    );

    const shellTxs = accountTxs.filter(tx =>
      tx.counterparty_country && SHELL_COMPANY_JURISDICTIONS.has(tx.counterparty_country)
    );

    const greylistTxs = accountTxs.filter(tx =>
      tx.counterparty_country && FATF_GREYLIST_COUNTRIES.has(tx.counterparty_country)
    );

    if (blacklistTxs.length > 0) {
      const countries = [...new Set(blacklistTxs.map(tx => tx.counterparty_country).filter((c): c is string => !!c))];
      const totalAmount = blacklistTxs.reduce((sum, tx) => sum + tx.amount, 0);
      alerts.push({
        alert_type: 'geographic_risk',
        severity: 'critical',
        risk_score: 96,
        transactions_flagged: blacklistTxs,
        suspicious_indicators: [
          `Transaction to/from FATF blacklist high-risk country: ${countries.join(', ')}`,
          ...(countries.includes('IR') ? ['Iran — subject to OFAC sanctions; potential sanctions violation'] : []),
          ...(countries.includes('KP') ? ['North Korea — subject to OFAC sanctions; potential sanctions violation'] : []),
          `Total exposure: $${totalAmount.toLocaleString()}`,
        ],
        regulatory_citation: '31 CFR §1020.320 — Suspicious Activity Report; OFAC SDN list; FATF Recommendations',
        recommended_action: 'escalate_immediately',
        confidence_score: 95,
        false_positive_probability: 0.03,
      });
    }

    if (shellTxs.length > 0) {
      const countries = [...new Set(shellTxs.map(tx => tx.counterparty_country).filter((c): c is string => !!c))];
      const totalAmount = shellTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const indicators: string[] = [
        `Wire transfers to known offshore/shell company jurisdictions: ${countries.join(', ')}`,
      ];

      if (countries.includes('KY')) indicators.push('Cayman Islands — common shell company jurisdiction');
      if (countries.includes('VG')) indicators.push('British Virgin Islands — common shell company jurisdiction; tax haven');

      alerts.push({
        alert_type: shellTxs.length >= 2 ? 'multiple_indicators' : 'geographic_risk',
        severity: 'high',
        risk_score: 78,
        transactions_flagged: shellTxs,
        suspicious_indicators: [
          ...indicators,
          `Total offshore wire activity: $${totalAmount.toLocaleString()}`,
        ],
        regulatory_citation: '31 CFR §1020.320 — Suspicious Activity Report; FinCEN Advisory FIN-2010-A005',
        recommended_action: 'investigate',
        confidence_score: 74,
        false_positive_probability: 0.18,
      });
    }

    if (blacklistTxs.length === 0 && shellTxs.length === 0 && greylistTxs.length > 0) {
      const countries = [...new Set(greylistTxs.map(tx => tx.counterparty_country).filter((c): c is string => !!c))];
      alerts.push({
        alert_type: 'geographic_risk',
        severity: 'medium',
        risk_score: 60,
        transactions_flagged: greylistTxs,
        suspicious_indicators: [
          `Transactions to/from FATF greylist jurisdiction: ${countries.join(', ')}`,
        ],
        regulatory_citation: '31 CFR §1020.320 — Suspicious Activity Report; FATF Recommendations',
        recommended_action: 'monitor',
        confidence_score: 62,
        false_positive_probability: 0.35,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// TransactionMonitor class
// ---------------------------------------------------------------------------

export class TransactionMonitor {
  private readonly config: TransactionMonitorConfig;
  private readonly anthropic: Anthropic;

  constructor(config: TransactionMonitorConfig) {
    this.config = config;
    this.anthropic = new Anthropic();
  }

  async analyze(input: TransactionMonitorInput): Promise<TransactionMonitorOutput> {
    const startTime = Date.now();
    const processedAt = new Date().toISOString();

    const validTransactions: SanitizedTransaction[] = [];
    const errors: Array<{ transaction_id: string; error_message: string; error_type: string }> = [];

    for (const tx of input.transactions) {
      try {
        validateTransaction(tx);
        validTransactions.push(tx as SanitizedTransaction);
      } catch (err) {
        const raw = tx as unknown as Record<string, unknown>;
        const txId = typeof raw['transaction_id'] === 'string' ? raw['transaction_id'] : 'UNKNOWN';
        if (err instanceof ValidationError) {
          errors.push({
            transaction_id: txId,
            error_message: err.message,
            error_type: 'validation_error',
          });
        } else {
          errors.push({
            transaction_id: txId,
            error_message: String(err),
            error_type: 'schema_error',
          });
        }
      }
    }

    const historicalContextMap = new Map<string, CustomerHistoricalContext>();
    if (input.historical_context) {
      for (const ctx of input.historical_context) {
        historicalContextMap.set(ctx.account_hash, ctx);
      }
    }

    const patternMatches: PatternMatch[] = [];

    if (this.config.enable_structuring_detection) {
      const structuringAlerts = detectStructuring(validTransactions, this.config.structuring_threshold_usd);
      const clusteredIds = new Set<string>(
        structuringAlerts.flatMap(a => a.transactions_flagged.map(tx => tx.transaction_id))
      );
      const smurfingAlerts = detectSmurfing(validTransactions, clusteredIds);
      patternMatches.push(
        ...structuringAlerts,
        ...smurfingAlerts,
        ...detectSingleTransactionThresholdProximity(validTransactions, this.config.structuring_threshold_usd, clusteredIds)
      );
    }

    if (this.config.enable_velocity_detection) {
      patternMatches.push(
        ...detectVelocityAnomalies(validTransactions, historicalContextMap, this.config.velocity_anomaly_ratio_threshold)
      );
    }

    if (this.config.enable_round_dollar_detection) {
      patternMatches.push(
        ...detectRoundDollar(validTransactions, this.config.round_dollar_threshold)
      );
    }

    if (this.config.enable_geographic_risk) {
      patternMatches.push(
        ...detectGeographicRisk(validTransactions)
      );
    }

    const deduplicatedMatches = this.deduplicateAlerts(patternMatches);

    let claudeTokensUsed = 0;
    let claudeApiCalls = 0;

    // Always call Claude — every batch must be AI-screened for audit trail purposes.
    // Compliance requires a record that AI analysis was performed, even when no patterns are detected.
    try {
      const enrichmentResult = await this.enrichWithClaude(deduplicatedMatches, validTransactions);
      claudeTokensUsed = enrichmentResult.tokensUsed;
      claudeApiCalls = 1;
    } catch (err) {
      logger.error({ session_id: input.session_id, err }, 'Claude enrichment failed — proceeding with deterministic alerts only');
    }

    const now = new Date().toISOString();
    const alerts: SuspiciousActivityAlert[] = deduplicatedMatches.map(match => ({
      alert_id: generateAlertId(),
      account_hash: match.transactions_flagged[0]?.account_hash ?? 'UNKNOWN',
      customer_token: match.transactions_flagged[0]?.customer_token ?? 'UNKNOWN',
      risk_score: match.risk_score,
      alert_type: match.alert_type,
      severity: match.severity,
      transactions_flagged: match.transactions_flagged,
      suspicious_indicators: match.suspicious_indicators,
      regulatory_citation: match.regulatory_citation,
      recommended_action: match.recommended_action,
      confidence_score: match.confidence_score,
      false_positive_probability: match.false_positive_probability,
      created_at: now,
      expires_at: expiresAt(now),
    }));

    const totalDuration = Date.now() - startTime;

    logger.info(
      {
        session_id: input.session_id,
        transactions_analyzed: validTransactions.length,
        alerts_generated: alerts.length,
        duration_ms: totalDuration,
      },
      'TransactionMonitor analysis complete'
    );

    return {
      session_id: input.session_id,
      processed_at: processedAt,
      transactions_analyzed: validTransactions.length,
      alerts_generated: alerts.length,
      alerts,
      performance_metrics: {
        total_duration_ms: totalDuration,
        avg_transaction_latency_ms: validTransactions.length > 0 ? totalDuration / validTransactions.length : 0,
        claude_api_calls: claudeApiCalls,
        claude_tokens_used: claudeTokensUsed,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private deduplicateAlerts(matches: PatternMatch[]): PatternMatch[] {
    const seen = new Map<string, PatternMatch>();

    for (const match of matches) {
      const key = match.transactions_flagged
        .map(tx => tx.transaction_id)
        .sort()
        .join(',');

      const existing = seen.get(key);
      if (!existing || match.risk_score > existing.risk_score) {
        seen.set(key, match);
      }
    }

    return [...seen.values()].sort((a, b) => b.risk_score - a.risk_score);
  }

  private async enrichWithClaude(
    matches: PatternMatch[],
    allTransactions: SanitizedTransaction[]
  ): Promise<{ tokensUsed: number }> {
    const summary = matches.map(m => ({
      alert_type: m.alert_type,
      severity: m.severity,
      risk_score: m.risk_score,
      indicators: m.suspicious_indicators,
      transaction_count: m.transactions_flagged.length,
    }));

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: 1000,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'user',
          content: `You are TransactionMonitor, a BSA/AML compliance agent. Review these detected suspicious activity patterns and confirm the alert classifications are appropriate. Return the word CONFIRMED if the patterns are valid BSA/AML concerns, or REVIEW with a brief explanation if any pattern appears to be a false positive.

Detected patterns:
${JSON.stringify(summary, null, 2)}

Total transactions in batch: ${allTransactions.length}

AGENT BOUNDARIES: You flag patterns only. Do not file SARs. Do not make legal determinations.`,
        }
      ],
    });

    const usage = response.usage;
    return { tokensUsed: usage.input_tokens + usage.output_tokens };
  }
}
