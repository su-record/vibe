/**
 * run-ledger 근거 등급 — verifyPassed 는 독립 실행으로만 서고, 명령이 없을 때만 self-report
 * (SPEC verify-gate-independence)
 *
 * REQ-verify-gate-independence-002 · 003 · 005 커버리지:
 *   D3  independentRun exit 0 → verifyPassed=true, verifyBasis=independent
 *   D4  independentRun exit 1 → 거부 (모델 results 가 전부 0 이어도)
 *   D5  verify-ledger.js CLI 가 scripts.test 를 직접 실행해 판정한다
 *   D6  명령 미감지 + results 전부 0 → verifyBasis=self-report
 *   D7  명령 감지 + independentRun 없음 → 거부, 사유에 independent
 *   D10 evidence.json 1.1.0 스키마 키
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEDGER = path.resolve(__dirname, '..', 'lib', 'run-ledger.js');
const RUNNER = path.resolve(__dirname, '..', 'lib', 'verify-runner.js');
const HOOK_RUNS = path.resolve(__dirname, '..', 'lib', 'hook-test-runs.js');
const CLI = path.resolve(__dirname, '..', 'verify-ledger.js');

const REPORTED_OK = [{ command: 'npm test', exitCode: 0 }];

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-verify-basis-'));
});
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function writePackageJson(projectDir, testScript) {
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'verify-basis-fixture', version: '1.0.0', scripts: { test: testScript } }),
  );
}

function independentRun(exitCode) {
  return { command: 'npm test', source: 'npm-test', exitCode, at: new Date().toISOString(), durationMs: 5 };
}

describe('recordVerifyDetailed — 근거 등급', () => {
  it('D3 — 독립 실행 exit 0 → verifyPassed=true, basis=independent', async () => {
    const { recordRunStart, recordVerifyDetailed, readLedger } = await import(LEDGER);
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);
    const result = recordVerifyDetailed(tmpDir, true, { runId, independentRun: independentRun(0) });
    expect(result).toEqual({ ok: true, basis: 'independent', reason: null });
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(true);
    expect(ledger.verifyBasis).toBe('independent');
    expect(ledger.independentRun).toMatchObject({ command: 'npm test', exitCode: 0 });
  });

  it('D4 — 독립 실행 exit 1 이면 모델 results 가 전부 0 이어도 거부', async () => {
    const { recordRunStart, recordVerifyDetailed, readLedger } = await import(LEDGER);
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);
    const result = recordVerifyDetailed(tmpDir, true, {
      runId,
      verificationResults: REPORTED_OK,
      independentRun: independentRun(1),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('independent test run failed');
    expect(readLedger(tmpDir).verifyPassed).toBe(false);
  });

  it('D6 — 테스트 명령이 없으면 results 전부 0 으로 self-report 등급 통과', async () => {
    const { recordRunStart, recordVerifyDetailed, readLedger } = await import(LEDGER);
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);
    const result = recordVerifyDetailed(tmpDir, true, { runId, verificationResults: REPORTED_OK });
    expect(result).toEqual({ ok: true, basis: 'self-report', reason: null });
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(true);
    expect(ledger.verifyBasis).toBe('self-report');
  });

  it('D6 보완 — self-report 등급도 results 가 비었거나 실패가 있으면 거부', async () => {
    const { recordRunStart, recordVerifyDetailed, readLedger } = await import(LEDGER);
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);
    expect(recordVerifyDetailed(tmpDir, true, { runId, verificationResults: [] }).ok).toBe(false);
    expect(recordVerifyDetailed(tmpDir, true, {
      runId, verificationResults: [{ command: 'npm test', exitCode: 2 }],
    }).ok).toBe(false);
    expect(readLedger(tmpDir).verifyPassed).toBe(false);
  });

  it('D7 — 명령이 감지되는데 독립 실행이 없으면 거부, 사유에 independent', async () => {
    const { recordRunStart, recordVerifyDetailed, readLedger } = await import(LEDGER);
    writePackageJson(tmpDir, 'exit 0');
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);
    const result = recordVerifyDetailed(tmpDir, true, { runId, verificationResults: REPORTED_OK });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('independent');
    expect(result.reason).toContain('npm test');
    expect(readLedger(tmpDir).verifyPassed).toBe(false);
  });

  it('fail 기록은 등급을 묻지 않는다 — 독립 실행 없이도 verifyPassed=false 로 기록', async () => {
    const { recordRunStart, recordVerifyDetailed, readLedger } = await import(LEDGER);
    writePackageJson(tmpDir, 'exit 0');
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);
    expect(recordVerifyDetailed(tmpDir, false, { runId }).ok).toBe(true);
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(false);
    expect(typeof ledger.verifyAt).toBe('string');
  });

  it('recordRunStart 는 이전 run 의 등급·독립 실행 필드를 지운다', async () => {
    const { recordRunStart, recordVerifyDetailed, readLedger } = await import(LEDGER);
    recordRunStart(tmpDir, 'f1');
    recordVerifyDetailed(tmpDir, true, { runId: readLedger(tmpDir).runId, independentRun: independentRun(0) });
    recordRunStart(tmpDir, 'f2');
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(false);
    expect(ledger.verifyBasis).toBeUndefined();
    expect(ledger.independentRun).toBeUndefined();
  });

  it('D10 — evidence.json 이 1.1.0 스키마로 등급·독립 실행·보고 결과·훅 기록을 담는다', async () => {
    const { recordRunStart, recordVerifyDetailed, readLedger } = await import(LEDGER);
    const { appendHookTestRun } = await import(HOOK_RUNS);
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);
    appendHookTestRun(tmpDir, { kind: 'edit', filePath: 'src/a.ts' });
    recordVerifyDetailed(tmpDir, true, { runId, verificationResults: REPORTED_OK, independentRun: independentRun(0) });
    const evidence = JSON.parse(fs.readFileSync(path.join(tmpDir, '.vibe', 'runs', runId, 'evidence.json'), 'utf-8'));
    expect(evidence.schemaVersion).toBe('1.1.0');
    const det = evidence.judges.deterministic;
    expect(det.verifyBasis).toBe('independent');
    expect(det.independentRun).toMatchObject({ command: 'npm test', exitCode: 0 });
    expect(det.reportedResults).toEqual(REPORTED_OK);
    expect(det.hookTestRuns.map(r => r.kind)).toEqual(['edit']);
  });
});

describe('verify-runner — 명령 감지', () => {
  it('감지 순서: verifyGate.command > scripts.test > vitest > jest > null', async () => {
    const { detectTestCommand } = await import(RUNNER);
    expect(detectTestCommand(tmpDir)).toBeNull();

    fs.mkdirSync(path.join(tmpDir, 'node_modules', '.bin'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', '.bin', 'jest'), '');
    expect(detectTestCommand(tmpDir)).toMatchObject({ source: 'jest' });

    fs.writeFileSync(path.join(tmpDir, 'node_modules', '.bin', 'vitest'), '');
    expect(detectTestCommand(tmpDir)).toMatchObject({ source: 'vitest' });

    writePackageJson(tmpDir, 'vitest run');
    expect(detectTestCommand(tmpDir)).toMatchObject({ source: 'npm-test', command: 'npm', args: ['test'] });

    fs.mkdirSync(path.join(tmpDir, '.vibe'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.vibe', 'config.json'), JSON.stringify({ verifyGate: { command: 'make test' } }));
    expect(detectTestCommand(tmpDir)).toMatchObject({ source: 'config', command: 'make test', shell: true });
  });

  it('runIndependentTests 는 명령이 없으면 null, 있으면 실행해 verify-run 을 남긴다', async () => {
    const { runIndependentTests } = await import(RUNNER);
    const { readHookTestRuns } = await import(HOOK_RUNS);
    expect(await runIndependentTests(tmpDir)).toBeNull();

    fs.mkdirSync(path.join(tmpDir, '.vibe'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.vibe', 'config.json'), JSON.stringify({ verifyGate: { command: 'exit 3' } }));
    const run = await runIndependentTests(tmpDir, { runId: 'r1' });
    expect(run).toMatchObject({ command: 'exit 3', source: 'config', exitCode: 3 });
    expect(readHookTestRuns(tmpDir)).toEqual([expect.objectContaining({ kind: 'verify-run', exitCode: 3, runId: 'r1' })]);
  });
});

describe('D5 — verify-ledger.js CLI 가 테스트 명령을 직접 실행한다', () => {
  function runCli(runId, resultsPath) {
    return spawnSync('node', [CLI, 'pass', runId, resultsPath], {
      encoding: 'utf-8',
      timeout: 60000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
  }

  it('scripts.test 가 exit 1 이면 results.json 이 전부 0 이어도 거부한다', async () => {
    const { recordRunStart, readLedger } = await import(LEDGER);
    const { readHookTestRuns } = await import(HOOK_RUNS);
    writePackageJson(tmpDir, 'exit 1');
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);
    const resultsPath = path.join(tmpDir, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(REPORTED_OK));

    const result = runCli(runId, resultsPath);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('REJECTED');
    expect(result.stdout).toContain('independent test run failed');
    expect(readLedger(tmpDir).verifyPassed).toBe(false);
    expect(readHookTestRuns(tmpDir)).toEqual([expect.objectContaining({ kind: 'verify-run', exitCode: 1 })]);
  });

  it('scripts.test 가 exit 0 이면 independent 등급으로 기록한다', async () => {
    const { recordRunStart, readLedger } = await import(LEDGER);
    writePackageJson(tmpDir, 'exit 0');
    recordRunStart(tmpDir, 'feat');
    const { runId } = readLedger(tmpDir);

    const result = runCli(runId, path.join(tmpDir, 'missing-results.json'));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('recorded: verifyPassed=true');
    expect(result.stdout).toContain('basis=independent');
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(true);
    expect(ledger.verifyBasis).toBe('independent');
    expect(ledger.independentRun).toMatchObject({ command: 'npm test', exitCode: 0 });
  });
});
