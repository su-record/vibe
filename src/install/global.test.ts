import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CARD_START, detectClients, ensureGlobal, globalLayout, globalStatus, hasNotifyHook, installSurfaces, projectLayout, setupGlobal, sweepDeadHooks, uninstallGlobal } from './global.js';
import { ensureProject, hasProject, projectStatus } from './project.js';

// These tests cover the home surfaces; plugin registration through the client CLIs has its own tests (register.test.ts).
process.env['VIBE_NO_PLUGIN'] = '1';

let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-home-'));
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

describe('global surfaces — one copy per client home', () => {
  it('a home with neither client gets Claude Code; a Codex home gets AGENTS.md, .codex/skills and .codex/hooks.json', () => {
    expect(detectClients(home)).toEqual(['claude']);
    fs.mkdirSync(path.join(home, '.codex'));
    expect(detectClients(home)).toEqual(['codex']);
    const report = setupGlobal(home);
    expect(report.clients).toEqual(['codex']);
    expect(report.surfaces['codex']).toMatchObject({ card: 'created', hook: 'added' });
    expect(report.surfaces['codex']?.skills).toHaveLength(6);
    expect(fs.readFileSync(path.join(home, '.codex', 'AGENTS.md'), 'utf-8')).toContain(CARD_START);
    expect(fs.existsSync(path.join(home, '.codex', 'skills', 'vibe.scope', 'SKILL.md'))).toBe(true);
    const hooks = JSON.parse(fs.readFileSync(path.join(home, '.codex', 'hooks.json'), 'utf-8')) as { hooks: Record<string, unknown[]> };
    expect(Object.keys(hooks.hooks).sort()).toEqual(['PostToolUse', 'PreToolUse']);
    expect(hasNotifyHook(path.join(home, '.codex', 'hooks.json'))).toBe(true);
    // the hook points at a script that exists in this package
    const command = (hooks.hooks['PostToolUse']?.[0] as { hooks: Array<{ command: string }> }).hooks[0]?.command ?? '';
    const script = /^node "(.+)" post$/.exec(command)?.[1];
    expect(script && fs.existsSync(script)).toBe(true);
    // nothing for Claude was created
    expect(fs.existsSync(path.join(home, '.claude'))).toBe(false);
  });

  it('merges into an existing ~/.claude/settings.json and CLAUDE.md, keeps the user\'s hooks, and is idempotent', () => {
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ model: 'x', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo bye' }] }] } }));
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# Mine\n\nkeep this\n');
    const first = setupGlobal(home);
    expect(first.surfaces['claude']).toMatchObject({ card: 'updated', hook: 'added' });
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf-8')) as { model: string; hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
    expect(settings.model).toBe('x');
    expect(settings.hooks['Stop']?.[0]?.hooks[0]?.command).toBe('echo bye');
    expect(settings.hooks['PostToolUse']).toHaveLength(1);
    expect(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf-8')).toMatch(/^# Mine\n\nkeep this\n\n<!-- vibe:start -->/);

    const second = setupGlobal(home);
    expect(second.surfaces['claude']).toMatchObject({ card: 'unchanged', hook: 'unchanged' });
    expect(globalStatus(home).clients['claude']).toMatchObject({ card: true, skills: 6, hook: true, current: true });
  });

  it('a notify hook from another install path is replaced, not duplicated', () => {
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node "/old/vibe/hooks/notify.js" pre' }] }] } }));
    setupGlobal(home);
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf-8')) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
    expect(settings.hooks['PreToolUse']).toHaveLength(1);
    expect(settings.hooks['PreToolUse']?.[0]?.hooks[0]?.command).not.toContain('/old/');
  });

  it('ensureGlobal repairs a stale skill and a missing card, and is a no-op when everything is current', () => {
    setupGlobal(home);
    expect(ensureGlobal(home)).toEqual([]);
    fs.writeFileSync(path.join(home, '.claude', 'skills', 'vibe.build', 'SKILL.md'), 'old\n');
    fs.rmSync(path.join(home, '.claude', 'CLAUDE.md'));
    expect(ensureGlobal(home)).toEqual(['claude']);
    expect(fs.readFileSync(path.join(home, '.claude', 'skills', 'vibe.build', 'SKILL.md'), 'utf-8')).not.toBe('old\n');
    expect(fs.existsSync(path.join(home, '.claude', 'CLAUDE.md'))).toBe(true);
    expect(ensureGlobal(home)).toEqual([]);
  });

  it('uninstall removes card, skills and hook from every client home and leaves user content', () => {
    fs.mkdirSync(path.join(home, '.claude'));
    fs.mkdirSync(path.join(home, '.codex'));
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# Mine\n');
    fs.mkdirSync(path.join(home, '.claude', 'skills', 'my-skill'), { recursive: true });
    setupGlobal(home);
    const removed = uninstallGlobal(home);
    expect(removed).toContain(path.join('.claude', 'CLAUDE.md') + ' card');
    expect(removed).toContain(path.join('.codex', 'hooks.json') + ' hook');
    expect(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf-8').trim()).toBe('# Mine');
    expect(fs.existsSync(path.join(home, '.claude', 'skills', 'my-skill'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.claude', 'skills', 'vibe'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.codex', 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.codex', 'hooks.json'))).toBe(false);
    expect(globalStatus(home).clients['claude']?.current).toBe(false);
  });

  it('the project layout (bench) puts the same surfaces inside one workspace', () => {
    const ws = path.join(home, 'ws');
    installSurfaces(ws, projectLayout('claude'));
    expect(fs.readFileSync(path.join(ws, 'CLAUDE.md'), 'utf-8')).toContain(CARD_START);
    expect(fs.existsSync(path.join(ws, '.claude', 'skills', 'vibe', 'SKILL.md'))).toBe(true);
    expect(hasNotifyHook(path.join(ws, '.claude', 'settings.local.json'))).toBe(true);
    expect(globalLayout('claude').hook).toBe(path.join('.claude', 'settings.json'));
  });
});

describe('.vibe/ — created by the first record, never by a command that only reads', () => {
  it('ensureProject seeds once and records init; a second call changes nothing', () => {
    const root = path.join(home, 'repo');
    fs.mkdirSync(root);
    expect(hasProject(root)).toBe(false);
    expect(projectStatus(root)).toMatchObject({ vibe: false, state: 'NONE', inboxOpen: 0 });
    const created = ensureProject(root);
    expect(created).toContain('.vibe');
    expect(created).toContain(path.join('.vibe', 'scenarios.yaml'));
    expect(fs.existsSync(path.join(root, '.vibe', 'state.json'))).toBe(true);
    expect(fs.readFileSync(path.join(root, '.vibe', 'ledger.jsonl'), 'utf-8')).toContain('"event":"init"');
    expect(ensureProject(root)).toEqual([]);
    expect(fs.readFileSync(path.join(root, '.vibe', 'ledger.jsonl'), 'utf-8').trim().split('\n')).toHaveLength(1);
  });
});

describe('vibe 3 leftovers', () => {
  it('sweeps hook entries and the codex notify line that point at a vibe 3 script that no longer exists, and keeps live ones', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-sweep-'));
    fs.mkdirSync(path.join(home, '.claude'));
    fs.mkdirSync(path.join(home, '.codex'));
    const live = path.join(home, 'live', 'hooks', 'scripts', 'ok.js');
    fs.mkdirSync(path.dirname(live), { recursive: true });
    fs.writeFileSync(live, '');
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ model: 'x', hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: `node ${home}/.vibe/hooks/scripts/session-start.js` }] }],
      Stop: [{ hooks: [{ type: 'command', command: `node "${home}/.vibe/hooks/scripts/stop-dispatcher.js"` }, { type: 'command', command: 'echo bye' }] }],
      PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: `node ${live}` }] }],
    } }));
    fs.writeFileSync(path.join(home, '.codex', 'config.toml'), `model = "gpt"\nnotify = ["node", "${home}/.vibe/hooks/scripts/codex-notify.js"]\n`);
    const removed = sweepDeadHooks(home);
    expect(removed).toHaveLength(3);
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf-8')) as { model: string; hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
    expect(settings.model).toBe('x');
    expect(Object.keys(settings.hooks).sort()).toEqual(['PostToolUse', 'Stop']);
    expect(settings.hooks['Stop']?.[0]?.hooks.map((h) => h.command)).toEqual(['echo bye']);
    expect(fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf-8')).toBe('model = "gpt"\n');
    expect(sweepDeadHooks(home)).toEqual([]);
    fs.rmSync(home, { recursive: true, force: true });
  });
});

describe('hermes client', () => {
  it('hermes: a ~/.hermes home gets the card in SOUL.md and the six skills, no hook file; uninstall clears them', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-hermes-'));
    fs.mkdirSync(path.join(home, '.hermes'));
    fs.writeFileSync(path.join(home, '.hermes', 'SOUL.md'), '# Identity\nI am Hermes.\n');
    const report = setupGlobal(home);
    expect(report.clients).toEqual(['hermes']);
    expect(report.surfaces['hermes']).toMatchObject({ card: 'updated', hook: 'none' });
    const soul = fs.readFileSync(path.join(home, '.hermes', 'SOUL.md'), 'utf-8');
    expect(soul.startsWith('# Identity')).toBe(true);
    expect(soul).toContain('<!-- vibe:start -->');
    expect(fs.readdirSync(path.join(home, '.hermes', 'skills')).sort()).toEqual(['vibe', 'vibe.build', 'vibe.discover', 'vibe.handoff', 'vibe.prove', 'vibe.scope']);
    expect(fs.existsSync(path.join(home, '.hermes', 'hooks.json'))).toBe(false);
    expect(globalStatus(home).clients['hermes']).toMatchObject({ card: true, skills: 6, hook: true, current: true });
    expect(ensureGlobal(home)).toEqual([]);
    const removed = uninstallGlobal(home);
    expect(removed).toContain('.hermes/SOUL.md card');
    expect(fs.readFileSync(path.join(home, '.hermes', 'SOUL.md'), 'utf-8')).toBe('# Identity\nI am Hermes.\n');
    fs.rmSync(home, { recursive: true, force: true });
  });
});
