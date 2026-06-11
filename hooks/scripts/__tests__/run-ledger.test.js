/**
 * run-ledger 라이브러리 테스트
 *
 * REQ-harness-remediation-005, 006, 007, 008 커버리지:
 *   - round-trip 읽기/쓰기
 *   - verifyAt > runStarted 로직
 *   - extractRunFeature / isVibeRunPrompt 헬퍼
 *   - recordRunStart → verifyPassed 리셋
 *   - recordVerify pass/fail
 *   - prompt-dispatcher 에서의 vibe.run 감지 (CLI 실행)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 테스트 격리용 임시 디렉토리
let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-ledger-test-'));
});
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// 모듈 임포트 (ESM 동적)
async function importLedger() {
  const ledgerPath = path.resolve(__dirname, '..', 'lib', 'run-ledger.js');
  // 캐시 버스팅 불필요 — 순수 함수, 상태 없음
  return import(ledgerPath);
}

// ──────────────────────────────────────────────────────────────────
// readLedger / recordRunStart / recordVerify round-trip
// ──────────────────────────────────────────────────────────────────
describe('run-ledger: round-trip', () => {
  it('존재하지 않는 레저 → null 반환', async () => {
    const { readLedger } = await importLedger();
    const result = readLedger(tmpDir);
    expect(result).toBeNull();
  });

  it('recordRunStart 후 읽으면 runStarted가 ISO 문자열', async () => {
    const { recordRunStart, readLedger } = await importLedger();
    const before = new Date().toISOString();
    recordRunStart(tmpDir, 'my-feature');
    const ledger = readLedger(tmpDir);
    expect(ledger).not.toBeNull();
    expect(ledger.runStarted).toBeDefined();
    expect(ledger.runStarted >= before).toBe(true);
    expect(ledger.runFeature).toBe('my-feature');
  });

  it('recordRunStart는 verifyPassed를 false로 리셋', async () => {
    const { recordRunStart, recordVerify, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'f1');
    recordVerify(tmpDir, true);
    // 두 번째 run — 리셋
    recordRunStart(tmpDir, 'f2');
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(false);
    expect(ledger.verifyAt).toBeNull();
    expect(ledger.stopWarned).toBe(false);
  });

  it('recordVerify(pass) → verifyPassed=true, verifyAt 설정', async () => {
    const { recordRunStart, recordVerify, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'feat');
    const before = new Date().toISOString();
    recordVerify(tmpDir, true);
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(true);
    expect(ledger.verifyAt).toBeDefined();
    expect(ledger.verifyAt >= before).toBe(true);
  });

  it('recordVerify(fail) → verifyPassed=false', async () => {
    const { recordRunStart, recordVerify, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'feat');
    recordVerify(tmpDir, false);
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// verifyAt > runStarted 관계 검증
// ──────────────────────────────────────────────────────────────────
describe('run-ledger: verifyAt > runStarted', () => {
  it('recordVerify 후 verifyAt > runStarted', async () => {
    const { recordRunStart, recordVerify, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'f');
    // 동일 밀리초 내 실행 가능성을 피하기 위해 runStarted를 과거로 조작
    const ledger = readLedger(tmpDir);
    const p = path.join(tmpDir, '.vibe', 'metrics', 'run-ledger.json');
    const patched = { ...ledger, runStarted: new Date(Date.now() - 1000).toISOString() };
    fs.writeFileSync(p, JSON.stringify(patched), 'utf-8');

    recordVerify(tmpDir, true);
    const after = readLedger(tmpDir);
    expect(after.verifyAt > after.runStarted).toBe(true);
    expect(after.verifyPassed).toBe(true);
  });

  it('verifyAt이 runStarted보다 이르면 gate 불충족 (simulate)', async () => {
    const { readLedger } = await importLedger();
    const p = path.join(tmpDir, '.vibe', 'metrics', 'run-ledger.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const now = new Date();
    // runStarted가 verifyAt보다 나중
    const data = {
      runStarted: new Date(now.getTime() + 5000).toISOString(),
      runFeature: 'f',
      verifyPassed: true,
      verifyAt: now.toISOString(),
      stopWarned: false,
    };
    fs.writeFileSync(p, JSON.stringify(data), 'utf-8');
    const ledger = readLedger(tmpDir);
    // auto-commit 게이트 로직: verifyPassed=true 이지만 verifyAt < runStarted
    const gatePass = ledger.verifyPassed === true
      && ledger.verifyAt
      && ledger.verifyAt > ledger.runStarted;
    expect(gatePass).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// isVibeRunPrompt / extractRunFeature
// ──────────────────────────────────────────────────────────────────
describe('run-ledger: vibe.run 감지 헬퍼', () => {
  it('/vibe.run 감지', async () => {
    const { isVibeRunPrompt } = await importLedger();
    expect(isVibeRunPrompt('/vibe.run my-feature')).toBe(true);
  });

  it('$vibe.run 감지', async () => {
    const { isVibeRunPrompt } = await importLedger();
    expect(isVibeRunPrompt('$vibe.run my-feature')).toBe(true);
  });

  it('대소문자 무관', async () => {
    const { isVibeRunPrompt } = await importLedger();
    expect(isVibeRunPrompt('/VIBE.RUN feature')).toBe(true);
  });

  it('부분 매칭 방지 — vibe.runs 는 미감지', async () => {
    const { isVibeRunPrompt } = await importLedger();
    // "vibe.runs"는 \b로 경계 처리됨
    expect(isVibeRunPrompt('vibe.runs everything')).toBe(false);
  });

  it('단어 내 포함은 미감지', async () => {
    const { isVibeRunPrompt } = await importLedger();
    expect(isVibeRunPrompt('I was talking about vibe.runner')).toBe(false);
  });

  it('extractRunFeature: 기능명 추출', async () => {
    const { extractRunFeature } = await importLedger();
    expect(extractRunFeature('/vibe.run my-feature')).toBe('my-feature');
  });

  it('extractRunFeature: $vibe.run에서 추출', async () => {
    const { extractRunFeature } = await importLedger();
    expect(extractRunFeature('$vibe.run auth-login ultrawork')).toBe('auth-login');
  });

  it('extractRunFeature: 기능명 없으면 null', async () => {
    const { extractRunFeature } = await importLedger();
    expect(extractRunFeature('/vibe.run --phase 1')).toBeNull();
  });

  it('extractRunFeature: /vibe.run만 있으면 null', async () => {
    const { extractRunFeature } = await importLedger();
    expect(extractRunFeature('/vibe.run')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// markStopWarned
// ──────────────────────────────────────────────────────────────────
describe('run-ledger: stopWarned', () => {
  it('markStopWarned → stopWarned=true', async () => {
    const { recordRunStart, markStopWarned, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'f');
    markStopWarned(tmpDir);
    const ledger = readLedger(tmpDir);
    expect(ledger.stopWarned).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// verify-ledger.js CLI
// ──────────────────────────────────────────────────────────────────
describe('verify-ledger CLI', () => {
  const CLI = path.resolve(__dirname, '..', 'verify-ledger.js');

  it('pass 인자 → verifyPassed=true, exit 0', async () => {
    const { recordRunStart } = await importLedger();
    recordRunStart(tmpDir, 'feat');

    const result = spawnSync('node', [CLI, 'pass'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('verifyPassed=true');

    const { readLedger } = await importLedger();
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(true);
  });

  it('fail 인자 → verifyPassed=false, exit 0', async () => {
    const { recordRunStart } = await importLedger();
    recordRunStart(tmpDir, 'feat');

    const result = spawnSync('node', [CLI, 'fail'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('verifyPassed=false');

    const { readLedger } = await importLedger();
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyPassed).toBe(false);
  });

  it('인자 없이도 exit 0 (fail-open)', () => {
    const result = spawnSync('node', [CLI], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    expect(result.status).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// prompt-dispatcher vibe.run 감지 (sanity — ledger 파일 생성 확인)
// ──────────────────────────────────────────────────────────────────
describe('prompt-dispatcher: vibe.run 감지 → ledger 파일 생성', () => {
  const DISPATCHER = path.resolve(__dirname, '..', 'prompt-dispatcher.js');

  it('/vibe.run 프롬프트 → run-ledger.json 생성', () => {
    const payload = JSON.stringify({ prompt: '/vibe.run test-feature' });
    const result = spawnSync('node', [DISPATCHER], {
      input: payload,
      encoding: 'utf-8',
      timeout: 10000,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: tmpDir,
        VIBE_HOOK_DEPTH: undefined,
        // keyword-detector 등 자식 프로세스 타임아웃 내 완료
      },
    });
    expect(result.status).toBe(0);
    const ledgerFile = path.join(tmpDir, '.vibe', 'metrics', 'run-ledger.json');
    expect(fs.existsSync(ledgerFile)).toBe(true);
    const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf-8'));
    expect(ledger.runStarted).toBeDefined();
    expect(ledger.runFeature).toBe('test-feature');
    expect(ledger.verifyPassed).toBe(false);
  });

  it('일반 프롬프트 → ledger 파일 미생성', () => {
    const payload = JSON.stringify({ prompt: 'implement the login form' });
    spawnSync('node', [DISPATCHER], {
      input: payload,
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    });
    const ledgerFile = path.join(tmpDir, '.vibe', 'metrics', 'run-ledger.json');
    expect(fs.existsSync(ledgerFile)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// auto-commit 게이트 로직 (단위 수준 — 레저 상태별 gate 검증)
// ──────────────────────────────────────────────────────────────────
describe('auto-commit: verify gate 로직 (레저 상태 시뮬레이션)', () => {
  function gatePass(ledger) {
    if (!ledger || !ledger.runStarted) return true; // 레저 없으면 통과 (기존 동작)
    return ledger.verifyPassed === true
      && ledger.verifyAt
      && ledger.verifyAt > ledger.runStarted;
  }

  it('레저 없음 → 통과 (기존 동작 유지)', () => {
    expect(gatePass(null)).toBe(true);
  });

  it('runStarted 없음 → 통과', () => {
    expect(gatePass({ verifyPassed: false, verifyAt: null })).toBe(true);
  });

  it('verifyPassed=false → 차단', () => {
    expect(gatePass({
      runStarted: '2026-01-01T10:00:00.000Z',
      verifyPassed: false,
      verifyAt: null,
    })).toBe(false);
  });

  it('verifyPassed=true + verifyAt > runStarted → 통과', () => {
    expect(gatePass({
      runStarted: '2026-01-01T10:00:00.000Z',
      verifyPassed: true,
      verifyAt: '2026-01-01T10:05:00.000Z',
    })).toBe(true);
  });

  it('verifyPassed=true 이지만 verifyAt < runStarted → 차단', () => {
    expect(gatePass({
      runStarted: '2026-01-01T10:05:00.000Z',
      verifyPassed: true,
      verifyAt: '2026-01-01T10:00:00.000Z',
    })).toBe(false);
  });
});
