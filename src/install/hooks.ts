import fs from 'node:fs';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { readJson, readText, writeAtomic, writeJson } from '../core/store.js';

/** Notification hooks in the client settings — install, remove, detect, and sweep what vibe 3 left. */
interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: 'command'; command: string; timeout?: number }>;
}
interface Settings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

const NOTIFY_MARK = 'hooks/notify.js';

function notifyCommand(mode: 'post' | 'pre'): string {
  return `node "${path.join(packageRoot(), NOTIFY_MARK)}" ${mode}`;
}

function wantedHooks(): Array<[string, string, string]> {
  return [
    ['PostToolUse', 'Edit|Write|MultiEdit|NotebookEdit', notifyCommand('post')],
    ['PreToolUse', 'Bash', notifyCommand('pre')],
  ];
}

function isNotify(entry: HookEntry): boolean {
  return entry.hooks.some((h) => h.command.includes(NOTIFY_MARK));
}

/** Notification hook — it never judges. Other hooks in the file are left alone; a notify entry from another install path is replaced. */
export function installHookFile(file: string): 'added' | 'unchanged' {
  const settings = readJson<Settings>(file) ?? {};
  const hooks: Record<string, HookEntry[]> = { ...settings.hooks };
  for (const [event, matcher, command] of wantedHooks()) {
    const kept = (hooks[event] ?? []).filter((entry) => !isNotify(entry));
    hooks[event] = [...kept, { matcher, hooks: [{ type: 'command', command, timeout: 20 }] }];
  }
  const next = { ...settings, hooks };
  if (JSON.stringify(next) === JSON.stringify(settings)) return 'unchanged';
  writeJson(file, next);
  return 'added';
}

export function removeHookFile(file: string): boolean {
  const settings = readJson<Settings>(file);
  if (!settings?.hooks) return false;
  let changed = false;
  for (const [event, list] of Object.entries(settings.hooks)) {
    const kept = list.filter((entry) => !isNotify(entry));
    if (kept.length !== list.length) {
      changed = true;
      if (kept.length === 0) delete settings.hooks[event];
      else settings.hooks[event] = kept;
    }
  }
  if (changed) {
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    if (Object.keys(settings).length === 0) fs.rmSync(file);
    else writeJson(file, settings);
  }
  return changed;
}

/**
 * vibe 3 wrote hooks like `node <install>/hooks/scripts/stop-dispatcher.js` into the client settings
 * and a `notify` line into ~/.codex/config.toml. When that install is gone the client reports a
 * missing file at every session start. Entries whose script no longer exists are removed here.
 */
const LEGACY_SCRIPT = /([^"'\s\]]+\/hooks\/scripts\/[\w.-]+\.js)/;

function deadLegacy(command: string): boolean {
  const m = LEGACY_SCRIPT.exec(command);
  return m !== null && !fs.existsSync(m[1]!);
}

function sweepSettingsFile(home: string, file: string): string[] {
  const removed: string[] = [];
  const settings = readJson<Settings>(file);
  if (!settings?.hooks) return removed;
  let changed = false;
  for (const [event, list] of Object.entries(settings.hooks)) {
    const kept = list
      .map((entry) => ({ ...entry, hooks: entry.hooks.filter((h) => {
        const dead = deadLegacy(h.command);
        if (dead) removed.push(`${path.relative(home, file)} ${event}: ${h.command}`);
        return !dead;
      }) }))
      .filter((entry) => entry.hooks.length > 0);
    if (kept.length !== list.length || kept.some((e, i) => e.hooks.length !== list[i]?.hooks.length)) {
      changed = true;
      if (kept.length === 0) delete settings.hooks[event];
      else settings.hooks[event] = kept;
    }
  }
  if (changed) writeJson(file, settings);
  return removed;
}

function sweepCodexNotify(home: string): string[] {
  const toml = path.join(home, '.codex', 'config.toml');
  const text = readText(toml);
  if (text === null) return [];
  const lines = text.split('\n');
  const kept = lines.filter((l) => !(/^\s*notify\s*=/.test(l) && deadLegacy(l)));
  if (kept.length === lines.length) return [];
  writeAtomic(toml, kept.join('\n'));
  return ['.codex/config.toml notify'];
}

export function sweepDeadHooks(home: string): string[] {
  return [
    ...sweepSettingsFile(home, path.join(home, '.claude', 'settings.json')),
    ...sweepSettingsFile(home, path.join(home, '.codex', 'hooks.json')),
    ...sweepCodexNotify(home),
  ];
}

export function hasNotifyHook(file: string): boolean {
  const settings = readJson<Settings>(file);
  return Object.values(settings?.hooks ?? {}).some((list) => list.some(isNotify));
}

export function hasCurrentHook(file: string): boolean {
  const settings = readJson<Settings>(file);
  return wantedHooks().every(([event, , command]) => (settings?.hooks?.[event] ?? []).some((e) => e.hooks.some((h) => h.command === command)));
}
