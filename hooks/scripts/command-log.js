/**
 * PreToolUse Hook - 모든 Bash 명령어를 타임스탬프와 함께 로깅
 *
 * 로그 위치: .vibe/command-log.txt (legacy .claude/vibe/ 사용 중이면 그쪽)
 * exit 0 항상 통과 (로깅만 수행, 차단하지 않음)
 */
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { PROJECT_DIR, projectVibeRoot } from './utils.js';
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';

const MAX_CMD_LENGTH = 500;

/**
 * in-process 진입점 — 로깅만 수행, 항상 0 반환 (차단하지 않음).
 * @param {{ toolInput: string }} ctx
 * @returns {Promise<number>}
 */
export async function run(ctx) {
  try {
    const input = JSON.parse(ctx.toolInput || '{}');
    const command = input.command || '';
    if (!command) return 0;

    const timestamp = new Date().toISOString();
    const truncated = command.length > MAX_CMD_LENGTH
      ? command.slice(0, MAX_CMD_LENGTH) + '...(truncated)'
      : command;

    const logDir = projectVibeRoot(PROJECT_DIR);
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    appendFileSync(path.join(logDir, 'command-log.txt'), `[${timestamp}] ${truncated}\n`);
  } catch {
    // Never block on logging failure
  }
  return 0;
}

// standalone CLI 모드
if (isDirectRun(import.meta.url)) {
  process.exit(await run(buildCliCtx()));
}
