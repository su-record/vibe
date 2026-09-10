import path from 'node:path';
import type { RunCheck } from '../scenarios.js';
import { checkProcess } from '../check-process.js';
import type { CaptureEvidence } from '../output-capture.js';

export interface CheckResult {
  pass: boolean;
  exit: number | null;
  ms: number;
  tail: string;
  reason?: string;
  signal?: string | null;
  failureCode?: string;
  capture?: CaptureEvidence;
  raw?: { stdout: Buffer; stderr: Buffer };
  cleanupUncertain?: boolean;
  /** What a model-judged check spent, per stage, when the driver reports it. */
  usage?: Array<{ stage: string; input: number; cacheRead: number; cacheWrite: number; output: number }>;
}

const DEFAULT_TIMEOUT_MS = 600_000;
const TAIL_LINES = 8;

export function tail(text: string, lines = TAIL_LINES): string {
  return text.trim().split('\n').slice(-lines).join('\n');
}

/**
 * `run` check — the harness executes the command itself. A model saying "I ran it" never
 * reaches this function. The command string comes from scenarios.yaml, so it runs in a shell,
 * in the project root unless the check names a `cwd`.
 */
export async function runCheck(check: RunCheck, root: string): Promise<CheckResult> {
  const cwd = check.cwd ? path.resolve(root, check.cwd) : root;
  const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const expect = check.expect ?? 0;
  const result = await checkProcess(check.cmd, { cwd, timeoutMs });
  const pass = result.failureCode === null && !result.signal && result.exit === expect;
  const failureCode = result.failureCode ?? (result.signal ? 'signal' : result.exit === 127 ? 'command-not-found' : 'exit-mismatch');
  const { failureCode: _issue, ...observed } = result;
  return { ...observed, pass, tail: tail(result.raw.stdout.toString('utf8') + result.raw.stderr.toString('utf8')), ...(pass ? {} : { reason: failureCode, failureCode }) };
}
