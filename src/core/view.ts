import { invalidateDoneIfEdited, readResults, type LastResult } from './check.js';
import { openQuestions } from './inbox.js';
import { hasIntent, intentPath, loadScenarios } from './intent.js';
import { readLedger } from './ledger.js';
import { listRegressions } from './regress.js';
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
    const view: ScenarioView = { id: s.id, then: s.then, type: s.check.type, last: results[s.id]?.last ?? 'never', at: results[s.id]?.at ?? null };
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
  if (state.state === 'STUCK') notices.push('STUCK — the same failure twice in a row; the inbox question needs an answer');
  if (scenarios.some(isHuman) && state.state === 'DONE') notices.push('human items are not gates — a confirmation was requested in the inbox');
  return {
    root,
    state: state.state,
    stage: stageOf(state, intent !== null, allPassedOnce),
    intent,
    scenarios: views,
    remaining,
    inbox: { open: questions.length, items: questions },
    last: lastEvent ? { client: lastEvent.client, model: lastEvent.model, at: lastEvent.at } : null,
    proposals: suggestSkills(root),
    notices,
  };
}
