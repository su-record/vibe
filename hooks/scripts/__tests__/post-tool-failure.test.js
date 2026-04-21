import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'post-tool-failure.js');

let TMP;

function run(payload) {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  try {
    const stdout = execFileSync('node', [SCRIPT], {
      input: json,
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: TMP, VIBE_HOOK_DEPTH: '' },
    });
    return { stdout, code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', code: err.status ?? 1 };
  }
}

function listRegressions() {
  const dir = path.join(TMP, '.vibe', 'regressions');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md'));
}

function readRegression(slug) {
  return fs.readFileSync(path.join(TMP, '.vibe', 'regressions', `${slug}.md`), 'utf-8');
}

beforeEach(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-post-fail-'));
  fs.mkdirSync(path.join(TMP, '.vibe'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('post-tool-failure', () => {
  it('registers a regression on failing Bash quality command', () => {
    run({
      tool_name: 'Bash',
      tool_input: { command: 'pnpm test --run' },
      tool_response: { exit_code: 1, stderr: 'FAIL src/foo.test.ts\n  expected 1 to be 2', stdout: '' },
    });
    const files = listRegressions();
    expect(files.length).toBe(1);
    const content = readRegression(files[0].replace('.md', ''));
    expect(content).toContain('status: open');
    expect(content).toContain('pnpm test --run');
    expect(content).toContain('source: post-tool-failure-hook');
  });

  it('ignores Bash failures on non-quality commands', () => {
    run({
      tool_name: 'Bash',
      tool_input: { command: 'ls /nonexistent' },
      tool_response: { exit_code: 2, stderr: 'No such file' },
    });
    expect(listRegressions()).toEqual([]);
  });

  it('ignores Bash successes on quality commands', () => {
    run({
      tool_name: 'Bash',
      tool_input: { command: 'pnpm test' },
      tool_response: { exit_code: 0, stdout: 'all passing' },
    });
    expect(listRegressions()).toEqual([]);
  });

  it('registers on Edit structural failure', () => {
    run({
      tool_name: 'Edit',
      tool_input: { file_path: '/src/foo.ts', old_string: 'a', new_string: 'b' },
      tool_response: { success: false, error: 'old_string not found in file' },
    });
    const files = listRegressions();
    expect(files.length).toBe(1);
    expect(readRegression(files[0].replace('.md', ''))).toContain('Edit failure on /src/foo.ts');
  });

  it('does not double-register identical failures (deterministic slug)', () => {
    const payload = {
      tool_name: 'Bash',
      tool_input: { command: 'pnpm lint' },
      tool_response: { exit_code: 1, stderr: 'error TS2345' },
    };
    run(payload);
    run(payload);
    expect(listRegressions().length).toBe(1);
  });

  it('does not re-open resolved regressions', () => {
    // First register
    const payload = {
      tool_name: 'Bash',
      tool_input: { command: 'pnpm test' },
      tool_response: { exit_code: 1, stderr: 'fail' },
    };
    run(payload);
    const slug = listRegressions()[0].replace('.md', '');
    // Manually mark resolved
    const p = path.join(TMP, '.vibe', 'regressions', `${slug}.md`);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf-8').replace('status: open', 'status: resolved'));
    // Re-trigger
    run(payload);
    // Still resolved (not overwritten)
    expect(fs.readFileSync(p, 'utf-8')).toContain('status: resolved');
  });

  it('respects regress.autoRegisterOnFailure=false config', () => {
    fs.writeFileSync(path.join(TMP, '.vibe', 'config.json'),
      JSON.stringify({ regress: { autoRegisterOnFailure: false } }));
    run({
      tool_name: 'Bash',
      tool_input: { command: 'pnpm test' },
      tool_response: { exit_code: 1, stderr: 'fail' },
    });
    expect(listRegressions()).toEqual([]);
  });

  it('skips when VIBE_HOOK_DEPTH is set (child session)', () => {
    try {
      execFileSync('node', [SCRIPT], {
        input: JSON.stringify({
          tool_name: 'Bash',
          tool_input: { command: 'pnpm test' },
          tool_response: { exit_code: 1, stderr: 'fail' },
        }),
        encoding: 'utf-8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: TMP, VIBE_HOOK_DEPTH: '1' },
      });
    } catch { /* ignore */ }
    expect(listRegressions()).toEqual([]);
  });

  it('tags different error signatures as different slugs', () => {
    run({
      tool_name: 'Bash',
      tool_input: { command: 'pnpm test' },
      tool_response: { exit_code: 1, stderr: 'FAIL foo.test.ts' },
    });
    run({
      tool_name: 'Bash',
      tool_input: { command: 'pnpm test' },
      tool_response: { exit_code: 1, stderr: 'FAIL bar.test.ts' },
    });
    expect(listRegressions().length).toBe(2);
  });
});
