import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { packageRoot } from './paths.js';

let fixture: string;
let root: string;
let home: string;
let env: NodeJS.ProcessEnv;
beforeEach(() => {
  fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-knowledge-auto-')));
  root = path.join(fixture, 'worktree'); home = path.join(fixture, 'home');
  fs.mkdirSync(root); fs.mkdirSync(home);
  env = { ...process.env, HOME: home, USERPROFILE: home, VIBE_HOME_DIR: home, CODEX_HOME: path.join(home, '.codex'),
    CODEX_THREAD_ID: '', CLAUDE_SESSION_ID: '', VIBE_CLIENT: 'codex', CLAUDE_PROJECT_DIR: root, VIBE_SKIP_SETUP: '1',
    XDG_CONFIG_HOME: path.join(home, '.config'), APPDATA: path.join(home, 'AppData', 'Roaming') };
});
afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

const wiki = () => path.join(home, '.config', 'vibe', 'knowledge');
function cli(args: string[]) {
  return spawnSync(process.execPath, [path.join(packageRoot(), 'dist/cli.js'), ...args, '--json'], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
}
function run(mode: 'stop' | 'session', payload: object = {}, cwd = root) {
  const result = spawnSync(process.execPath, [path.join(packageRoot(), 'hooks/notify.js'), mode, '--personal'],
    { cwd, env: { ...env, CLAUDE_PROJECT_DIR: cwd }, input: JSON.stringify({ cwd, session_id: 'fixture-session', ...payload }), encoding: 'utf8', timeout: 5000 });
  expect(result.status, result.stderr).toBe(0);
  return mode === 'stop' ? JSON.parse(result.stdout) : result.stdout;
}

it('stays off by default: no knowledge turn, no log and no private record', () => {
  run('session');
  fs.writeFileSync(path.join(root, 'work.txt'), 'changed');
  expect(run('stop')).toEqual({});
  expect(fs.existsSync(wiki())).toBe(false);
  expect(fs.existsSync(path.join(home, '.vibe-runtime'))).toBe(false);
  expect(JSON.parse(cli(['knowledge', 'auto']).stdout)).toMatchObject({ auto: false, folder: wiki() });
});

it('gives the model one knowledge turn after changed files and after a run of conversation turns', () => {
  expect(cli(['knowledge', 'auto', 'on', '--turns', '3']).status).toBe(0);
  run('session');
  expect(run('stop')).toEqual({});
  fs.writeFileSync(path.join(root, 'work.txt'), 'changed');
  const turn = run('stop', { transcript_path: path.join(fixture, 'claims.jsonl') });
  expect(turn.decision).toBe('block');
  expect(turn.reason).toContain(`wiki at ${wiki()}`);
  expect(turn.reason).toContain('vibe internal guide wiki');
  expect(turn.reason).toContain('offer it in one line without installing it');
  expect(run('stop', { stop_hook_active: true })).toEqual({});
  expect(run('stop')).toEqual({});
  expect(run('stop')).toEqual({});
  expect(run('stop').decision).toBe('block');
  const log = fs.readFileSync(path.join(wiki(), 'log.md'), 'utf8').trim().split('\n');
  expect(log).toHaveLength(2);
  expect(log[0]).toMatch(/^- \d{4}-\d\d-\d\d \d\d:\d\d UTC · \[\[projects\/worktree\]\] · codex · unversioned · files changed$/);
  expect(log[1]).toContain('· conversation');
});

it('waits five conversation turns by default, only for file changes at 0, and creates skills only when allowed', () => {
  expect(JSON.parse(cli(['knowledge', 'auto', 'on']).stdout)).toMatchObject({ auto: true, turns: 5, skills: 'propose', exclude: [] });
  run('session');
  for (let turn = 1; turn < 5; turn++) expect(run('stop')).toEqual({});
  expect(run('stop').decision).toBe('block');
  expect(cli(['knowledge', 'auto', '--turns', '0', '--skills', 'create']).status).toBe(0);
  for (let turn = 0; turn < 6; turn++) expect(run('stop')).toEqual({});
  fs.writeFileSync(path.join(root, 'work.txt'), 'changed');
  expect(run('stop').reason).toContain('create a skill for a repeated procedure (the user allowed it)');
  for (const bad of [['--turns', '-1'], ['--turns', 'many'], ['--skills', 'always'], ['--exclude']]) expect(cli(['knowledge', 'auto', ...bad]).status).toBe(2);
});

it('never fingerprints, logs or interrupts work inside an excluded folder until it is included again', () => {
  const client = path.join(fixture, 'client-work');
  const project = path.join(client, 'site');
  fs.mkdirSync(project, { recursive: true });
  expect(cli(['knowledge', 'auto', 'on', '--turns', '1', '--exclude', client]).status).toBe(0);
  expect(JSON.parse(cli(['knowledge', 'auto']).stdout).exclude).toEqual([client]);
  run('session', {}, project);
  fs.writeFileSync(path.join(project, 'work.txt'), 'changed');
  for (let turn = 0; turn < 3; turn++) expect(run('stop', {}, project)).toEqual({});
  expect(fs.existsSync(path.join(home, '.vibe-runtime'))).toBe(false);
  expect(fs.existsSync(path.join(wiki(), 'log.md'))).toBe(false);
  expect(run('stop').decision).toBeUndefined();
  expect(run('stop').decision).toBe('block');
  expect(JSON.parse(cli(['knowledge', 'auto', '--include', client]).stdout).exclude).toEqual([]);
  expect(run('stop', {}, project)).toEqual({});
  expect(run('stop', {}, project).decision).toBe('block');
});

it('starts counting from the first Stop when the session start was missed, and skips the home folder', () => {
  expect(cli(['knowledge', 'auto', 'on']).status).toBe(0);
  fs.writeFileSync(path.join(root, 'work.txt'), 'changed');
  expect(run('stop')).toEqual({});
  fs.writeFileSync(path.join(root, 'work.txt'), 'changed again');
  expect(run('stop').decision).toBe('block');
  for (let turn = 0; turn < 4; turn++) expect(run('stop', {}, home)).toEqual({});
});

it('moves the wiki to an absolute folder, keeps it when turned off and rejects a relative one', () => {
  const vault = path.join(fixture, 'Obsidian', 'vibe');
  expect(cli(['knowledge', 'auto', 'on', '--dir', vault]).status).toBe(0);
  expect(cli(['knowledge', 'auto', 'on', '--dir', 'relative/folder']).status).toBe(2);
  run('session');
  fs.writeFileSync(path.join(root, 'work.txt'), 'changed');
  expect(run('stop').reason).toContain(`wiki at ${vault}`);
  expect(fs.readFileSync(path.join(vault, 'log.md'), 'utf8')).toContain('files changed');
  expect(JSON.parse(cli(['knowledge', 'auto', 'off']).stdout)).toMatchObject({ auto: false, dir: vault, folder: vault });
  fs.writeFileSync(path.join(root, 'work.txt'), 'changed once more');
  expect(run('stop')).toEqual({});
});

it('readies the wiki as a vault without Obsidian and lists it at the first session after Obsidian has run', () => {
  const on = JSON.parse(cli(['knowledge', 'auto', 'on']).stdout);
  expect(on).toMatchObject({ folder: wiki(), vault: 'waiting', copied: 0, synced: null });
  expect(fs.statSync(path.join(wiki(), '.obsidian')).isDirectory()).toBe(true);
  const registry = process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json')
    : process.platform === 'win32' ? path.join(home, 'AppData', 'Roaming', 'obsidian', 'obsidian.json') : path.join(home, '.config', 'obsidian', 'obsidian.json');
  fs.mkdirSync(path.dirname(registry), { recursive: true });
  fs.writeFileSync(registry, '{"vaults":{}}');
  run('session');
  expect(Object.values(JSON.parse(fs.readFileSync(registry, 'utf8')).vaults)).toMatchObject([{ path: wiki() }]);
  expect(JSON.parse(cli(['knowledge', 'auto']).stdout).vault).toBe('in-vault');
  expect(JSON.parse(cli(['knowledge', 'auto', 'off']).stdout).vault).toBeNull();
});

it('puts the wiki in the vault in use when turned on, carrying the earlier pages across', () => {
  fs.mkdirSync(wiki(), { recursive: true });
  fs.writeFileSync(path.join(wiki(), 'index.md'), '- [[reuse]]');
  const vault = path.join(fixture, 'Notes');
  fs.mkdirSync(vault);
  const registry = process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json')
    : process.platform === 'win32' ? path.join(home, 'AppData', 'Roaming', 'obsidian', 'obsidian.json') : path.join(home, '.config', 'obsidian', 'obsidian.json');
  fs.mkdirSync(path.dirname(registry), { recursive: true });
  fs.writeFileSync(registry, JSON.stringify({ vaults: { v: { path: vault, ts: 1, open: true } } }));
  const on = JSON.parse(cli(['knowledge', 'auto', 'on']).stdout);
  expect(on).toMatchObject({ dir: path.join(vault, 'vibe'), folder: path.join(vault, 'vibe'), vault: 'in-vault', copied: 1 });
  expect(fs.readFileSync(path.join(vault, 'vibe', 'index.md'), 'utf8')).toBe('- [[reuse]]');
  expect(fs.existsSync(path.join(wiki(), 'index.md'))).toBe(true);
  expect(JSON.parse(cli(['knowledge', 'auto', 'on']).stdout)).toMatchObject({ folder: path.join(vault, 'vibe'), copied: 0 });
});

it('does not count its own log line as work when the wiki sits inside the project', () => {
  expect(cli(['knowledge', 'auto', 'on', '--dir', path.join(root, 'notes')]).status).toBe(0);
  run('session');
  fs.writeFileSync(path.join(root, 'work.txt'), 'changed');
  expect(run('stop').decision).toBe('block');
  expect(run('stop')).toEqual({});
});

it('shows a vibe project\'s shared knowledge in the wiki and gives two projects of the same name their own pages', () => {
  expect(cli(['knowledge', 'auto', 'on', '--turns', '1']).status).toBe(0);
  fs.mkdirSync(path.join(root, '.vibe'));
  run('session');
  expect(fs.realpathSync(path.join(wiki(), 'projects', 'worktree'))).toBe(path.join(root, '.vibe', 'knowledge'));
  const shared = run('stop').reason;
  expect(shared).toContain(`in the wiki at ${wiki()} (this project's page is projects/worktree.md); what the project's team needs`);
  expect(shared).toContain(`goes into ${path.join(root, '.vibe', 'knowledge')}, which the wiki shows as projects/worktree/`);
  const other = path.join(fixture, 'elsewhere', 'worktree');
  fs.mkdirSync(other, { recursive: true });
  run('session', {}, other);
  const own = run('stop', {}, other).reason;
  expect(own).toMatch(/\(this project's page is projects\/worktree-[a-f0-9]{6}\.md\), record/);
  expect(fs.readFileSync(path.join(wiki(), 'log.md'), 'utf8')).toMatch(/\[\[projects\/worktree\]\][^\n]*\n[^\n]*\[\[projects\/worktree-[a-f0-9]{6}\]\]/);
  expect(fs.readdirSync(path.join(wiki(), 'projects'))).toEqual(['worktree']);
});
