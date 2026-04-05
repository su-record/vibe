/**
 * PreToolUse Hook - PR 생성 전 테스트 게이트
 *
 * mcp__github__create_pull_request 호출 시 테스트가 통과해야만 PR 생성 허용.
 * exit 2 = 차단, exit 0 = 통과
 */
import { execSync } from 'child_process';
import { PROJECT_DIR } from './utils.js';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

function detectTestCommand() {
  const pkgPath = path.join(PROJECT_DIR, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return 'npm test';
      }
    } catch { /* ignore */ }
  }
  // Python
  if (existsSync(path.join(PROJECT_DIR, 'pytest.ini')) || existsSync(path.join(PROJECT_DIR, 'pyproject.toml'))) {
    return 'python -m pytest --tb=short -q';
  }
  // Go
  if (existsSync(path.join(PROJECT_DIR, 'go.mod'))) {
    return 'go test ./...';
  }
  return null;
}

try {
  const testCmd = detectTestCommand();
  if (!testCmd) {
    // No test command detected — allow PR
    process.exit(0);
  }

  console.log(`[PR-GATE] Running tests before PR creation: ${testCmd}`);
  execSync(testCmd, {
    cwd: PROJECT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });
  console.log('[PR-GATE] Tests passed — PR creation allowed');
  process.exit(0);
} catch (err) {
  const output = err.stdout ? err.stdout.toString().split('\n').slice(-5).join('\n') : '';
  console.log(`[PR-GATE] Tests failed — PR creation blocked\n${output}`);
  process.exit(2);
}
