/**
 * PostToolUse Hook - Write/Edit 후 자동 포맷
 *
 * 프로젝트에 설치된 포매터를 감지하고 수정된 파일에 자동 실행.
 * Prettier(JS/TS), Black(Python), gofmt(Go) 지원.
 * 200ms 이내 완료 목표 — 단일 파일만 처리.
 *
 * 변경 감지: mtime 비교로 prettier가 실제 파일을 수정했는지 판단.
 * 수정된 경우 finding을 반환 — 디스패처가 additionalContext에 포함시킨다.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
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

/**
 * mtimeMs 읽기 — stat 실패 시 0 반환 (fail-open).
 * @param {string} resolvedPath
 * @returns {number}
 */
function getMtime(resolvedPath) {
  try {
    return statSync(resolvedPath).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * 파일 포맷 실행. 실제 변경이 발생했으면 finding 문자열을 반환.
 * @param {string} filePath
 * @returns {Promise<string|null>} finding or null
 */
async function formatFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) return null;

  try {
    if (CODE_EXT_RE.test(filePath) && hasPrettier()) {
      const mtimeBefore = getMtime(resolved);
      await execFileAsync('npx', ['prettier', '--write', resolved], {
        cwd: PROJECT_DIR,
        timeout: FORMAT_TIMEOUT_MS,
        // Windows에서 npx는 npx.cmd — shell 없이는 execFile이 찾지 못함
        shell: process.platform === 'win32',
      });
      const mtimeAfter = getMtime(resolved);
      if (mtimeAfter > mtimeBefore) {
        return `auto-format reformatted ${path.basename(resolved)} — re-read before further edits to avoid stale old_string`;
      }
    } else if (PYTHON_EXT_RE.test(filePath) && hasBin('black')) {
      const mtimeBefore = getMtime(resolved);
      await execFileAsync('black', ['--quiet', resolved], { timeout: FORMAT_TIMEOUT_MS });
      const mtimeAfter = getMtime(resolved);
      if (mtimeAfter > mtimeBefore) {
        return `auto-format reformatted ${path.basename(resolved)} — re-read before further edits to avoid stale old_string`;
      }
    } else if (GO_EXT_RE.test(filePath) && hasBin('gofmt')) {
      const mtimeBefore = getMtime(resolved);
      await execFileAsync('gofmt', ['-w', resolved], { timeout: FORMAT_TIMEOUT_MS });
      const mtimeAfter = getMtime(resolved);
      if (mtimeAfter > mtimeBefore) {
        return `auto-format reformatted ${path.basename(resolved)} — re-read before further edits to avoid stale old_string`;
      }
    }
  } catch {
    // Format failure should never block — silently continue
  }
  return null;
}

/**
 * in-process 진입점 — 포맷 실행. finding 문자열 배열 반환.
 * @param {{ toolInput: string }} ctx
 * @returns {Promise<{ exitCode: number, findings: string[] }>}
 */
export async function run(ctx) {
  const findings = [];
  try {
    const filePath = getFilePath(ctx);
    if (filePath) {
      const finding = await formatFile(filePath);
      if (finding) findings.push(finding);
    }
  } catch {
    // Silent fail
  }
  return { exitCode: 0, findings };
}

// standalone CLI 모드
if (isDirectRun(import.meta.url)) {
  const { exitCode, findings } = await run(buildCliCtx());
  if (findings.length > 0) process.stdout.write(findings.join('\n') + '\n');
  process.exit(exitCode);
}
