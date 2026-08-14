/**
 * PR 테스트 게이트 공유 헬퍼 — pr-test-gate.js와 pre-tool-guard.js가 공용.
 *
 * 테스트 커맨드 감지 → 실행 → 결과 반환.
 * exit code를 직접 호출하지 않고 결과 객체를 반환한다 (호출자가 판단).
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * 프로젝트에서 실행할 테스트 커맨드를 감지한다.
 *
 * @param {string} projectDir
 * @returns {string|null}
 */
export function detectTestCommand(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return 'npm test';
      }
    } catch { /* ignore */ }
  }
  // Python
  if (existsSync(path.join(projectDir, 'pytest.ini')) || existsSync(path.join(projectDir, 'pyproject.toml'))) {
    return 'python -m pytest --tb=short -q';
  }
  // Go
  if (existsSync(path.join(projectDir, 'go.mod'))) {
    return 'go test ./...';
  }
  return null;
}

/**
 * 테스트 게이트를 실행한다.
 *
 * @param {string} projectDir
 * @returns {{ passed: boolean, testCmd: string|null, output: string }}
 *   testCmd=null 이면 테스트 없음 → passed=true (통과)
 */
export function runPrTestGate(projectDir) {
  const testCmd = detectTestCommand(projectDir);
  if (!testCmd) {
    return { passed: true, testCmd: null, output: '' };
  }

  try {
    execSync(testCmd, {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });
    return { passed: true, testCmd, output: '' };
  } catch (err) {
    const output = err.stdout ? err.stdout.toString().split('\n').slice(-5).join('\n') : '';
    return { passed: false, testCmd, output };
  }
}
