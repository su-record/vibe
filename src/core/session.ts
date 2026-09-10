import type { FailureSummary } from './failure.js';
import type { RepairState } from './repair.js';
import { createRequire } from 'node:module';
import { denied } from './errors.js';
import { inspectContract, type ExecutionPlan } from './inspect.js';
import { listRegressions, regressionProblems } from './regress.js';
import fs from 'node:fs';
import path from 'node:path';

export interface StopEvidenceInput {
  run: string;
  done: boolean;
  intentHash: string;
  executionPlan: ExecutionPlan;
  repair?: RepairState | null;
  failures?: FailureSummary[];
  scenarios: Array<{ id: string; status: 'pass' | 'fail' | 'pending' | 'blocked' | 'stale' | 'handoff' }>;
}
interface SessionView { status: string; root?: string; revision?: string; complete?: boolean; [key: string]: unknown }
const runtime = createRequire(import.meta.url)('../../hooks/session-state.cjs') as {
  identity(payload: { session_id?: string }): string;
  bindSession(root: string, id: string, scenarios: Array<{ id: string; needs?: string[] }>): SessionView;
  recordStopEvidence(root: string, input: StopEvidenceInput): unknown;
  sessionStatus(payload: { session_id?: string }): SessionView;
};
export function bindSession(root: string, requested?: string): SessionView {
  try {
    const id = runtime.identity(requested ? { session_id: requested } : {});
    const contract = fs.existsSync(path.join(root, '.vibe/scenarios.yaml')) ? inspectContract(root) : { scenarios: [], rejections: [] };
    if (contract.rejections.length || regressionProblems(root).length) throw denied('cannot bind an invalid contract; inspect and correct it first');
    return runtime.bindSession(root, id, [...contract.scenarios, ...listRegressions(root)]);
  } catch (error) { throw denied((error as Error).message); }
}
export function sessionStatus(requested?: string): SessionView { return runtime.sessionStatus(requested ? { session_id: requested } : {}); }
export function recordStopEvidence(root: string, input: StopEvidenceInput): void {
  try { runtime.recordStopEvidence(root, input); }
  catch (error) { throw denied(`cannot retain explicit Stop evidence: ${(error as Error).message}`); }
}
