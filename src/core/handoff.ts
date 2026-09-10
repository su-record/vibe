import { detectClient, detectModel } from './client.js';
import { usage } from './errors.js';
import { loadScenarios } from './intent.js';
import { readLedger, record } from './ledger.js';
import { listRegressions } from './regress.js';
import { readState, writeState } from './state.js';
import { readJson } from './store.js';
import { vibePath } from './paths.js';

const CATEGORIES = ['unavailable-input', 'environment', 'outside-authority', 'technical-limit', 'withdrawn'];
export interface ScenarioHandoff { intentHash: string; scenario: string; reason: string; category: string; owner: string; nextAction: string; evidence: string | null }

export function readHandoffHistory(root: string) {
  const hash = readState(root).intentHash;
  const pending: Record<string, ScenarioHandoff> = {};
  const invalidatedAfter = new Map<string, number>();
  const checkedAt = new Map<string, number>();
  for (const [index, event] of readLedger(root).entries()) {
    if (event.event === 'check' && event.run) {
      for (const [id, status] of Object.entries(event.scenarios ?? {})) if (status === 'pass') checkedAt.set(`${event.run}#${id}`, index);
    }
    if (event.handoff?.intentHash !== hash) continue;
    if (event.event !== 'handoff' && event.event !== 'reopen') continue;
    invalidatedAfter.set(event.handoff.scenario, index);
    if (event.event === 'handoff') pending[event.handoff.scenario] = event.handoff;
    if (event.event === 'reopen') delete pending[event.handoff.scenario];
  }
  return { pending, invalidatedAfter, checkedAt };
}

export function readHandoffs(root: string): Record<string, ScenarioHandoff> {
  return readHandoffHistory(root).pending;
}

function validate(root: string, id: string, reason: string): string {
  const state = readState(root);
  if (!state.intentHash || ![...loadScenarios(root), ...listRegressions(root)].some((s) => s.id === id)) throw usage(`unknown scenario: ${id}`);
  if (!reason.trim() || reason.length > 2000) throw usage('handoff/reopen requires a nonblank reason of at most 2000 characters');
  return state.intentHash;
}

export function handoffScenario(root: string, id: string, input: { reason: string; category: string; nextAction: string; owner?: string }): ScenarioHandoff {
  const intentHash = validate(root, id, input.reason);
  if (!CATEGORIES.includes(input.category)) throw usage(`handoff category must be ${CATEGORIES.join('|')}`);
  if (!input.nextAction.trim() || input.nextAction.length > 2000) throw usage('handoff requires a nonblank --next action of at most 2000 characters');
  const previous = readJson<Record<string, { run?: string }>>(vibePath(root, 'results.json'))?.[id];
  const handoff = { intentHash, scenario: id, reason: input.reason.trim(), category: input.category, owner: input.owner?.trim().slice(0, 200) || 'unknown', nextAction: input.nextAction.trim(), evidence: previous?.run ? `${previous.run}#${id}` : null };
  record(root, { event: 'handoff', client: detectClient(), model: detectModel(), handoff });
  const state = readState(root);
  if (state.state === 'DONE') writeState(root, { ...state, state: 'RUNNING', doneAt: null, doneTree: null });
  return handoff;
}

export function reopenScenario(root: string, id: string, reason: string): void {
  validate(root, id, reason);
  const handoff = readHandoffs(root)[id];
  if (!handoff) throw usage(`scenario is not handed off: ${id}`);
  record(root, { event: 'reopen', client: detectClient(), model: detectModel(), handoff: { ...handoff, reason: reason.trim() } });
}
