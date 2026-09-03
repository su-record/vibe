import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { EvalCheck } from '../scenarios.js';
import type { CheckResult } from './run.js';

const DEFAULT_CASE_TIMEOUT_MS = 60_000;
const MAX_MISMATCHES_SHOWN = 5;

interface Case {
  id: string;
  input: unknown;
  expected: unknown;
}

function runCase(cmd: string, cwd: string, input: string, timeoutMs: number): Promise<{ out: string; exit: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, shell: true, env: { ...process.env, VIBE_CHECK: '1' }, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => void (out += chunk.toString('utf-8')));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', () => resolve({ out, exit: null }));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ out, exit: code });
    });
    child.stdin.end(input);
  });
}

function matches(out: string, expected: unknown): boolean {
  const text = out.trim();
  if (typeof expected === 'string') return text === expected.trim();
  try {
    return JSON.stringify(JSON.parse(text)) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

/**
 * `eval` check — a labelled case set against a runner. The verdict is a count of matching cases
 * (never a ratio): pass when at least `expect.pass` cases match. Each case is one line of JSONL
 * `{ "input": …, "expected": … }`; input goes to the runner's stdin, stdout is compared to expected.
 */
export async function evalCheck(check: EvalCheck, root: string): Promise<CheckResult> {
  const started = Date.now();
  let cases: Case[];
  try {
    const lines = fs.readFileSync(path.resolve(root, check.cases), 'utf-8').split('\n').filter((l) => l.trim());
    cases = lines.map((line, i) => {
      const item = JSON.parse(line) as { id?: string; input?: unknown; expected?: unknown };
      return { id: item.id ?? `#${i + 1}`, input: item.input, expected: item.expected };
    });
  } catch (error) {
    return { pass: false, exit: null, ms: Date.now() - started, tail: '', reason: `cases unreadable: ${(error as Error).message}` };
  }
  const mismatches: string[] = [];
  let matched = 0;
  for (const c of cases) {
    const input = typeof c.input === 'string' ? c.input : JSON.stringify(c.input);
    const { out } = await runCase(check.runner, root, input, check.timeoutMs ?? DEFAULT_CASE_TIMEOUT_MS);
    if (matches(out, c.expected)) matched += 1;
    else if (mismatches.length < MAX_MISMATCHES_SHOWN) mismatches.push(`${c.id}: got ${JSON.stringify(out.trim()).slice(0, 80)} · expected ${JSON.stringify(c.expected).slice(0, 80)}`);
  }
  const pass = matched >= check.expect.pass;
  const summary = `${matched} of ${cases.length} cases matched (need ${check.expect.pass})`;
  const result: CheckResult = { pass, exit: pass ? 0 : 1, ms: Date.now() - started, tail: [summary, ...mismatches].join('\n') };
  if (!pass) result.reason = summary;
  return result;
}
