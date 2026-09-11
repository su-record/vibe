import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

// Every test, including direct core callers, keeps private receipts away from the real home.
const original = { HOME: process.env['HOME'], USERPROFILE: process.env['USERPROFILE'] };
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-test-home-'));
process.env['HOME'] = home;
process.env['USERPROFILE'] = home;
afterAll(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  fs.rmSync(home, { recursive: true, force: true });
});
