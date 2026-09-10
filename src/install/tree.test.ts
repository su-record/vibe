import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packageRoot } from '../core/paths.js';
import { checkPluginTree, pluginTree, pluginTreeFiles, writePluginTree } from './tree.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-tree-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('plugin tree — the repository is the plugin, generated from package.json', () => {
  it('tree: every marketplace file carries the package version and description; hooks differ only by the root variable', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot(), 'package.json'), 'utf-8')) as { version: string; description: string };
    const tree = pluginTree();
    expect(Object.keys(tree).sort()).toEqual(['.claude-plugin/marketplace.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'hooks/codex-hooks.json', 'hooks/hooks.json']);
    for (const file of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
      expect(JSON.parse(tree[file]!)).toMatchObject({ name: 'vibe', version: pkg.version, description: pkg.description });
    }
    expect(JSON.parse(tree['.claude-plugin/marketplace.json']!).plugins[0]).toMatchObject({ name: 'vibe', source: './' });
    const norm = (t: string): string => t.replace(/\$\{(CLAUDE_)?PLUGIN_ROOT\}/g, 'R').replace(/session\.js\\" (claude|codex)/g, 'session.js C');
    expect(Object.keys((JSON.parse(tree['hooks/hooks.json']!) as { hooks: Record<string, unknown> }).hooks)).toContain('Stop'); // Stop reads bounded status on both clients; it never executes the verdict
    expect(norm(tree['hooks/hooks.json']!)).toBe(norm(tree['hooks/codex-hooks.json']!));
    expect(JSON.parse(tree['hooks/hooks.json']!).hooks.SessionStart[0].hooks[0].command).toContain('session.js" claude');
  });

  it('tree: build writes, check is quiet, an edit is drift, and the committed tree is current', () => {
    expect(writePluginTree(root).sort()).toEqual(pluginTreeFiles().sort());
    expect(checkPluginTree(root)).toEqual([]);
    expect(writePluginTree(root)).toEqual([]);
    fs.writeFileSync(path.join(root, '.codex-plugin', 'plugin.json'), '{}');
    expect(checkPluginTree(root)).toEqual(['.codex-plugin/plugin.json']);
    expect(checkPluginTree(packageRoot())).toEqual([]); // the repository itself
  });
});

describe('plugin hooks — one card, one hook, never two', () => {
  const session = path.join(packageRoot(), 'hooks', 'session.js');
  const notify = path.join(packageRoot(), 'hooks', 'notify.js');

  it('hooks: session.js hands over one card and bounded binding status without a PATH CLI', () => {
    const home = path.join(root, 'home'), project = path.join(root, 'project');
    fs.mkdirSync(home); fs.mkdirSync(project);
    const env = { ...process.env, HOME: home, USERPROFILE: home, VIBE_HOME_DIR: home, CLAUDE_PROJECT_DIR: project,
      CODEX_THREAD_ID: 'tree-session', CLAUDE_SESSION_ID: '', PATH: path.join(root, 'no-tools') };
    const run = (client: string) => spawnSync(process.execPath, [session, client], { cwd: project, input: '{}', encoding: 'utf8', env, timeout: 5000 });
    const out = run('claude');
    expect(out.status).toBe(0);
    const ctx = JSON.parse(out.stdout).hookSpecificOutput;
    expect(ctx.hookEventName).toBe('SessionStart');
    expect(ctx.additionalContext).toContain('You work inside vibe');
    expect(ctx.additionalContext).toContain('session-unbound');
    expect(run('codex').stdout).toContain('Stop ran no checks');
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '<!-- vibe:start -->\ncard\n<!-- vibe:end -->\n');
    const homeOwned = JSON.parse(run('claude').stdout).hookSpecificOutput.additionalContext;
    expect(homeOwned).not.toContain('You work inside vibe');
    expect(homeOwned).toContain('session-unbound');
    expect(homeOwned).toContain('vibe session bind');
  });

  it('hooks: notify.js --plugin steps back when the home settings already carry the npm notify hook', () => {
    fs.mkdirSync(path.join(root, '.vibe'));
    fs.mkdirSync(path.join(root, '.claude'));
    fs.writeFileSync(path.join(root, '.claude', 'settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'node /x/hooks/notify.js post' }] }] } }));
    const env = { ...process.env, HOME: root, VIBE_HOME_DIR: root, CLAUDE_PROJECT_DIR: root };
    const guarded = spawnSync(process.execPath, [notify, 'pre', '--plugin'], { encoding: 'utf-8', env, input: JSON.stringify({ tool_input: { command: 'git push' } }) });
    expect(guarded.status).toBe(0);
    expect(guarded.stderr).toBe('');
    const alone = spawnSync(process.execPath, [notify, 'pre'], { encoding: 'utf-8', env, input: JSON.stringify({ tool_input: { command: 'git push' } }) });
    expect(alone.stderr).toContain('irreversible');
  });
});
