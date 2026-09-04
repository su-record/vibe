import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { readJson, readText, writeAtomic, writeJson } from '../core/store.js';
import { hasCurrentHook, installHookFile, removeHookFile, sweepDeadHooks } from './hooks.js';
import { claudePluginVersion, cliAvailable, codexRegistered, registerClaude, registerCodex, unregisterClaude, unregisterCodex, type Mode } from './register.js';

export { hasNotifyHook, sweepDeadHooks } from './hooks.js';

/**
 * The always-on surfaces — card, six common skills, notification hook — are identical in every
 * project and tied to the CLI version, so they live once per client home (`~/.claude`, `~/.codex`),
 * not in each repository. `npm i -g` puts them there (postinstall) and every `vibe` command repairs
 * them when they are missing or stale. Only `.vibe/` state belongs to a project.
 */
export type Client = 'claude' | 'codex' | 'hermes';
export const ALL_CLIENTS: ReadonlyArray<Client> = ['claude', 'codex', 'hermes'];
export const CARD_START = '<!-- vibe:start -->';
export const CARD_END = '<!-- vibe:end -->';
export const CARD_MAX_BYTES = 1024;
export const SKILL_NAMES = ['vibe', 'vibe-discover', 'vibe-scope', 'vibe-build', 'vibe-prove', 'vibe-handoff'] as const;
/** The directory names five of the six carried before 4.1.8 (a dot is outside the Agent Skills name grammar); swept wherever the harness owns a skills directory. */
export const LEGACY_SKILL_NAMES = ['vibe.discover', 'vibe.scope', 'vibe.build', 'vibe.prove', 'vibe.handoff'] as const;

/** Where a client reads its card, skills and hooks — relative to `base`. */
export interface Layout {
  card: string;
  skills: string;
  /** Absent for clients without a hook file (Hermes reads AGENTS.md and skills only). */
  hook?: string;
}

const CLIENT_DIR: Record<Client, string> = { claude: '.claude', codex: '.codex', hermes: '.hermes' };

/** User-level layout: one per client home. Codex reads a native `~/.codex/hooks.json` shaped like Claude's settings. */
export function globalLayout(client: Client): Layout {
  const dir = CLIENT_DIR[client];
  if (client === 'claude') return { card: path.join(dir, 'CLAUDE.md'), skills: path.join(dir, 'skills'), hook: path.join(dir, 'settings.json') };
  if (client === 'codex') return { card: path.join(dir, 'AGENTS.md'), skills: path.join(dir, 'skills'), hook: path.join(dir, 'hooks.json') };
  // Hermes Agent: identity file SOUL.md is the only home-level instruction it always loads; skills follow the agentskills.io layout.
  return { card: path.join(dir, 'SOUL.md'), skills: path.join(dir, 'skills') };
}

/** Repository-level layout — used by the bench, where one workspace must carry the harness and another must not. */
export function projectLayout(client: Client): Layout {
  const dir = CLIENT_DIR[client];
  if (client === 'claude') return { card: 'CLAUDE.md', skills: path.join(dir, 'skills'), hook: path.join(dir, 'settings.local.json') };
  return { card: 'AGENTS.md', skills: path.join(dir, 'skills'), hook: path.join(dir, 'hooks.json') };
}

export function cardText(): string {
  return readText(path.join(packageRoot(), 'card.md')) ?? '';
}

function cardBlock(): string {
  return `${CARD_START}\n${cardText().trim()}\n${CARD_END}`;
}

/** Replace the marker block; leave the rest of the user's file untouched. */
export function upsertCard(file: string): 'created' | 'updated' | 'unchanged' {
  const block = cardBlock();
  const existing = readText(file);
  if (existing === null) {
    writeAtomic(file, `${block}\n`);
    return 'created';
  }
  const start = existing.indexOf(CARD_START);
  const end = existing.indexOf(CARD_END);
  if (start === -1 || end === -1 || end < start) {
    writeAtomic(file, `${existing.replace(/\s*$/, '')}\n\n${block}\n`);
    return 'updated';
  }
  const next = `${existing.slice(0, start)}${block}${existing.slice(end + CARD_END.length)}`;
  if (next === existing) return 'unchanged';
  writeAtomic(file, next);
  return 'updated';
}

export function removeCard(file: string): boolean {
  const existing = readText(file);
  if (existing === null) return false;
  const start = existing.indexOf(CARD_START);
  const end = existing.indexOf(CARD_END);
  if (start === -1 || end === -1) return false;
  const next = `${existing.slice(0, start)}${existing.slice(end + CARD_END.length)}`.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n');
  if (next.trim() === '') fs.rmSync(file);
  else writeAtomic(file, next);
  return true;
}

function hasCurrentCard(file: string): boolean {
  return (readText(file) ?? '').includes(cardBlock());
}

function skillSource(name: string): string {
  return path.join(packageRoot(), 'skills', name);
}

function skillCurrent(dest: string, name: string): boolean {
  const from = path.join(skillSource(name), 'SKILL.md');
  const to = path.join(dest, name, 'SKILL.md');
  const want = readText(from);
  return want !== null && readText(to) === want;
}

/** Remove the pre-4.1.8 dotted directories; returns what went. Project skills in the same directory are not touched. */
export function removeLegacySkills(dest: string): string[] {
  const removed: string[] = [];
  for (const name of LEGACY_SKILL_NAMES) {
    const target = path.join(dest, name);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}

/** Copy the six common skills; a stale copy is replaced. Project skills in the same directory are not touched. */
export function copySkills(dest: string): string[] {
  removeLegacySkills(dest);
  const copied: string[] = [];
  for (const name of SKILL_NAMES) {
    const from = skillSource(name);
    if (!fs.existsSync(from)) continue;
    const to = path.join(dest, name);
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
    copied.push(name);
  }
  return copied;
}

export function removeSkills(dest: string): string[] {
  const removed: string[] = removeLegacySkills(dest);
  for (const name of SKILL_NAMES) {
    const target = path.join(dest, name);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}

export function countSkills(dest: string): number {
  return fs.existsSync(dest) ? fs.readdirSync(dest).filter((n) => (SKILL_NAMES as ReadonlyArray<string>).includes(n)).length : 0;
}


/** Clients whose home directory exists. A machine with neither gets Claude Code — the primary surface. */
export function detectClients(home: string = os.homedir()): Client[] {
  const present = ALL_CLIENTS.filter((c) => fs.existsSync(path.join(home, CLIENT_DIR[c])));
  return present.length > 0 ? present : ['claude'];
}

export interface SurfaceReport {
  card: string;
  skills: string[];
  hook: string;
  mode: Mode;
  detail?: string;
}

/** Install card, skills and hook under `base` following `layout`. Idempotent. */
export function installSurfaces(base: string, layout: Layout): SurfaceReport {
  return {
    card: upsertCard(path.join(base, layout.card)),
    skills: copySkills(path.join(base, layout.skills)),
    hook: layout.hook ? installHookFile(path.join(base, layout.hook)) : 'none',
    mode: 'home',
  };
}

/**
 * Plugin mode: the client CLI registers this package as a local plugin, so skills and hooks come
 * from the plugin and the home copies go. Claude Code's plugin carries the card in its SessionStart
 * hook; Codex keeps the card in ~/.codex/AGENTS.md because its plugin hooks do not run at session start.
 * Falls back to the home surfaces when the CLI is missing or the registration fails.
 */
function installClient(home: string, client: Client): SurfaceReport {
  const layout = globalLayout(client);
  if (client === 'claude' && cliAvailable('claude')) {
    const r = registerClaude(home);
    if (r.ok) {
      removeSurfaces(home, layout);
      return { card: 'plugin', skills: [], hook: 'plugin', mode: 'plugin', detail: r.detail };
    }
    return { ...installSurfaces(home, layout), detail: r.detail };
  }
  if (client === 'codex' && cliAvailable('codex')) {
    const r = registerCodex(home);
    if (r.ok) {
      removeSkills(path.join(home, layout.skills));
      if (layout.hook) removeHookFile(path.join(home, layout.hook));
      return { card: upsertCard(path.join(home, layout.card)), skills: [], hook: 'plugin', mode: 'plugin', detail: r.detail };
    }
    return { ...installSurfaces(home, layout), detail: r.detail };
  }
  return installSurfaces(home, layout);
}

export function removeSurfaces(base: string, layout: Layout): string[] {
  const removed: string[] = [];
  if (removeCard(path.join(base, layout.card))) removed.push(`${layout.card} card`);
  for (const name of removeSkills(path.join(base, layout.skills))) removed.push(path.join(layout.skills, name));
  if (layout.hook && removeHookFile(path.join(base, layout.hook))) removed.push(`${layout.hook} hook`);
  return removed;
}

export interface SurfaceStatus {
  card: boolean;
  skills: number;
  hook: boolean;
  /** Every surface present and identical to what this package version ships */
  current: boolean;
  mode: Mode;
  /** Plugin mode: the version the client has installed */
  pluginVersion?: string | null;
}

export function surfaceStatus(base: string, layout: Layout): SurfaceStatus {
  const skillsDir = path.join(base, layout.skills);
  const card = hasCurrentCard(path.join(base, layout.card));
  const hook = layout.hook ? hasCurrentHook(path.join(base, layout.hook)) : true;
  const skillsCurrent = SKILL_NAMES.every((name) => skillCurrent(skillsDir, name));
  return { card, skills: countSkills(skillsDir), hook, current: card && hook && skillsCurrent, mode: 'home' };
}

function packageVersion(): string {
  return readJson<{ version: string }>(path.join(packageRoot(), 'package.json'))?.version ?? '0.0.0';
}

/** Status per client: plugin mode when the client CLI is present, home mode otherwise. */
export function clientStatus(home: string, client: Client): SurfaceStatus {
  const layout = globalLayout(client);
  if (client === 'claude' && cliAvailable('claude')) {
    const version = claudePluginVersion(home);
    const current = version === packageVersion();
    return { card: current, skills: current ? SKILL_NAMES.length : 0, hook: current, current, mode: 'plugin', pluginVersion: version };
  }
  if (client === 'codex' && cliAvailable('codex')) {
    const registered = codexRegistered(home);
    const card = hasCurrentCard(path.join(home, layout.card));
    return { card, skills: registered ? SKILL_NAMES.length : 0, hook: registered, current: registered && card, mode: 'plugin', pluginVersion: registered ? packageVersion() : null };
  }
  return surfaceStatus(home, layout);
}

export interface GlobalReport {
  home: string;
  clients: Client[];
  surfaces: Record<string, SurfaceReport>;
  cardBytes: number;
}

/** Install the always-on surfaces into every detected client home. */
export function setupGlobal(home: string = os.homedir(), clients: ReadonlyArray<Client> = detectClients(home)): GlobalReport {
  const surfaces: Record<string, SurfaceReport> = {};
  for (const client of clients) surfaces[client] = installClient(home, client);
  return { home, clients: [...clients], surfaces, cardBytes: Buffer.byteLength(cardText(), 'utf-8') };
}

export interface GlobalStatus {
  home: string;
  clients: Record<string, SurfaceStatus>;
  cardBytes: number;
  cardOver: boolean;
}

export function globalStatus(home: string = os.homedir()): GlobalStatus {
  const clients: Record<string, SurfaceStatus> = {};
  for (const client of detectClients(home)) clients[client] = clientStatus(home, client);
  const cardBytes = Buffer.byteLength(cardText(), 'utf-8');
  return { home, clients, cardBytes, cardOver: cardBytes > CARD_MAX_BYTES };
}

/**
 * Self-repair: when a detected client lacks the surfaces or carries a stale copy, install them;
 * the dotted skill directories of ≤ 4.1.7 go first, in every mode.
 * Returns the clients that were repaired. Never throws — a broken home must not block a verdict.
 */
export function ensureGlobal(home: string = os.homedir()): Client[] {
  try {
    sweepDeadHooks(home);
    for (const client of detectClients(home)) removeLegacySkills(path.join(home, globalLayout(client).skills));
    const stale = detectClients(home).filter((c) => !clientStatus(home, c).current);
    if (stale.length > 0) setupGlobal(home, stale);
    return stale;
  } catch {
    return [];
  }
}

/** Remove the surfaces from every client home that has them; project `.vibe/` state is not touched here. */
export function uninstallGlobal(home: string = os.homedir()): string[] {
  const removed: string[] = sweepDeadHooks(home);
  for (const client of ALL_CLIENTS) {
    if (!fs.existsSync(path.join(home, CLIENT_DIR[client]))) continue;
    if (client === 'claude' && cliAvailable('claude')) removed.push(...unregisterClaude(home));
    if (client === 'codex' && cliAvailable('codex')) removed.push(...unregisterCodex(home));
    removed.push(...removeSurfaces(home, globalLayout(client)));
  }
  return removed;
}

/** Remove what `vibe init` (≤ 4.0.1) or the bench left inside a repository: card blocks, the six skills, notify hooks. Project skills and other hooks stay. */
export function uninstallProjectSurfaces(root: string): string[] {
  const removed: string[] = [];
  for (const client of ALL_CLIENTS) removed.push(...removeSurfaces(root, projectLayout(client)));
  return removed;
}
