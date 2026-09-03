import { createHash } from 'node:crypto';
import { fileCheck } from './checks/file.js';
import { runCheck, type CheckResult } from './checks/run.js';
import { detectClient, detectModel } from './client.js';
import { invalidTransition } from './errors.js';
import { ask, hasOpenQuestion } from './inbox.js';
import { record } from './ledger.js';
import { vibePath } from './paths.js';
import { loadScenarios } from './intent.js';
import { listRegressions } from './regress.js';
import { isHuman, type Scenario } from './scenarios.js';
import { readState, transition, writeState, type StateFile } from './state.js';
import { nowIso, readJson, writeJson } from './store.js';
import { treeHash } from './tree.js';

export type LastResult = 'pass' | 'fail' | 'pending';
export interface ResultsFile {
  [id: string]: { last: LastResult; at: string; run: string };
}

export interface ScenarioOutcome {
  id: string;
  type: Scenario['check']['type'];
  status: LastResult;
  exit: number | null;
  ms: number;
  tail: string;
  reason?: string;
  regression?: boolean;
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
  /** 아직 한 번도 통과하지 않은 시나리오 id — DONE 이 안 된 이유 */
  remaining: string[];
}

export function resultsPath(root: string): string {
  return vibePath(root, 'results.json');
}

export function readResults(root: string): ResultsFile {
  return readJson<ResultsFile>(resultsPath(root)) ?? {};
}

async function execute(scenario: Scenario, root: string): Promise<CheckResult> {
  const check = scenario.check;
  switch (check.type) {
    case 'run':
      return runCheck(check, root);
    case 'file':
      return fileCheck(check, root);
    case 'human':
      return { pass: false, exit: null, ms: 0, tail: check.question, reason: 'human — 판정하지 않는다' };
    default:
      return { pass: false, exit: null, ms: 0, tail: '', reason: `${check.type} 검사는 이 버전(4.0.0-alpha)에서 아직 실행되지 않는다` };
  }
}

function failHashOf(outcomes: ScenarioOutcome[]): string | null {
  const failed = outcomes.filter((o) => o.status === 'fail').sort((a, b) => a.id.localeCompare(b.id));
  if (failed.length === 0) return null;
  const hash = createHash('sha256');
  for (const o of failed) hash.update(`${o.id}|${o.exit}|${o.tail.split('\n')[0] ?? ''}\n`);
  return hash.digest('hex').slice(0, 8);
}

export function scenarioSetHash(scenarios: Scenario[]): string {
  const hash = createHash('sha256');
  for (const s of [...scenarios].sort((a, b) => a.id.localeCompare(b.id))) hash.update(`${s.id}|${JSON.stringify(s.check)}\n`);
  return hash.digest('hex').slice(0, 12);
}

function nextRunId(state: StateFile): string {
  return `r-${state.runs + 1}`;
}

function askHumanOnce(root: string, scenario: Scenario): void {
  if (scenario.check.type !== 'human') return;
  const question = scenario.check.question;
  if (hasOpenQuestion(root, (q) => q.scenario === scenario.id)) return;
  ask(root, { question, scenario: scenario.id });
}

export interface CheckOptions {
  ids?: string[];
  all?: boolean;
}

/**
 * 유일한 판정 경로. 검사를 하네스가 실행하고 Evidence 를 쓴다.
 * 첫 호출에 APPROVED→RUNNING, 전부 통과면 DONE, 같은 실패 해시 2회 연속이면 STUCK.
 */
export async function runChecks(root: string, options: CheckOptions = {}): Promise<CheckReport> {
  const state = readState(root);
  if (!['APPROVED', 'RUNNING', 'DONE', 'STUCK'].includes(state.state)) {
    throw invalidTransition(`check 는 승인 뒤에만 돈다 (현재 ${state.state})`);
  }
  const scenarios = loadScenarios(root);
  const regressions = listRegressions(root);
  const universe: Array<Scenario & { regression?: boolean }> = [...scenarios, ...regressions.map((r) => ({ ...r, regression: true }))];
  const previous = readResults(root);

  let selected: Array<Scenario & { regression?: boolean }>;
  if (options.ids && options.ids.length > 0) {
    const wanted = new Set(options.ids);
    selected = universe.filter((s) => wanted.has(s.id));
    const missing = options.ids.filter((id) => !universe.some((s) => s.id === id));
    if (missing.length > 0) throw invalidTransition(`알 수 없는 시나리오: ${missing.join(', ')}`);
  } else if (options.all) {
    selected = universe;
  } else {
    selected = universe.filter((s) => isHuman(s) || previous[s.id]?.last !== 'pass');
  }

  if (state.state === 'APPROVED') transition(root, 'RUNNING');
  const run = nextRunId(state);
  const at = nowIso();
  const outcomes: ScenarioOutcome[] = [];
  for (const scenario of selected) {
    const result = await execute(scenario, root);
    const status: LastResult = isHuman(scenario) ? 'pending' : result.pass ? 'pass' : 'fail';
    if (isHuman(scenario)) askHumanOnce(root, scenario);
    const outcome: ScenarioOutcome = { id: scenario.id, type: scenario.check.type, status, exit: result.exit, ms: result.ms, tail: result.tail };
    if (result.reason) outcome.reason = result.reason;
    if (scenario.regression) outcome.regression = true;
    outcomes.push(outcome);
  }

  const results: ResultsFile = { ...previous };
  for (const o of outcomes) results[o.id] = { last: o.status, at, run };
  writeJson(resultsPath(root), results);

  const gated = universe.filter((s) => !isHuman(s));
  const remaining = gated.filter((s) => results[s.id]?.last !== 'pass').map((s) => s.id);
  const passed = outcomes.filter((o) => o.status === 'pass').length;
  const failed = outcomes.filter((o) => o.status === 'fail').length;
  const pending = outcomes.filter((o) => o.status === 'pending').length;
  const failHash = failHashOf(outcomes);

  const current = readState(root);
  let stuck = false;
  let done = false;
  let next: StateFile = { ...current, runs: current.runs + 1 };
  if (failHash !== null) {
    const streak = failHash === current.lastFailHash ? current.failStreak + 1 : 1;
    next = { ...next, lastFailHash: failHash, failStreak: streak };
    if (streak >= 2) {
      stuck = true;
      next.state = 'STUCK';
      if (!hasOpenQuestion(root, (q) => q.question.startsWith('STUCK'))) {
        ask(root, { question: `STUCK: 같은 실패(${failHash})가 2회 연속이다 — ${outcomes.filter((o) => o.status === 'fail').map((o) => o.id).join(', ')}. 어떻게 할까요?`, options: ['힌트를 준다', '시나리오를 고친다', '중단한다'] });
      }
    } else if (current.state === 'DONE' || current.state === 'STUCK') {
      next.state = 'RUNNING';
    }
  } else {
    next = { ...next, lastFailHash: null, failStreak: 0 };
    if (remaining.length === 0) {
      done = true;
      next.state = 'DONE';
      next.doneAt = at;
      next.doneTree = treeHash(root);
    } else if (current.state === 'STUCK') {
      next.state = 'RUNNING';
    }
  }
  writeState(root, next);

  const evidence = { run, at, client: detectClient(), model: detectModel(), scenarioSet: scenarioSetHash(scenarios), results: outcomes };
  writeJson(vibePath(root, 'evidence', `${run}.json`), evidence);
  const scenarioMap: Record<string, LastResult> = {};
  for (const o of outcomes) scenarioMap[o.id] = o.status;
  record(root, { event: 'check', client: evidence.client, model: evidence.model, run, scenarioSet: evidence.scenarioSet, scenarios: scenarioMap, passed, failed, failHash, ms: outcomes.reduce((a, o) => a + o.ms, 0) });
  if (stuck) record(root, { event: 'stuck', client: evidence.client, model: evidence.model, run, failHash });
  if (done) record(root, { event: 'done', client: evidence.client, model: evidence.model, run });

  return { run, at, state: next.state, outcomes, passed, failed, pending, failHash, stuck, done, remaining };
}

/** DONE 인데 트리가 바뀌었으면 RUNNING 으로 되돌린다. state 명령이 매번 부른다. */
export function invalidateDoneIfEdited(root: string): boolean {
  const state = readState(root);
  if (state.state !== 'DONE' || !state.doneTree) return false;
  if (treeHash(root) === state.doneTree) return false;
  writeState(root, { ...state, state: 'RUNNING', doneAt: null, doneTree: null });
  return true;
}
