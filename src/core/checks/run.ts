import { spawn } from 'node:child_process';
import path from 'node:path';
import type { RunCheck } from '../scenarios.js';

export interface CheckResult {
  pass: boolean;
  exit: number | null;
  ms: number;
  tail: string;
  reason?: string;
}

const DEFAULT_TIMEOUT_MS = 600_000;
const TAIL_LINES = 8;
const MAX_CAPTURE = 256 * 1024;

export function tail(text: string, lines = TAIL_LINES): string {
  return text.trim().split('\n').slice(-lines).join('\n');
}

/**
 * `run` check — the harness executes the command itself. A model saying "I ran it" never
 * reaches this function. The command string comes from scenarios.yaml, so it runs in a shell.
 */
export function runCheck(check: RunCheck, root: string): Promise<CheckResult> {
  const cwd = check.cwd ? path.resolve(root, check.cwd) : root;
  const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const expect = check.expect ?? 0;
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(check.cmd, { cwd, shell: true, env: { ...process.env, VIBE_CHECK: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let captured = '';
    const capture = (chunk: Buffer): void => {
      if (captured.length < MAX_CAPTURE) captured += chunk.toString('utf-8');
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      captured += `\n[vibe] killed after ${timeoutMs}ms`;
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ pass: false, exit: null, ms: Date.now() - started, tail: tail(captured), reason: `spawn failed: ${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const exit = code ?? null;
      resolve({ pass: exit === expect, exit, ms: Date.now() - started, tail: tail(captured) });
    });
  });
}
