import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { readJson, writeJson } from '../core/store.js';
import { installPlugin, MARKETPLACE_NAME, pluginPaths, pluginStatus } from './plugin.js';
import { newer } from './update.js';

/**
 * The package registers itself as a local plugin wherever a client CLI is present, so a plugin
 * is what the client sees while npm stays the only install. Claude Code: a directory marketplace
 * pointing at this package, plugin `vibe@vibe`. Codex / ChatGPT desktop: the personal marketplace
 * and the assembled tree. When the CLI is absent (or VIBE_NO_PLUGIN is set) the surfaces go into
 * the client home instead — the older path, still complete.
 */
export type Mode = 'plugin' | 'home';
const MARKETPLACE = 'vibe';
const PLUGIN_ID = 'vibe@vibe';

function run(cmd: string, args: string[], home: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { encoding: 'utf-8', timeout: 120_000, env: { ...process.env, HOME: home, USERPROFILE: home }, shell: process.platform === 'win32' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

export function cliAvailable(name: string): boolean {
  if (process.env['VIBE_NO_PLUGIN']) return false;
  const r = spawnSync(name, ['--version'], { encoding: 'utf-8', timeout: 15_000, shell: process.platform === 'win32' });
  return r.status === 0;
}

function packageVersion(): string {
  return readJson<{ version: string }>(path.join(packageRoot(), 'package.json'))?.version ?? '0.0.0';
}

// ─── Claude Code ─────────────────────────────────────────────────────────

interface InstalledPlugins {
  plugins?: Record<string, Array<{ version?: string; scope?: string }>>;
}
interface KnownMarketplaces {
  [name: string]: { source?: { source?: string; path?: string } };
}

export function claudePluginVersion(home: string): string | null {
  const doc = readJson<InstalledPlugins>(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
  return doc?.plugins?.[PLUGIN_ID]?.[0]?.version ?? null;
}

function claudeMarketplacePath(home: string): string | null {
  const doc = readJson<KnownMarketplaces>(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'));
  return doc?.[MARKETPLACE]?.source?.path ?? null;
}

export interface RegisterReport {
  ok: boolean;
  mode: Mode;
  version: string | null;
  detail: string;
}

/** Point the `vibe` marketplace at this package and install/update the plugin. Idempotent: nothing runs when current. */
export function registerClaude(home: string, root: string = packageRoot()): RegisterReport {
  const want = packageVersion();
  const installed = claudePluginVersion(home);
  const at = claudeMarketplacePath(home);
  if (installed === want && at === root) return { ok: true, mode: 'plugin', version: installed, detail: 'current' };
  if (at !== null && at !== root) run('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE], home);
  if (at !== root) {
    const add = run('claude', ['plugin', 'marketplace', 'add', root, '--scope', 'user'], home);
    if (!add.ok) return { ok: false, mode: 'home', version: installed, detail: `marketplace add failed: ${add.out.slice(-200)}` };
  }
  const step = installed ? run('claude', ['plugin', 'update', PLUGIN_ID], home) : run('claude', ['plugin', 'install', PLUGIN_ID, '--scope', 'user'], home);
  if (!step.ok) return { ok: false, mode: 'home', version: installed, detail: `plugin ${installed ? 'update' : 'install'} failed: ${step.out.slice(-200)}` };
  const now = claudePluginVersion(home);
  return { ok: now !== null, mode: now !== null ? 'plugin' : 'home', version: now, detail: installed ? `updated ${installed} → ${now}` : `installed ${now}` };
}

export function unregisterClaude(home: string): string[] {
  const removed: string[] = [];
  if (claudePluginVersion(home) !== null && run('claude', ['plugin', 'uninstall', PLUGIN_ID], home).ok) removed.push(`claude plugin ${PLUGIN_ID}`);
  if (claudeMarketplacePath(home) !== null && run('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE], home).ok) removed.push(`claude marketplace ${MARKETPLACE}`);
  return removed;
}

// ─── Codex CLI · ChatGPT desktop ─────────────────────────────────────────

function marketplaceName(home: string): string {
  return readJson<{ name?: string }>(pluginPaths(home).marketplace)?.name ?? MARKETPLACE_NAME;
}

/**
 * The version Codex has installed, read from its cache (`~/.codex/plugins/cache/<marketplace>/vibe/<version>/`);
 * the highest when several are present, null when Codex holds none — a reading, not the package version.
 */
export function codexPluginVersion(home: string): string | null {
  const dir = path.join(home, '.codex', 'plugins', 'cache', marketplaceName(home), 'vibe');
  if (!fs.existsSync(dir)) return null;
  const versions = fs
    .readdirSync(dir)
    .filter((v) => /^\d+\.\d+\.\d+/.test(v) && fs.existsSync(path.join(dir, v, '.codex-plugin', 'plugin.json')))
    .sort((a, b) => (newer(a, b) ? -1 : newer(b, a) ? 1 : 0));
  return versions[0] ?? null;
}

/** Tree without drift, marketplace pointing at it, and Codex holding this version. An unreadable cache (null) is not stale. */
export function codexRegistered(home: string): boolean {
  const s = pluginStatus(home);
  if (!s.exists || !s.registered || s.drift.length > 0) return false;
  const held = codexPluginVersion(home);
  return held === null || held === packageVersion();
}

/**
 * Assemble the tree under ~/.config/vibe/plugin, register the personal marketplace, and let Codex pick it up.
 * Codex has no per-plugin update: an older install is removed and added again. A marketplace that is
 * already configured is not a failure.
 */
export function registerCodex(home: string): RegisterReport {
  if (codexRegistered(home)) return { ok: true, mode: 'plugin', version: packageVersion(), detail: 'current' };
  const held = codexPluginVersion(home);
  const r = installPlugin(home);
  const id = `vibe@${r.marketplaceName}`;
  const add = run('codex', ['plugin', 'marketplace', 'add', home], home);
  if (!add.ok && !/already/i.test(add.out)) return { ok: false, mode: 'home', version: held, detail: `codex marketplace add failed: ${add.out.slice(-200)}` };
  if (held !== null) run('codex', ['plugin', 'remove', id], home);
  const plug = run('codex', ['plugin', 'add', id], home);
  if (!plug.ok) return { ok: false, mode: 'home', version: held, detail: `codex plugin add failed: ${plug.out.slice(-200)}` };
  return { ok: true, mode: 'plugin', version: r.version, detail: held ? `updated ${held} → ${r.version}` : `registered ${id}` };
}

export function unregisterCodex(home: string): string[] {
  const removed: string[] = [];
  const paths = pluginPaths(home);
  if (fs.existsSync(paths.tree)) {
    run('codex', ['plugin', 'remove', `vibe@${marketplaceName(home)}`], home);
    fs.rmSync(paths.tree, { recursive: true, force: true });
    removed.push(paths.tree);
  }
  const doc = readJson<{ plugins?: Array<{ name?: string }> }>(paths.marketplace);
  if (doc?.plugins?.some((p) => p?.name === 'vibe')) {
    writeJson(paths.marketplace, { ...doc, plugins: doc.plugins.filter((p) => p?.name !== 'vibe') });
    removed.push(`${paths.marketplace} vibe entry`);
  }
  return removed;
}
