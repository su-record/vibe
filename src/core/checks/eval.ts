import fs from 'node:fs';
import path from 'node:path';
import type { EvalCheck } from '../scenarios.js';
import type { CheckResult } from './run.js';
import { checkProcess } from '../check-process.js';
import { outputCapture } from '../output-capture.js';
import { boundedFile } from '../inspect.js';

const DEFAULT_CASE_TIMEOUT_MS = 60_000;
const MAX_MISMATCHES_SHOWN = 5;

interface Case {
  id: string;
  input: unknown;
  expected: unknown;
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
    const lines = boundedFile(path.resolve(root, check.cases)).toString('utf8').split('\n').filter((l) => l.trim());
    cases = lines.map((line, i) => {
      const item = JSON.parse(line) as { id?: string; input?: unknown; expected?: unknown };
      return { id: item.id ?? `#${i + 1}`, input: item.input, expected: item.expected };
    });
  } catch (error) {
    return { pass: false, exit: null, ms: Date.now() - started, tail: '', reason: `cases unreadable: ${(error as Error).message}` };
  }
  const streams = outputCapture();
  const mismatches: string[] = [];
  let matched = 0;
  for (const c of cases) {
    const input = typeof c.input === 'string' ? c.input : JSON.stringify(c.input);
    const processResult = await checkProcess(check.runner, { cwd: root, input, timeoutMs: check.timeoutMs ?? DEFAULT_CASE_TIMEOUT_MS });
    const overflow = streams.add('stdout', processResult.raw.stdout) || streams.add('stderr', processResult.raw.stderr);
    if (processResult.failureCode || processResult.exit !== 0 || overflow) return { ...streams.finish(false), pass: false, exit: processResult.exit, ms: Date.now() - started, tail: '', failureCode: processResult.failureCode ?? (overflow ? 'capture-overflow' : 'runner-exit'), cleanupUncertain: processResult.cleanupUncertain };
    const out = processResult.raw.stdout.toString('utf8');
    if (matches(out, c.expected)) matched += 1;
    else if (mismatches.length < MAX_MISMATCHES_SHOWN) mismatches.push(`${c.id}: got ${JSON.stringify(out.trim()).slice(0, 80)} · expected ${JSON.stringify(c.expected).slice(0, 80)}`);
  }
  const pass = matched >= check.expect.pass;
  const summary = `${matched} of ${cases.length} cases matched (need ${check.expect.pass})`;
  const result: CheckResult = { ...streams.finish(true), pass, exit: pass ? 0 : 1, ms: Date.now() - started, tail: [summary, ...mismatches].join('\n'), ...(pass ? {} : { failureCode: 'eval-mismatch' }) };
  if (!pass) result.reason = summary;
  return result;
}
