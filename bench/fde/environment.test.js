import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isolatedEnvironment } from './environment.js';

it('copies fixture credentials only, strips private keys, and keeps the product unavailable to bare', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-neutral-env-'));
  try {
    const original = path.join(root, 'original');
    fs.mkdirSync(path.join(original, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(original, '.codex/auth.json'), '{"fixture":true}');
    fs.writeFileSync(path.join(original, '.codex/config.toml'), 'operator instructions must not reach the arm');
    const env = isolatedEnvironment(path.join(root, 'attempt'), root, { HOME: original, PATH: process.env.PATH, VIBE_KEY_EXPECTED: 'private', CLAUDE_SESSION_ID: 'operator-session', CODEX_THREAD_ID: 'operator-thread' }, 'off');
    expect(env.VIBE_KEY_EXPECTED).toBeUndefined();
    expect(env.CLAUDE_SESSION_ID).toBeUndefined();
    expect(env.CODEX_THREAD_ID).toBeUndefined();
    expect(fs.existsSync(path.join(env.CODEX_HOME, 'auth.json'))).toBe(true);
    expect(fs.existsSync(path.join(env.CODEX_HOME, 'config.toml'))).toBe(false);
    const blocked = spawnSync(process.execPath, [path.join(root, 'attempt/bin/bare-vibe.cjs')], { env, encoding: 'utf8' });
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain('unavailable in the bare arm');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
