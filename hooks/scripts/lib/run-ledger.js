/**
 * Run Ledger — vibe.run 실행 및 vibe.verify 결과 추적.
 *
 * 파일 위치: <projectDir>/.vibe/metrics/run-ledger.json
 * 형식: { runId, runStarted, runFeature, verifyPassed, verifyAt, verifyBasis, stopWarned,
 *         basisWarned, verifyRequired, verifyRequiredReason, verificationResults, independentRun }
 *
 * verifyBasis — verifyPassed 의 근거 등급:
 *   'independent'  verify-runner 가 훅 프로세스에서 직접 실행한 테스트 명령의 exit code
 *   'self-report'  테스트 명령을 찾지 못해 모델이 넘긴 results 만 있는 상태 (stop 훅이 경고)
 * 명령이 감지되는데 독립 실행 없이 pass 를 요청하면 거부한다 — "자기보고로는 완료되지
 * 않는다" 는 선언과 코드가 어긋나던 지점 (SPEC verify-gate-independence).
 *
 * 모든 함수는 fail-open (try/catch, 오류 시 null/false 반환).
 * 원자적 쓰기: 임시 파일 → rename 방식 사용.
 */

import fs from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';
import { clearHookTestRuns, readHookTestRuns } from './hook-test-runs.js';
import { detectTestCommand } from './verify-runner.js';

// 1.1.0: verifyBasis · independentRun · reportedResults · hookTestRuns 추가 (필드 추가만)
const EVIDENCE_SCHEMA_VERSION = '1.1.0';
export const VERIFY_BASIS = Object.freeze({ independent: 'independent', selfReport: 'self-report' });
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

/**
 * 독립 실행 결과 정규화 — verify-runner 의 반환값 중 evidence 에 남길 필드만.
 * exitCode 가 정수가 아니면 독립 실행으로 치지 않는다 (null).
 */
function independentRunRecord(run) {
  if (!run || typeof run !== 'object' || !Number.isInteger(run.exitCode)) return null;
  return {
    command: typeof run.command === 'string' ? run.command : null,
    source: typeof run.source === 'string' ? run.source : null,
    exitCode: run.exitCode,
    at: typeof run.at === 'string' ? run.at : null,
    durationMs: Number.isInteger(run.durationMs) ? run.durationMs : null,
  };
}

function buildEvidence(projectDir, ledger, passed, generatedAt) {
  const reported = verificationResults(ledger.verificationResults);
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    runId: ledger.runId,
    specPath: resolveSpecPath(projectDir, ledger.runFeature),
    generatedAt,
    judges: {
      deterministic: {
        authority: 'blocking',
        verifyPassed: Boolean(passed),
        verifyBasis: ledger.verifyBasis || null,
        independentRun: independentRunRecord(ledger.independentRun),
        // 모델이 넘긴 결과 — 근거가 아니라 참고 기록. verificationResults 는 1.0.0 호환용 별칭.
        reportedResults: reported,
        verificationResults: reported,
        hookTestRuns: readHookTestRuns(projectDir),
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
    const {
      verificationResults: _results,
      verificationCommands: _commands,
      verifyBasis: _basis,
      independentRun: _run,
      basisWarned: _basisWarned,
      ...retained
    } = existing;
    const next = {
      ...retained,
      runId: randomUUID(),
      runStarted: new Date().toISOString(),
      runFeature: feature || null,
      verifyPassed: false,
      verifyAt: null,
      stopWarned: false,
    };
    // 훅 기록도 run 단위다 — 이전 run 의 편집·테스트 이벤트가 이번 판정에 섞이지 않게
    clearHookTestRuns(projectDir);
    return writeLedger(projectDir, next);
  });
}

/**
 * pass 요청의 근거 등급 판정. 거부 사유는 모델이 다음 행동을 알 수 있게 구체적으로 쓴다.
 * @param {string} projectDir
 * @param {{command: string, exitCode: number}[]} reported - 모델이 넘긴 결과 (참고)
 * @param {object|null} independentRun - verify-runner 결과 (근거)
 * @returns {{ ok: boolean, basis: string|null, reason: string|null }}
 */
function judgePassBasis(projectDir, reported, independentRun) {
  if (independentRun) {
    if (independentRun.exitCode === 0) return { ok: true, basis: VERIFY_BASIS.independent, reason: null };
    return {
      ok: false,
      basis: VERIFY_BASIS.independent,
      reason: `independent test run failed: \`${independentRun.command || 'test'}\` exit ${independentRun.exitCode}`
        + ' — fix the failing tests, then re-run verify-ledger.js pass',
    };
  }
  const detected = detectTestCommand(projectDir);
  if (detected) {
    const command = [detected.command, ...detected.args].join(' ');
    return {
      ok: false,
      basis: null,
      reason: `independent run required: test command \`${command}\` (${detected.source}) was detected but not executed`
        + ' — run `verify-ledger.js pass <runId>`, which executes it itself; reported results alone cannot pass',
    };
  }
  if (reported.length === 0 || reported.some(result => result.exitCode !== 0)) {
    return {
      ok: false,
      basis: VERIFY_BASIS.selfReport,
      reason: 'self-report basis requires at least one reported command result with every exit code 0'
        + ' (no test command detected — set verifyGate.command in .vibe/config.json to upgrade to independent basis)',
    };
  }
  return { ok: true, basis: VERIFY_BASIS.selfReport, reason: null };
}

function writeVerifyRecord(projectDir, passed, record) {
  const existing = readLedger(projectDir) || {};
  const existingRunId = UUID_PATTERN.test(existing.runId || '') ? existing.runId : null;
  if (existing.runId !== undefined && !existingRunId) return false;
  if (existingRunId && record.runId !== existingRunId) return false;
  const generatedAt = new Date().toISOString();
  const next = {
    ...existing,
    runId: existingRunId || randomUUID(),
    verifyPassed: Boolean(passed),
    verifyAt: generatedAt,
    verifyBasis: record.basis,
    verificationResults: record.reported,
    independentRun: record.independentRun,
  };
  // pass 시 verifyRequired 클리어
  if (passed) {
    next.verifyRequired = false;
    next.verifyRequiredReason = null;
  }
  if (!writeEvidence(projectDir, next, passed, generatedAt)) return false;
  return writeLedger(projectDir, next);
}

/**
 * vibe.verify 결과 기록 — 사유 포함 버전. pass 시 verifyRequired 상태를 클리어한다.
 *
 * pass 의 근거는 `options.independentRun`(verify-runner 결과) 이다. 없으면 프로젝트에서
 * 테스트 명령을 감지해 보고, 감지되면 거부한다(독립 실행을 건너뛴 것). 감지되지 않을 때만
 * 모델이 넘긴 results 로 self-report 등급 통과를 허용한다.
 * @param {string} projectDir
 * @param {boolean} passed
 * @param {{runId?: string, verificationResults?: object[], independentRun?: object|null}} options
 * @returns {{ ok: boolean, basis: string|null, reason: string|null }}
 */
export function recordVerifyDetailed(projectDir, passed, options = {}) {
  const reported = verificationResults(options.verificationResults);
  const independentRun = independentRunRecord(options.independentRun);
  const verdict = passed
    ? judgePassBasis(projectDir, reported, independentRun)
    : { ok: true, basis: independentRun ? VERIFY_BASIS.independent : VERIFY_BASIS.selfReport, reason: null };
  if (!verdict.ok) return verdict;
  const record = { runId: options.runId, reported, independentRun, basis: verdict.basis };
  const written = withLedgerLock(projectDir, () => writeVerifyRecord(projectDir, passed, record));
  if (!written) return { ok: false, basis: verdict.basis, reason: 'run-ledger write failed — runId mismatch, lock held, or evidence write error' };
  return { ok: true, basis: verdict.basis, reason: null };
}

/**
 * vibe.verify 결과 기록 (boolean 호환 표면). 사유가 필요하면 recordVerifyDetailed.
 * @param {string} projectDir
 * @param {boolean} passed - 검증 통과 여부
 * @param {{runId?: string, verificationResults?: object[], independentRun?: object|null}} options
 * @returns {boolean} 성공 여부
 */
export function recordVerify(projectDir, passed, options = {}) {
  return recordVerifyDetailed(projectDir, passed, options).ok;
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
 * self-report 등급 경고 플래그 세팅 — stop 훅이 같은 run 에서 두 번 경고하지 않게.
 * @param {string} projectDir
 * @returns {boolean} 성공 여부
 */
export function markBasisWarned(projectDir) {
  try {
    const existing = readLedger(projectDir) || {};
    const next = { ...existing, basisWarned: true };
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
