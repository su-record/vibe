import { invalidateDoneIfEdited, readResults, type LastResult } from './check.js';
import { openQuestions } from './inbox.js';
import { hasIntent, intentPath, loadScenarios } from './intent.js';
import { readLedger } from './ledger.js';
import { listRegressions } from './regress.js';
import { isHuman } from './scenarios.js';
import { readState, stageOf, type Stage, type State } from './state.js';
import { readText } from './store.js';

export interface ScenarioView {
  id: string;
  then: string;
  type: string;
  last: LastResult | 'never';
  at: string | null;
  regression?: boolean;
  irreversible?: string;
}

export interface StateView {
  state: State;
  stage: Stage;
  intent: { title: string; hash: string | null; approvedAt: string | null } | null;
  scenarios: ScenarioView[];
  remaining: string[];
  inbox: { open: number; items: Array<{ id: string; question: string; options?: string[]; default?: string; scenario?: string; needs?: string }> };
  last: { client: string; model: string | null; at: string } | null;
  /** 스킬 생성·가져오기 제안 — 4.0.0-alpha 에서는 비어 있다 (3단계) */
  proposals: Array<{ kind: string; ref: string; why: string }>;
  notices: string[];
}

function intentTitle(root: string): string {
  const text = readText(intentPath(root)) ?? '';
  const heading = text.split('\n').find((line) => line.startsWith('#'));
  return heading ? heading.replace(/^#+\s*/, '').trim() : '(제목 없음)';
}

/** 모든 스킬의 첫 호출. DONE 이 편집으로 무효가 됐으면 여기서 RUNNING 으로 돌아간다. */
export function buildStateView(root: string): StateView {
  const notices: string[] = [];
  if (invalidateDoneIfEdited(root)) notices.push('DONE 이후 파일이 바뀌어 RUNNING 으로 돌아갔다 — `vibe check` 를 다시 돌려야 한다');
  const state = readState(root);
  const results = readResults(root);
  const scenarios = loadScenarios(root);
  const regressions = listRegressions(root);
  const views: ScenarioView[] = [...scenarios, ...regressions.map((r) => ({ ...r, regression: true }))].map((s) => {
    const view: ScenarioView = { id: s.id, then: s.then, type: s.check.type, last: results[s.id]?.last ?? 'never', at: results[s.id]?.at ?? null };
    if ('regression' in s && s.regression) view.regression = true;
    if (s.irreversible) view.irreversible = s.irreversible;
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
  if (state.state === 'STUCK') notices.push('STUCK — 같은 실패가 2회 연속이다. 인박스의 질문에 답이 필요하다');
  if (scenarios.some(isHuman) && state.state === 'DONE') notices.push('human 항목은 게이트가 아니다 — 인박스에서 사람 확인을 요청했다');
  return {
    state: state.state,
    stage: stageOf(state, intent !== null, allPassedOnce),
    intent,
    scenarios: views,
    remaining,
    inbox: { open: questions.length, items: questions },
    last: lastEvent ? { client: lastEvent.client, model: lastEvent.model, at: lastEvent.at } : null,
    proposals: [],
    notices,
  };
}
