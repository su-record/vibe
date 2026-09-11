import { requireRiskCoverage, uncoveredRisks } from './risk-signals.js';
import { createHash } from 'node:crypto';
import { summarizeFailure, failureLine, type FailureSummary } from './failure.js';
import { repairFailure, resumeRepair } from './repair.js';
import { evalCheck } from './checks/eval.js';
import { fileCheck } from './checks/file.js';
import { httpCheck } from './checks/http.js';
import { reviewCheck } from './checks/review.js';
import { actionOf } from './checks/mutation.js';
import { runCheck, type CheckResult } from './checks/run.js';
import { detectClient, detectHarness, detectModel, reportedCostUsd, reportedTurns } from './client.js';
import { invalidTransition } from './errors.js';
import { ask, hasOpenQuestion, openQuestions, resolve as resolveQuestion } from './inbox.js';
import { record, type Edge, recentAuthorize } from './ledger.js';
import { vibePath } from './paths.js';
import { intentHash, intentPath, loadScenarios, scenariosPath } from './intent.js';
import { listRegressions } from './regress.js';
import { ancestorsOf, isHuman, type Scenario } from './scenarios.js';
import { readState, writeState, type StateFile } from './state.js';
import { nowIso, readJson, readText, writeJson } from './store.js';
import { readSourceBasis, sourceValidity } from './source-basis.js';
import { changedBlobs, changedSince, treeHash } from './tree.js';
import { consentStatus, requireConsent } from './consent.js';
import { fingerprint } from './inspect.js';
import { diagnosticFile } from './evidence.js';
import { foldHandoffResults } from './handoff-results.js';
import { readHandoffs } from './handoff.js';
import { outputCapture } from './output-capture.js';
import { reserveRun, writeRunEvidence } from './run-id.js';
import { recordStopEvidence } from './session.js';

export type LastResult = 'pass' | 'fail' | 'pending' | 'blocked' | 'stale' | 'handoff';
/** Checks that may run at the same time — independent scenarios only, never a dependent before its parent. */
export const MAX_PARALLEL = 4;
export interface ResultsFile {
  /** `tree`: the tree hash the result was taken on — a result from another tree is stale and counts as not passed. */
  [id: string]: { last: LastResult; at: string; run: string; tree?: string; failure?: FailureSummary };
}

export interface ScenarioOutcome {
  id: string;
  type: Scenario['check']['type'];
  status: LastResult;
  exit: number | null;
  ms: number;
  tail: string;
  signal?: string | null;
  failureCode?: string;
  failure?: FailureSummary;
  capture?: CheckResult['capture'];
  executionContext?: string;
  evidenceId?: string;
  sources?: string[];
  diagnostic?: string;
  cleanupUncertain?: boolean;
  reason?: string;
  usage?: CheckResult['usage'];
  regression?: boolean;
  /** Parents that had not passed when this scenario's turn came — it was not run. */
  blockedBy?: string[];
}

export interface CheckReport {
  run: string;
  at: string;
  state: StateFile['state'];
  outcomes: ScenarioOutcome[];
  passed: number;
  failed: number;
  pending: number;
  failHash: string | null;
  stuck: boolean;
  done: boolean;
  /** Scenario ids that have not passed yet — why this is not DONE */
  remaining: string[];
}

export function resultsPath(root: string): string {
  return vibePath(root, 'results.json');
}

export function readResults(root: string): ResultsFile {
  const stored = readJson<ResultsFile>(resultsPath(root)) ?? {};
  const tree = treeHash(root);
  const live: ResultsFile = {};
  // A pass is bound to the tree it was taken on: any other tree makes it stale, never DONE
  for (const [id, r] of Object.entries(stored)) live[id] = r.last === 'pass' && r.tree !== tree ? { ...r, last: 'stale' } : r;
  return foldHandoffResults(root, live);
}

async function execute(scenario: Scenario, root: string): Promise<CheckResult> {
  const check = scenario.check;
  switch (check.type) {
    case 'run':
      return runCheck(check, root);
    case 'file':
      return fileCheck(check, root);
    case 'http':
      return httpCheck(check, root);
    case 'eval':
      return evalCheck(check, root);
    case 'review':
      return reviewCheck(check, root);
    case 'human':
      return { pass: false, exit: null, ms: 0, tail: check.question, reason: 'human — not judged by the harness' };
    default:
      return { pass: false, exit: null, ms: 0, tail: '', reason: `unknown check type` };
  }
}

function failHashOf(outcomes: ScenarioOutcome[]): string | null {
  const failed = outcomes.filter((o) => o.status === 'fail').sort((a, b) => a.id.localeCompare(b.id));
  if (failed.length === 0) return null;
  const hash = createHash('sha256');
  for (const o of failed) hash.update(`${o.id}|${o.type}|${o.exit}|${o.signal ?? ''}|${o.failureCode ?? 'check-failed'}|${o.failure?.diagnosticCode ?? ''}|${o.failure?.locations[0]?.file ?? ''}\n`);
  return hash.digest('hex').slice(0, 8);
}

export function scenarioSetHash(scenarios: Scenario[]): string {
  const hash = createHash('sha256');
  for (const s of [...scenarios].sort((a, b) => a.id.localeCompare(b.id))) hash.update(`${s.id}|${JSON.stringify({ check: s.check, needs: s.needs, risk: s.risk })}\n`);
  return hash.digest('hex').slice(0, 12);
}

function askHumanOnce(root: string, scenario: Scenario): void {
  if (scenario.check.type !== 'human') return;
  const question = scenario.check.question;
  if (hasOpenQuestion(root, (q) => q.scenario === scenario.id)) return;
  ask(root, { question, scenario: scenario.id });
}

/** An irreversible scenario runs only behind an authorize record: the harness never re-executes a mutation on its own. */
function unauthorized(root: string, scenario: Scenario & { regression?: boolean }): ScenarioOutcome | null {
  if (!scenario.irreversible) return null;
  const action = actionOf(scenario.irreversible);
  if (recentAuthorize(root, action)) {
    for (const q of openQuestions(root)) if (q.scenario === scenario.id && q.question.startsWith('Outside authority:')) resolveQuestion(root, q.id);
    return null;
  }
  const outcome: ScenarioOutcome = { id: scenario.id, type: scenario.check.type, status: 'blocked', exit: null, ms: 0, tail: '', reason: `irreversible (${action}) — vibe authorize --action ${action} first; check --all never runs it on its own` };
  outcome.failureCode = 'authorization-required';
  outcome.failure = summarizeFailure(root, scenario, { pass: false, exit: null, ms: 0, tail: '', failureCode: 'authorization-required' });
  if (!hasOpenQuestion(root, (q) => q.scenario === scenario.id && q.question.startsWith('Outside authority:'))) {
    ask(root, { scenario: scenario.id, question: `Outside authority: ${failureLine(outcome.failure)}. Irreversible action ${action} needs authorization; no action was attempted. Will you authorize it or revise the scope?`, options: ['authorize the action', 'revise scope', 'handoff'] });
  }
  if (scenario.regression) outcome.regression = true;
  return outcome;
}

async function runOne(root: string, scenario: Scenario & { regression?: boolean }, options: CheckOptions & { run: string }): Promise<ScenarioOutcome> {
  if (readHandoffs(root)[scenario.id]) return { id: scenario.id, type: scenario.check.type, status: 'handoff', exit: null, ms: 0, tail: '', reason: 'required work handed off; not passed' };
  const held = unauthorized(root, scenario);
  if (held) return held;
  let result: CheckResult;
  try { requireConsent(root); result = await execute(scenario, root); }
  catch { result = { pass: false, exit: null, ms: 0, tail: '', failureCode: 'adapter-error' }; }
  const status: LastResult = isHuman(scenario) ? 'pending' : result.pass ? 'pass' : 'fail';
  if (isHuman(scenario)) askHumanOnce(root, scenario);
  const outcome: ScenarioOutcome = { id: scenario.id, type: scenario.check.type, status, exit: result.exit, ms: result.ms, tail: '' };
  if (status === 'fail') { outcome.failureCode = result.failureCode ?? `${scenario.check.type}-failed`; outcome.reason = outcome.failureCode; outcome.failure = summarizeFailure(root, scenario, result); }
  outcome.capture = result.capture ?? outputCapture().finish(result.failureCode !== 'adapter-error').capture;
  if (result.signal !== undefined) outcome.signal = result.signal;
  if (result.cleanupUncertain) outcome.cleanupUncertain = true;
  outcome.sources = [...(scenario.verifiers ?? []), ...('path' in scenario.check ? [scenario.check.path] : []), ...(scenario.check.type === 'eval' ? [scenario.check.cases] : [])];
  if (options.diagnostics) outcome.diagnostic = diagnosticFile(root, options.run, scenario.id, result);
  if (result.usage) outcome.usage = result.usage;
  if (scenario.regression) outcome.regression = true;
  return outcome;
}

function blocked(scenario: Scenario & { regression?: boolean }, by: string[]): ScenarioOutcome {
  const outcome: ScenarioOutcome = { id: scenario.id, type: scenario.check.type, status: 'blocked', exit: null, ms: 0, tail: '', reason: `blocked — needs ${by.join(', ')}`, blockedBy: by };
  if (scenario.regression) outcome.regression = true;
  return outcome;
}

/**
 * The work graph decides the order: every scenario whose parents have all passed runs in the
 * current layer, at most MAX_PARALLEL at a time; the rest wait for the next layer. A scenario
 * whose parent ended anywhere but `pass` is blocked and never run. Cycles cannot reach here —
 * the parser rejects them.
 */
async function runLayers(root: string, selected: Array<Scenario & { regression?: boolean }>, previous: ResultsFile, options: CheckOptions & { run: string }): Promise<ScenarioOutcome[]> {
  const last: Record<string, LastResult | undefined> = {};
  // A parent selected for this run is judged by this run, never by what it did last time
  const selectedIds = new Set(selected.map((s) => s.id));
  for (const [id, r] of Object.entries(previous)) if (!selectedIds.has(id)) last[id] = r.last;
  const outcomes: ScenarioOutcome[] = [];
  let waiting = [...selected];
  while (waiting.length > 0) {
    const stillToRun = new Set(waiting.map((s) => s.id));
    const ready = waiting.filter((s) => (s.needs ?? []).every((n) => last[n] === 'pass'));
    // A parent that will not run in this invocation and has not passed blocks its dependents.
    const stuck = waiting.filter((s) => !ready.includes(s) && (s.needs ?? []).some((n) => !stillToRun.has(n) && last[n] !== 'pass'));
    for (const s of stuck) {
      outcomes.push(blocked(s, (s.needs ?? []).filter((n) => last[n] !== 'pass')));
      last[s.id] = 'blocked';
    }
    waiting = waiting.filter((s) => !ready.includes(s) && !stuck.includes(s));
    if (ready.length === 0 && stuck.length === 0) {
      // Only a cycle could leave scenarios waiting on each other; the parser rejects cycles, so this is a guard.
      for (const s of waiting) outcomes.push(blocked(s, s.needs ?? []));
      break;
    }
    for (let i = 0; i < ready.length; i += MAX_PARALLEL) {
      const batch = await Promise.all(ready.slice(i, i + MAX_PARALLEL).map((s) => runOne(root, s, options)));
      for (const o of batch) {
        outcomes.push(o);
        last[o.id] = o.status;
      }
    }
  }
  const order = new Map(selected.map((s, i) => [s.id, i]));
  return outcomes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

function snapshotPath(root: string): string {
  return vibePath(root, 'snapshot.json');
}

/**
 * A scenario that just passed for the first time implements the files that changed since the
 * previous check — not everything dirty in the tree. The snapshot of changed-file content ids is
 * kept between checks so the diff is exact.
 */
function implementsEdges(root: string, scenarioIds: string[]): Edge[] {
  const current = changedBlobs(root);
  const files = changedSince(readJson<Record<string, string>>(snapshotPath(root)), current);
  writeJson(snapshotPath(root), current);
  if (scenarioIds.length === 0) return [];
  const edges: Edge[] = [];
  for (const id of scenarioIds) for (const file of files) edges.push({ type: 'implements', from: `scenario:${id}`, to: `file:${file}` });
  return edges;
}

export interface CheckOptions {
  ids?: string[];
  all?: boolean;
  diagnostics?: boolean;
  approach?: string;
}

type Selectable = Scenario & { regression?: boolean };

function selectScenarios(universe: Selectable[], previous: ResultsFile, options: CheckOptions): Selectable[] {
  if (options.ids && options.ids.length > 0) {
    const missing = options.ids.filter((id) => !universe.some((s) => s.id === id));
    if (missing.length > 0) throw invalidTransition(`unknown scenario: ${missing.join(', ')}`);
    // An explicit id pulls in the ancestors that have not passed yet — `check tests` builds first.
    const wanted = new Set([...options.ids, ...ancestorsOf(universe, options.ids).filter((id) => previous[id]?.last !== 'pass')]);
    return universe.filter((s) => wanted.has(s.id));
  }
  if (options.all) return universe;
  return universe.filter((s) => isHuman(s) || previous[s.id]?.last !== 'pass');
}

/** The state after a run: STUCK on the same failure twice, DONE when nothing remains, otherwise RUNNING. */
function settleState(root: string, current: StateFile, failHash: string | null, remaining: string[], outcomes: ScenarioOutcome[], at: string, approach?: string): { next: StateFile; stuck: boolean; done: boolean } {
  let next: StateFile = { ...current };
  if (failHash !== null) {
    const failures = outcomes.filter((o) => o.status === 'fail').flatMap((o) => o.failure ? [o.failure] : []);
    next = { ...next, ...repairFailure(root, current, failHash, failures, `r-${current.runs}`, approach) };
    return { next, stuck: next.state === 'STUCK', done: false };
  }
  next = { ...next, lastFailHash: null, failStreak: 0, repair: null };
  if (remaining.length === 0) {
    next.state = 'DONE';
    next.doneAt = at;
    next.doneTree = treeHash(root);
    return { next, stuck: false, done: true };
  }
  if (current.state === 'STUCK') next.state = 'RUNNING';
  return { next, stuck: false, done: false };
}

function validateApproval(root: string, state: StateFile): void {
  const basis = readSourceBasis(root);
  const currentHash = intentHash(readText(intentPath(root)) ?? '', readText(scenariosPath(root)) ?? '', basis);
  if (currentHash !== state.intentHash) throw invalidTransition(`approval void — the intent or scenarios changed since ${state.intentHash ?? 'the approval'}; run vibe intent draft and approve again`);
  const sources = sourceValidity(root, basis);
  if (sources && !sources.valid) throw invalidTransition(`approval void — source changed or missing: ${[...sources.changed, ...sources.missing, ...sources.unreadable].join(', ')}; re-evaluate affected findings, run vibe intent draft and approve again`);
}

/**
 * The only verdict path. The harness runs the checks and writes the evidence.
 * First call moves APPROVED→RUNNING; all gates passing → DONE; the same failure hash
 * twice in a row → STUCK.
 */
export async function runChecks(root: string, options: CheckOptions = {}): Promise<CheckReport> {
  let state = readState(root);
  if (!['APPROVED', 'RUNNING', 'DONE', 'STUCK'].includes(state.state)) {
    throw invalidTransition(`check runs only after approval (current state ${state.state})`);
  }
  validateApproval(root, state);
  const executionPlan = requireConsent(root);
  state = resumeRepair(root, state);
  const executionContext = fingerprint(executionPlan);
  const scenarios = loadScenarios(root);
  const regressions = listRegressions(root);
  const universe: Selectable[] = [...scenarios, ...regressions.map((r) => ({ ...r, regression: true }))];
  requireRiskCoverage(root, universe);
  const previous = readResults(root);
  const selected = selectScenarios(universe, previous, options);

  const run = reserveRun(root, state);
  const at = nowIso();
  const outcomes = await runLayers(root, selected, previous, { ...options, run });
  for (const outcome of outcomes) { outcome.executionContext = executionContext; outcome.evidenceId = `${run}#${outcome.id}`; }

  requireRiskCoverage(root, universe);
  const results: ResultsFile = { ...previous };
  const tree = treeHash(root); // after the checks ran: a check that writes build output is part of the tree it passed on
  for (const o of outcomes) results[o.id] = { last: o.status, at, run, tree, ...(o.failure ? { failure: o.failure } : {}) };
  writeJson(resultsPath(root), results);
  const implemented = outcomes.filter((o) => o.status === 'pass' && previous[o.id]?.last !== 'pass').map((o) => o.id);
  const edges = implementsEdges(root, implemented);

  const gated = universe.filter((s) => !isHuman(s));
  const remaining = gated.filter((s) => results[s.id]?.last !== 'pass').map((s) => s.id);
  const passed = outcomes.filter((o) => o.status === 'pass').length;
  const failed = outcomes.filter((o) => o.status === 'fail').length;
  const pending = outcomes.filter((o) => o.status === 'pending').length;
  const failHash = failHashOf(outcomes);
  const { next, stuck, done } = settleState(root, readState(root), failHash, remaining, outcomes, at, options.approach);
  const report = { run, at, state: next.state, outcomes, passed, failed, pending, failHash, stuck, done, remaining };
  recordReport(root, report, scenarios, edges);
  recordStopEvidence(root, { run, done, executionPlan, repair: next.repair ?? null, failures: outcomes.flatMap((outcome) => outcome.failure ? [outcome.failure] : []), intentHash: state.intentHash!, scenarios: gated.map((scenario) => ({ id: scenario.id, status: results[scenario.id]?.last ?? 'pending' })) });
  writeState(root, next);
  for (const event of [...(stuck ? ['stuck' as const] : []), ...(done ? ['done' as const] : [])]) record(root, { event, client: detectClient(), model: detectModel(), run, failHash });
  return report;
}


function recordReport(root: string, report: CheckReport, scenarios: Scenario[], edges: Edge[]): void {
  const { run, at, outcomes, passed, failed, failHash } = report;
  const evidence = { schemaVersion: 2, run, at, intentHash: readState(root).intentHash, client: detectClient(), model: detectModel(), scenarioSet: scenarioSetHash(scenarios), results: outcomes.map(({ diagnostic: _private, ...outcome }) => outcome) };
  writeRunEvidence(root, run, evidence);
  const scenarioMap: Record<string, Exclude<LastResult, 'stale'>> = {};
  for (const o of outcomes) scenarioMap[o.id] = o.status as Exclude<LastResult, 'stale'>;
  const harness = detectHarness();
  record(root, { event: 'check', client: evidence.client, model: evidence.model, ...(harness ? { harness } : {}), run, scenarioSet: evidence.scenarioSet, scenarios: scenarioMap, passed, failed, failHash, turns: reportedTurns(), costUsd: reportedCostUsd(), ms: outcomes.reduce((a, o) => a + o.ms, 0), edges });

}

/** DONE with a changed tree goes back to RUNNING. `state` calls this every time. */
export function invalidateDoneIfEdited(root: string): boolean {
  const state = readState(root);
  if (state.state !== 'DONE' || !state.doneTree) return false;
  const basis = readSourceBasis(root);
  const currentHash = intentHash(readText(intentPath(root)) ?? '', readText(scenariosPath(root)) ?? '', basis);
  if (uncoveredRisks(root, loadScenarios(root)).length === 0 && treeHash(root) === state.doneTree && currentHash === state.intentHash && (sourceValidity(root, basis)?.valid ?? true) && consentStatus(root).valid) return false;
  writeState(root, { ...state, state: 'RUNNING', doneAt: null, doneTree: null });
  return true;
}
