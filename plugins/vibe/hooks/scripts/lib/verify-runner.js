/**
 * Verify Runner — verify 시점에 프로젝트 테스트 명령을 훅 프로세스가 직접 실행한다.
 *
 * WHY: verifyPassed 의 근거를 모델이 넘긴 results.json 이 아니라 이 프로세스가 관측한
 * exit code 로 둔다. auto-test 는 편집 파일의 관련 테스트 하나만 돌리므로 전체 스위트
 * 판정은 여기서만 나온다 (SPEC verify-gate-independence, Rejected Alternatives).
 *
 * 감지 순서: .vibe/config.json verifyGate.command → package.json scripts.test
 *          → node_modules/.bin/vitest → node_modules/.bin/jest → null (명령 없음)
 *
 * 명령이 없으면 null 을 돌려주고, run-ledger 는 그 경우를 self-report 등급으로 기록한다.
 * verifyGate.command 는 사용자 문자열이라 shell 로 실행한다 — 모델이 이 값을 바꿀 수
 * 있음은 문서에 명시한다(위조 불가능을 주장하지 않는다).
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { appendHookTestRun } from './hook-test-runs.js';

export const DEFAULT_VERIFY_TIMEOUT_MS = 600_000;
const OUTPUT_TAIL_LINES = 5;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
// Windows 에서 npm/npx 는 .cmd — shell 없이는 execFile 이 찾지 못한다 (auto-test.js 와 동일 규약)
const IS_WINDOWS = process.platform === 'win32';

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readVerifyGateConfig(projectDir) {
  const cfg = readJson(path.join(projectDir, '.vibe', 'config.json'));
  const gate = cfg && cfg.verifyGate;
  return gate && typeof gate === 'object' ? gate : {};
}

function hasBin(projectDir, name) {
  return fs.existsSync(path.join(projectDir, 'node_modules', '.bin', name));
}

/**
 * 실행할 테스트 명령 감지.
 * @param {string} projectDir
 * @returns {{ command: string, args: string[], shell: boolean, source: 'config'|'npm-test'|'vitest'|'jest' }|null}
 */
export function detectTestCommand(projectDir) {
  const gate = readVerifyGateConfig(projectDir);
  if (typeof gate.command === 'string' && gate.command.trim()) {
    return { command: gate.command.trim(), args: [], shell: true, source: 'config' };
  }
  const pkg = readJson(path.join(projectDir, 'package.json'));
  const testScript = pkg && pkg.scripts && pkg.scripts.test;
  if (typeof testScript === 'string' && testScript.trim()) {
    return { command: 'npm', args: ['test'], shell: IS_WINDOWS, source: 'npm-test' };
  }
  if (hasBin(projectDir, 'vitest')) {
    return { command: 'npx', args: ['vitest', 'run'], shell: IS_WINDOWS, source: 'vitest' };
  }
  if (hasBin(projectDir, 'jest')) {
    return { command: 'npx', args: ['jest'], shell: IS_WINDOWS, source: 'jest' };
  }
  return null;
}

/** verifyGate.timeoutMs (양의 정수) 또는 기본값 */
export function resolveVerifyTimeoutMs(projectDir) {
  const value = readVerifyGateConfig(projectDir).timeoutMs;
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_VERIFY_TIMEOUT_MS;
}

function tail(text) {
  return String(text || '').trim().split('\n').slice(-OUTPUT_TAIL_LINES).join('\n');
}

function execute(detected, projectDir, timeoutMs) {
  const options = { cwd: projectDir, timeout: timeoutMs, shell: detected.shell, maxBuffer: MAX_OUTPUT_BYTES };
  return new Promise(resolve => {
    execFile(detected.command, detected.args, options, (err, stdout, stderr) => {
      if (!err) {
        resolve({ exitCode: 0, output: tail(stdout) });
        return;
      }
      const exitCode = Number.isInteger(err.code) ? err.code : 1;
      const timeoutNote = err.killed ? `[verify-runner] killed after ${timeoutMs}ms` : '';
      resolve({ exitCode, output: tail(`${stdout || ''}\n${stderr || ''}\n${timeoutNote}`) });
    });
  });
}

/**
 * 감지된 명령을 실행하고 결과를 hook-test-runs 에 `verify-run` 으로 남긴다.
 * @param {string} projectDir
 * @param {{ timeoutMs?: number, runId?: string|null }} options
 * @returns {Promise<{ command: string, source: string, exitCode: number, at: string, durationMs: number, outputTail: string }|null>}
 */
export async function runIndependentTests(projectDir, options = {}) {
  const detected = detectTestCommand(projectDir);
  if (!detected) return null;
  const timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : resolveVerifyTimeoutMs(projectDir);
  const startedAt = Date.now();
  const { exitCode, output } = await execute(detected, projectDir, timeoutMs);
  const run = {
    command: [detected.command, ...detected.args].join(' '),
    source: detected.source,
    exitCode,
    at: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    outputTail: output,
  };
  appendHookTestRun(projectDir, {
    kind: 'verify-run',
    runId: options.runId || null,
    command: run.command,
    exitCode: run.exitCode,
    at: run.at,
    durationMs: run.durationMs,
  });
  return run;
}
