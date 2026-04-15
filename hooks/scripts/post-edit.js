/**
 * PostToolUse Hook - Edit 후 console.log 감지
 *
 * NOTE: tsc, prettier 제거 — 빌드/커밋 시점에 실행하므로 Edit마다 불필요
 * grep spawn 대신 fs.readFileSync + regex로 프로세스 오버헤드 제거
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const CONSOLE_LOG_RE = /console\.log/;
const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

try {
  const input = JSON.parse(process.env.TOOL_INPUT || '{}');
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
        console.log(`[POST-EDIT] ${path.basename(resolved)}: console.log at line ${hits.join(',')}`);
      }
    }
  }
} catch {
  // 조용히 실패
}
