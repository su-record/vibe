/**
 * PostToolUse Hook - Write/Edit 후 자동 포맷
 *
 * 프로젝트에 설치된 포매터를 감지하고 수정된 파일에 자동 실행.
 * Prettier(JS/TS), Black(Python), gofmt(Go) 지원.
 * 200ms 이내 완료 목표 — 단일 파일만 처리.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import { PROJECT_DIR } from './utils.js';
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';

// WHY async execFile (not execSync): in-process 디스패처에서 다른 step과
// Promise.all로 병렬 실행되므로, 동기 실행은 이벤트 루프를 막아 체인을 직렬화시킨다.
const execFileAsync = promisify(execFile);

const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|json|md|html|vue|svelte)$/;
const PYTHON_EXT_RE = /\.py$/;
const GO_EXT_RE = /\.go$/;
const FORMAT_TIMEOUT_MS = 5000;

function getFilePath(ctx) {
  try {
    const input = JSON.parse(ctx.toolInput || '{}');
    return input.file_path || input.path || '';
  } catch {
    return '';
  }
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

async function formatFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) return;

  try {
    if (CODE_EXT_RE.test(filePath) && hasPrettier()) {
      await execFileAsync('npx', ['prettier', '--write', resolved], {
        cwd: PROJECT_DIR,
        timeout: FORMAT_TIMEOUT_MS,
        // Windows에서 npx는 npx.cmd — shell 없이는 execFile이 찾지 못함
        shell: process.platform === 'win32',
      });
      console.log(`[AUTO-FORMAT] prettier: ${path.basename(resolved)}`);
    } else if (PYTHON_EXT_RE.test(filePath) && hasBin('black')) {
      await execFileAsync('black', ['--quiet', resolved], { timeout: FORMAT_TIMEOUT_MS });
      console.log(`[AUTO-FORMAT] black: ${path.basename(resolved)}`);
    } else if (GO_EXT_RE.test(filePath) && hasBin('gofmt')) {
      await execFileAsync('gofmt', ['-w', resolved], { timeout: FORMAT_TIMEOUT_MS });
      console.log(`[AUTO-FORMAT] gofmt: ${path.basename(resolved)}`);
    }
  } catch {
    // Format failure should never block — silently continue
  }
}

/**
 * in-process 진입점 — 항상 0 반환 (포맷 실패도 차단하지 않음).
 * @param {{ toolInput: string }} ctx
 * @returns {Promise<number>}
 */
export async function run(ctx) {
  try {
    const filePath = getFilePath(ctx);
    if (filePath) await formatFile(filePath);
  } catch {
    // Silent fail
  }
  return 0;
}

// standalone CLI 모드
if (isDirectRun(import.meta.url)) {
  process.exit(await run(buildCliCtx()));
}
