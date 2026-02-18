/**
 * PostToolUse Hook - Edit 후 console.log 감지
 *
 * NOTE: tsc, prettier 제거 — 빌드/커밋 시점에 실행하므로 Edit마다 불필요
 */
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { PROJECT_DIR } from './utils.js';

// Claude Code에서 전달받는 환경변수에서 파일 경로 추출
const toolInput = process.env.TOOL_INPUT || '{}';

function main() {
  try {
    const input = JSON.parse(toolInput);
    const filePath = input.file_path || input.path || '';

    if (!filePath) {
      return;
    }

    // 경로 검증: resolve로 정규화
    const resolved = path.resolve(filePath);
    if (!existsSync(resolved)) {
      return;
    }

    // TypeScript/JavaScript 파일인지 확인
    const isTs = /\.(ts|tsx)$/.test(resolved);
    const isJs = /\.(js|jsx|mjs|cjs)$/.test(resolved);

    if (!isTs && !isJs) {
      return;
    }

    const results = [];

    // console.log 감지 (execFileSync로 command injection 방지)
    try {
      const grepResult = execFileSync(
        'grep', ['-n', 'console\\.log', resolved],
        { cwd: PROJECT_DIR, stdio: 'pipe', encoding: 'utf-8' }
      );
      if (grepResult.trim()) {
        const lines = grepResult.trim().split('\n').slice(0, 3).map(l => l.split(':')[0]).join(',');
        results.push(`console.log at line ${lines}`);
      }
    } catch {
      // grep 실패는 console.log 없음을 의미
    }

    if (results.length > 0) {
      console.log(`[POST-EDIT] ${path.basename(resolved)}: ${results.join(' | ')}`);
    }

  } catch {
    // 조용히 실패
  }
}

main();
