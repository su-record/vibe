import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { readJson, writeJson } from '../core/store.js';
import { installPlugin, pluginPaths, pluginStatus } from './plugin.js';

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

export function codexRegistered(home: string): boolean {
  const s = pluginStatus(home);
  return s.exists && s.registered && s.drift.length === 0;
}

/** Assemble the tree under ~/.config/vibe/plugin, register the personal marketplace, and let Codex pick it up. */
export function registerCodex(home: string): RegisterReport {
  if (codexRegistered(home)) return { ok: true, mode: 'plugin', version: packageVersion(), detail: 'current' };
  const r = installPlugin(home);
  const add = run('codex', ['plugin', 'marketplace', 'add', home], home);
  const plug = run('codex', ['plugin', 'add', `vibe@${r.marketplaceName}`], home);
  const ok = add.ok && plug.ok;
  return { ok, mode: ok ? 'plugin' : 'home', version: r.version, detail: ok ? `registered vibe@${r.marketplaceName}` : `codex plugin add failed: ${(add.ok ? plug.out : add.out).slice(-200)}` };
}

export function unregisterCodex(home: string): string[] {
  const removed: string[] = [];
  const paths = pluginPaths(home);
  if (fs.existsSync(paths.tree)) {
    run('codex', ['plugin', 'remove', 'vibe'], home);
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
