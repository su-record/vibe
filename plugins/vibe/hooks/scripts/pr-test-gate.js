/**
 * PreToolUse Hook - PR 생성 전 테스트 게이트
 *
 * mcp__github__create_pull_request 호출 시 테스트가 통과해야만 PR 생성 허용.
 * exit 2 = 차단, exit 0 = 통과
 */
import { PROJECT_DIR } from './utils.js';
import { runPrTestGate } from './lib/pr-gate-runner.js';

const { passed, testCmd, output } = runPrTestGate(PROJECT_DIR);

if (!testCmd) {
  // 테스트 커맨드 없음 → PR 허용
  process.exit(0);
}

if (passed) {
  console.log('[PR-GATE] Tests passed — PR creation allowed');
  process.exit(0);
} else {
  console.log(`[PR-GATE] Tests failed — PR creation blocked\n${output}`);
  process.exit(2);
}
