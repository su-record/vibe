import { invalidTransition } from './errors.js';
import { ancestorsOf, isHuman, type Scenario } from './scenarios.js';
import type { CheckOptions, ResultsFile } from './check.js';

export type Selectable = Scenario & { regression?: boolean };

export function selectScenarios(universe: Selectable[], previous: ResultsFile, options: CheckOptions): Selectable[] {
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

