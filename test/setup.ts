import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { afterAll } from 'vitest';

// Every test, including direct core callers, keeps private receipts away from the real home.
const original = { HOME: process.env['HOME'], USERPROFILE: process.env['USERPROFILE'] };
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-test-home-'));
process.env['HOME'] = home;
process.env['USERPROFILE'] = home;
// In a worker thread process.env is a copy the OS never sees, so os.homedir() would still answer the real home.
const homedir = os.homedir;
os.homedir = () => process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'] ?? homedir();
syncBuiltinESMExports();
afterAll(() => {
  os.homedir = homedir;
  syncBuiltinESMExports();
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  fs.rmSync(home, { recursive: true, force: true });
});
