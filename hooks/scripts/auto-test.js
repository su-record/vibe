/**
 * PostToolUse Hook - Write/Edit 후 관련 테스트 자동 실행
 *
 * 수정된 파일에 대응하는 테스트 파일을 찾아 실행.
 * 실패 시 마지막 5줄만 출력해서 context window 오염 방지.
 * exit 0 항상 — 차단하지 않고 에이전트에게 결과만 전달.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import { PROJECT_DIR } from './utils.js';
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';

// WHY async execFile (not execSync): in-process 디스패처에서 다른 step과
// Promise.all로 병렬 실행되므로, 60초 동기 실행은 체인 전체를 직렬화시킨다.
const execFileAsync = promisify(execFile);

const CODE_EXT_RE = /\.(ts|tsx|js|jsx)$/;
const TEST_SUFFIXES = ['.test.', '.spec.'];
const MAX_OUTPUT_LINES = 5;
const TEST_TIMEOUT_MS = 60000;

function getFilePath(ctx) {
  try {
    const input = JSON.parse(ctx.toolInput || '{}');
    return input.file_path || input.path || '';
  } catch {
    return '';
  }
}

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
 * in-process 진입점 — 항상 0 반환 (테스트 실패도 차단하지 않고 결과만 전달).
 * @param {{ toolInput: string }} ctx
 * @returns {Promise<number>}
 */
export async function run(ctx) {
  try {
    const filePath = getFilePath(ctx);
    if (!filePath || !CODE_EXT_RE.test(filePath)) return 0;

    const testFile = isTestFile(filePath) ? filePath : findTestFile(filePath);
    if (!testFile) return 0;

    const relPath = path.relative(PROJECT_DIR, testFile);
    let args = null;
    if (hasVitest()) {
      args = ['vitest', 'run', relPath, '--reporter=verbose'];
    } else if (hasJest()) {
      args = ['jest', relPath, '--no-coverage'];
    } else {
      return 0;
    }

    console.log(`[AUTO-TEST] Running: ${relPath}`);
    const { stdout } = await execFileAsync('npx', args, {
      cwd: PROJECT_DIR,
      timeout: TEST_TIMEOUT_MS,
      // Windows에서 npx는 npx.cmd — shell 없이는 execFile이 찾지 못함
      shell: process.platform === 'win32',
    });

    const tail = stdout.trim().split('\n').slice(-MAX_OUTPUT_LINES).join('\n');
    console.log(`[AUTO-TEST] PASSED\n${tail}`);
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    const combined = (stdout + '\n' + stderr).trim();
    const tail = combined.split('\n').slice(-MAX_OUTPUT_LINES).join('\n');
    console.log(`[AUTO-TEST] FAILED\n${tail}`);
  }
  return 0;
}

// standalone CLI 모드
if (isDirectRun(import.meta.url)) {
  process.exit(await run(buildCliCtx()));
}
