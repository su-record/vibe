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
 * Run sentinel-guard.js with stdin JSON payload (using shell pipe).
 * The script reads stdin via fs.openSync('/dev/stdin'), which requires
 * a real pipe — execFileSync input option does not work.
 */
function runGuardWithStdin(payload) {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  // Escape single quotes in JSON for shell safety
  const escaped = json.replace(/'/g, "'\\''");
  try {
    const stdout = execSync(`echo '${escaped}' | node ${SCRIPT}`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '').trim(), exitCode: err.status };
  }
}

// ══════════════════════════════════════════════════
// Sentinel path protection
// ══════════════════════════════════════════════════
describe('sentinel-guard', () => {
  describe('Write/Edit to sentinel paths via argv', () => {
    it('should block Write to src/infra/lib/autonomy/', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: 'src/infra/lib/autonomy/policy.ts' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block Edit to sentinel path', () => {
      const result = runGuard([
        'Edit',
        JSON.stringify({ file_path: 'src/infra/lib/autonomy/config.ts' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
    });

    it('should block Write with backslash path separators', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: 'src\\infra\\lib\\autonomy\\file.ts' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block Write with ./ prefix', () => {
      const result = runGuard([
        'Write',
        JSON.stringify({ file_path: './src/infra/lib/autonomy/index.ts' }),
      ]);
      expect(result.exitCode).toBe(2);
    });
  });

  describe('Write/Edit to sentinel paths via stdin', () => {
    it('should block Edit via stdin payload', () => {
      const result = runGuardWithStdin({
        tool_name: 'Edit',
        tool_input: { file_path: './src/infra/lib/autonomy/config.ts' },
      });
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
    });

    it('should block Write via stdin payload', () => {
      const result = runGuardWithStdin({
        tool_name: 'Write',
        tool_input: { file_path: 'src/infra/lib/autonomy/policy.ts' },
      });
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Sentinel files are protected');
    });
  });

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
        JSON.stringify({ file_path: 'src/infra/lib/autonomy/policy.ts' }),
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
  });

  describe('dangerous bash commands targeting sentinel paths', () => {
    it('should block rm -rf targeting sentinel path', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'rm -rf src/infra/lib/autonomy/' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
      expect(result.stdout).toContain('Dangerous command targeting sentinel path');
    });

    it('should block kill -9 targeting sentinel path', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'kill -9 1234 && rm src/infra/lib/autonomy/x' }),
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

  describe('Bash command containing sentinel path in command string', () => {
    it('should block when command string itself starts with sentinel path', () => {
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'src/infra/lib/autonomy/run.sh' }),
      ]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should not block non-dangerous commands referencing sentinel path mid-string', () => {
      // isSentinelPath only checks startsWith, and the DANGEROUS_BASH_RE +
      // includes check requires both a dangerous command and sentinel path
      const result = runGuard([
        'Bash',
        JSON.stringify({ command: 'cat src/infra/lib/autonomy/policy.ts | wc -l' }),
      ]);
      // 'cat' is not a dangerous command, command does not start with sentinel path
      expect(result.exitCode).toBe(0);
    });
  });

  describe('stdin vs argv priority', () => {
    it('should prefer stdin payload over argv', () => {
      const payload = JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: 'src/infra/lib/autonomy/x.ts' },
      });
      const escaped = payload.replace(/'/g, "'\\''");
      try {
        execSync(`echo '${escaped}' | node ${SCRIPT} Read '{}'`, {
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
