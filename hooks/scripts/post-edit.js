/**
 * PostToolUse Hook - Edit 후 자동 포맷팅 및 TypeScript 체크
 *
 * 기능:
 * - TypeScript/JavaScript 파일 수정 시 자동 Prettier 포맷팅
 * - TypeScript 파일 수정 시 타입 체크
 * - console.log 감지 및 경고
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
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

    // Prettier 포맷팅 (prettier가 설치된 경우만)
    const prettierConfig = [
      `${PROJECT_DIR}/.prettierrc`,
      `${PROJECT_DIR}/.prettierrc.json`,
      `${PROJECT_DIR}/.prettierrc.js`,
      `${PROJECT_DIR}/prettier.config.js`,
    ].find(p => existsSync(p));

    if (prettierConfig || existsSync(`${PROJECT_DIR}/node_modules/.bin/prettier`)) {
      try {
        execSync(`npx prettier --write "${filePath}" 2>/dev/null`, {
          cwd: PROJECT_DIR,
          stdio: 'pipe',
          timeout: 10000,
        });
        results.push('formatted');
      } catch {
        // Prettier 실패는 무시
      }
    }

    // TypeScript 타입 체크 (tsconfig가 있는 경우만)
    if (isTs && existsSync(`${PROJECT_DIR}/tsconfig.json`)) {
      try {
        execSync(`npx tsc --noEmit --skipLibCheck 2>&1 | head -5`, {
          cwd: PROJECT_DIR,
          stdio: 'pipe',
          timeout: 30000,
        });
        results.push('types OK');
      } catch (e) {
        const output = e.stdout?.toString() || '';
        const errorCount = (output.match(/error TS/g) || []).length;
        if (errorCount > 0) {
          results.push(`${errorCount} type errors`);
        }
      }
    }

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
