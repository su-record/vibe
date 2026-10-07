import { readResults, validateApproval, type CheckOptions } from './check.js';
import { selectScenarios } from './check-selection.js';
import { requireConsent } from './consent.js';
import { loadScenarios } from './intent.js';
import { listRegressions } from './regress.js';
import { repairAwaitingInput } from './repair.js';
import { requireRiskCoverage } from './risk-signals.js';
import { ancestorsOf, isHuman } from './scenarios.js';
import { readState } from './state.js';

/** A read-only view of the existing selector, not a second verdict or execution receipt. */
export function verificationPlan(root: string, options: CheckOptions = {}) {
  const state = readState(root);
  const universe = [...loadScenarios(root), ...listRegressions(root).map(s => ({ ...s, regression: true }))];
  const previous = readResults(root);
  const selected = new Set(selectScenarios(universe, previous, options).map(s => s.id));
  const blockers: string[] = [];
  const waiting = repairAwaitingInput(root, state.repair);
  if (!['APPROVED', 'RUNNING', 'DONE', 'STUCK'].includes(state.state)) blockers.push(`task is ${state.state}; no approved execution`);
  else {
    for (const validate of [() => validateApproval(root, state), () => requireConsent(root), () => requireRiskCoverage(root, universe)]) {
      try { validate(); } catch (error) { blockers.push(error instanceof Error ? error.message : 'validation unavailable'); }
    }
    if (waiting) blockers.push('repair limit reached; existing question needs an answer');
  }
  const checks = universe.map(s => {
    const result = previous[s.id];
    const last = result?.last ?? 'never';
    const decision = blockers.length ? 'blocked' : selected.has(s.id) ? 'selected' : last === 'pass' ? 'reuse' : 'outside-selection';
    const reason = decision === 'reuse' ? 'recorded pass is fresh under existing tree, artifact and handoff rules'
      : decision === 'blocked' ? 'resolve blockers before executing or treating recorded evidence as reusable'
      : decision === 'outside-selection' ? 'not requested; still required before completion'
      : options.all ? 'explicit full run' : options.ids?.includes(s.id) ? 'explicitly requested'
      : isHuman(s) ? 'human judgment; no automatic verdict' : `no reusable pass (${last})`;
    return { id: s.id, type: s.check.type, last, decision, selected: selected.has(s.id), reason,
      evidence: result?.run ? `${result.run}#${s.id}` : null,
      prerequisites: ancestorsOf(universe, [s.id]).filter(id => previous[id]?.last !== 'pass') };
  });
  return { root, recordedState: state.state, blockers, checks,
    qualityReview: { status: 'not-assessed' as const, assessedBy: null,
      guide: 'vibe internal guide verification',
      next: 'For authored output, inspect affected code, prose or rendered UI against its guide before delivery. Record scope, findings and limits in the existing task note or summary.',
      limits: 'Machine passes and DONE do not establish antislop quality. This preview neither performs nor reads an agent assessment; reuse requires unchanged output and criteria.' },
    nextAction: blockers.length ? 'resolve-blockers' : checks.some(c => c.decision === 'selected') ? 'run-selected-checks' : 'inspect-completion-requirements',
    remaining: universe.filter(s => !isHuman(s) && previous[s.id]?.last !== 'pass').map(s => s.id),
    retry: state.repair ? { failures: state.failStreak, waiting,
      next: 'Inspect the existing failure evidence and identify changed input or a new hypothesis before retrying.' } : null,
    limits: 'Read-only snapshot, not DONE, permission or a promise of execution. Check revalidates before running; per-action authority and human/handoff waits still apply. External state, undeclared ignored inputs, host calls and host token costs are not observed. Explicitly rerun checks whose external inputs changed.' };
}
