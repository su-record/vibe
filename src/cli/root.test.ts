import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { emptyState } from '../core/state.js';

let fixture: string;
beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-home-cli-'));
});
afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

it('a CLI started at fixture HOME cannot read or seed the parent project', () => {
  const fixtureHome = path.join(fixture, 'home');
  const records = path.join(fixture, '.vibe');
  fs.mkdirSync(fixtureHome);
  fs.mkdirSync(records);
  const original = JSON.stringify({ ...emptyState(), sentinel: 'parent must stay unchanged' });
  fs.writeFileSync(path.join(records, 'state.json'), original);
  const cli = fileURLToPath(new URL('../cli.ts', import.meta.url));
  const tsx = fileURLToPath(new URL('../../node_modules/.bin/tsx', import.meta.url));
  const run = (args: string[]) => spawnSync(tsx, [cli, ...args, '--json'], {
    cwd: fixtureHome, encoding: 'utf-8', timeout: 60_000,
    env: { ...process.env, HOME: fixtureHome, VIBE_SKIP_SETUP: '1', VIBE_NO_PLUGIN: '1' },
  });
  const state = run(['state']);
  expect(state.status, state.stdout || state.stderr).toBe(0);
  expect(JSON.parse(state.stdout)).toMatchObject({ root: fixtureHome, state: 'NONE' });
  const write = run(['tokens', 'off']);
  expect(write.status, write.stdout || write.stderr).toBe(2);
  expect(write.stdout).toContain('vibe will not create a project in your home directory');
  expect(fs.existsSync(path.join(fixtureHome, '.vibe'))).toBe(false);
  expect(fs.readdirSync(records)).toEqual(['state.json']);
  expect(fs.readFileSync(path.join(records, 'state.json'), 'utf-8')).toBe(original);
}, 60_000);
