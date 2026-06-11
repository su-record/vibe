/**
 * run-ledger verifyRequired 확장 테스트
 *
 * 검증 대상:
 *   - recordVerifyRequired: verifyRequired=true, reason 설정
 *   - recordVerify(pass) → verifyRequired 클리어
 *   - recordVerify(fail) → verifyRequired 유지
 *   - auto-commit 게이트: verifyRequired=true 시 skip
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-verify-required-'));
});
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

async function importLedger() {
  const ledgerPath = path.resolve(__dirname, '..', 'lib', 'run-ledger.js');
  return import(ledgerPath);
}

describe('run-ledger: verifyRequired', () => {
  it('초기 상태: verifyRequired 없음', async () => {
    const { recordRunStart, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'feat');
    const ledger = readLedger(tmpDir);
    // verifyRequired는 undefined 또는 false여야 함
    expect(ledger.verifyRequired).toBeFalsy();
  });

  it('recordVerifyRequired → verifyRequired=true, reason 설정', async () => {
    const { recordRunStart, recordVerifyRequired, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'feat');
    recordVerifyRequired(tmpDir, 'P1 any-type line 5');
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyRequired).toBe(true);
    expect(ledger.verifyRequiredReason).toBe('P1 any-type line 5');
  });

  it('recordVerify(pass) → verifyRequired 클리어', async () => {
    const { recordRunStart, recordVerifyRequired, recordVerify, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'feat');
    recordVerifyRequired(tmpDir, 'P1 console.log found');
    recordVerify(tmpDir, true);
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyRequired).toBe(false);
    expect(ledger.verifyRequiredReason).toBeNull();
    expect(ledger.verifyPassed).toBe(true);
  });

  it('recordVerify(fail) → verifyRequired 유지됨', async () => {
    const { recordRunStart, recordVerifyRequired, recordVerify, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'feat');
    recordVerifyRequired(tmpDir, 'P1 issue');
    recordVerify(tmpDir, false);
    const ledger = readLedger(tmpDir);
    // fail 시 verifyRequired는 유지되어야 함
    expect(ledger.verifyRequired).toBe(true);
    expect(ledger.verifyPassed).toBe(false);
  });

  it('reason 없이 recordVerifyRequired → 기본 reason 설정', async () => {
    const { recordRunStart, recordVerifyRequired, readLedger } = await importLedger();
    recordRunStart(tmpDir, 'feat');
    recordVerifyRequired(tmpDir, '');
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyRequired).toBe(true);
    expect(typeof ledger.verifyRequiredReason).toBe('string');
  });

  it('recordVerifyRequired fail-open (레저 없이도 작동)', async () => {
    const { recordVerifyRequired, readLedger } = await importLedger();
    // runStart 없이 호출
    recordVerifyRequired(tmpDir, 'standalone P1');
    const ledger = readLedger(tmpDir);
    expect(ledger.verifyRequired).toBe(true);
  });
});

describe('auto-commit: verifyRequired 게이트 로직', () => {
  function autoCommitGatePass(ledger) {
    if (!ledger) return true;

    // verify 게이트 (기존)
    if (ledger.runStarted) {
      const verifyOk = ledger.verifyPassed === true
        && ledger.verifyAt
        && ledger.verifyAt > ledger.runStarted;
      if (!verifyOk) return false;
    }

    // verifyRequired 게이트 (신규)
    if (ledger.verifyRequired === true) return false;

    return true;
  }

  it('verifyRequired=true → 차단', () => {
    expect(autoCommitGatePass({
      runStarted: null,
      verifyRequired: true,
      verifyRequiredReason: 'P1 any-type',
    })).toBe(false);
  });

  it('verifyRequired=false → 통과 (verifyRequired만 확인 시)', () => {
    expect(autoCommitGatePass({
      runStarted: null,
      verifyRequired: false,
    })).toBe(true);
  });

  it('verifyRequired=undefined → 통과 (기존 레저 호환)', () => {
    expect(autoCommitGatePass({
      runStarted: null,
      verifyRequired: undefined,
    })).toBe(true);
  });

  it('runStarted + verifyPassed + verifyRequired=true → 차단 (verifyRequired 우선)', () => {
    expect(autoCommitGatePass({
      runStarted: '2026-01-01T10:00:00.000Z',
      verifyPassed: true,
      verifyAt: '2026-01-01T10:05:00.000Z',
      verifyRequired: true,
    })).toBe(false);
  });

  it('runStarted + verifyPassed + verifyRequired=false → 통과', () => {
    expect(autoCommitGatePass({
      runStarted: '2026-01-01T10:00:00.000Z',
      verifyPassed: true,
      verifyAt: '2026-01-01T10:05:00.000Z',
      verifyRequired: false,
    })).toBe(true);
  });
});
