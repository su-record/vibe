import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

let fixture;
const runner = fileURLToPath(new URL('./run.js', import.meta.url));
beforeEach(() => { fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-retirement-')); });
afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

it.each([
  [['--set', 'direction'], 'handover'],
  [['--task', 'anomaly'], 'anomaly'],
])('prepares %s without a model call or a ledger entry', (selection, task) => {
  const fixtureHome = path.join(fixture, 'home');
  fs.mkdirSync(fixtureHome);
  const ledger = path.join(fixture, 'ledger.jsonl');
  const result = spawnSync(process.execPath, [runner, '--client', 'claude', '--harness', 'off', '--prepare-only', '--ledger', ledger, ...selection], {
    cwd: fixture, encoding: 'utf-8', timeout: 20_000,
    env: { ...process.env, HOME: fixtureHome, TMPDIR: fixture, VIBE_SKIP_SETUP: '1' },
  });
  expect(result.status, result.stdout || result.stderr).toBe(0);
  const prepared = JSON.parse(result.stdout);
  expect(prepared.task).toBe(task);
  expect(fs.existsSync(path.join(prepared.ws, 'TASK.md'))).toBe(true);
  if (task === 'anomaly') expect(fs.existsSync(path.join(prepared.ws, 'docs', 'finance.md'))).toBe(true);
  expect(fs.existsSync(path.join(prepared.ws, 'key'))).toBe(false);
  expect(fs.existsSync(ledger)).toBe(false);
}, 30_000);
