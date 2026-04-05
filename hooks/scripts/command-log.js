/**
 * PreToolUse Hook - 모든 Bash 명령어를 타임스탬프와 함께 로깅
 *
 * 로그 위치: .claude/command-log.txt
 * exit 0 항상 통과 (로깅만 수행, 차단하지 않음)
 */
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { PROJECT_DIR } from './utils.js';

const LOG_DIR = path.join(PROJECT_DIR, '.claude');
const LOG_FILE = path.join(LOG_DIR, 'command-log.txt');
const MAX_CMD_LENGTH = 500;

try {
  const input = JSON.parse(process.env.TOOL_INPUT || '{}');
  const command = input.command || '';
  if (!command) process.exit(0);

  const timestamp = new Date().toISOString();
  const truncated = command.length > MAX_CMD_LENGTH
    ? command.slice(0, MAX_CMD_LENGTH) + '...(truncated)'
    : command;

  const entry = `[${timestamp}] ${truncated}\n`;

  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(LOG_FILE, entry);
} catch {
  // Never block on logging failure
}
process.exit(0);
