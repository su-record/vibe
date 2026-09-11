import type { FileCheck, Scenario, Rejection } from './scenarios.js';

export const RISK_KINDS = ['data', 'access', 'interface', 'deployment', 'integration'] as const;
export interface Risk {
  kind: typeof RISK_KINDS[number];
  paths?: string[];
  impact: string;
  recovery: string;
  failureChecks: string[];
  recoveryChecks: string[];
}

/** Validate declared obligations; this does not infer domain risks from arbitrary source code. */
export function riskReason(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'risk must be an object';
  const risk = value as Record<string, unknown>;
  if (!RISK_KINDS.includes(risk['kind'] as Risk['kind'])) return `risk.kind must be ${RISK_KINDS.join('|')}`;
  for (const key of ['impact', 'recovery']) {
    if (typeof risk[key] !== 'string' || !risk[key].trim()) return `risk.${key} must explain the affected behavior and recovery`;
  }
  for (const key of ['failureChecks', 'recoveryChecks']) {
    const ids = risk[key];
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !id.trim())) return `risk.${key} must name at least one scenario`;
  }
  if (risk['paths'] !== undefined && (!Array.isArray(risk['paths']) || risk['paths'].some(p => typeof p !== 'string' || !p || p.startsWith('/') || p.includes('..') || p.includes('\\') || p === '.'))) return 'risk.paths must contain project-relative files or directories';
  const allowed = new Set(['paths', 'kind', 'impact', 'recovery', 'failureChecks', 'recoveryChecks']);
  if (Object.keys(risk).some(key => !allowed.has(key))) return 'unknown risk field';
  return null;
}

function assertsContent(check: FileCheck): boolean {
  if (check.exists === false) return false;
  return [check.pattern, check.contains, check.absent, check.traceable, check.schema].some(value => typeof value === 'string' && value.trim().length > 0)
    || check.a11y === true || check.sum !== undefined;
}

/** Risk obligations use the existing dependency scheduler and verdict, not a second pipeline. */
export function bindRiskChecks(scenarios: Scenario[], rejections: Rejection[]): void {
  const byId = new Map(scenarios.map(s => [s.id, s]));
  for (const scenario of scenarios) {
    if (!scenario.risk) continue;
    if (scenario.check.type === 'human') rejections.push({ id: scenario.id, reason: 'a risk-bearing scenario must have a machine verdict' });
    const required = [...new Set([...scenario.risk.failureChecks, ...scenario.risk.recoveryChecks])];
    for (const id of required) {
      const target = byId.get(id);
      if (!target) { rejections.push({ id: scenario.id, reason: `risk check does not exist: ${id}` }); continue; }
      if (id === scenario.id || target.check.type === 'human' || target.check.type === 'review') {
        rejections.push({ id: scenario.id, reason: `risk check ${id} must be a separate machine check` });
      }
      if (target.irreversible) rejections.push({ id: scenario.id, reason: `risk check ${id} must use a local fixture or dry run, not an irreversible action` });
      if (target.check.type === 'file' && !assertsContent(target.check)) {
        rejections.push({ id: scenario.id, reason: `risk check ${id} must assert behavior or content, not only file existence` });
      }
      if (['run', 'eval'].includes(target.check.type) && !target.verifiers?.length) {
        rejections.push({ id: scenario.id, reason: `risk check ${id} requires explicit verifier files` });
      }
    }
    scenario.needs = [...new Set([...(scenario.needs ?? []), ...required])];
  }
}
