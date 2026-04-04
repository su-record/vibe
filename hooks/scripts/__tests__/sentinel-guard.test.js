import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'sentinel-guard.js');

/**
 * Run sentinel-guard.js with given args or stdin payload.
 * Returns { stdout, exitCode }.
 */
function runGuard({ args = [], stdin = null } = {}) {
  try {
    const opts = { encoding: 'utf-8', timeout: 5000 };
    if (stdin) {
      opts.input = typeof stdin === 'string' ? stdin : JSON.stringify(stdin);
    }
    const stdout = execFileSync('node', [SCRIPT, ...args], opts);
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '').trim(), exitCode: err.status };
  }
}

// ══════════════════════════════════════════════════
// Sentinel path protection
// ══════════════════════════════════════════════════
describe('sentinel-guard', () => {
  describe('Write/Edit to sentinel paths', () => {
    it('should block Write to src/infra/lib/autonomy/ via argv', () => {
      const result = runGuard({
        args: ['Write', JSON.stringify({ file_path: 'src/infra/lib/autonomy/policy.ts' })],
      });
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block Edit to sentinel path via stdin', () => {
      const result = runGuard({
        stdin: {
          tool_name: 'Edit',
          tool_input: { file_path: './src/infra/lib/autonomy/config.ts' },
        },
      });
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
    });

    it('should block Write with backslash path separators', () => {
      const result = runGuard({
        args: ['Write', JSON.stringify({ file_path: 'src\\infra\\lib\\autonomy\\file.ts' })],
      });
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Sentinel files are protected');
    });

    it('should block Write with ./ prefix', () => {
      const result = runGuard({
        args: ['Write', JSON.stringify({ file_path: './src/infra/lib/autonomy/index.ts' })],
      });
      expect(result.exitCode).toBe(2);
    });
  });

  describe('allowed operations', () => {
    it('should allow Write to non-sentinel paths', () => {
      const result = runGuard({
        args: ['Write', JSON.stringify({ file_path: 'src/cli/commands/init.ts' })],
      });
      expect(result.exitCode).toBe(0);
    });

    it('should allow Read to sentinel paths (read is not blocked)', () => {
      const result = runGuard({
        args: ['Read', JSON.stringify({ file_path: 'src/infra/lib/autonomy/policy.ts' })],
      });
      expect(result.exitCode).toBe(0);
    });

    it('should allow Bash commands that do not target sentinel paths', () => {
      const result = runGuard({
        args: ['Bash', JSON.stringify({ command: 'ls -la src/cli/' })],
      });
      expect(result.exitCode).toBe(0);
    });
  });

  describe('dangerous bash commands targeting sentinel paths', () => {
    it('should block rm -rf targeting sentinel path', () => {
      const result = runGuard({
        args: ['Bash', JSON.stringify({ command: 'rm -rf src/infra/lib/autonomy/' })],
      });
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('block');
    });

    it('should block dd if= targeting sentinel path', () => {
      const result = runGuard({
        args: ['Bash', JSON.stringify({ command: 'dd if=/dev/zero of=src/infra/lib/autonomy/data' })],
      });
      expect(result.exitCode).toBe(2);
    });

    it('should allow rm -rf on non-sentinel paths', () => {
      const result = runGuard({
        args: ['Bash', JSON.stringify({ command: 'rm -rf dist/' })],
      });
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Bash command with sentinel path reference', () => {
    it('should block Bash whose command string matches sentinel path pattern', () => {
      const result = runGuard({
        args: ['Bash', JSON.stringify({ command: 'cat src/infra/lib/autonomy/policy.ts | wc -l' })],
      });
      // The command itself contains sentinel path, so isSentinelPath(command) is checked
      // on the full command string — it should match
      expect(result.exitCode).toBe(2);
    });
  });

  describe('stdin vs argv handling', () => {
    it('should prefer stdin payload over argv', () => {
      const result = runGuard({
        args: ['Read', '{}'], // argv says Read (allowed)
        stdin: {
          tool_name: 'Write',
          tool_input: { file_path: 'src/infra/lib/autonomy/x.ts' },
        },
      });
      // stdin should take priority — Write to sentinel path → block
      expect(result.exitCode).toBe(2);
    });
  });
});
