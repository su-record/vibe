import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let fixture;
const script = fileURLToPath(new URL('./suite-under-load.js', import.meta.url));
beforeEach(() => { fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4 load check-')); });
afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

function run(body) {
  if (body !== undefined) {
    if (process.platform === 'win32') {
      const fake = path.join(fixture, 'npx.cjs');
      fs.writeFileSync(fake, body);
      fs.writeFileSync(path.join(fixture, 'npx.cmd'), `@echo off\r\n"${process.execPath}" "${fake}" %*\r\n`);
    } else fs.writeFileSync(path.join(fixture, 'npx'), `#!${process.execPath}\n${body}\n`, { mode: 0o755 });
  }
  const env = { ...process.env, PATH: fixture, VIBE_LOAD_ROUNDS: '1' };
  if (process.platform === 'win32' && body === undefined) {
    // Windows treats keys case-insensitively; an inherited COMSPEC would win over a new ComSpec.
    for (const key of Object.keys(env)) if (key.toUpperCase() === 'COMSPEC') delete env[key];
    env.ComSpec = path.join(fixture, 'missing-cmd.exe');
  }
  return spawnSync(process.execPath, [script], {
    cwd: fixture, encoding: 'utf-8', timeout: 10_000,
    env,
  });
}

describe('load-check process outcomes', () => {
  it('fails on a nonzero child exit without a test-failure marker', () => {
    const result = run("process.stderr.write('startup failed\\n'); process.exit(7);");
    expect(result.status, result.stdout || result.stderr).toBe(1);
    expect(result.stdout).toContain('round 1/1: exit 7/7');
    expect(result.stdout).not.toContain('nothing failed');
  });

  it('reports a child that cannot start and exits 1', () => {
    const result = run();
    expect(result.status, result.stdout || result.stderr).toBe(1);
    expect(result.stdout).toContain('could not start npx');
    expect(result.stderr).not.toContain("Unhandled 'error' event");
  });

  it('passes when both children exit zero', () => {
    const result = run('process.exit(0);');
    expect(result.status, result.stdout || result.stderr).toBe(0);
    expect(result.stdout).toContain('round 1/1: both passed');
    expect(result.stdout).toContain('nothing failed');
  });
});
