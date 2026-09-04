import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packageRoot } from '../core/paths.js';
import { codexAgentToml, installPlugin, languagePacks, MARKETPLACE_NAME, pluginPaths, pluginStatus, sweepLegacyPluginStore } from './plugin.js';

let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-plugin-home-'));
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

describe('vibe plugin install / status', () => {
  it('assembles manifest, six skills and hooks, and registers the tree in the personal marketplace', () => {
    const report = installPlugin(home);
    const paths = pluginPaths(home);
    expect(report.tree).toBe(paths.tree);
    const manifest = JSON.parse(fs.readFileSync(path.join(paths.tree, '.codex-plugin', 'plugin.json'), 'utf-8')) as { name: string; version: string; skills: string; hooks: string };
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot(), 'package.json'), 'utf-8')) as { version: string };
    expect(manifest).toMatchObject({ name: 'vibe', version: pkg.version, skills: './skills/', hooks: './hooks/codex-hooks.json' });
    expect(fs.readdirSync(path.join(paths.tree, 'skills')).sort()).toEqual([...languagePacks(), 'vibe', 'vibe-build', 'vibe-discover', 'vibe-handoff', 'vibe-prove', 'vibe-scope'].sort());
    const hooks = fs.readFileSync(path.join(paths.tree, 'hooks', 'codex-hooks.json'), 'utf-8');
    expect(hooks).toContain('${PLUGIN_ROOT}/hooks/notify.js');
    expect(hooks).toContain('${PLUGIN_ROOT}/hooks/session.js');
    expect(fs.existsSync(path.join(paths.tree, 'hooks', 'notify.js'))).toBe(true);
    expect(fs.existsSync(path.join(paths.tree, 'hooks', 'session.js'))).toBe(true);
    expect(fs.existsSync(path.join(paths.tree, 'node_modules'))).toBe(false);

    const marketplace = JSON.parse(fs.readFileSync(paths.marketplace, 'utf-8')) as { name: string; plugins: Array<{ name: string; source: { source: string; path: string } }> };
    expect(marketplace.name).toBe(MARKETPLACE_NAME);
    expect(marketplace.plugins[0]).toMatchObject({ name: 'vibe', source: { source: 'local', path: './.config/vibe/plugin/vibe' } });
    expect(report.next[0]).toContain('codex plugin marketplace add');
    expect(report.next[1]).toBe(`codex plugin add vibe@${MARKETPLACE_NAME}`);

    const status = pluginStatus(home);
    expect(status.drift).toEqual([]);
    expect(status).toMatchObject({ exists: true, skills: 6, hooks: true, registered: true, manifestVersion: pkg.version });
  });

  it('keeps other plugins in an existing marketplace and replaces the vibe entry', () => {
    const paths = pluginPaths(home);
    fs.mkdirSync(path.dirname(paths.marketplace), { recursive: true });
    fs.writeFileSync(paths.marketplace, JSON.stringify({ name: 'mine', plugins: [{ name: 'other', source: { source: 'local', path: './x' } }, { name: 'vibe', source: { source: 'local', path: './old' } }] }));
    const report = installPlugin(home);
    expect(report.next[1]).toBe('codex plugin add vibe@mine'); // the real marketplace name, not ours
    const marketplace = JSON.parse(fs.readFileSync(paths.marketplace, 'utf-8')) as { name: string; plugins: Array<{ name: string; source: { path: string } }> };
    expect(marketplace.name).toBe('mine');
    expect(marketplace.plugins.map((p) => p.name)).toEqual(['other', 'vibe']);
    expect(marketplace.plugins[1]?.source.path).toBe('./.config/vibe/plugin/vibe');
  });

  it('reports drift when the tree is stale or missing', () => {
    expect(pluginStatus(home).drift).toEqual(['plugin tree missing — run `vibe plugin install`', 'not registered in the personal marketplace']);
    installPlugin(home);
    const paths = pluginPaths(home);
    const manifestPath = path.join(paths.tree, '.codex-plugin', 'plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { version: string };
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: '0.0.1' }));
    fs.rmSync(path.join(paths.tree, 'skills', 'vibe-prove'), { recursive: true });
    const status = pluginStatus(home);
    expect(status.drift).toEqual([`manifest 0.0.1 ≠ package ${status.packageVersion}`, 'skills 5 ≠ 6']);
  });

  it('reports drift when the marketplace points elsewhere — the ≤ 4.1.7 path, or none — while the entry still counts as registered', () => {
    installPlugin(home);
    const paths = pluginPaths(home);
    const doc = JSON.parse(fs.readFileSync(paths.marketplace, 'utf-8')) as { plugins: Array<{ name: string; source: { source: string; path: string } }> };
    doc.plugins[0]!.source.path = './.vibe/plugin/vibe';
    fs.writeFileSync(paths.marketplace, JSON.stringify(doc));
    const status = pluginStatus(home);
    expect(status.registered).toBe(true);
    expect(status.drift).toEqual([`marketplace points at ${path.join(home, '.vibe', 'plugin', 'vibe')}`]);
    installPlugin(home);
    expect(pluginStatus(home).drift).toEqual([]);
  });

  it('the tree lives under ~/.config/vibe; a ≤ 4.1.7 store at ~/.vibe/plugin goes, and an emptied ~/.vibe with it', () => {
    fs.mkdirSync(path.join(home, '.vibe', 'plugin', 'vibe', 'skills'), { recursive: true });
    fs.writeFileSync(path.join(home, '.vibe', 'plugin', 'vibe', 'README.md'), 'old');
    const report = installPlugin(home);
    expect(report.tree).toBe(path.join(home, '.config', 'vibe', 'plugin', 'vibe'));
    expect(fs.existsSync(path.join(home, '.vibe'))).toBe(false);
    const marketplace = JSON.parse(fs.readFileSync(pluginPaths(home).marketplace, 'utf-8')) as { plugins: Array<{ name: string; source: { path: string } }> };
    expect(marketplace.plugins.find((p) => p.name === 'vibe')?.source.path).toBe('./.config/vibe/plugin/vibe');
    // a home .vibe that holds a project record is left alone
    fs.mkdirSync(path.join(home, '.vibe', 'plugin'), { recursive: true });
    fs.writeFileSync(path.join(home, '.vibe', 'state.json'), '{}');
    expect(sweepLegacyPluginStore(home)).toEqual([path.join(home, '.vibe', 'plugin')]);
    expect(fs.existsSync(path.join(home, '.vibe', 'state.json'))).toBe(true);
  });

  it('every language pack ships two Codex reviewers as TOML in the tree', () => {
    installPlugin(home);
    const agents = path.join(pluginPaths(home).tree, 'agents');
    expect(languagePacks().length).toBeGreaterThan(0);
    for (const pack of languagePacks()) {
      const lang = pack.replace('antislop-', '');
      for (const stage of ['copy-editor', 'chief-editor']) {
        const toml = fs.readFileSync(path.join(agents, `${lang}-${stage}.toml`), 'utf-8');
        expect(toml).toContain(`name = "${lang}-${stage}"`);
        expect(toml).toContain('developer_instructions = """');
        expect(codexAgentToml(lang, stage)).toBe(toml);
      }
    }
  });
});
