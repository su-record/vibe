import { describe, it, expect } from 'vitest';
import { execFileSync, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'sentinel-guard.js');

/**
 * Run sentinel-guard.js with argv arguments.
 * Returns { stdout, exitCode }.
 */
function runGuard(args = []) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '').trim(), exitCode: err.status };
  }
}

/**
 * Run sentinel-guard.js with stdin JSON payload.
 */
function runGuardWithStdin(payload) {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  try {
    const stdout = execFileSync('node', [SCRIPT], {
      input: json,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '').trim(), exitCode: err.status };
  }
}

// ══════════════════════════════════════════════════
// Sentinel path protection — evolution machinery
// ══════════════════════════════════════════════════
describe('sentinel-guard', () => {
  // ─── 실제 보호 경로: src/infra/lib/evolution/ ───
  describe('Write/Edit to evolution sentinel path via argv', () => {
    it('should block Write to src/infra/lib/evolution/', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: 'src/infra/lib/evolution/EvolutionOrchestrator.ts' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block Edit to evolution sentinel path', () => {
      const result = runGuard([
        'Edit',
        JSON.stringify({ file_path: 'src/infra/lib/evolution/GuardAnalyzer.ts' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
    });

    it('should block Write with backslash path separators', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: 'src\\infra\\lib\\evolution\\file.ts' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block Write with ./ prefix', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: './src/infra/lib/evolution/index.ts' }),
      ]);
      expect(result.exitCode).toBe(2);
    });
  });

  // ─── 실제 보호 경로: hooks/scripts/lib/ ───
  describe('Write/Edit to hooks/scripts/lib/ sentinel path', () => {
    it('should block Write to hooks/scripts/lib/', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: 'hooks/scripts/lib/dispatcher.js' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block Edit to hook-context.js', () => {
      const result = runGuard([
        'Edit',
        JSON.stringify({ file_path: 'hooks/scripts/lib/hook-context.js' }),
      ]);
      expect(result.exitCode).toBe(2);
    });
  });

  // ─── stdin 경로 ───
  describe('Write/Edit to sentinel paths via stdin', () => {
    it('should block Edit evolution path via stdin payload', () => {
      const result = runGuardWithStdin({
        tool_name: 'Edit',
        tool_input: { file_path: './src/infra/lib/evolution/InsightStore.ts' },
      });
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
    });

    it('should block Write evolution path via stdin payload', () => {
      const result = runGuardWithStdin({
        tool_name: 'Write',
        tool_input: { file_path: 'src/infra/lib/evolution/CircuitBreaker.ts' },
      });
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block Write hooks/scripts/lib/ path via stdin', () => {
      const result = runGuardWithStdin({
        tool_name: 'Write',
        tool_input: { file_path: 'hooks/scripts/lib/run-ledger.js' },
      });
      expect(result.exitCode).toBe(2);
    });
  });

  // ─── 허용 경로 ───
  describe('allowed operations', () => {
    it('should allow Write to non-sentinel paths', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: 'src/cli/commands/init.ts' }),
      ]);
      expect(result.exitCode).toBe(0);
    });

    it('should allow Read to sentinel paths (read is not blocked)', () => {
      const result = runGuard([
        'Read',
        JSON.stringify({ file_path: 'src/infra/lib/evolution/GuardAnalyzer.ts' }),
      ]);
      expect(result.exitCode).toBe(0);
    });

    it('should allow Bash commands that do not target sentinel paths', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'ls -la src/cli/' }),
      ]);
      expect(result.exitCode).toBe(0);
    });

    it('should allow Write to hooks/scripts/ top level (not lib/ subdir)', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: 'hooks/scripts/step-counter.js' }),
      ]);
      expect(result.exitCode).toBe(0);
    });

    it('should allow Write to src/infra/lib/ parent (not evolution subdir)', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: 'src/infra/lib/constants.ts' }),
      ]);
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── 위험한 bash + sentinel 경로 ───
  describe('dangerous bash commands targeting sentinel paths', () => {
    it('should block rm -rf targeting evolution path', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'rm -rf src/infra/lib/evolution/' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
      expect(result.stdout).toContain('Dangerous command targeting sentinel path');
    });

    it('should block rm -rf targeting hooks/scripts/lib/', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'rm -rf hooks/scripts/lib/' }),
      ]);
      expect(result.exitCode).toBe(2);
    });

    it('should allow rm -rf on non-sentinel paths', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'rm -rf dist/' }),
      ]);
      expect(result.exitCode).toBe(0);
    });

    it('should allow dangerous commands not targeting sentinel paths', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'rm -rf /tmp/junk' }),
      ]);
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Bash 명령어 문자열이 sentinel 경로로 시작하는 경우 ───
  describe('Bash command containing sentinel path in command string', () => {
    it('should block when command string itself starts with evolution sentinel path', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'src/infra/lib/evolution/run.sh' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block when command string starts with hooks/scripts/lib/', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'hooks/scripts/lib/dispatcher.js' }),
      ]);
      expect(result.exitCode).toBe(2);
    });

    it('should not block non-dangerous commands referencing sentinel path mid-string', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'cat src/infra/lib/evolution/GuardAnalyzer.ts | wc -l' }),
      ]);
      // 'cat' is not a dangerous command, command does not start with sentinel path
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── stdin vs argv 우선순위 ───
  describe('stdin vs argv priority', () => {
    it('should prefer stdin payload over argv', () => {
      const payload = JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: 'src/infra/lib/evolution/x.ts' },
      });
      try {
        execFileSync('node', [SCRIPT, 'Read', '{}'], {
          input: payload,
          encoding: 'utf-8',
          timeout: 5000,
        });
        expect.unreachable('should have exited with code 2');
      } catch (err) {
        expect(err.status).toBe(2);
        expect(err.stdout).toContain('block');
      }
    });
  });
});
