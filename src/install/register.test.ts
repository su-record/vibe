import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packageRoot } from '../core/paths.js';
import { ensureGlobal, globalStatus, setupGlobal, uninstallGlobal } from './global.js';
import { installPlugin, pluginPaths } from './plugin.js';
import { registerClaude, registerCodex } from './register.js';

/**
 * The client CLIs are stand-ins: shell scripts that log their arguments and write the same
 * files the real `claude` writes (installed_plugins.json · known_marketplaces.json).
 */
let home: string;
let shim: string;
let savedPath: string | undefined;
let savedNoPlugin: string | undefined;

const CLAUDE_SHIM = `#!/bin/sh
echo "$@" >> "$HOME/claude.log"
P="$HOME/.claude/plugins"; mkdir -p "$P"
V=$(node -p "require('$PKG/package.json').version")
case "$*" in
  "--version") echo 9.9.9;;
  "plugin marketplace add"*) printf '{"vibe":{"source":{"source":"directory","path":"%s"}}}' "$4" > "$P/known_marketplaces.json";;
  "plugin marketplace remove"*) printf '{}' > "$P/known_marketplaces.json";;
  "plugin install"*|"plugin update"*) printf '{"version":2,"plugins":{"vibe@vibe":[{"scope":"user","version":"%s"}]}}' "$V" > "$P/installed_plugins.json";;
  "plugin uninstall"*) printf '{"version":2,"plugins":{}}' > "$P/installed_plugins.json";;
esac
`;
/** Codex copies the marketplace's tree into ~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/ on add and deletes it on remove. */
const CODEX_SHIM = `#!/bin/sh
echo "$@" >> "$HOME/codex.log"
C="$HOME/.codex/plugins/cache/vibe-local/vibe"
case "$*" in
  "--version") echo codex-cli 9.9.9;;
  "plugin add"*) V=$(node -p "require('$HOME/.config/vibe/plugin/vibe/.codex-plugin/plugin.json').version"); mkdir -p "$C/$V"; cp -r "$HOME/.config/vibe/plugin/vibe/." "$C/$V/";;
  "plugin remove"*) rm -rf "$C";;
esac
`;
const CODEX_SHIM_NO_CACHE = `#!/bin/sh
echo "$@" >> "$HOME/codex.log"
case "$*" in "--version") echo codex-cli 9.9.9;; esac
`;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-register-'));
  shim = path.join(home, 'shim');
  fs.mkdirSync(shim);
  fs.writeFileSync(path.join(shim, 'claude'), CLAUDE_SHIM.replace('$PKG', packageRoot()), { mode: 0o755 });
  fs.writeFileSync(path.join(shim, 'codex'), CODEX_SHIM, { mode: 0o755 });
  savedPath = process.env['PATH'];
  savedNoPlugin = process.env['VIBE_NO_PLUGIN'];
  process.env['PATH'] = `${shim}:${savedPath ?? ''}`;
  delete process.env['VIBE_NO_PLUGIN'];
});
afterEach(() => {
  process.env['PATH'] = savedPath;
  if (savedNoPlugin === undefined) delete process.env['VIBE_NO_PLUGIN'];
  else process.env['VIBE_NO_PLUGIN'] = savedNoPlugin;
  fs.rmSync(home, { recursive: true, force: true });
});

const log = (name: string): string[] => (fs.existsSync(path.join(home, name)) ? fs.readFileSync(path.join(home, name), 'utf-8').trim().split('\n') : []);

describe('plugin mode — the package registers itself as a local plugin', () => {
  it('plugin mode: with the claude CLI present the package becomes marketplace vibe + plugin vibe@vibe, and no home surfaces are written', () => {
    fs.mkdirSync(path.join(home, '.claude'));
    const report = setupGlobal(home);
    expect(report.surfaces['claude']).toMatchObject({ mode: 'plugin', card: 'plugin', hook: 'plugin' });
    expect(log('claude.log')).toEqual([`plugin marketplace add ${packageRoot()} --scope user`, 'plugin install vibe@vibe --scope user']);
    expect(fs.existsSync(path.join(home, '.claude', 'CLAUDE.md'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.claude', 'skills'))).toBe(false);
    const status = globalStatus(home).clients['claude'];
    expect(status).toMatchObject({ mode: 'plugin', current: true });
    expect(status?.pluginVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(ensureGlobal(home)).toEqual([]);
    expect(log('claude.log')).toHaveLength(2); // current — nothing ran again
  });

  it('plugin mode: an older installed plugin is updated, a marketplace pointing elsewhere is re-pointed, uninstall unregisters', () => {
    fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'vibe@vibe': [{ scope: 'user', version: '0.0.1' }] } }));
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'), JSON.stringify({ vibe: { source: { source: 'directory', path: '/elsewhere' } } }));
    expect(globalStatus(home).clients['claude']?.current).toBe(false);
    expect(ensureGlobal(home)).toEqual(['claude']);
    expect(log('claude.log')).toEqual(['plugin marketplace remove vibe', `plugin marketplace add ${packageRoot()} --scope user`, 'plugin update vibe@vibe']);
    expect(globalStatus(home).clients['claude']?.current).toBe(true);
    const removed = uninstallGlobal(home);
    expect(removed).toEqual(['claude plugin vibe@vibe', 'claude marketplace vibe']);
  });

  it('plugin mode: codex gets the assembled tree, the personal marketplace and the two codex commands; the card stays in ~/.codex/AGENTS.md; a Codex whose cache cannot be read is not stale', () => {
    fs.writeFileSync(path.join(shim, 'codex'), CODEX_SHIM_NO_CACHE, { mode: 0o755 });
    fs.mkdirSync(path.join(home, '.codex'));
    const report = setupGlobal(home);
    expect(report.surfaces['codex']).toMatchObject({ mode: 'plugin', hook: 'plugin', card: 'created' });
    expect(log('codex.log')).toEqual([`plugin marketplace add ${home}`, 'plugin add vibe@vibe-local']);
    expect(fs.existsSync(path.join(home, '.config', 'vibe', 'plugin', 'vibe', '.codex-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.codex', 'skills'))).toBe(false);
    expect(fs.readFileSync(path.join(home, '.codex', 'AGENTS.md'), 'utf-8')).toContain('<!-- vibe:start -->');
    expect(globalStatus(home).clients['codex']).toMatchObject({ mode: 'plugin', current: true });
    expect(ensureGlobal(home)).toEqual([]);
    expect(log('codex.log')).toHaveLength(2); // an unreadable cache is not stale — nothing ran again
    expect(uninstallGlobal(home)).toEqual(expect.arrayContaining([path.join(home, '.config', 'vibe', 'plugin', 'vibe'), '.codex/AGENTS.md card']));
    expect(log('codex.log').at(-1)).toBe('plugin remove vibe@vibe-local');
  });

  it('plugin mode: codex behind — an older plugin in the Codex cache and a marketplace entry at the ≤ 4.1.7 path are read as stale, repaired by remove + add, and read as current afterwards', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot(), 'package.json'), 'utf-8')) as { version: string };
    fs.mkdirSync(path.join(home, '.codex'));
    fs.mkdirSync(path.join(home, '.agents', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(home, '.agents', 'plugins', 'marketplace.json'), JSON.stringify({ name: 'vibe-local', plugins: [{ name: 'vibe', source: { source: 'local', path: './.vibe/plugin/vibe' } }] }));
    const old = path.join(home, '.codex', 'plugins', 'cache', 'vibe-local', 'vibe', '0.0.1', '.codex-plugin');
    fs.mkdirSync(old, { recursive: true });
    fs.writeFileSync(path.join(old, 'plugin.json'), JSON.stringify({ name: 'vibe', version: '0.0.1' }));
    fs.mkdirSync(path.join(old, '..', 'hooks'));
    fs.writeFileSync(path.join(old, '..', 'hooks', 'notify.js'), '// the hook a running session still points at\n');
    const older = path.join(home, '.codex', 'plugins', 'cache', 'vibe-local', 'vibe', '0.0.0', '.codex-plugin');
    fs.mkdirSync(older, { recursive: true });
    fs.writeFileSync(path.join(older, 'plugin.json'), JSON.stringify({ name: 'vibe', version: '0.0.0' }));

    const before = globalStatus(home).clients['codex'];
    expect(before).toMatchObject({ mode: 'plugin', current: false, pluginVersion: '0.0.1' });
    expect(ensureGlobal(home)).toEqual(['codex']);
    expect(log('codex.log')).toEqual([`plugin marketplace add ${home}`, 'plugin remove vibe@vibe-local', 'plugin add vibe@vibe-local']);
    const marketplace = JSON.parse(fs.readFileSync(path.join(home, '.agents', 'plugins', 'marketplace.json'), 'utf-8')) as { plugins: Array<{ name: string; source: { path: string } }> };
    expect(marketplace.plugins.find((p) => p.name === 'vibe')?.source.path).toBe('./.config/vibe/plugin/vibe');
    // the version just replaced stays, hooks and all, for a session that started under it; anything older is swept
    expect(fs.existsSync(path.join(home, '.codex', 'plugins', 'cache', 'vibe-local', 'vibe', '0.0.1', 'hooks', 'notify.js'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.codex', 'plugins', 'cache', 'vibe-local', 'vibe', '0.0.0'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.codex', 'plugins', 'cache', 'vibe-local', 'vibe', pkg.version, '.codex-plugin', 'plugin.json'))).toBe(true);

    const after = globalStatus(home).clients['codex'];
    expect(after).toMatchObject({ mode: 'plugin', current: true, pluginVersion: pkg.version });
    expect(ensureGlobal(home)).toEqual([]);
    expect(log('codex.log')).toHaveLength(3); // current — nothing ran again
  });

  it('plugin mode: codex behind — when the marketplace is already configured, codex marketplace add may refuse and the registration still goes on', () => {
    fs.writeFileSync(path.join(shim, 'codex'), CODEX_SHIM.replace('"plugin add"*)', '"plugin marketplace add"*) echo "marketplace vibe-local already exists" >&2; exit 1;;\n  "plugin add"*)'), { mode: 0o755 });
    fs.mkdirSync(path.join(home, '.codex'));
    expect(setupGlobal(home).surfaces['codex']).toMatchObject({ mode: 'plugin' });
    expect(globalStatus(home).clients['codex']).toMatchObject({ current: true });
  });

  it('home mode: VIBE_NO_PLUGIN (or no CLI) keeps the older path — card, skills and hook in the client home', () => {
    process.env['VIBE_NO_PLUGIN'] = '1';
    fs.mkdirSync(path.join(home, '.claude'));
    const report = setupGlobal(home);
    expect(report.surfaces['claude']).toMatchObject({ mode: 'home', card: 'created', hook: 'added' });
    expect(fs.existsSync(path.join(home, '.claude', 'skills', 'vibe'))).toBe(true);
    expect(log('claude.log')).toEqual([]);
    expect(globalStatus(home).clients['claude']).toMatchObject({ mode: 'home', current: true });
  });

  it('highest version wins: a marketplace pointing at a newer install that Claude holds is left alone; an older one is replaced; Codex likewise', () => {
    const newerPkg = path.join(home, 'newer');
    fs.mkdirSync(newerPkg, { recursive: true });
    fs.writeFileSync(path.join(newerPkg, 'package.json'), JSON.stringify({ name: '@su-record/vibe', version: '99.0.0' }));
    const plugins = path.join(home, '.claude', 'plugins');
    fs.mkdirSync(plugins, { recursive: true });
    fs.writeFileSync(path.join(plugins, 'known_marketplaces.json'), JSON.stringify({ vibe: { source: { source: 'directory', path: newerPkg } } }));
    fs.writeFileSync(path.join(plugins, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'vibe@vibe': [{ scope: 'user', version: '99.0.0' }] } }));
    const left = registerClaude(home);
    expect(left).toMatchObject({ ok: true, mode: 'plugin', version: '99.0.0' });
    expect(left.detail).toContain(`99.0.0 at ${newerPkg}`);
    expect(fs.existsSync(path.join(home, 'claude.log'))).toBe(false); // nothing ran
    expect(globalStatus(home).clients['claude']).toMatchObject({ current: true, pluginVersion: '99.0.0' });

    fs.writeFileSync(path.join(newerPkg, 'package.json'), JSON.stringify({ name: '@su-record/vibe', version: '0.0.1' }));
    fs.writeFileSync(path.join(plugins, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'vibe@vibe': [{ scope: 'user', version: '0.0.1' }] } }));
    const replaced = registerClaude(home);
    expect(replaced.ok).toBe(true);
    expect(fs.readFileSync(path.join(home, 'claude.log'), 'utf-8')).toContain('plugin marketplace add');

    // Codex: a tree assembled by a newer install, held by Codex, stays
    installPlugin(home);
    const tree = pluginPaths(home).tree;
    const manifestPath = path.join(tree, '.codex-plugin', 'plugin.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ ...JSON.parse(fs.readFileSync(manifestPath, 'utf-8')), version: '99.0.0' }));
    const cache = path.join(home, '.codex', 'plugins', 'cache', 'vibe-local', 'vibe', '99.0.0', '.codex-plugin');
    fs.mkdirSync(cache, { recursive: true });
    fs.writeFileSync(path.join(cache, 'plugin.json'), JSON.stringify({ name: 'vibe', version: '99.0.0' }));
    const codexLeft = registerCodex(home);
    expect(codexLeft).toMatchObject({ ok: true, version: '99.0.0' });
    expect(codexLeft.detail).toContain('99.0.0 at');
    expect(fs.existsSync(path.join(home, 'codex.log'))).toBe(false);
  });
});
