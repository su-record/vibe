import fs from 'node:fs';
import path from 'node:path';
import { detectClient, detectModel } from '../core/client.js';
import { record } from '../core/ledger.js';
import { packageRoot, vibePath } from '../core/paths.js';
import { emptyState, readState, statePath } from '../core/state.js';
import { ensureDir, readJson, readText, writeAtomic, writeJson } from '../core/store.js';
import { openQuestions } from '../core/inbox.js';

export type Client = 'claude' | 'codex' | 'chatgpt';
export const ALL_CLIENTS: ReadonlyArray<Client> = ['claude', 'codex', 'chatgpt'];
export const CARD_START = '<!-- vibe:start -->';
export const CARD_END = '<!-- vibe:end -->';
export const CARD_MAX_BYTES = 1024;

const SKILL_NAMES = ['vibe', 'vibe.discover', 'vibe.scope', 'vibe.build', 'vibe.prove', 'vibe.handoff'] as const;

export function cardText(): string {
  return readText(path.join(packageRoot(), 'card.md')) ?? '';
}

/** Replace the marker block; leave the rest of the user's file untouched. */
export function upsertCard(file: string, card: string): 'created' | 'updated' | 'unchanged' {
  const block = `${CARD_START}\n${card.trim()}\n${CARD_END}`;
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
  const next = `${existing.slice(0, start)}${existing.slice(end + CARD_END.length)}`.replace(/\n{3,}/g, '\n\n');
  if (next.trim() === '') fs.rmSync(file);
  else writeAtomic(file, next);
  return true;
}

function copySkills(dest: string): string[] {
  const src = path.join(packageRoot(), 'skills');
  const copied: string[] = [];
  for (const name of SKILL_NAMES) {
    const from = path.join(src, name);
    if (!fs.existsSync(from)) continue;
    const to = path.join(dest, name);
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
    copied.push(name);
  }
  return copied;
}

interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: 'command'; command: string; timeout?: number }>;
}
interface Settings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

function notifyCommand(mode: 'post' | 'pre'): string {
  const script = path.join(packageRoot(), 'hooks', 'notify.js');
  return `node "${script}" ${mode}`;
}

/** Notification hook — it never judges. Other hooks in the file are left alone. */
export function installClaudeHook(root: string): 'added' | 'unchanged' {
  const file = path.join(root, '.claude', 'settings.local.json');
  const settings = readJson<Settings>(file) ?? {};
  const hooks = settings.hooks ?? {};
  const wanted: Array<[string, string, string]> = [
    ['PostToolUse', 'Edit|Write|MultiEdit|NotebookEdit', notifyCommand('post')],
    ['PreToolUse', 'Bash', notifyCommand('pre')],
  ];
  let changed = false;
  for (const [event, matcher, command] of wanted) {
    const list = hooks[event] ?? [];
    const present = list.some((entry) => entry.hooks.some((h) => h.command === command));
    if (present) continue;
    list.push({ matcher, hooks: [{ type: 'command', command, timeout: 20 }] });
    hooks[event] = list;
    changed = true;
  }
  if (!changed) return 'unchanged';
  writeJson(file, { ...settings, hooks });
  return 'added';
}

export function removeClaudeHook(root: string): boolean {
  const file = path.join(root, '.claude', 'settings.local.json');
  const settings = readJson<Settings>(file);
  if (!settings?.hooks) return false;
  let changed = false;
  for (const [event, list] of Object.entries(settings.hooks)) {
    const kept = list.filter((entry) => !entry.hooks.some((h) => h.command.includes('hooks/notify.js')));
    if (kept.length !== list.length) {
      changed = true;
      if (kept.length === 0) delete settings.hooks[event];
      else settings.hooks[event] = kept;
    }
  }
  if (changed) writeJson(file, settings);
  return changed;
}

export interface InitReport {
  root: string;
  clients: Client[];
  created: string[];
  card: Record<string, string>;
  skills: Record<string, string[]>;
  hook: string | null;
  cardBytes: number;
}

export function initProject(root: string, clients: ReadonlyArray<Client>): InitReport {
  const created: string[] = [];
  for (const dir of ['', 'evidence', 'knowledge', 'knowledge/research', 'regressions']) {
    const target = vibePath(root, dir);
    if (!fs.existsSync(target)) {
      ensureDir(target);
      created.push(path.relative(root, target));
    }
  }
  const seeds: Array<[string, string]> = [
    ['intent.md', ''],
    ['scenarios.yaml', '[]\n'],
    ['results.json', '{}\n'],
  ];
  for (const [name, body] of seeds) {
    const target = vibePath(root, name);
    if (!fs.existsSync(target)) {
      writeAtomic(target, body);
      created.push(path.relative(root, target));
    }
  }
  if (!fs.existsSync(statePath(root))) writeJson(statePath(root), emptyState());

  const card = cardText();
  const cardReport: Record<string, string> = {};
  const skillReport: Record<string, string[]> = {};
  let hook: string | null = null;
  const wantsClaude = clients.includes('claude');
  const wantsCodexLike = clients.includes('codex') || clients.includes('chatgpt');
  if (wantsClaude) {
    cardReport['CLAUDE.md'] = upsertCard(path.join(root, 'CLAUDE.md'), card);
    skillReport['.claude/skills'] = copySkills(path.join(root, '.claude', 'skills'));
    hook = installClaudeHook(root);
  }
  if (wantsCodexLike) {
    cardReport['AGENTS.md'] = upsertCard(path.join(root, 'AGENTS.md'), card);
    skillReport['.codex/skills'] = copySkills(path.join(root, '.codex', 'skills'));
  }
  record(root, { event: 'init', client: detectClient(), model: detectModel(), detail: clients.join(',') });
  return { root, clients: [...clients], created, card: cardReport, skills: skillReport, hook, cardBytes: Buffer.byteLength(card, 'utf-8') };
}

export interface StatusReport {
  root: string;
  vibe: boolean;
  cardBytes: number;
  cardOver: boolean;
  cards: Record<string, boolean>;
  skills: Record<string, number>;
  hook: boolean;
  state: string;
  inboxOpen: number;
}

export function statusProject(root: string): StatusReport {
  const card = cardText();
  const cardBytes = Buffer.byteLength(card, 'utf-8');
  const cards: Record<string, boolean> = {};
  for (const name of ['CLAUDE.md', 'AGENTS.md']) cards[name] = (readText(path.join(root, name)) ?? '').includes(CARD_START);
  const skills: Record<string, number> = {};
  for (const dir of ['.claude/skills', '.codex/skills']) {
    const full = path.join(root, dir);
    skills[dir] = fs.existsSync(full) ? fs.readdirSync(full).filter((n) => n === 'vibe' || n.startsWith('vibe.')).length : 0;
  }
  const settings = readJson<Settings>(path.join(root, '.claude', 'settings.local.json'));
  const hook = Object.values(settings?.hooks ?? {}).some((list) => list.some((e) => e.hooks.some((h) => h.command.includes('hooks/notify.js'))));
  const vibe = fs.existsSync(vibePath(root));
  return { root, vibe, cardBytes, cardOver: cardBytes > CARD_MAX_BYTES, cards, skills, hook, state: vibe ? readState(root).state : 'NONE', inboxOpen: vibe ? openQuestions(root).length : 0 };
}

export function uninstallProject(root: string, keepState: boolean): string[] {
  const removed: string[] = [];
  for (const name of ['CLAUDE.md', 'AGENTS.md']) if (removeCard(path.join(root, name))) removed.push(`${name} card`);
  for (const dir of ['.claude/skills', '.codex/skills']) {
    for (const name of SKILL_NAMES) {
      const target = path.join(root, dir, name);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
        removed.push(path.join(dir, name));
      }
    }
  }
  if (removeClaudeHook(root)) removed.push('.claude/settings.local.json hook');
  if (!keepState && fs.existsSync(vibePath(root))) {
    fs.rmSync(vibePath(root), { recursive: true, force: true });
    removed.push('.vibe/');
  }
  return removed;
}
