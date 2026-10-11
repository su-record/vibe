import fs from 'node:fs';
import os, { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { packageRoot } from '../src/core/paths.js';
import { privateDirectory, writePrivate } from '../src/core/private-store.js';

const nested = process.env['VIBE_SETUP_PROBE'] === '1';

it('answers the test home from os.homedir and the private store', () => {
  const home = fs.realpathSync(process.env['HOME']!);
  expect(fs.realpathSync(os.homedir())).toBe(home);
  expect(fs.realpathSync(homedir())).toBe(home);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-setup-'));
  try {
    expect(path.dirname(writePrivate(root, 'probe.json', '{}'))).toBe(privateDirectory(root, false));
    expect(privateDirectory(root, false)).toBe(path.join(home, '.vibe-runtime'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// Worker threads copy process.env, so only a real threads run shows whether the launch home stays untouched.
it.skipIf(nested)('keeps the launch home empty when vitest runs in worker threads', () => {
  const launch = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-launch-home-'));
  try {
    const run = spawnSync(process.execPath, [path.join(packageRoot(), 'node_modules/vitest/vitest.mjs'), 'run', '--pool=threads', 'test/setup.test.ts'],
      { cwd: packageRoot(), encoding: 'utf8', env: { ...process.env, HOME: launch, USERPROFILE: launch, VIBE_SETUP_PROBE: '1' } });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(fs.readdirSync(launch)).toEqual([]);
  } finally { fs.rmSync(launch, { recursive: true, force: true }); }
}, 60000);
