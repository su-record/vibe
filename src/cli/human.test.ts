import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openQuestions } from '../core/inbox.js';
import { cmdAsk } from './human.js';
import type { Flags } from './common.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-human-'));
  fs.mkdirSync(path.join(root, '.git'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('ask records questions, reports belong in chat', () => {
  it('rejects a report before creating any project state, including empty options', () => {
    for (const flags of [{}, { options: ' | ' }]) {
      expect(() => cmdAsk(root, ['All checks passed.'], flags)).toThrow(expect.objectContaining({
        exitCode: 2, message: 'vibe ask is for questions only the user can answer; report results in chat',
      }));
    }
    expect(fs.existsSync(path.join(root, '.vibe'))).toBe(false);
  });

  it.each<[string, Flags]>([
    ['Which currency?', {}],
    ['어떤 통화인가요？', {}],
    ['Choose a currency', { options: 'KRW|EUR' }],
    ['Confirm sending', { needs: 'authorize:send' }],
  ])('records a question with punctuation, options or needs: %s', (question, flags) => {
    expect(cmdAsk(root, [question], flags)).toMatchObject({ code: 0, json: { wait: true } });
    expect(openQuestions(root).map((q) => q.question)).toEqual([question]);
  });

  it('the CLI carries the usage error through as exit 2', () => {
    const cli = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
    const result = spawnSync(process.execPath, [cli, 'ask', 'All checks passed.'], {
      cwd: root, encoding: 'utf-8', timeout: 60_000,
      env: { ...process.env, HOME: root, USERPROFILE: root, VIBE_SKIP_SETUP: '1' },
    });
    expect(result.status, result.stdout || result.stderr).toBe(2);
  }, 60_000);
});
