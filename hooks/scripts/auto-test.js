/**
 * PostToolUse Hook - Write/Edit 후 관련 테스트 자동 실행
 *
 * 수정된 파일에 대응하는 테스트 파일을 찾아 실행.
 * 실패 시 마지막 5줄만 출력해서 context window 오염 방지.
 * exit 0 항상 — 차단하지 않고 에이전트에게 결과만 전달.
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { PROJECT_DIR } from './utils.js';

const CODE_EXT_RE = /\.(ts|tsx|js|jsx)$/;
const TEST_SUFFIXES = ['.test.', '.spec.'];
const MAX_OUTPUT_LINES = 5;

function getFilePath() {
  const input = JSON.parse(process.env.TOOL_INPUT || '{}');
  return input.file_path || input.path || '';
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

try {
  const filePath = getFilePath();
  if (!filePath || !CODE_EXT_RE.test(filePath)) process.exit(0);

  const testFile = isTestFile(filePath) ? filePath : findTestFile(filePath);
  if (!testFile) process.exit(0);

  const relPath = path.relative(PROJECT_DIR, testFile);
  let cmd = '';
  if (hasVitest()) {
    cmd = `npx vitest run "${relPath}" --reporter=verbose`;
  } else if (hasJest()) {
    cmd = `npx jest "${relPath}" --no-coverage`;
  } else {
    process.exit(0);
  }

  console.log(`[AUTO-TEST] Running: ${relPath}`);
  const output = execSync(cmd, {
    cwd: PROJECT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  }).toString();

  const tail = output.trim().split('\n').slice(-MAX_OUTPUT_LINES).join('\n');
  console.log(`[AUTO-TEST] PASSED\n${tail}`);
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : '';
  const stdout = err.stdout ? err.stdout.toString() : '';
  const combined = (stdout + '\n' + stderr).trim();
  const tail = combined.split('\n').slice(-MAX_OUTPUT_LINES).join('\n');
  console.log(`[AUTO-TEST] FAILED\n${tail}`);
}
