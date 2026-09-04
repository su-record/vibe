import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { detectClient, detectModel } from './client.js';
import { denied, usage } from './errors.js';
import { githubClient, type GithubClient } from './github.js';
import { appendJsonl, nowIso, readJson, readJsonl, writeAtomic, writeJson } from './store.js';
import { loadScenarios } from './intent.js';
import { inboxPath } from './inbox.js';
import { record, type Edge } from './ledger.js';
import { vibePath } from './paths.js';
import { listRegressions } from './regress.js';
import type { Check, CheckType } from './scenarios.js';
import { readState } from './state.js';

/**
 * Project-local skills. Nothing accumulates globally: a skill lives in this repository's
 * `.claude/skills` and `.codex/skills`, is registered in `.vibe/skills/registry.json`, and is
 * installed only when bound to a check or carrying knowledge the model does not have. Proposals
 * are proposals — installing, running remote commands and global installs never happen by themselves.
 */
export const COMMON_SKILLS: readonly string[] = ['vibe', 'vibe-discover', 'vibe-scope', 'vibe-build', 'vibe-prove', 'vibe-handoff'];
const SKILL_DIRS = ['.claude/skills', '.codex/skills'] as const;
const NAME_RE = /^[a-z][a-z0-9.-]{0,39}$/;
const DEFAULT_UNUSED_RUNS = 10;
const MAX_PROPOSALS = 3;
const MAX_COMMANDS_SHOWN = 20;

export interface ProjectSkill {
  name: string;
  kind: 'created' | 'added';
  source: string;
  check: Check | null;
  license: string | null;
  installedAt: string;
  installedRun: number;
  lastUsedRun: number | null;
  lastUsedAt: string | null;
  paths: string[];
}
interface Registry {
  skills: ProjectSkill[];
}

function registryPath(root: string): string {
  return vibePath(root, 'skills', 'registry.json');
}
function dismissedPath(root: string): string {
  return vibePath(root, 'skills', 'dismissed.jsonl');
}
export function readRegistry(root: string): Registry {
  return readJson<Registry>(registryPath(root)) ?? { skills: [] };
}
function writeRegistry(root: string, registry: Registry): void {
  writeJson(registryPath(root), registry);
}

/** Install into every client directory that exists; `.claude/skills` when none does. */
function targetDirs(root: string): string[] {
  const present = SKILL_DIRS.filter((d) => fs.existsSync(path.join(root, path.dirname(d))));
  return present.length > 0 ? [...present] : [SKILL_DIRS[0]];
}

function templateCheck(type: CheckType, name: string): Check {
  switch (type) {
    case 'run':
      return { type: 'run', cmd: `node scripts/${name}.js`, expect: 0 };
    case 'file':
      return { type: 'file', path: `out/${name}.csv`, exists: true };
    case 'http':
      return { type: 'http', url: 'https://example.com/health', expect: { status: 200 } };
    case 'eval':
      return { type: 'eval', cases: `evals/${name}.jsonl`, runner: `node scripts/${name}.js`, expect: { pass: 1 } };
    default:
      throw usage('skill create --check run|file|http|eval — a skill without a verdict is prose');
  }
}

function skillBody(name: string, check: Check, from: string | null): string {
  const scenario = YAML.stringify([{ id: name, then: from ? `[from scenario ${from}] fill in the success statement` : 'fill in the success statement', check }]).trim();
  return [
    '---', `name: ${name}`, 'description: "fill in — one line saying when this skill applies"', 'user-invocable: true', '---', '',
    `# ${name}`, '', '## When', '', 'fill in — the situation that repeats in this project', '', '## Procedure', '',
    `1. Run \`vibe skill used ${name}\` so the ledger knows the skill was applied.`, '2. fill in — the steps, each one checkable', '', '## Check', '',
    'This skill is installed because it is bound to the check below. Add it to `scenarios.yaml` when the procedure is part of an intent.', '', '```yaml', scenario, '```', '',
  ].join('\n');
}

function writeSkillFiles(root: string, name: string, files: Record<string, string>): string[] {
  const written: string[] = [];
  for (const dir of targetDirs(root)) {
    for (const [file, content] of Object.entries(files)) {
      const target = path.join(root, dir, name, file);
      writeAtomic(target, content);
      written.push(path.posix.join(dir, name, file));
    }
  }
  return written;
}

function register(root: string, skill: ProjectSkill): void {
  const registry = readRegistry(root);
  registry.skills = [...registry.skills.filter((s) => s.name !== skill.name), skill];
  writeRegistry(root, registry);
}

export interface CreateInput {
  name: string;
  checkType?: CheckType;
  fromScenario?: string;
}

export function createSkill(root: string, input: CreateInput): { name: string; paths: string[]; check: Check } {
  if (!NAME_RE.test(input.name)) throw usage('skill name: 1-40 chars of lowercase letters, digits, dots, hyphens');
  if (COMMON_SKILLS.includes(input.name)) throw usage(`${input.name} is a common skill shipped with vibe`);
  let check: Check;
  if (input.fromScenario) {
    const scenario = loadScenarios(root).find((s) => s.id === input.fromScenario);
    if (!scenario) throw usage(`unknown scenario: ${input.fromScenario}`);
    if (scenario.check.type === 'human') throw usage('a human scenario has no verdict — a skill cannot be bound to it');
    check = scenario.check;
  } else {
    if (!input.checkType) throw usage('skill create <name> --check run|file|http|eval [--from-scenario <id>]');
    check = templateCheck(input.checkType, input.name);
  }
  const paths = writeSkillFiles(root, input.name, { 'SKILL.md': skillBody(input.name, check, input.fromScenario ?? null) });
  const run = readState(root).runs;
  register(root, { name: input.name, kind: 'created', source: 'created', check, license: null, installedAt: nowIso(), installedRun: run, lastUsedRun: null, lastUsedAt: null, paths });
  const edges: Edge[] = input.fromScenario ? [{ type: 'implements', from: `skill:${input.name}`, to: `scenario:${input.fromScenario}` }] : [];
  record(root, { event: 'skill', client: detectClient(), model: detectModel(), detail: `create ${input.name} (${check.type})`, edges });
  return { name: input.name, paths, check };
}

// ─── add — from GitHub, pinned to a commit, confirmed by a person ───────────

interface ContentEntry {
  name?: string;
  type?: string;
  path?: string;
  content?: string;
  encoding?: string;
}

export function parseSkillRef(spec: string): { owner: string; repo: string; name: string | null } {
  const match = /^([\w.-]+)\/([\w.-]+)(?:@([\w./-]+))?$/.exec(spec);
  if (!match) throw usage('skill add owner/repo[@name] [--pin <sha>] [--yes]');
  return { owner: match[1]!, repo: match[2]!, name: match[3] ?? null };
}

/** Lines a reader would run: fenced code and `$ ` lines. Shown before anything is installed. */
export function commandsIn(skillMd: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const raw of skillMd.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if ((fenced && line && !line.startsWith('#')) || line.startsWith('$ ')) out.push(line.replace(/^\$ /, ''));
  }
  return out.slice(0, MAX_COMMANDS_SHOWN);
}

async function locateSkill(client: GithubClient, owner: string, repo: string, name: string | null, sha: string): Promise<{ dir: string; entries: ContentEntry[] }> {
  const dirs = name ? [`skills/${name}`, name] : [''];
  for (const dir of dirs) {
    try {
      const entries = (await client.get(`/repos/${owner}/${repo}/contents/${dir}?ref=${sha}`)) as ContentEntry[];
      if (Array.isArray(entries) && entries.some((e) => e.name === 'SKILL.md')) return { dir, entries };
    } catch {
      /* try the next layout */
    }
  }
  throw usage(`no SKILL.md found in ${owner}/${repo}${name ? ` for ${name}` : ''} at ${sha.slice(0, 7)}`);
}

async function fetchFiles(client: GithubClient, owner: string, repo: string, entries: ContentEntry[], sha: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.type !== 'file' || !entry.name || !entry.path) continue;
    const full = (await client.get(`/repos/${owner}/${repo}/contents/${entry.path}?ref=${sha}`)) as ContentEntry;
    if (typeof full.content !== 'string') continue;
    files[entry.name] = full.encoding === 'base64' ? Buffer.from(full.content, 'base64').toString('utf-8') : full.content;
  }
  if (!files['SKILL.md']) throw usage('SKILL.md could not be downloaded');
  return files;
}

export interface AddInput {
  spec: string;
  pin?: string;
  yes: boolean;
}
export type AddResult =
  | { installed: false; ref: string; sha: string; license: string | null; commands: string[]; files: string[] }
  | { installed: true; ref: string; sha: string; license: string | null; commands: string[]; paths: string[] };

export async function addSkill(root: string, input: AddInput, client: GithubClient = githubClient()): Promise<AddResult> {
  const { owner, repo, name } = parseSkillRef(input.spec);
  const skillName = path.posix.basename(name ?? repo);
  if (!NAME_RE.test(skillName)) throw usage(`cannot use "${skillName}" as a skill name`);
  const meta = (await client.get(`/repos/${owner}/${repo}`)) as { default_branch?: string; license?: { spdx_id?: string | null } | null };
  const license = meta.license?.spdx_id ?? null;
  let sha = input.pin ?? null;
  if (!sha) {
    const branch = (await client.get(`/repos/${owner}/${repo}/branches/${meta.default_branch ?? 'main'}`)) as { commit?: { sha?: string } };
    sha = branch.commit?.sha ?? null;
  }
  if (!sha) throw usage('could not resolve a commit to pin');
  const { entries } = await locateSkill(client, owner, repo, name, sha);
  const files = await fetchFiles(client, owner, repo, entries, sha);
  const commands = commandsIn(files['SKILL.md']!);
  const ref = `${owner}/${repo}${name ? `@${name}` : ''}#${sha.slice(0, 12)}`;
  if (!input.yes) return { installed: false, ref, sha, license, commands, files: Object.keys(files) };
  const paths = writeSkillFiles(root, skillName, files);
  register(root, { name: skillName, kind: 'added', source: ref, check: null, license, installedAt: nowIso(), installedRun: readState(root).runs, lastUsedRun: null, lastUsedAt: null, paths });
  record(root, { event: 'skill', client: detectClient(), model: detectModel(), detail: `add ${ref} (${license ?? 'no license'}) confirmed by --yes` });
  return { installed: true, ref, sha, license, commands, paths };
}

// ─── list · used · prune · dismiss ──────────────────────────────────────────

export interface SkillListing {
  common: string[];
  project: ProjectSkill[];
  currentRun: number;
}

export function listSkills(root: string): SkillListing {
  return { common: [...COMMON_SKILLS], project: readRegistry(root).skills, currentRun: readState(root).runs };
}

export function markUsed(root: string, name: string): ProjectSkill {
  const registry = readRegistry(root);
  const skill = registry.skills.find((s) => s.name === name);
  if (!skill) throw usage(`not a project skill: ${name}`);
  skill.lastUsedRun = readState(root).runs;
  skill.lastUsedAt = nowIso();
  writeRegistry(root, registry);
  record(root, { event: 'skill', client: detectClient(), model: detectModel(), detail: `used ${name}`, skillsUsed: [name] });
  return skill;
}

export function pruneSkills(root: string, options: { unusedRuns?: number; dryRun?: boolean } = {}): { removed: string[]; kept: string[]; threshold: number } {
  const unusedRuns = options.unusedRuns ?? DEFAULT_UNUSED_RUNS;
  const current = readState(root).runs;
  const registry = readRegistry(root);
  const stale = registry.skills.filter((s) => current - (s.lastUsedRun ?? s.installedRun) >= unusedRuns);
  if (!options.dryRun) {
    for (const s of stale) for (const dir of SKILL_DIRS) fs.rmSync(path.join(root, dir, s.name), { recursive: true, force: true });
    registry.skills = registry.skills.filter((s) => !stale.includes(s));
    writeRegistry(root, registry);
    if (stale.length > 0) record(root, { event: 'skill', client: detectClient(), model: detectModel(), detail: `prune ${stale.map((s) => s.name).join(', ')} (unused ${unusedRuns} runs)` });
  }
  return { removed: stale.map((s) => s.name), kept: registry.skills.filter((s) => !stale.includes(s)).map((s) => s.name), threshold: unusedRuns };
}

export function dismissProposal(root: string, ref: string): void {
  if (!ref.trim()) throw usage('skill dismiss <ref>');
  appendJsonl(dismissedPath(root), { ref, at: nowIso() });
  record(root, { event: 'skill', client: detectClient(), model: detectModel(), detail: `dismiss ${ref}` });
}

// ─── suggest — signals, not opinions ────────────────────────────────────────

export interface Proposal {
  kind: 'create' | 'import' | 'knowledge';
  ref: string;
  why: string;
  source: string;
}

function hostSignals(root: string, project: ProjectSkill[]): Proposal[] {
  const out: Proposal[] = [];
  for (const s of loadScenarios(root)) {
    if (s.check.type !== 'http') continue;
    let key: string;
    try {
      key = new URL(s.check.url).hostname.replace(/^(www|api)\./, '').split('.')[0] ?? '';
    } catch {
      continue;
    }
    if (!key || key === 'localhost' || /^\d+$/.test(key) || project.some((p) => p.name.includes(key))) continue;
    if (!out.some((p) => p.ref.endsWith(key))) out.push({ kind: 'import', ref: `vibe skill search ${key}`, why: `scenario ${s.id} targets ${key}; no project skill covers it`, source: 'scenarios' });
  }
  return out;
}

function regressionSignals(root: string, project: ProjectSkill[]): Proposal[] {
  const bySource = new Map<string, number>();
  for (const r of listRegressions(root)) {
    const match = /source ([a-z0-9-]+):/.exec(r.then);
    if (match) bySource.set(match[1]!, (bySource.get(match[1]!) ?? 0) + 1);
  }
  const scenarios = loadScenarios(root);
  const out: Proposal[] = [];
  for (const [id, n] of bySource) {
    const scenario = scenarios.find((s) => s.id === id);
    if (n < 2 || !scenario || scenario.check.type === 'human' || project.some((p) => p.name === `${id}-guard`)) continue;
    out.push({ kind: 'create', ref: `vibe skill create ${id}-guard --from-scenario ${id}`, why: `${n} regressions trace to scenario ${id}`, source: 'regressions' });
  }
  return out;
}

function questionSignals(root: string): Proposal[] {
  const counts = new Map<string, number>();
  for (const e of readJsonl<{ type: string; question?: string }>(inboxPath(root))) {
    if (e.type !== 'question' || !e.question || e.question.startsWith('STUCK')) continue;
    counts.set(e.question, (counts.get(e.question) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([q, n]) => ({ kind: 'knowledge' as const, ref: `vibe knowledge add --title ${JSON.stringify(q.slice(0, 60))}`, why: `the same question was asked ${n} times — an answer in knowledge/ stops it`, source: 'inbox' }));
}

function handoffSignals(root: string, project: ProjectSkill[]): Proposal[] {
  if (readState(root).state !== 'DONE') return [];
  return loadScenarios(root)
    .filter((s) => s.irreversible && s.check.type !== 'human' && !project.some((p) => p.name === `run-${s.id}`))
    .map((s) => ({ kind: 'create' as const, ref: `vibe skill create run-${s.id} --from-scenario ${s.id}`, why: `handoff: ${s.id} is irreversible (${s.irreversible}) — the operator needs the procedure with its check`, source: 'state' }));
}

export function suggestSkills(root: string, all = false): Proposal[] {
  const project = readRegistry(root).skills;
  const dismissed = new Set(readJsonl<{ ref: string }>(dismissedPath(root)).map((d) => d.ref));
  const proposals = [...handoffSignals(root, project), ...regressionSignals(root, project), ...hostSignals(root, project), ...questionSignals(root)].filter((p) => !dismissed.has(p.ref));
  return all ? proposals : proposals.slice(0, MAX_PROPOSALS);
}

