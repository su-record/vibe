import os from 'node:os';
import path from 'node:path';
import { detectClient, detectModel } from './client.js';
import { usage } from './errors.js';
import { record } from './ledger.js';
import { vibePath } from './paths.js';
import { readJson, writeAtomic, writeJson } from './store.js';

/** Domain knowledge is not a skill — it is a document the model reads when it needs it. */
export function knowledgeDir(root: string): string {
  return vibePath(root, 'knowledge');
}

const defaultHome = (): string => process.env['VIBE_HOME_DIR'] ?? os.homedir();

export type SkillMode = 'propose' | 'create';
/** Conversation turns without a file change before a knowledge turn; 0 keeps only the file-change trigger. */
export const DEFAULT_KNOWLEDGE_TURNS = 5;

/**
 * The person's own knowledge settings, kept beside the wiki rather than in any project. `auto` is off unless
 * they turn it on; `dir` moves the wiki, for example into a folder of an Obsidian vault; `skills` says whether
 * a repeated procedure becomes an offered draft or a created skill; `exclude` lists folders never recorded.
 */
export interface KnowledgeSettings {
  auto: boolean;
  dir?: string;
  turns: number;
  skills: SkillMode;
  exclude: string[];
}

export interface KnowledgeChange {
  auto?: boolean;
  dir?: string;
  turns?: number;
  skills?: string;
  exclude?: string;
  include?: string;
}

export function knowledgeSettingsFile(home: string = defaultHome()): string {
  return path.join(home, '.config', 'vibe', 'knowledge.json');
}

export function knowledgeSettings(home: string = defaultHome()): KnowledgeSettings {
  const raw = readJson<Record<string, unknown>>(knowledgeSettingsFile(home)) ?? {};
  const { dir, turns, exclude } = raw;
  return {
    auto: raw['auto'] === true,
    ...(typeof dir === 'string' && path.isAbsolute(dir) ? { dir } : {}),
    turns: Number.isInteger(turns) && (turns as number) >= 0 ? turns as number : DEFAULT_KNOWLEDGE_TURNS,
    skills: raw['skills'] === 'create' ? 'create' : 'propose',
    exclude: Array.isArray(exclude) ? exclude.filter((e): e is string => typeof e === 'string' && path.isAbsolute(e)) : [],
  };
}

function absolute(flag: string, value: string | undefined): string | undefined {
  if (value !== undefined && !path.isAbsolute(value)) throw usage(`--${flag} takes an absolute folder path`);
  return value === undefined ? undefined : path.resolve(value);
}

/** Apply the person's change; a folder must be absolute, and what the change leaves out is kept. */
export function setKnowledgeSettings(change: KnowledgeChange, home: string = defaultHome()): KnowledgeSettings {
  const current = knowledgeSettings(home);
  if (change.turns !== undefined && !(Number.isInteger(change.turns) && change.turns >= 0)) throw usage('--turns takes a whole number, 0 or more');
  if (change.skills !== undefined && !['propose', 'create'].includes(change.skills)) throw usage('--skills takes propose | create');
  const dir = absolute('dir', change.dir) ?? current.dir;
  const exclude = absolute('exclude', change.exclude), include = absolute('include', change.include);
  const next: KnowledgeSettings = {
    auto: change.auto ?? current.auto,
    ...(dir ? { dir } : {}),
    turns: change.turns ?? current.turns,
    skills: (change.skills as SkillMode | undefined) ?? current.skills,
    exclude: [...new Set([...current.exclude, ...(exclude ? [exclude] : [])])].filter(folder => folder !== include),
  };
  writeJson(knowledgeSettingsFile(home), next);
  return next;
}

/** Cross-project knowledge, outside any `.vibe/` — the same plain-file format, read after a project's own. */
export function globalKnowledgeDir(home: string = defaultHome()): string {
  return knowledgeSettings(home).dir ?? path.join(home, '.config', 'vibe', 'knowledge');
}

export interface AddKnowledgeOptions {
  global?: boolean;
}

export function addKnowledge(root: string, title: string, body: string, options: AddKnowledgeOptions = {}): { file: string } {
  if (!title.trim()) throw usage('--title is required');
  if (!body.trim()) throw usage('body is empty');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'note';
  const dir = options.global ? globalKnowledgeDir() : knowledgeDir(root);
  const file = path.join(dir, `${slug}.md`);
  writeAtomic(file, `# ${title}\n\n${body.trim()}\n`);
  record(root, { event: 'knowledge', client: detectClient(), model: detectModel(), detail: options.global ? `global:${slug}` : slug });
  return { file };
}
