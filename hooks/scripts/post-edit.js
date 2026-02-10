/**
 * PostToolUse Hook - Edit 후 console.log 감지
 *
 * NOTE: tsc, prettier 제거 — 빌드/커밋 시점에 실행하므로 Edit마다 불필요
 */
import { execSync } from 'child_process';
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

    // TypeScript/JavaScript 파일인지 확인
    const isTs = /\.(ts|tsx)$/.test(filePath);
    const isJs = /\.(js|jsx|mjs|cjs)$/.test(filePath);

    if (!isTs && !isJs) {
      return;
    }

    const results = [];

    // console.log 감지
    try {
      const grepResult = execSync(
        `grep -n "console\\.log" "${filePath}" 2>/dev/null | head -3`,
        { cwd: PROJECT_DIR, stdio: 'pipe', encoding: 'utf-8' }
      );
      if (grepResult.trim()) {
        const lines = grepResult.trim().split('\n').map(l => l.split(':')[0]).join(',');
        results.push(`console.log at line ${lines}`);
      }
    } catch {
      // grep 실패는 console.log 없음을 의미
    }

    if (results.length > 0) {
      console.log(`[POST-EDIT] ${filePath.split('/').pop()}: ${results.join(' | ')}`);
    }

  } catch {
    // 조용히 실패
  }
}

main();
