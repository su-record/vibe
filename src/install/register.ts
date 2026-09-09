import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

/** The version of the vibe package at `dir`, when there is one. */
function vibeVersionAt(dir: string | null): string | null {
  if (!dir) return null;
  const pkg = readJson<{ name?: string; version?: string }>(path.join(dir, 'package.json'));
  return pkg?.name === '@su-record/vibe' && typeof pkg.version === 'string' ? pkg.version : null;
}

/**
 * Highest version wins: a marketplace that already points at another vibe install of a version
 * greater than or equal to this one, which Claude actually holds, is left alone — a development
 * checkout and a global install stop re-registering each other on every command.
 */
export function claudeHeldElsewhere(home: string, root: string = packageRoot()): { at: string; version: string } | null {
  const at = claudeMarketplacePath(home);
  if (!at || path.resolve(at) === path.resolve(root)) return null;
  const theirs = vibeVersionAt(at);
  if (!theirs || newer(packageVersion(), theirs)) return null;
  return claudePluginVersion(home) === theirs ? { at, version: theirs } : null;
}

/** Point the `vibe` marketplace at this package and install/update the plugin. Idempotent: nothing runs when current. */
export function registerClaude(home: string, root: string = packageRoot()): RegisterReport {
  const want = packageVersion();
  const installed = claudePluginVersion(home);
  const at = claudeMarketplacePath(home);
  if (installed === want && at === root) return { ok: true, mode: 'plugin', version: installed, detail: 'current' };
  const elsewhere = claudeHeldElsewhere(home, root);
  if (elsewhere) return { ok: true, mode: 'plugin', version: elsewhere.version, detail: `current — ${elsewhere.version} at ${elsewhere.at}` };
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
/** Highest version wins for Codex too: a tree assembled by a newer install, which Codex holds, is not torn down by an older binary. */
export function codexHeldNewer(home: string): string | null {
  const s = pluginStatus(home);
  if (!s.exists || !s.registered || !s.manifestVersion || !newer(s.manifestVersion, packageVersion())) return null;
  const otherDrift = s.drift.filter((d) => !d.startsWith('manifest '));
  return otherDrift.length === 0 && codexPluginVersion(home) === s.manifestVersion ? s.manifestVersion : null;
}

/**
 * Codex runs a hook only after the user accepted it once: config.toml keeps a `trusted_hash` per hook under
 * `[hooks.state."<source>:<event>:i:j"]`. vibe cannot write that hash (its form is not public), so it reads it:
 * trusted when every event vibe installs has an entry for its source — the plugin's codex-hooks.json or the
 * settings hooks.json. Null when Codex has no hook state at all.
 */
export function codexHooksTrusted(home: string): boolean | null {
  let toml = '';
  try {
    toml = fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf-8');
  } catch {
    return null;
  }
  const keys = [...toml.matchAll(/^\[hooks\.state\."([^"]+)"\]/gm)].map((m) => m[1] ?? '');
  if (keys.length === 0) return null;
  const sources = [`vibe@${marketplaceName(home)}:hooks/codex-hooks.json`, path.join(home, '.codex', 'hooks.json')];
  const events = ['session_start', 'pre_tool_use', 'post_tool_use', 'stop'];
  return sources.some((src) => events.every((ev) => keys.some((k) => k.startsWith(`${src}:${ev}:`))));
}

export function codexRegistered(home: string): boolean {
  if (codexHeldNewer(home)) return true;
  const s = pluginStatus(home);
  if (!s.exists || !s.registered || s.drift.length > 0) return false;
  const held = codexPluginVersion(home);
  return held === null || held === packageVersion();
}

const codexCacheDir = (home: string): string => path.join(home, '.codex', 'plugins', 'cache', marketplaceName(home), 'vibe');

/**
 * A Codex or ChatGPT session resolves `${PLUGIN_ROOT}` once, at start, to the cache directory of the version it
 * found; `codex plugin remove` deletes that directory, and every hook of a session still running under the old
 * version then exits 1 until it restarts. So the version just replaced is kept in the cache — put back after the
 * add when Codex removed it — and only versions older than that one are swept.
 */
function keepPreviousVersion(home: string, held: string, snapshot: string | null): void {
  const dir = codexCacheDir(home);
  const previous = path.join(dir, held);
  if (snapshot && !fs.existsSync(previous)) fs.cpSync(snapshot, previous, { recursive: true });
  if (snapshot) fs.rmSync(snapshot, { recursive: true, force: true });
  if (!fs.existsSync(dir)) return;
  for (const v of fs.readdirSync(dir)) if (/^\d+\.\d+\.\d+/.test(v) && newer(held, v)) fs.rmSync(path.join(dir, v), { recursive: true, force: true });
}

function snapshotVersion(home: string, held: string): string | null {
  const from = path.join(codexCacheDir(home), held);
  if (!fs.existsSync(from)) return null;
  const to = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-held-'));
  fs.cpSync(from, to, { recursive: true });
  return to;
}

/**
 * Assemble the tree under ~/.config/vibe/plugin, register the personal marketplace, and let Codex pick it up.
 * Codex has no per-plugin update: an older install is removed and added again, and the removed version's
 * cache directory is put back so a session that started under it keeps its hooks until it restarts. A
 * marketplace that is already configured is not a failure.
 */
export function registerCodex(home: string): RegisterReport {
  const newerHeld = codexHeldNewer(home);
  if (newerHeld) return { ok: true, mode: 'plugin', version: newerHeld, detail: `current — ${newerHeld} at ${pluginPaths(home).tree}` };
  if (codexRegistered(home)) return { ok: true, mode: 'plugin', version: packageVersion(), detail: 'current' };
  const held = codexPluginVersion(home);
  const r = installPlugin(home);
  const id = `vibe@${r.marketplaceName}`;
  const add = run('codex', ['plugin', 'marketplace', 'add', home], home);
  if (!add.ok && !/already/i.test(add.out)) return { ok: false, mode: 'home', version: held, detail: `codex marketplace add failed: ${add.out.slice(-200)}` };
  const snapshot = held !== null ? snapshotVersion(home, held) : null;
  if (held !== null) run('codex', ['plugin', 'remove', id], home);
  const plug = run('codex', ['plugin', 'add', id], home);
  if (held !== null) keepPreviousVersion(home, held, snapshot);
  if (!plug.ok) return { ok: false, mode: 'home', version: held, detail: `codex plugin add failed: ${plug.out.slice(-200)}` };
  return { ok: true, mode: 'plugin', version: r.version, detail: held ? `updated ${held} → ${r.version}; a session started under ${held} keeps its hooks until it restarts` : `registered ${id}` };
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
