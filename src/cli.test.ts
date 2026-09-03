import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_SRC = path.join(here, 'cli.ts');
const TSX = path.join(here, '..', 'node_modules', '.bin', 'tsx');

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-cli-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

interface Run {
  status: number;
  stdout: string;
  json: unknown;
}

function vibe(args: string[], input?: string): Run {
  const result = spawnSync(TSX, [CLI_SRC, ...args, '--json'], {
    cwd: root,
    encoding: 'utf-8',
    input,
    env: { ...process.env, VIBE_CLIENT: 'test-client' },
    timeout: 60000,
  });
  let json: unknown = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    json = null;
  }
  return { status: result.status ?? -1, stdout: result.stdout, json };
}

describe('CLI — from request to DONE', () => {
  it('init → draft → approve(token) → check → DONE; the exit code is the verdict', () => {
    const init = vibe(['init']);
    expect(init.status).toBe(0);
    expect(fs.existsSync(path.join(root, '.vibe', 'state.json'))).toBe(true);
    expect(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf-8')).toContain('<!-- vibe:start -->');
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'vibe', 'SKILL.md'))).toBe(true);

    const before = vibe(['state']);
    expect((before.json as { state: string }).state).toBe('NONE');

    const draft = vibe(['intent', 'draft', '--stdin'], JSON.stringify({
      intent: '# Hello\n\n## Why\ntest\n',
      scenarios: '- { id: hello, then: hello.txt exists, check: { type: file, path: hello.txt, contains: "hi" } }\n',
    }));
    expect(draft.status).toBe(0);
    const token = (draft.json as { token: string }).token;
    expect(token).toMatch(/^\d{3} \d{3}$/);

    // check before approval → 4
    expect(vibe(['check']).status).toBe(4);
    // wrong token → 3
    expect(vibe(['approve', '000', '000']).status).toBe(3);
    expect(vibe(['approve', token]).status).toBe(0);

    // the file does not exist yet → 1
    const failing = vibe(['check']);
    expect(failing.status).toBe(1);
    expect((failing.json as { state: string }).state).toBe('RUNNING');

    fs.writeFileSync(path.join(root, 'hello.txt'), 'hi\n');
    const passing = vibe(['check']);
    expect(passing.status).toBe(0);
    expect((passing.json as { done: boolean; state: string }).done).toBe(true);

    const after = vibe(['state']);
    expect((after.json as { state: string; stage: string }).state).toBe('DONE');
    expect((after.json as { stage: string }).stage).toBe('handoff');

    const evidence = vibe(['evidence']);
    expect((evidence.json as { run: string }).run).toBe('r-2');
  });

  it('authorize returns 0 only when token, action and target all match', () => {
    vibe(['init']);
    vibe(['intent', 'draft', '--stdin'], JSON.stringify({ intent: '# x', scenarios: '- { id: a, then: x, check: { type: run, cmd: "exit 0" } }\n' }));
    const ask = vibe(['ask', 'Send to accounting for real?', '--needs', 'authorize:send', '--target', 'acct@example.com']);
    expect(ask.status).toBe(0);
    const token = (ask.json as { token: string }).token;
    expect(vibe(['authorize', token, '--action', 'send', '--target', 'other@example.com']).status).toBe(3);
    expect(vibe(['authorize', token, '--action', 'send', '--target', 'acct@example.com']).status).toBe(0);
    expect(vibe(['authorize', token, '--action', 'send', '--target', 'acct@example.com']).status).toBe(3);
  });

  it('uninstall removes card, skills and hook but keeps .vibe', () => {
    vibe(['init']);
    const out = vibe(['uninstall']);
    expect(out.status).toBe(0);
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'vibe'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.vibe'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'CLAUDE.md'))).toBe(false);
  });

  it('help always exits 0', () => {
    expect(execFileSync(TSX, [CLI_SRC, '--help'], { cwd: root, encoding: 'utf-8' })).toContain('vibe');
  });
});
