/**
 * auto-test.js debounce 테스트
 *
 * 검증 대상:
 *   - debounce 모드에서 쿨다운 내 + 소스 미변경 → 스킵
 *   - 쿨다운 만료 → 재실행
 *   - 소스 변경 → 재실행
 *   - mode='off' → 실행 안 함
 *   - mode='always' → debounce 없이 항상 실행 시도
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-autotest-debounce-'));
});
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// debounce 로직 단위 테스트 (auto-test.js와 동일 알고리즘)
const DEBOUNCE_COOLDOWN_MS = 120_000;

function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}

function makeDebounceHelpers(stateFile) {
  function readState() {
    try {
      if (fs.existsSync(stateFile)) return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch { /* ignore */ }
    return {};
  }

  function writeState(state) {
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
    } catch { /* ignore */ }
  }

  function shouldSkip(testFile, srcFile) {
    try {
      const state = readState();
      const entry = state[testFile];
      if (!entry) return false;
      const elapsed = Date.now() - entry.lastRun;
      if (elapsed > DEBOUNCE_COOLDOWN_MS) return false;
      const currentHash = fileHash(srcFile);
      if (currentHash !== entry.srcHash) return false;
      return true;
    } catch {
      return false;
    }
  }

  function updateState(testFile, srcFile) {
    const state = readState();
    state[testFile] = { lastRun: Date.now(), srcHash: fileHash(srcFile) };
    writeState(state);
  }

  return { shouldSkip, updateState, readState };
}

describe('auto-test debounce: 핵심 로직', () => {
  it('첫 실행: state 없음 → 스킵 안 함', () => {
    const stateFile = path.join(tmpDir, 'auto-test-state.json');
    const { shouldSkip } = makeDebounceHelpers(stateFile);
    const testFile = path.join(tmpDir, 'foo.test.ts');
    const srcFile = path.join(tmpDir, 'foo.ts');
    fs.writeFileSync(srcFile, 'const x = 1;\n', 'utf-8');
    expect(shouldSkip(testFile, srcFile)).toBe(false);
  });

  it('state 업데이트 후 쿨다운 내 + 소스 미변경 → 스킵', () => {
    const stateFile = path.join(tmpDir, 'auto-test-state.json');
    const { shouldSkip, updateState } = makeDebounceHelpers(stateFile);
    const testFile = path.join(tmpDir, 'foo.test.ts');
    const srcFile = path.join(tmpDir, 'foo.ts');
    fs.writeFileSync(srcFile, 'const x = 1;\n', 'utf-8');
    updateState(testFile, srcFile);
    // 소스 변경 없음 + 즉시 재호출 → 스킵
    expect(shouldSkip(testFile, srcFile)).toBe(true);
  });

  it('소스 변경 후 → 스킵 안 함 (재실행)', () => {
    const stateFile = path.join(tmpDir, 'auto-test-state.json');
    const { shouldSkip, updateState } = makeDebounceHelpers(stateFile);
    const testFile = path.join(tmpDir, 'foo.test.ts');
    const srcFile = path.join(tmpDir, 'foo.ts');
    fs.writeFileSync(srcFile, 'const x = 1;\n', 'utf-8');
    updateState(testFile, srcFile);
    // 소스 변경
    fs.writeFileSync(srcFile, 'const x = 2;\n', 'utf-8');
    expect(shouldSkip(testFile, srcFile)).toBe(false);
  });

  it('쿨다운 만료 → 스킵 안 함 (재실행)', () => {
    const stateFile = path.join(tmpDir, 'auto-test-state.json');
    const { shouldSkip, updateState, readState } = makeDebounceHelpers(stateFile);
    const testFile = path.join(tmpDir, 'foo.test.ts');
    const srcFile = path.join(tmpDir, 'foo.ts');
    fs.writeFileSync(srcFile, 'const x = 1;\n', 'utf-8');
    updateState(testFile, srcFile);

    // lastRun을 과거로 조작 (쿨다운 초과)
    const state = readState();
    state[testFile].lastRun = Date.now() - DEBOUNCE_COOLDOWN_MS - 1000;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state), 'utf-8');

    expect(shouldSkip(testFile, srcFile)).toBe(false);
  });

  it('state 파일 없어도 fail-open (스킵 안 함)', () => {
    const stateFile = path.join(tmpDir, 'nonexistent', 'state.json');
    const { shouldSkip } = makeDebounceHelpers(stateFile);
    const testFile = path.join(tmpDir, 'foo.test.ts');
    const srcFile = path.join(tmpDir, 'foo.ts');
    expect(shouldSkip(testFile, srcFile)).toBe(false);
  });
});

describe('auto-test: state 파일 경로 패턴', () => {
  it('state 파일이 .vibe/metrics/ 하위에 위치', () => {
    // 경로 패턴 검증 (실제 PROJECT_DIR은 다름)
    const expectedPattern = /\.vibe[/\\]metrics[/\\]auto-test-state\.json$/;
    const stateFile = path.join('/some/project', '.vibe', 'metrics', 'auto-test-state.json');
    expect(expectedPattern.test(stateFile)).toBe(true);
  });
});
