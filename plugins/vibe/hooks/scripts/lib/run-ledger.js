/**
 * Run Ledger — vibe.run 실행 및 vibe.verify 결과 추적.
 *
 * 파일 위치: <projectDir>/.vibe/metrics/run-ledger.json
 * 형식: { runId, runStarted, runFeature, verifyPassed, verifyAt, stopWarned,
 *         verifyRequired, verifyRequiredReason }
 *
 * 모든 함수는 fail-open (try/catch, 오류 시 null/false 반환).
 * 원자적 쓰기: 임시 파일 → rename 방식 사용.
 */

import fs from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

const EVIDENCE_SCHEMA_VERSION = '1.0.0';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 레저 파일 경로 */
function ledgerPath(projectDir) {
  return path.join(projectDir, '.vibe', 'metrics', 'run-ledger.json');
}

function evidencePath(projectDir, runId) {
  if (!UUID_PATTERN.test(runId)) return null;
  const runsDir = path.resolve(projectDir, '.vibe', 'runs');
  const target = path.resolve(runsDir, runId, 'evidence.json');
  return target.startsWith(`${runsDir}${path.sep}`) ? target : null;
}

function writeJsonAtomic(targetPath, data) {
  if (!targetPath) return false;
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, targetPath);
    return true;
  } catch {
    try { fs.rmSync(tmp, { force: true }); } catch { /* fail-open */ }
    return false;
  }
}

function withLedgerLock(projectDir, operation) {
  const lockPath = path.join(projectDir, '.vibe', 'metrics', 'run-ledger.lock');
  let descriptor;
  try {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    descriptor = fs.openSync(lockPath, 'wx');
    return operation();
  } catch {
    return false;
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
      try { fs.rmSync(lockPath, { force: true }); } catch { /* fail-open */ }
    }
  }
}

/**
 * 레저 파일 읽기.
 * @param {string} projectDir
 * @returns {{ runStarted: string|null, runFeature: string|null, verifyPassed: boolean, verifyAt: string|null, stopWarned: boolean, verifyRequired: boolean, verifyRequiredReason: string|null }|null}
 */
export function readLedger(projectDir) {
  try {
    const p = ledgerPath(projectDir);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 레저 파일 원자적 쓰기 (임시 파일 write → rename).
 * @param {string} projectDir
 * @param {object} data
 * @returns {boolean} 성공 여부
 */
function writeLedger(projectDir, data) {
  try {
    return writeJsonAtomic(ledgerPath(projectDir), data);
  } catch {
    return false;
  }
}

function verificationResults(results) {
  if (Array.isArray(results)) {
    return results
      .filter(item => item
        && typeof item === 'object'
        && typeof item.command === 'string'
        && Number.isInteger(item.exitCode))
      .map(item => ({
        command: item.command,
        exitCode: item.exitCode,
      }));
  }
  return [];
}

function resolveSpecPath(projectDir, feature) {
  if (typeof feature !== 'string' || feature.includes('..') || /[\\/]/.test(feature)) {
    return null;
  }
  const flatPath = `.vibe/specs/${feature}.md`;
  if (fs.existsSync(path.join(projectDir, flatPath))) return flatPath;
  const splitPath = `.vibe/specs/${feature}/_index.md`;
  return fs.existsSync(path.join(projectDir, splitPath)) ? splitPath : null;
}

function buildEvidence(projectDir, ledger, passed, generatedAt) {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    runId: ledger.runId,
    specPath: resolveSpecPath(projectDir, ledger.runFeature),
    generatedAt,
    judges: {
      deterministic: {
        authority: 'blocking',
        verifyPassed: Boolean(passed),
        verificationResults: verificationResults(ledger.verificationResults),
      },
      model: { authority: 'advisory-only', canComplete: false },
      humanTaste: { authority: 'release-only', canComplete: false },
    },
  };
}

function writeEvidence(projectDir, ledger, passed, generatedAt) {
  try {
    return writeJsonAtomic(
      evidencePath(projectDir, ledger.runId),
      buildEvidence(projectDir, ledger, passed, generatedAt),
    );
  } catch {
    return false;
  }
}

/**
 * vibe.run 시작 기록 — runStarted를 현재 시각으로 세팅하고 verifyPassed를 리셋.
 * @param {string} projectDir
 * @param {string|null} feature - 프롬프트에서 추출된 기능명 (없으면 null)
 * @returns {boolean} 성공 여부
 */
export function recordRunStart(projectDir, feature) {
  return withLedgerLock(projectDir, () => {
    const existing = readLedger(projectDir) || {};
    const { verificationResults: _results, verificationCommands: _commands, ...retained } = existing;
    const next = {
      ...retained,
      runId: randomUUID(),
      runStarted: new Date().toISOString(),
      runFeature: feature || null,
      verifyPassed: false,
      verifyAt: null,
      stopWarned: false,
    };
    return writeLedger(projectDir, next);
  });
}

/**
 * vibe.verify 결과 기록.
 * pass 시 verifyRequired 상태를 클리어한다.
 * @param {string} projectDir
 * @param {boolean} passed - 검증 통과 여부
 * @param {{runId?: string, verificationResults?: object[]}} options
 * @returns {boolean} 성공 여부
 */
export function recordVerify(projectDir, passed, options = {}) {
  return withLedgerLock(projectDir, () => {
    const existing = readLedger(projectDir) || {};
    const existingRunId = UUID_PATTERN.test(existing.runId || '') ? existing.runId : null;
    if (existing.runId !== undefined && !existingRunId) return false;
    if (existingRunId && options.runId !== existingRunId) return false;
    const runId = existingRunId || randomUUID();
    const results = verificationResults(options.verificationResults);
    if (passed && (results.length === 0 || results.some(result => result.exitCode !== 0))) {
      return false;
    }
    const generatedAt = new Date().toISOString();
    const next = {
      ...existing,
      runId,
      verifyPassed: Boolean(passed),
      verifyAt: generatedAt,
      verificationResults: results,
    };
    // pass 시 verifyRequired 클리어
    if (passed) {
      next.verifyRequired = false;
      next.verifyRequiredReason = null;
    }
    if (!writeEvidence(projectDir, next, passed, generatedAt)) return false;
    return writeLedger(projectDir, next);
  });
}

/**
 * P1 이슈 발견 시 verify-required 상태 기록.
 * @param {string} projectDir
 * @param {string} reason - 이슈 사유
 * @returns {boolean} 성공 여부
 */
export function recordVerifyRequired(projectDir, reason) {
  try {
    const existing = readLedger(projectDir) || {};
    const next = {
      ...existing,
      verifyRequired: true,
      verifyRequiredReason: reason || 'P1 issue detected',
    };
    return writeLedger(projectDir, next);
  } catch {
    return false;
  }
}

/**
 * stop 경고 플래그 세팅 (루프 방지).
 * @param {string} projectDir
 * @returns {boolean} 성공 여부
 */
export function markStopWarned(projectDir) {
  try {
    const existing = readLedger(projectDir) || {};
    const next = { ...existing, stopWarned: true };
    return writeLedger(projectDir, next);
  } catch {
    return false;
  }
}

/**
 * 프롬프트에서 vibe.run 기능명 추출.
 * "/vibe.run some-feature ..." 또는 "$vibe.run some-feature ..." 형태에서 첫 토큰 추출.
 * @param {string} prompt
 * @returns {string|null}
 */
export function extractRunFeature(prompt) {
  try {
    const m = prompt.match(/(?:\/|\$)vibe\.run\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/i);
    if (!m) return null;
    const token = m[1] || m[2] || m[3];
    // 플래그(-- 시작)나 키워드는 기능명이 아님
    if (token.startsWith('-')) return null;
    return token;
  } catch {
    return null;
  }
}

/**
 * 프롬프트에 vibe.run 호출이 포함되는지 확인 (단어 경계 매칭, 대소문자 무관).
 * @param {string} prompt
 * @returns {boolean}
 */
export function isVibeRunPrompt(prompt) {
  try {
    return /(?:^|[\s,;|&(])[$\/]vibe\.run(?:\b|$)/i.test(prompt);
  } catch {
    return false;
  }
}
