/**
 * stop-dispatcher — self-report 등급 경고 (SPEC verify-gate-independence, D8)
 *
 * verifyPassed 가 self-report 등급이면 stderr 로 1회 경고하고 basisWarned 를 세운다.
 * 차단하지 않는다 — 테스트 명령이 없는 프로젝트를 막지 않는다는 결정.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STOP = path.resolve(__dirname, '..', 'stop-dispatcher.js');

// 다른 Stop 단계는 전부 끈다 — 이 테스트는 등급 경고만 본다
const STEPS_OFF = {
  hooks: {
    'codex-review-gate': { enabled: false },
    'stop-notify': { enabled: false },
    'auto-commit': { enabled: false },
    'devlog-gen': { enabled: false },
  },
};

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-stop-basis-'));
  fs.mkdirSync(path.join(tmpDir, '.vibe', 'metrics'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.vibe', 'config.json'), JSON.stringify(STEPS_OFF));
});
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function writeLedger(fields) {
  const ledger = {
    runId: randomUUID(),
    runStarted: '2026-01-01T00:00:00.000Z',
    runFeature: 'feat',
    verifyPassed: true,
    verifyAt: '2026-01-01T00:10:00.000Z',
    stopWarned: false,
    ...fields,
  };
  fs.writeFileSync(path.join(tmpDir, '.vibe', 'metrics', 'run-ledger.json'), JSON.stringify(ledger));
}

function readLedger() {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.vibe', 'metrics', 'run-ledger.json'), 'utf-8'));
}

function runStop() {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: tmpDir };
  delete env.VIBE_HOOK_DEPTH;
  return spawnSync('node', [STOP], {
    input: JSON.stringify({ tool_name: 'Stop' }),
    encoding: 'utf-8',
    timeout: 30000,
    env,
  });
}

describe('D8 — self-report 등급 경고', () => {
  it('self-report 등급이면 첫 Stop 에서만 경고하고 basisWarned=true 를 남긴다', () => {
    writeLedger({ verifyBasis: 'self-report' });

    const first = runStop();
    expect(first.status).toBe(0);
    expect(first.stderr).toContain('self-report');
    expect(first.stdout).not.toContain('"decision":"block"');
    expect(readLedger().basisWarned).toBe(true);

    const second = runStop();
    expect(second.status).toBe(0);
    expect(second.stderr).not.toContain('self-report');
  });

  it('independent 등급이면 경고하지 않는다', () => {
    writeLedger({ verifyBasis: 'independent' });
    const result = runStop();
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('self-report');
    expect(readLedger().basisWarned).toBeUndefined();
  });

  it('verifyPassed=false 면 등급 경고 대신 기존 verify-skip 경고만 낸다', () => {
    writeLedger({ verifyPassed: false, verifyBasis: 'self-report' });
    const result = runStop();
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('/vibe.verify was not run');
    expect(result.stderr).not.toContain('self-report basis');
  });
});
