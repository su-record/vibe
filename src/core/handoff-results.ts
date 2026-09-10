import type { LastResult, ResultsFile } from './check.js';
import { readHandoffHistory } from './handoff.js';
import { loadScenarios } from './intent.js';
import { listRegressions } from './regress.js';

interface Dependency { id: string; needs?: string[] }

function descendants(scenarios: Dependency[], roots: string[]): Set<string> {
  const found = new Set(roots);
  const queue = [...roots];
  for (let i = 0; i < queue.length; i += 1) {
    for (const scenario of scenarios) {
      if (found.has(scenario.id) || !scenario.needs?.includes(queue[i]!)) continue;
      found.add(scenario.id);
      queue.push(scenario.id);
    }
  }
  return found;
}

/** Ledger order distinguishes proof from a later handoff even when their timestamps are equal. */
export function foldHandoffResults(root: string, results: ResultsFile): ResultsFile {
  const { pending, invalidatedAfter, checkedAt } = readHandoffHistory(root);
  const scenarios = [...loadScenarios(root), ...listRegressions(root)];
  const live: ResultsFile = Object.fromEntries(Object.entries(results).map(([id, result]) => [id, { ...result }]));
  for (const [parent, cutoff] of invalidatedAfter) {
    for (const id of descendants(scenarios, [parent])) {
      const result = live[id];
      if (result?.last === 'pass' && (checkedAt.get(`${result.run}#${id}`) ?? -1) <= cutoff) result.last = 'pending';
    }
  }
  for (const [id, result] of Object.entries(live)) if (result.last === 'handoff' && !pending[id]) result.last = 'pending';
  for (const id of descendants(scenarios, Object.keys(pending))) {
    live[id] = { ...(live[id] ?? { at: '', run: '' }), last: pending[id] ? 'handoff' : 'blocked' };
  }
  return live;
}

/** Independent authorization failures are still work; only descendants of a handoff are held by it. */
export function isHandoffOnly(pending: Array<Dependency & { last: LastResult | 'never' }>): boolean {
  const held = new Set(pending.filter((scenario) => scenario.last === 'handoff').map((scenario) => scenario.id));
  const blocked = pending.filter((scenario) => scenario.last === 'blocked');
  const closure = descendants(blocked, [...held]);
  return held.size > 0 && pending.every((scenario) => closure.has(scenario.id));
}
