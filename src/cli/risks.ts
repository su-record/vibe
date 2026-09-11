import { riskSignals, uncoveredRisks } from '../core/risk-signals.js';
import { loadScenarios } from '../core/intent.js';
import type { Output } from './common.js';

export function cmdRisks(root: string): Output {
  const scenarios = loadScenarios(root);
  const signals = riskSignals(root, scenarios);
  const missing = uncoveredRisks(root, scenarios, signals);
  const checks = scenarios.filter(s => !s.irreversible && !['human', 'review'].includes(s.check.type))
    .map(s => ({ id: s.id, then: s.then, verifiers: s.verifiers ?? [] }));
  const json = { signals: signals.slice(0, 100), missing: missing.slice(0, 20), existingChecks: checks.slice(0, 20), counts: { signals: signals.length, missing: missing.length, existingChecks: checks.length },
    next: missing.length ? 'Reuse relevant existing checks; connect missing outcomes with risk.kind, risk.paths and failure/recovery checks. Do not create a duplicate test merely for a new stage.' : 'No uncovered detected risk; continue with the existing checks.',
    limits: 'Deterministic path and action rules, not complete semantic analysis. Missing Git baseline or non-Git projects inspect all available paths conservatively.' };
  return { json, text: JSON.stringify(json, null, 2), code: 0 };
}
