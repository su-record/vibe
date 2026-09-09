import { invalidateDoneIfEdited, readResults, type LastResult } from './check.js';
import { openQuestions } from './inbox.js';
import { hasIntent, intentPath, loadScenarios } from './intent.js';
import { readLedger } from './ledger.js';
import { actionOf } from './checks/mutation.js';
import { listRegressions, regressionProblems } from './regress.js';
import { isHuman } from './scenarios.js';
import { suggestSkills, type Proposal } from './skills.js';
import { readState, stageOf, type Stage, type State } from './state.js';
import { readText } from './store.js';
import path from 'node:path';

export interface ScenarioView {
  id: string;
  then: string;
  type: string;
  last: LastResult | 'never';
  at: string | null;
  regression?: boolean;
  irreversible?: string;
  needs?: string[];
  /** What the check runs or reads — the command, the path, the URL, the question — so `vibe state` is the brief and scenarios.yaml need not be opened. */
  check: string;
}

export interface StateView {
  /** The resolved project root — every record below lives in `${root}/.vibe` */
  root: string;
  state: State;
  stage: Stage;
  intent: { title: string; hash: string | null; approvedAt: string | null } | null;
  scenarios: ScenarioView[];
  remaining: string[];
  inbox: { open: number; items: Array<{ id: string; question: string; options?: string[]; default?: string; scenario?: string; needs?: string }> };
  last: { client: string; model: string | null; at: string } | null;
  /** Skill create/import/knowledge proposals from scenarios, regressions, inbox and state signals — at most three */
  proposals: Proposal[];
  notices: string[];
  /** What to do now, in one line — the router follows this, not a skill file. */
  next: string;
  /** `small`: at most four scenarios, all run/file, no needs chain deeper than one — one `check --all` at the end.
   * `full` is the same procedure plus failure handling: `vibe context <id>` and `vibe check <id>` only for a scenario that failed. */
  size: 'small' | 'full';
}

function sizeOf(scenarios: Array<{ id: string; check: { type: string }; needs?: string[]; regression?: boolean }>): 'small' | 'full' {
  const own = scenarios.filter((s) => !('regression' in s && s.regression));
  if (own.length > 4) return 'full';
  const byId = new Map(own.map((s) => [s.id, s]));
  for (const s of own) {
    if (s.check.type !== 'run' && s.check.type !== 'file') return 'full';
    if ((s.needs ?? []).some((n) => (byId.get(n)?.needs ?? []).length > 0)) return 'full';
  }
  return 'small';
}

/** The one thing a check acts on: a run's command, a file's path, an http call, a review's path, a human's question. */
function checkTarget(check: Record<string, unknown>): string {
  const c = check as { type?: string; cmd?: string; path?: string; url?: string; method?: string; question?: string };
  if (c.cmd) return c.cmd;
  if (c.path) return c.path;
  if (c.url) return `${c.method ?? 'GET'} ${c.url}`;
  if (c.question) return c.question;
  return c.type ?? '';
}

function nextLine(state: State, stage: Stage, remaining: string[], inbox: string[], size: 'small' | 'full', run: number): string {
  if (state === 'STUCK') return `prove — STUCK: answer inbox [${inbox.join(', ')}], then vibe check --all`;
  if (inbox.length > 0) return `answer inbox [${inbox.join(', ')}] — then continue`;
  if (stage === 'discover') return 'discover — the vibe-discover skill: what counts as success, at most three questions';
  if (stage === 'scope') return 'approve — the vibe-scope skill: vibe intent analyze, research, one approval message; wait for "yes"';
  if (state === 'DONE') return `report — DONE r-${run}: answer the user from this output — what was built, which checks passed — with no skill and no further reads; HANDOFF.md only if the intent asks`;
  if (remaining.length === 0) return 'check --all — nothing remaining; the verdict comes from vibe check';
  const tail = size === 'small' ? 'then one vibe check --all' : 'then vibe check --all; on a failure, vibe context <id> then vibe check <id>';
  return `build ${remaining.join(', ')} — ${tail}`;
}

function intentTitle(root: string): string {
  const text = readText(intentPath(root)) ?? '';
  const heading = text.split('\n').find((line) => line.startsWith('#'));
  return heading ? heading.replace(/^#+\s*/, '').trim() : '(untitled)';
}

/** Every skill's first call. A DONE invalidated by edits falls back to RUNNING here. */
export function buildStateView(root: string, cwd: string = process.cwd()): StateView {
  const notices: string[] = [];
  if (path.resolve(cwd) !== path.resolve(root)) notices.push(`project root is ${root} — above the current directory; records and run checks use that root`);
  if (invalidateDoneIfEdited(root)) notices.push('files changed after DONE — state is RUNNING again; run `vibe check`');
  const state = readState(root);
  const results = readResults(root);
  const scenarios = loadScenarios(root);
  const regressions = listRegressions(root);
  const views: ScenarioView[] = [...scenarios, ...regressions.map((r) => ({ ...r, regression: true }))].map((s) => {
    const view: ScenarioView = { id: s.id, then: s.then, type: s.check.type, last: results[s.id]?.last ?? 'never', at: results[s.id]?.at ?? null, check: checkTarget(s.check as unknown as Record<string, unknown>) };
    if ('regression' in s && s.regression) view.regression = true;
    if (s.irreversible) view.irreversible = s.irreversible;
    if (s.needs) view.needs = s.needs;
    return view;
  });
  const gated = views.filter((v) => v.type !== 'human');
  const remaining = gated.filter((v) => v.last !== 'pass').map((v) => v.id);
  const allPassedOnce = gated.length > 0 && remaining.length === 0;
  const questions = openQuestions(root).map((q) => {
    const item: StateView['inbox']['items'][number] = { id: q.id, question: q.question };
    if (q.options) item.options = q.options;
    if (q.default) item.default = q.default;
    if (q.scenario) item.scenario = q.scenario;
    if (q.needs) item.needs = q.needs;
    return item;
  });
  const lastEvent = readLedger(root).at(-1);
  const intent = hasIntent(root) ? { title: intentTitle(root), hash: state.intentHash, approvedAt: state.approvedAt } : null;
  notices.push(...regressionProblems(root));
  for (const s of scenarios) if (s.irreversible) notices.push(`${s.id} mutates (${actionOf(s.irreversible)}) — not run by check --all without vibe authorize --action ${actionOf(s.irreversible)}`);
  if (state.state === 'STUCK') notices.push('STUCK — the same failure twice in a row; the inbox question needs an answer');
  if (scenarios.some(isHuman) && state.state === 'DONE') notices.push('human items are not gates — a confirmation was requested in the inbox');
  const stage = stageOf(state, intent !== null, allPassedOnce);
  const size = sizeOf([...scenarios, ...regressions.map((r) => ({ ...r, regression: true }))]);
  return {
    root,
    state: state.state,
    stage,
    next: nextLine(state.state, stage, remaining, questions.map((q) => q.id), size, state.runs),
    size,
    intent,
    scenarios: views,
    remaining,
    inbox: { open: questions.length, items: questions },
    last: lastEvent ? { client: lastEvent.client, model: lastEvent.model, at: lastEvent.at } : null,
    proposals: suggestSkills(root),
    notices,
  };
}
