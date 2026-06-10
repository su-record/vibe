/**
 * PostToolUse Hook - Write/Edit 후 자동 포맷
 *
 * 프로젝트에 설치된 포매터를 감지하고 수정된 파일에 자동 실행.
 * Prettier(JS/TS), Black(Python), gofmt(Go) 지원.
 * 200ms 이내 완료 목표 — 단일 파일만 처리.
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { PROJECT_DIR } from './utils.js';

const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|json|md|html|vue|svelte)$/;
const PYTHON_EXT_RE = /\.py$/;
const GO_EXT_RE = /\.go$/;

function getFilePath() {
  const input = JSON.parse(process.env.TOOL_INPUT || '{}');
  return input.file_path || input.path || '';
}

// PATH 직접 스캔 — `which` execSync는 매 파일 저장마다 자식 프로세스를 동기
// spawn하므로, fs.existsSync로 대체하고 프로세스 내 캐싱한다.
const _binCache = new Map();
function hasBin(name) {
  const cached = _binCache.get(name);
  if (cached !== undefined) return cached;
  const candidates = process.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`, name] : [name];
  const found = (process.env.PATH || '').split(path.delimiter).some(
    dir => dir && candidates.some(c => existsSync(path.join(dir, c))),
  );
  _binCache.set(name, found);
  return found;
}

function hasPrettier() {
  return existsSync(path.join(PROJECT_DIR, 'node_modules', '.bin', 'prettier'));
}

function formatFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) return;

  try {
    if (CODE_EXT_RE.test(filePath) && hasPrettier()) {
      execSync(`npx prettier --write "${resolved}"`, {
        cwd: PROJECT_DIR,
        stdio: 'ignore',
        timeout: 5000,
      });
      console.log(`[AUTO-FORMAT] prettier: ${path.basename(resolved)}`);
    } else if (PYTHON_EXT_RE.test(filePath) && hasBin('black')) {
      execSync(`black --quiet "${resolved}"`, { stdio: 'ignore', timeout: 5000 });
      console.log(`[AUTO-FORMAT] black: ${path.basename(resolved)}`);
    } else if (GO_EXT_RE.test(filePath) && hasBin('gofmt')) {
      execSync(`gofmt -w "${resolved}"`, { stdio: 'ignore', timeout: 5000 });
      console.log(`[AUTO-FORMAT] gofmt: ${path.basename(resolved)}`);
    }
  } catch {
    // Format failure should never block — silently continue
  }
}

try {
  const filePath = getFilePath();
  if (filePath) formatFile(filePath);
} catch {
  // Silent fail
}
