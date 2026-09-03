/**
 * auto-commit — verify 이후 편집이 있으면 커밋을 막는다 (SPEC verify-gate-independence, D9)
 *
 * 신선도 판정은 ledger 를 훅이 덮어쓰지 않고, hook-test-runs 의 마지막 edit.at 과
 * ledger.verifyAt 을 비교해 소비자(auto-commit)가 한다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTO_COMMIT = path.resolve(__dirname, '..', 'auto-commit.js');
const HOOK_RUNS = path.resolve(__dirname, '..', 'lib', 'hook-test-runs.js');

const RUN_STARTED = '2026-01-01T00:00:00.000Z';
const VERIFY_AT = '2026-01-01T00:10:00.000Z';

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-commit-stale-'));
  fs.mkdirSync(path.join(tmpDir, '.vibe', 'metrics'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.vibe', 'config.json'),
    JSON.stringify({ hooks: { 'auto-commit': { enabled: true } } }),
  );
});
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function writeLedger(fields) {
  const ledger = {
    runId: randomUUID(),
    runStarted: RUN_STARTED,
    runFeature: 'feat',
    verifyPassed: true,
    verifyAt: VERIFY_AT,
    verifyBasis: 'independent',
    stopWarned: false,
    ...fields,
  };
  fs.writeFileSync(path.join(tmpDir, '.vibe', 'metrics', 'run-ledger.json'), JSON.stringify(ledger));
}

function runAutoCommit() {
  // tmpDir 은 git 저장소가 아니다 — 게이트를 통과하면 git 호출이 실패하고 조용히 끝난다.
  return spawnSync('node', [AUTO_COMMIT], {
    input: JSON.stringify({ tool_name: 'Stop' }),
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
  });
}

describe('D9 — verify 이후 편집 신선도', () => {
  it('마지막 edit.at 이 verifyAt 보다 뒤면 SKIP 하고 사유에 파일 경로를 적는다', async () => {
    const { appendHookTestRun } = await import(HOOK_RUNS);
    writeLedger({});
    appendHookTestRun(tmpDir, { kind: 'edit', filePath: 'src/x.ts', at: '2026-01-01T00:11:00.000Z' });

    const result = runAutoCommit();
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('[auto-commit] SKIP');
    expect(result.stderr).toContain('code edited after verify');
    expect(result.stderr).toContain('src/x.ts');
  });

  it('편집이 verifyAt 보다 앞이면 신선도로는 막지 않는다', async () => {
    const { appendHookTestRun } = await import(HOOK_RUNS);
    writeLedger({});
    appendHookTestRun(tmpDir, { kind: 'edit', filePath: 'src/x.ts', at: '2026-01-01T00:05:00.000Z' });

    const result = runAutoCommit();
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('SKIP');
  });

  it('self-report 등급이면 커밋은 허용하되 NOTE 를 남긴다', () => {
    writeLedger({ verifyBasis: 'self-report' });
    const result = runAutoCommit();
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('SKIP');
    expect(result.stderr).toContain('self-report');
  });

  it('기존 게이트 유지 — verifyPassed=false 는 여전히 SKIP', () => {
    writeLedger({ verifyPassed: false });
    const result = runAutoCommit();
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('vibe.verify not passed');
  });
});
