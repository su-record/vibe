import { vibePath } from './paths.js';
import { appendJsonl, nowIso, readJsonl } from './store.js';

/**
 * Ledger — every run leaves client, model, result and cost. Comparison is a ledger query.
 * There are no ratio / percent / multiplier fields: a field that exists gets used, and a
 * used number becomes a claim.
 */
export type LedgerEventType =
  | 'init'
  | 'draft'
  | 'approve'
  | 'check'
  | 'stuck'
  | 'done'
  | 'abandon'
  | 'ask'
  | 'authorize'
  | 'regress'
  | 'knowledge';

export interface LedgerEvent {
  at: string;
  event: LedgerEventType;
  client: string;
  model: string | null;
  run?: string;
  scenarioSet?: string;
  scenarios?: Record<string, 'pass' | 'fail' | 'pending'>;
  passed?: number;
  failed?: number;
  failHash?: string | null;
  turns?: number | null;
  costUsd?: number | null;
  ms?: number;
  skillsUsed?: string[];
  detail?: string;
}

export function ledgerPath(root: string): string {
  return vibePath(root, 'ledger.jsonl');
}

export function record(root: string, event: Omit<LedgerEvent, 'at'>): LedgerEvent {
  const full: LedgerEvent = { at: nowIso(), ...event };
  appendJsonl(ledgerPath(root), full);
  return full;
}

export function readLedger(root: string, sinceMs?: number): LedgerEvent[] {
  const all = readJsonl<LedgerEvent>(ledgerPath(root));
  if (!sinceMs) return all;
  const cutoff = Date.now() - sinceMs;
  return all.filter((e) => new Date(e.at).getTime() >= cutoff);
}

// ─── Comparison — the code says "cannot tell" when it cannot ─────────────

export type CompareBy = 'client' | 'model';
export type CompareMetric = 'checks' | 'turns' | 'cost';
export type Verdict = 'insufficient-runs' | 'mixed-scenario-sets' | 'inconclusive' | 'difference-observed';

export interface Range {
  min: number;
  max: number;
  mean: number;
}
export interface ArmSummary {
  arm: string;
  runs: number;
  usable: number;
  scenarioSets: string[];
  range: Range | null;
}
export interface Comparison {
  by: CompareBy;
  metric: CompareMetric;
  arms: ArmSummary[];
  verdict: Verdict;
  reason: string;
  /** Absolute difference (b − a). Not a ratio. */
  delta: number | null;
}

function metricOf(e: LedgerEvent, metric: CompareMetric): number | null {
  if (metric === 'checks') return typeof e.passed === 'number' ? e.passed : null;
  if (metric === 'turns') return typeof e.turns === 'number' ? e.turns : null;
  return typeof e.costUsd === 'number' ? e.costUsd : null;
}

function range(values: number[]): Range | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, mean };
}

export function compare(root: string, by: CompareBy, metric: CompareMetric, minRuns = 5): Comparison {
  const checks = readLedger(root).filter((e) => e.event === 'check');
  const groups = new Map<string, LedgerEvent[]>();
  for (const e of checks) {
    const key = by === 'client' ? e.client : e.model ?? 'unknown';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const arms: ArmSummary[] = [...groups.entries()].map(([arm, events]) => {
    const values = events.map((e) => metricOf(e, metric)).filter((v): v is number => v !== null);
    return {
      arm,
      runs: events.length,
      usable: values.length,
      scenarioSets: [...new Set(events.map((e) => e.scenarioSet ?? 'unknown'))],
      range: range(values),
    };
  });
  const base = { by, metric, arms, delta: null };
  if (arms.length < 2) return { ...base, verdict: 'insufficient-runs', reason: 'fewer than two arms to compare' };
  const [a, b] = arms as [ArmSummary, ArmSummary];
  if (a.usable < minRuns || b.usable < minRuns) {
    return { ...base, verdict: 'insufficient-runs', reason: `fewer than ${minRuns} usable runs per arm (${a.arm} ${a.usable}, ${b.arm} ${b.usable})` };
  }
  const setsA = new Set(a.scenarioSets);
  const setsB = new Set(b.scenarioSets);
  if (setsA.size !== 1 || setsB.size !== 1 || [...setsA][0] !== [...setsB][0]) {
    return { ...base, verdict: 'mixed-scenario-sets', reason: 'the arms did not run the same scenario set — results of different work are not comparable' };
  }
  const ra = a.range as Range;
  const rb = b.range as Range;
  const overlap = ra.min <= rb.max && rb.min <= ra.max;
  if (overlap) return { ...base, verdict: 'inconclusive', reason: 'observed ranges (min–max) overlap — this sample cannot tell a difference' };
  return { ...base, verdict: 'difference-observed', reason: 'ranges do not overlap. "a difference was observed", not "one is better"', delta: rb.mean - ra.mean };
}
