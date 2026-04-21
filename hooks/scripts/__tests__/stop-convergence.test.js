import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'stop-convergence.js');

let TMP;

function writeFile(rel, content) {
  const p = path.join(TMP, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function run(stdin = '{}') {
  try {
    const stdout = execFileSync('node', [SCRIPT], {
      input: stdin,
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: TMP, VIBE_HOOK_DEPTH: '' },
    });
    return { stdout: stdout.trim(), code: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '').trim(), code: err.status ?? 1 };
  }
}

function parseJSON(s) {
  const match = s.match(/\{.*\}/s);
  return match ? JSON.parse(match[0]) : null;
}

beforeEach(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-stop-conv-'));
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('stop-convergence', () => {
  it('passes when no regressions/checks/verify state exists', () => {
    fs.mkdirSync(path.join(TMP, '.vibe'), { recursive: true });
    const r = run('{}');
    expect(r.stdout).toBe('');
    expect(r.code).toBe(0);
  });

  it('blocks when an open regression exists', () => {
    writeFile('.vibe/regressions/foo.md', [
      '---', 'slug: foo', 'status: open', 'root-cause-tag: other',
      'registered: 2026-04-21', 'feature: demo', '---', 'body',
    ].join('\n'));
    const r = run('{}');
    const obj = parseJSON(r.stdout);
    expect(obj).toBeTruthy();
    expect(obj.decision).toBe('block');
    expect(obj.reason).toContain('open regression');
    expect(obj.hookSpecificOutput.hookEventName).toBe('Stop');
  });

  it('ignores regressions listed in convergence.ignore', () => {
    writeFile('.vibe/regressions/foo.md', [
      '---', 'slug: foo', 'status: open', 'root-cause-tag: other',
      'registered: 2026-04-21', 'feature: demo', '---',
    ].join('\n'));
    writeFile('.vibe/config.json', JSON.stringify({ convergence: { ignore: ['foo'] } }));
    const r = run('{}');
    expect(r.stdout).toBe('');
    expect(r.code).toBe(0);
  });

  it('blocks on failed typecheck in current-run.json', () => {
    writeFile('.vibe/metrics/current-run.json', JSON.stringify({
      typecheck: { status: 'fail', error: 'TS2345' },
    }));
    const r = run('{}');
    const obj = parseJSON(r.stdout);
    expect(obj.decision).toBe('block');
    expect(obj.reason).toContain('typecheck');
  });

  it('blocks when verify last-report has unresolved P1', () => {
    writeFile('.vibe/verify/last-report.json', JSON.stringify({ p1: 2 }));
    const r = run('{}');
    const obj = parseJSON(r.stdout);
    expect(obj.decision).toBe('block');
    expect(obj.reason).toContain('P1');
  });

  it('respects stop_hook_active loop guard (no-op when already blocked once)', () => {
    writeFile('.vibe/regressions/foo.md', [
      '---', 'slug: foo', 'status: open', 'root-cause-tag: other',
      'registered: 2026-04-21', 'feature: demo', '---',
    ].join('\n'));
    const r = run(JSON.stringify({ stop_hook_active: true }));
    expect(r.stdout).toBe('');
    expect(r.code).toBe(0);
  });

  it('respects convergence.enforce=false (disabled)', () => {
    writeFile('.vibe/regressions/foo.md', [
      '---', 'slug: foo', 'status: open', 'root-cause-tag: other',
      'registered: 2026-04-21', 'feature: demo', '---',
    ].join('\n'));
    writeFile('.vibe/config.json', JSON.stringify({ convergence: { enforce: false } }));
    const r = run('{}');
    expect(r.stdout).toBe('');
    expect(r.code).toBe(0);
  });

  it('releases block after 3 consecutive blocks (safety release)', () => {
    writeFile('.vibe/regressions/foo.md', [
      '---', 'slug: foo', 'status: open', 'root-cause-tag: other',
      'registered: 2026-04-21', 'feature: demo', '---',
    ].join('\n'));
    writeFile('.vibe/stop-convergence.state.json', JSON.stringify({
      consecutiveBlocks: 3, lastBlockAt: '2026-04-21T00:00:00Z',
    }));
    const r = run('{}');
    expect(r.stdout).toBe('');
    expect(r.code).toBe(0);
    // state reset
    const state = JSON.parse(fs.readFileSync(path.join(TMP, '.vibe/stop-convergence.state.json'), 'utf-8'));
    expect(state.consecutiveBlocks).toBe(0);
  });

  it('increments consecutiveBlocks on successive blocks', () => {
    writeFile('.vibe/regressions/foo.md', [
      '---', 'slug: foo', 'status: open', 'root-cause-tag: other',
      'registered: 2026-04-21', 'feature: demo', '---',
    ].join('\n'));
    run('{}');
    run('{}');
    const state = JSON.parse(fs.readFileSync(path.join(TMP, '.vibe/stop-convergence.state.json'), 'utf-8'));
    expect(state.consecutiveBlocks).toBe(2);
  });

  it('resets state after convergence reached', () => {
    // Seed blocked state
    writeFile('.vibe/stop-convergence.state.json', JSON.stringify({
      consecutiveBlocks: 2, lastBlockAt: '2026-04-21T00:00:00Z',
    }));
    fs.mkdirSync(path.join(TMP, '.vibe'), { recursive: true });
    const r = run('{}');
    expect(r.stdout).toBe('');
    const state = JSON.parse(fs.readFileSync(path.join(TMP, '.vibe/stop-convergence.state.json'), 'utf-8'));
    expect(state.consecutiveBlocks).toBe(0);
  });
});
