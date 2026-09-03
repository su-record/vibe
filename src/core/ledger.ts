import { vibePath } from './paths.js';
import { appendJsonl, nowIso, readJsonl } from './store.js';

/**
 * 장부 — 모든 런이 클라이언트·모델·결과·비용을 남긴다. 비교는 장부 질의다.
 * 비율·퍼센트·배수 필드는 없다. 있으면 쓰이고, 쓰이면 주장이 된다.
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

// ─── 비교 — 판정 불가를 코드가 낸다 ────────────────────────────────

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
  /** 절대 단위 차이 (b − a). 비율이 아니다 */
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
  if (arms.length < 2) return { ...base, verdict: 'insufficient-runs', reason: '비교할 arm 이 2개 미만이다' };
  const [a, b] = arms as [ArmSummary, ArmSummary];
  if (a.usable < minRuns || b.usable < minRuns) {
    return { ...base, verdict: 'insufficient-runs', reason: `arm 당 사용 가능 런이 ${minRuns} 미만이다 (${a.arm} ${a.usable}, ${b.arm} ${b.usable})` };
  }
  const setsA = new Set(a.scenarioSets);
  const setsB = new Set(b.scenarioSets);
  if (setsA.size !== 1 || setsB.size !== 1 || [...setsA][0] !== [...setsB][0]) {
    return { ...base, verdict: 'mixed-scenario-sets', reason: '두 arm 이 같은 시나리오 셋을 돌지 않았다 — 다른 일을 시킨 결과는 비교가 아니다' };
  }
  const ra = a.range as Range;
  const rb = b.range as Range;
  const overlap = ra.min <= rb.max && rb.min <= ra.max;
  if (overlap) return { ...base, verdict: 'inconclusive', reason: '관측 범위(min~max)가 겹친다 — 이 표본으로는 차이를 말할 수 없다' };
  return { ...base, verdict: 'difference-observed', reason: '범위가 겹치지 않는다. "차이가 관측됐다" 이지 "낫다" 가 아니다', delta: rb.mean - ra.mean };
}
