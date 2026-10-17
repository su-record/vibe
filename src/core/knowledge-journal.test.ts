import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { packageRoot } from './paths.js';

const journal = createRequire(import.meta.url)('../../hooks/knowledge-journal.cjs');
const DAY = 86400000;

let fixture: string, root: string, home: string;
let env: NodeJS.ProcessEnv;
beforeEach(() => {
  fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-journal-')));
  root = path.join(fixture, 'work'); home = path.join(fixture, 'home');
  fs.mkdirSync(root); fs.mkdirSync(home);
  env = { ...process.env, HOME: home, USERPROFILE: home, VIBE_HOME_DIR: home, CODEX_THREAD_ID: '', CLAUDE_SESSION_ID: '', VIBE_CLIENT: 'claude',
    CLAUDE_PROJECT_DIR: root, VIBE_SKIP_SETUP: '1', XDG_CONFIG_HOME: path.join(home, '.config'), APPDATA: path.join(home, 'AppData', 'Roaming') };
});
afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

function hook(mode: string, payload: object, session = 's1', cwd = root) {
  const script = ['prompt', 'tool'].includes(mode) ? ['hooks/journal.cjs', mode] : ['hooks/notify.js', mode, '--personal'];
  const result = spawnSync(process.execPath, [path.join(packageRoot(), script[0]!), ...script.slice(1)],
    { cwd, env: { ...env, CLAUDE_PROJECT_DIR: cwd }, input: JSON.stringify({ cwd, session_id: session, ...payload }), encoding: 'utf8', timeout: 10000 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}
function cli(...args: string[]) {
  return spawnSync(process.execPath, [path.join(packageRoot(), 'dist/cli.js'), ...args], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
}
const lines = () => journal.read(root, home) as Array<Record<string, unknown>>;

it('masks secrets and addresses, keeps command words without arguments, and reads outcomes clients report', () => {
  expect(journal.mask('key sk-abcdefghijklmnopqrstu token=abc123 mail me@corp.example ok')).toBe('key [masked] [masked] mail [masked] ok');
  expect(journal.mask('-----BEGIN RSA PRIVATE KEY-----\nxyz\n-----END RSA PRIVATE KEY----- after')).toBe('[masked] after');
  expect(journal.commandHeads('FOO=1 npm run build && git push origin main | tee "a b" ; /usr/bin/ls -la; "quoted"')).toEqual(['npm run', 'git push', 'tee', 'ls']);
  expect(journal.commandHeads('git --no-pager log')).toEqual(['git']);
  expect([{ exit_code: 0 }, { exitCode: 2 }, { interrupted: true }, { stdout: 'x' }, 'text'].map(journal.outcome)).toEqual([true, false, false, null, null]);
  const prompt = journal.entryFor('prompt', { prompt: `아니, 다시 해줘 ${'word '.repeat(150)}` }, 'session', 5);
  expect(prompt).toMatchObject({ at: 5, k: 'prompt', correction: true });
  expect(prompt.text).toHaveLength(600);
  expect(journal.entryFor('prompt', { prompt: 'ship it' }, 'session', 5).correction).toBeUndefined();
  expect(journal.entryFor('tool', { tool_input: { command: 'npm test' }, tool_response: { exit_code: 1 } }, 'session', 5)).toMatchObject({ k: 'shell', heads: ['npm test'], ok: false });
  expect(journal.entryFor('prompt', { prompt: '  ' }, 'session')).toBeNull();
  expect(journal.entryFor('tool', { tool_input: { command: '"$x"' } }, 'session')).toBeNull();
});

it('keeps 30 days and finds repeated instructions, command sequences and failures across sessions', () => {
  const now = Date.now();
  journal.append(root, { at: now - 31 * DAY, s: 'old', k: 'prompt', text: 'forgotten' }, home, now);
  journal.append(root, { at: now - 31 * DAY, s: 'old', k: 'prompt', text: 'forgotten' }, home, now);
  expect(lines().map(e => e['text'])).toEqual(['forgotten']);
  const add = (s: string, e: object) => journal.append(root, { at: now, s, ...e }, home, now);
  for (const s of ['a', 'b', 'c']) {
    add(s, { k: 'prompt', text: `explain the result in Korean with the reason ${s}` });
    for (const head of ['npm run', 'git add', 'git commit']) add(s, { k: 'shell', heads: [head], ok: true });
    add(s, { k: 'shell', heads: ['npm test'], ok: s === 'c' ? true : false });
  }
  add('c', { k: 'turn' });
  add('d', { k: 'prompt', text: 'no, that is not what I asked', correction: true });
  const summary = journal.summarize(lines());
  expect(summary.repeats.instructions).toMatchObject([{ count: 3, sessions: 3, text: 'explain the result in Korean with the reason c' }]);
  expect(summary.repeats.sequences).toEqual([{ sequence: 'npm run → git add → git commit', count: 3, sessions: 3 }, { sequence: 'git add → git commit → npm test', count: 3, sessions: 3 }]);
  expect(summary.repeats.failures).toEqual([{ command: 'npm test', count: 2 }]);
  expect(summary.recent).toEqual({ prompts: ['no, that is not what I asked'], corrections: ['no, that is not what I asked'], failed: [] });
  add('d', { k: 'turn' });
  expect(journal.summarize(lines()).recent.prompts).toEqual(['no, that is not what I asked']);
  expect(journal.brief(summary)).toContain('1 prompts and 1 corrections since the last knowledge turn and 4 repeats over 30 days');
  expect(journal.brief(journal.summarize([]))).toBe('');
});

it('journals prompts and shell calls only while session knowledge and its journal are on, never in an excluded folder', () => {
  hook('prompt', { prompt: 'first' });
  hook('tool', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: { exit_code: 0 } });
  expect(fs.existsSync(path.join(home, '.vibe-runtime'))).toBe(false);
  expect(cli('knowledge', 'auto', 'on', '--turns', '2').stdout).toContain('journal on: your prompts (first 600 characters, secrets and e-mail addresses masked)');
  expect(hook('prompt', { prompt: 'use my token=hunter2 please' })).toBe('');
  hook('tool', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: { exit_code: 1 } });
  expect(lines()).toMatchObject([{ k: 'prompt', text: 'use my [masked] please' }, { k: 'shell', heads: ['npm test'], ok: false }]);
  const client = path.join(fixture, 'client');
  fs.mkdirSync(client);
  expect(cli('knowledge', 'auto', '--exclude', client).status).toBe(0);
  hook('prompt', { prompt: 'secret client work' }, 's1', client);
  expect(journal.read(client, home)).toEqual([]);
  expect(cli('knowledge', 'auto', '--journal', 'off').stdout).toContain('journal off');
  hook('prompt', { prompt: 'not kept' });
  expect(lines()).toHaveLength(2);
});

it('points the knowledge turn at the journal, marks the turn, and reminds the session to look before choosing', () => {
  expect(hook('session', {})).not.toContain('knowledge find');
  expect(cli('knowledge', 'auto', 'on', '--turns', '1').status).toBe(0);
  expect(hook('session', {})).toContain('run `vibe knowledge find <subject>` and follow the recorded decisions');
  hook('prompt', { prompt: 'no, keep the old name' });
  const turn = JSON.parse(hook('stop', {}));
  expect(turn.decision).toBe('block');
  expect(turn.reason).toContain('the journal holds 1 prompts and 1 corrections since the last knowledge turn');
  expect(turn.reason).toContain('propose at most one improvement fitted to how the user works');
  expect(lines().at(-1)).toMatchObject({ k: 'turn' });
  const read = JSON.parse(cli('knowledge', 'journal', '--json').stdout);
  expect(read.recent.corrections).toEqual(['no, keep the old name']);
  expect(cli('knowledge', 'journal').stdout).toContain('corrections (the user pushed back):\n    - no, keep the old name');
  expect(cli('knowledge', 'auto', '--journal', 'off').status).toBe(0);
  hook('prompt', { prompt: 'more' });
  expect(JSON.parse(hook('stop', {})).reason).not.toContain('vibe knowledge journal');
}, 30000);
