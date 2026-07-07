/**
 * PostToolUse Hook - Write/Edit 후 관련 테스트 자동 실행
 *
 * 수정된 파일에 대응하는 테스트 파일을 찾아 실행.
 * 실패 시 마지막 5줄만 출력해서 context window 오염 방지.
 *
 * debounce 지원: autoTest.mode='debounce'(기본) | 'always' | 'off' via .vibe/config.json
 *   debounce 모드: 동일 테스트 파일을 DEBOUNCE_COOLDOWN_MS(120s) 내에
 *   소스 변경 없이 재실행 스킵.
 *
 * findings 반환 구조 (디스패처가 additionalContext에 주입).
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { PROJECT_DIR, readProjectConfig } from './utils.js';
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';

// WHY async execFile (not execSync): in-process 디스패처에서 다른 step과
// Promise.all로 병렬 실행되므로, 60초 동기 실행은 체인 전체를 직렬화시킨다.
const execFileAsync = promisify(execFile);

const CODE_EXT_RE = /\.(ts|tsx|js|jsx)$/;
const TEST_SUFFIXES = ['.test.', '.spec.'];
const MAX_OUTPUT_LINES = 5;
const TEST_TIMEOUT_MS = 60000;

/** debounce 쿨다운 — 동일 테스트 + 동일 소스 해시에 대해 스킵하는 시간(ms) */
const DEBOUNCE_COOLDOWN_MS = 120_000;

/** debounce 상태 파일 경로 */
const DEBOUNCE_STATE_FILE = path.join(PROJECT_DIR, '.vibe', 'metrics', 'auto-test-state.json');

function isTestFile(filePath) {
  return TEST_SUFFIXES.some(s => filePath.includes(s));
}

function findTestFile(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  // src/foo.ts → src/foo.test.ts, src/__tests__/foo.test.ts
  const candidates = [
    path.join(dir, `${base}.test${ext}`),
    path.join(dir, `${base}.spec${ext}`),
    path.join(dir, '__tests__', `${base}.test${ext}`),
    path.join(dir, '__tests__', `${base}.spec${ext}`),
  ];
  return candidates.find(c => existsSync(c)) || null;
}

function hasVitest() {
  return existsSync(path.join(PROJECT_DIR, 'node_modules', '.bin', 'vitest'));
}

function hasJest() {
  return existsSync(path.join(PROJECT_DIR, 'node_modules', '.bin', 'jest'));
}

/**
 * autoTest.mode 설정 읽기 — 기본 'debounce'.
 * @returns {'debounce'|'always'|'off'}
 */
function getTestMode() {
  try {
    const cfg = readProjectConfig();
    const mode = cfg?.autoTest?.mode;
    if (mode === 'always' || mode === 'off' || mode === 'debounce') return mode;
  } catch { /* ignore */ }
  return 'debounce';
}

/**
 * 파일 내용 SHA-256 해시 (앞 16자만 사용). 파일 없으면 빈 문자열.
 * @param {string} filePath
 * @returns {string}
 */
function fileHash(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}

/**
 * debounce 상태 파일 읽기. fail-open → 빈 객체.
 * @returns {Record<string, { lastRun: number, srcHash: string }>}
 */
function readDebounceState() {
  try {
    if (existsSync(DEBOUNCE_STATE_FILE)) {
      return JSON.parse(readFileSync(DEBOUNCE_STATE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

/**
 * debounce 상태 파일 쓰기. fail-open.
 * @param {Record<string, { lastRun: number, srcHash: string }>} state
 */
function writeDebounceState(state) {
  try {
    mkdirSync(path.dirname(DEBOUNCE_STATE_FILE), { recursive: true });
    writeFileSync(DEBOUNCE_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch { /* fail-open */ }
}

/**
 * debounce 체크: testFile을 스킵해야 하면 true.
 * @param {string} testFile — 절대 경로
 * @param {string} srcFile — 절대 경로 (소스 파일, 테스트가 아닌 경우)
 * @returns {boolean}
 */
function shouldSkipDebounce(testFile, srcFile) {
  try {
    const state = readDebounceState();
    const entry = state[testFile];
    if (!entry) return false;

    const now = Date.now();
    const elapsed = now - entry.lastRun;
    if (elapsed > DEBOUNCE_COOLDOWN_MS) return false;

    const currentHash = fileHash(srcFile);
    if (currentHash !== entry.srcHash) return false;

    return true; // 쿨다운 내 + 소스 미변경 → 스킵
  } catch {
    return false; // fail-open
  }
}

/**
 * debounce 상태 업데이트.
 * @param {string} testFile
 * @param {string} srcFile
 */
function updateDebounceState(testFile, srcFile) {
  try {
    const state = readDebounceState();
    state[testFile] = {
      lastRun: Date.now(),
      srcHash: fileHash(srcFile),
    };
    writeDebounceState(state);
  } catch { /* fail-open */ }
}

/**
 * in-process 진입점 — 테스트 실행. findings 반환.
 * @param {{ filePath: string }} ctx
 * @returns {Promise<{ exitCode: number, findings: string[] }>}
 */
export async function run(ctx) {
  const findings = [];
  try {
    const filePath = ctx.filePath;
    if (!filePath || !CODE_EXT_RE.test(filePath)) return { exitCode: 0, findings };

    const mode = getTestMode();
    if (mode === 'off') return { exitCode: 0, findings };

    const srcFile = path.resolve(filePath);
    const testFile = isTestFile(filePath) ? srcFile : findTestFile(srcFile);
    if (!testFile) return { exitCode: 0, findings };

    // debounce 모드: 스킵 여부 확인
    if (mode === 'debounce') {
      const skipSrc = isTestFile(filePath) ? testFile : srcFile;
      if (shouldSkipDebounce(testFile, skipSrc)) {
        // 스팸 방지: 스킵 시 finding 없음 (조용히)
        return { exitCode: 0, findings };
      }
    }

    const relPath = path.relative(PROJECT_DIR, testFile);
    let args = null;
    if (hasVitest()) {
      args = ['vitest', 'run', relPath, '--reporter=verbose'];
    } else if (hasJest()) {
      args = ['jest', relPath, '--no-coverage'];
    } else {
      return { exitCode: 0, findings };
    }

    // debounce 상태 업데이트 (실행 전)
    if (mode === 'debounce') {
      const skipSrc = isTestFile(filePath) ? testFile : srcFile;
      updateDebounceState(testFile, skipSrc);
    }

    const { stdout } = await execFileAsync('npx', args, {
      cwd: PROJECT_DIR,
      timeout: TEST_TIMEOUT_MS,
      // Windows에서 npx는 npx.cmd — shell 없이는 execFile이 찾지 못함
      shell: process.platform === 'win32',
    });

    const tail = stdout.trim().split('\n').slice(-MAX_OUTPUT_LINES).join('\n');
    findings.push(`[AUTO-TEST] PASSED: ${relPath}\n${tail}`);
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    const combined = (stdout + '\n' + stderr).trim();
    const tail = combined.split('\n').slice(-MAX_OUTPUT_LINES).join('\n');
    findings.push(`[AUTO-TEST] FAILED\n${tail}`);
  }
  return { exitCode: 0, findings };
}

// standalone CLI 모드
if (isDirectRun(import.meta.url)) {
  const { exitCode, findings } = await run(buildCliCtx());
  if (findings.length > 0) process.stdout.write(findings.join('\n') + '\n');
  process.exit(exitCode);
}
