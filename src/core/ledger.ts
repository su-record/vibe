import { isProjectDir, vibePath } from './paths.js';
import { readState } from './state.js';
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
  | 'knowledge'
  | 'research'
  | 'skill'
  | 'usage';

export interface LedgerEvent {
  at: string;
  event: LedgerEventType;
  client: string;
  model: string | null;
  /** on | off | scoped — set only by a bench run */
  harness?: 'on' | 'off' | 'scoped';
  run?: string;
  scenarioSet?: string;
  scenarios?: Record<string, 'pass' | 'fail' | 'pending' | 'blocked'>;
  passed?: number;
  failed?: number;
  failHash?: string | null;
  turns?: number | null;
  costUsd?: number | null;
  /** What a reader or reviewer call cost in tokens — a `usage` event, attributed to the run in progress. */
  tokens?: { input: number; cacheRead: number; cacheWrite: number; output: number } | null;
  ms?: number;
  skillsUsed?: string[];
  detail?: string;
  /** Typed relations between nodes — the only edge kinds the ledger knows. */
  edges?: Edge[];
  /** Bench-only fields (bench/run.js writes these lines directly, not through `record`). */
  task?: string;
  /** `<task>#<index>` — the same run repeated across arms, so `compare --paired` can line them up. */
  pair?: string;
  /** Whether every scenario passed in this run. Falls back to `failed === 0` when absent. */
  armPassed?: boolean;
  /** costUsd recomputed from tokens at a configured price; null when the price or the tokens are unknown. */
  costRecomputed?: number | null;
}

export type EdgeType = 'supersedes' | 'decided-by' | 'implements' | 'caused';
/** Nodes are `kind:value` — intent:<hash> · scenario:<id> · file:<path> · regression:<id> · run:<id> · human:chat · human:token:<id> */
export interface Edge {
  type: EdgeType;
  from: string;
  to: string;
}
export const EDGE_TYPES: readonly EdgeType[] = ['supersedes', 'decided-by', 'implements', 'caused'];

export function ledgerPath(root: string): string {
  return vibePath(root, 'ledger.jsonl');
}

export function record(root: string, event: Omit<LedgerEvent, 'at'>): LedgerEvent {
  const full: LedgerEvent = { at: nowIso(), ...event };
  appendJsonl(ledgerPath(root), full);
  return full;
}

export interface UsageInput {
  detail: string;
  client: string;
  model: string | null;
  tokens: LedgerEvent['tokens'];
  costUsd: number | null;
  ms: number;
}

/** A reader or reviewer call inside a project leaves what it cost; outside a project nothing is written. */
export function recordUsage(root: string, input: UsageInput): LedgerEvent | null {
  if (!isProjectDir(root)) return null;
  const run = `r-${readState(root).runs + 1}`;
  return record(root, { event: 'usage', client: input.client, model: input.model, run, detail: input.detail, tokens: input.tokens ?? null, costUsd: input.costUsd, ms: input.ms });
}

/** An authorize record for `action` inside the window — what lets an irreversible scenario run at all. */
export function recentAuthorize(root: string, action: string, windowMs = 10 * 60 * 1000): boolean {
  const cutoff = Date.now() - windowMs;
  return readLedger(root).some((e) => e.event === 'authorize' && (e.detail ?? '').startsWith(`${action}:`) && new Date(e.at).getTime() >= cutoff);
}

export function readLedger(root: string, sinceMs?: number): LedgerEvent[] {
  const all = readJsonl<LedgerEvent>(ledgerPath(root));
  if (!sinceMs) return all;
  const cutoff = Date.now() - sinceMs;
  return all.filter((e) => new Date(e.at).getTime() >= cutoff);
}

// ─── Edges — "why" is a walk over typed relations, not a query language ───

export interface EdgeHit extends Edge {
  at: string;
  event: LedgerEventType;
}

export function readEdges(root: string, type?: EdgeType): EdgeHit[] {
  const out: EdgeHit[] = [];
  for (const e of readLedger(root)) {
    for (const edge of e.edges ?? []) if (!type || edge.type === type) out.push({ ...edge, at: e.at, event: e.event });
  }
  return out;
}

function nodeMatches(node: string, query: string): boolean {
  return node === query || node.endsWith(`:${query}`);
}

export interface WhyStep {
  depth: number;
  edge: EdgeHit;
}
export interface WhyResult {
  node: string | null;
  steps: WhyStep[];
}

/**
 * Walk outward from a node along every edge that touches it, up to `maxDepth` hops. The result
 * is the list of edges in the order they were reached — enough to read "regression r-1 was caused
 * by scenario x, which implements file y, decided by chat" without a graph database.
 */
export function why(root: string, query: string, maxDepth = 3): WhyResult {
  const edges = readEdges(root);
  const start = edges.map((e) => [e.from, e.to]).flat().find((n) => nodeMatches(n, query)) ?? null;
  if (!start) return { node: null, steps: [] };
  const seenNodes = new Set([start]);
  const seenEdges = new Set<EdgeHit>();
  const steps: WhyStep[] = [];
  let frontier = [start];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const edge of edges) {
        if (seenEdges.has(edge) || (edge.from !== node && edge.to !== node)) continue;
        seenEdges.add(edge);
        steps.push({ depth, edge });
        const other = edge.from === node ? edge.to : edge.from;
        if (!seenNodes.has(other)) {
          seenNodes.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  return { node: start, steps };
}

// ─── Comparison — the code says "cannot tell" when it cannot ─────────────

export type CompareBy = 'client' | 'model' | 'harness';
export type CompareMetric = 'checks' | 'turns' | 'cost' | 'ms' | 'tokens';
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
  /** Runs whose recomputed cost differs from the client-reported cost by more than 3×. */
  costMismatch: number;
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

/** Input tokens as they are billed: cache reads at a tenth, cache writes at a quarter more. */
export function weightedTokens(t: { input: number; cacheRead: number; cacheWrite: number }): number {
  return t.input + 0.1 * t.cacheRead + 1.25 * t.cacheWrite;
}

function metricOf(e: LedgerEvent, metric: CompareMetric): number | null {
  if (metric === 'checks') return typeof e.passed === 'number' ? e.passed : null;
  if (metric === 'turns') return typeof e.turns === 'number' ? e.turns : null;
  if (metric === 'ms') return typeof e.ms === 'number' ? e.ms : null;
  if (metric === 'tokens') return e.tokens ? weightedTokens(e.tokens) : null;
  return typeof e.costUsd === 'number' ? e.costUsd : null;
}

/** A run "passed" for pairing purposes when every scenario in it passed. */
function armPassed(e: LedgerEvent): boolean {
  return e.armPassed ?? (typeof e.failed === 'number' && e.failed === 0);
}

/** The key that lines up the same run across two arms: the `pair` field bench/run.js writes, or — for a
 * ledger without one — the nth occurrence of a task within its own arm, in the order it was recorded. */
function pairKey(e: LedgerEvent, seenPerTask: Map<string, number>): string {
  if (e.pair) return e.pair;
  const task = e.task ?? 'unknown';
  const n = seenPerTask.get(task) ?? 0;
  seenPerTask.set(task, n + 1);
  return `${task}#${n}`;
}

/** Keep only matching passing pairs. Other arm counts retain their summaries so compare can
 * explain why no pairwise verdict is possible. */
function pairedOnly(checks: LedgerEvent[], by: CompareBy): LedgerEvent[] {
  const arms = new Map<string, LedgerEvent[]>();
  for (const e of checks) {
    const key = armKey(e, by);
    arms.set(key, [...(arms.get(key) ?? []), e]);
  }
  const [armA, armB] = [...arms.keys()];
  if (arms.size !== 2 || armA === undefined || armB === undefined) return checks;
  const seenA = new Map<string, number>();
  const seenB = new Map<string, number>();
  const bByKey = new Map((arms.get(armB) ?? []).map((e) => [pairKey(e, seenB), e]));
  const out: LedgerEvent[] = [];
  for (const e of arms.get(armA) ?? []) {
    const other = bByKey.get(pairKey(e, seenA));
    if (other && armPassed(e) && armPassed(other)) out.push(e, other);
  }
  return out;
}

/** costRecomputed far (more than 3×) from the client-reported costUsd — a run worth a second look. */
function costMismatched(e: LedgerEvent): boolean {
  const a = e.costRecomputed;
  const b = e.costUsd;
  if (typeof a !== 'number' || typeof b !== 'number' || a === 0 || b === 0) return false;
  return Math.max(a, b) / Math.min(a, b) > 3;
}

function withUsage(e: LedgerEvent, metric: CompareMetric, usageByRun: Map<string, number>): number | null {
  const own = metricOf(e, metric);
  if (metric !== 'cost') return own;
  const spent = e.run ? usageByRun.get(e.run) : undefined;
  if (own === null && spent === undefined) return null;
  return (own ?? 0) + (spent ?? 0);
}

function range(values: number[]): Range | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, mean };
}

function armKey(e: LedgerEvent, by: CompareBy): string {
  if (by === 'client') return e.client;
  if (by === 'model') return e.model ?? 'unknown';
  return e.harness ?? 'unknown';
}

export interface CompareFilter {
  client?: string;
  task?: string;
}

/** `ledgerFile` lets a bench keep its own ledger outside any project. `paired` keeps only runs that
 * pair with a passing run in the other arm on the same task (see `pairedOnly`) — for a bench ledger,
 * where efficiency is only comparable between runs that both did the work. */
export function compare(root: string, by: CompareBy, metric: CompareMetric, minRuns = 5, ledgerFile?: string, paired = false, filter: CompareFilter = {}): Comparison {
  const all = ledgerFile ? readJsonl<LedgerEvent>(ledgerFile) : readLedger(root);
  const events = all.filter((e) => (!filter.client || e.client === filter.client) && (!filter.task || e.task === filter.task));
  const allChecks = events.filter((e) => e.event === 'check');
  const checks = paired ? pairedOnly(allChecks, by) : allChecks;
  // What the readers and reviewers spent during a run belongs to that run's cost.
  const usageByRun = new Map<string, number>();
  for (const e of events) if (e.event === 'usage' && e.run && typeof e.costUsd === 'number') usageByRun.set(e.run, (usageByRun.get(e.run) ?? 0) + e.costUsd);
  const groups = new Map<string, LedgerEvent[]>();
  for (const e of checks) {
    const key = armKey(e, by);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const arms: ArmSummary[] = [...groups.entries()].map(([arm, events]) => {
    const values = events.map((e) => withUsage(e, metric, usageByRun)).filter((v): v is number => v !== null);
    return {
      arm,
      runs: events.length,
      usable: values.length,
      scenarioSets: [...new Set(events.map((e) => e.scenarioSet ?? 'unknown'))],
      range: range(values),
      costMismatch: events.filter(costMismatched).length,
    };
  });
  const base = { by, metric, arms, delta: null };
  if (arms.length < 2) return { ...base, verdict: 'insufficient-runs', reason: 'fewer than two arms to compare' };
  if (arms.length > 2) return { ...base, verdict: 'inconclusive', reason: `more than two arms to compare — filter the ledger to exactly two ${by} arms` };
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
