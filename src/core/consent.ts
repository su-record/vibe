import { executionPlan, fingerprint, type ExecutionPlan } from './inspect.js';
import { readPrivate, writePrivate } from './private-store.js';
import { denied } from './errors.js';

function receiptName(plan: ExecutionPlan): string { return `consent-${fingerprint(plan.project)}.json`; }

export function consentStatus(root: string, plan = executionPlan(root)): { valid: boolean; changed: string[]; fingerprint: string } {
  const current = fingerprint(plan);
  try {
    const text = readPrivate(root, receiptName(plan));
    if (!text) return { valid: false, changed: ['missing local receipt'], fingerprint: current };
    const saved = JSON.parse(text) as { schemaVersion?: number; fingerprint?: string; plan?: ExecutionPlan };
    if (saved.schemaVersion !== 1 || !saved.plan || saved.fingerprint !== fingerprint(saved.plan)) return { valid: false, changed: ['malformed local receipt'], fingerprint: current };
    const changed = Object.keys(plan).filter((key) => fingerprint(saved.plan![key as keyof ExecutionPlan]) !== fingerprint(plan[key as keyof ExecutionPlan]));
    return { valid: saved.fingerprint === current && changed.length === 0, changed, fingerprint: current };
  } catch { return { valid: false, changed: ['unreadable or unsafe local receipt'], fingerprint: current }; }
}

export function saveConsent(root: string, plan = executionPlan(root)): string {
  if (plan.checks.some((check) => check.verifiers.some((file) => file.sha256 === null))) throw denied('cannot approve unreadable declared verifiers; inspect and fix their paths first');
  return writePrivate(root, receiptName(plan), JSON.stringify({ schemaVersion: 1, approvedAt: new Date().toISOString(), fingerprint: fingerprint(plan), plan }));
}

export function requireConsent(root: string): ExecutionPlan {
  const plan = executionPlan(root);
  const status = consentStatus(root, plan);
  if (!status.valid) throw denied(`local execution consent required (${status.changed.join(', ')}) — run vibe approve --preview, review the plan, then vibe approve`);
  return plan;
}
