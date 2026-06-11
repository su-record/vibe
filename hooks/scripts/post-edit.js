/**
 * PostToolUse Hook - Edit 후 console.log 감지
 *
 * NOTE: tsc, prettier 제거 — 빌드/커밋 시점에 실행하므로 Edit마다 불필요
 * grep spawn 대신 fs.readFileSync + regex로 프로세스 오버헤드 제거
 *
 * findings를 console.log가 아닌 반환값으로 전달.
 * (console.log 출력은 CC PostToolUse에서 transcript-only — 모델이 보지 못함)
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';

const CONSOLE_LOG_RE = /console\.log\(/;
const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/**
 * in-process 진입점 — console.log 감지만 수행.
 * findings 배열 반환 (디스패처가 수집해 additionalContext에 주입).
 * @param {{ toolInput: string }} ctx
 * @returns {Promise<{ exitCode: number, findings: string[] }>}
 */
export async function run(ctx) {
  const findings = [];
  try {
    const input = JSON.parse(ctx.toolInput || '{}');
    const filePath = input.file_path || input.path || '';

    if (filePath && CODE_EXT_RE.test(filePath)) {
      const resolved = path.resolve(filePath);
      if (existsSync(resolved)) {
        const lines = readFileSync(resolved, 'utf-8').split('\n');
        const hits = [];
        for (let i = 0; i < lines.length && hits.length < 3; i++) {
          if (CONSOLE_LOG_RE.test(lines[i])) hits.push(i + 1);
        }
        if (hits.length > 0) {
          findings.push(`[POST-EDIT] ${path.basename(resolved)}: console.log at line ${hits.join(',')}`);
        }
      }
    }
  } catch {
    // 조용히 실패
  }
  return { exitCode: 0, findings };
}

// standalone CLI 모드 — 전역 예외 흡수는 단독 프로세스일 때만 등록
// (in-process import 시 디스패처의 전역 핸들러를 오염시키지 않도록)
if (isDirectRun(import.meta.url)) {
  process.on('uncaughtException', () => {});
  process.on('unhandledRejection', () => {});
  const { exitCode, findings } = await run(buildCliCtx());
  if (findings.length > 0) process.stdout.write(findings.join('\n') + '\n');
  process.exit(exitCode);
}
