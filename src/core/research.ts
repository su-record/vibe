import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { detectClient, detectModel } from './client.js';
import { readConfig } from './config.js';
import { usage } from './errors.js';
import { githubClient, type GithubClient } from './github.js';
import { intentPath, loadScenarios } from './intent.js';
import { record } from './ledger.js';
import { vibePath } from './paths.js';
import { readJson, readText, writeAtomic, writeJson, nowIso } from './store.js';

/**
 * Research — before building, see what exists: repositories that solved the problem, official
 * SDK examples, verified skills. The harness searches and ranks; the model reads the note; a
 * person decides. Nothing fetched is executed or installed here.
 */
export type Source = 'repos' | 'code' | 'skills';
export const SOURCES: readonly Source[] = ['repos', 'code', 'skills'];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX = 5;
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'vibe', 'phase', 'into', 'from', 'on', 'by', 'is', 'it']);

export interface Candidate {
  kind: 'repo' | 'skill';
  ref: string;
  url: string;
  why: string;
  stars: number | null;
  updatedAt: string | null;
  license: string | null;
  action: string;
  score: number;
}

export interface ResearchOptions {
  query?: string;
  fromIntent?: boolean;
  sources?: Source[];
  max?: number;
}

export interface ResearchResult {
  queries: string[];
  sources: Source[];
  candidates: Candidate[];
  file: string | null;
  cached: boolean;
  authenticated: boolean;
}

interface RepoItem {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  pushed_at?: string;
  license?: { spdx_id?: string | null } | null;
}
interface CodeItem {
  path?: string;
  repository?: RepoItem;
}
interface TreeEntry {
  path?: string;
  type?: string;
}

function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)))];
}

/** Queries come from the intent title, the hosts its http checks target, and the stack. */
export function queriesFromIntent(root: string): string[] {
  const queries: string[] = [];
  const heading = (readText(intentPath(root)) ?? '').split('\n').find((l) => l.startsWith('#')) ?? '';
  const title = tokens(heading.replace(/^#+/, '')).slice(0, 4).join(' ');
  if (title) queries.push(title);
  for (const s of loadScenarios(root)) {
    if (s.check.type !== 'http') continue;
    try {
      const host = new URL(s.check.url).hostname.replace(/^(www|api)\./, '').split('.')[0];
      if (host && !queries.includes(`${host} sdk`)) queries.push(`${host} sdk`);
    } catch {
      /* not a URL — nothing to ask */
    }
  }
  const pkg = readJson<{ dependencies?: Record<string, string> }>(path.join(root, 'package.json'));
  const deps = Object.keys(pkg?.dependencies ?? {}).filter((d) => !d.startsWith('@types/')).slice(0, 2);
  if (deps.length > 0 && title) queries.push(`${deps.join(' ')} ${title.split(' ')[0]}`);
  return queries.slice(0, 3);
}

function score(text: string, queryTokens: string[], stars: number | null, updatedAt: string | null, license: string | null): { score: number; matched: string[] } {
  const haystack = text.toLowerCase();
  const matched = queryTokens.filter((t) => haystack.includes(t));
  let total = matched.length * 3;
  if (updatedAt) {
    const age = Date.now() - new Date(updatedAt).getTime();
    total += age < 180 * 86_400_000 ? 2 : age < 365 * 86_400_000 ? 1 : 0;
  }
  if (stars) total += Math.min(Math.log10(stars), 4);
  if (license && license !== 'NOASSERTION') total += 1;
  return { score: total, matched };
}

function why(matched: string[], updatedAt: string | null, stars: number | null, license: string | null): string {
  const parts = [matched.length ? `matches "${matched.join(', ')}"` : 'no keyword match'];
  if (updatedAt) parts.push(`updated ${updatedAt.slice(0, 7)}`);
  if (stars !== null) parts.push(`${stars} stars`);
  parts.push(license ? license : 'no license');
  return parts.join(' · ');
}

function fromRepo(item: RepoItem, queryTokens: string[]): Candidate | null {
  if (!item.full_name || !item.html_url) return null;
  const stars = item.stargazers_count ?? null;
  const updatedAt = item.pushed_at ?? null;
  const license = item.license?.spdx_id ?? null;
  const s = score(`${item.full_name} ${item.description ?? ''}`, queryTokens, stars, updatedAt, license);
  const action = license ? `knowledge: save a reference note on ${item.full_name}` : 'none — license unknown';
  return { kind: 'repo', ref: item.full_name, url: item.html_url, why: why(s.matched, updatedAt, stars, license), stars, updatedAt, license, action, score: s.score };
}

function fromCode(item: CodeItem, queryTokens: string[]): Candidate | null {
  const repo = item.repository;
  if (!repo?.full_name || !item.path) return null;
  const dir = path.posix.dirname(item.path);
  const name = dir === '.' ? '' : path.posix.basename(dir);
  const ref = name ? `${repo.full_name}@${name}` : repo.full_name;
  const s = score(`${repo.full_name} ${item.path} ${repo.description ?? ''}`, queryTokens, null, repo.pushed_at ?? null, repo.license?.spdx_id ?? null);
  return { kind: 'skill', ref, url: `${repo.html_url ?? `https://github.com/${repo.full_name}`}/tree/HEAD/${dir === '.' ? '' : dir}`, why: why(s.matched, repo.pushed_at ?? null, null, repo.license?.spdx_id ?? null), stars: null, updatedAt: repo.pushed_at ?? null, license: repo.license?.spdx_id ?? null, action: `vibe skill add ${ref}`, score: s.score };
}

/** One tree request per catalog; a skill is any directory holding SKILL.md, at any depth under `skills/` or the root. */
export function skillDirsInTree(entries: TreeEntry[]): Array<{ name: string; dir: string }> {
  const out: Array<{ name: string; dir: string }> = [];
  for (const e of entries) {
    if (e.type !== 'blob' || !e.path || path.posix.basename(e.path) !== 'SKILL.md') continue;
    const dir = path.posix.dirname(e.path);
    if (dir === '.' || dir.includes('node_modules') || dir.includes('/tests/')) continue;
    out.push({ name: dir.startsWith('skills/') ? dir.slice('skills/'.length) : dir, dir });
  }
  return out;
}

async function catalogCandidates(client: GithubClient, catalog: string, queryTokens: string[]): Promise<Candidate[]> {
  let entries: TreeEntry[] = [];
  try {
    const tree = (await client.get(`/repos/${catalog}/git/trees/HEAD?recursive=1`)) as { tree?: TreeEntry[] };
    entries = tree.tree ?? [];
  } catch {
    return [];
  }
  const out: Candidate[] = [];
  for (const { name, dir } of skillDirsInTree(entries)) {
    const leaf = path.posix.basename(name);
    const matched = queryTokens.filter((t) => name.toLowerCase().includes(t) || (t.length > 3 && leaf.includes(t.slice(0, 4))));
    if (matched.length === 0) continue;
    out.push({ kind: 'skill', ref: `${catalog}@${name}`, url: `https://github.com/${catalog}/tree/HEAD/${dir}`, why: `catalog ${catalog} · matches "${matched.join(', ')}"`, stars: null, updatedAt: null, license: null, action: `vibe skill add ${catalog}@${name}`, score: matched.length * 3 + 2 });
  }
  return out;
}

async function search(client: GithubClient, queries: string[], sources: Source[], catalogs: string[]): Promise<Candidate[]> {
  const found: Candidate[] = [];
  const queryTokens = tokens(queries.join(' '));
  for (const q of queries) {
    if (sources.includes('repos')) {
      const res = (await client.get(`/search/repositories?q=${encodeURIComponent(q)}&sort=updated&per_page=5`)) as { items?: RepoItem[] };
      for (const item of res.items ?? []) {
        const c = fromRepo(item, queryTokens);
        if (c) found.push(c);
      }
    }
    if (sources.includes('code') && client.authenticated) {
      const res = (await client.get(`/search/code?q=${encodeURIComponent(`${q} filename:SKILL.md`)}&per_page=5`)) as { items?: CodeItem[] };
      for (const item of res.items ?? []) {
        const c = fromCode(item, queryTokens);
        if (c) found.push(c);
      }
    }
  }
  if (sources.includes('skills')) for (const catalog of catalogs) found.push(...(await catalogCandidates(client, catalog, queryTokens)));
  const byRef = new Map<string, Candidate>();
  // A candidate none of the query words describe is noise, whatever search returned it.
  for (const c of found) if (!c.why.startsWith('no keyword match') && (!byRef.has(c.ref) || byRef.get(c.ref)!.score < c.score)) byRef.set(c.ref, c);
  return [...byRef.values()].sort((a, b) => b.score - a.score);
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'research';
}

function writeNote(root: string, queries: string[], candidates: Candidate[]): string {
  const file = vibePath(root, 'knowledge', 'research', `${nowIso().slice(0, 10)}-${slug(queries[0] ?? '')}.md`);
  const rows = candidates.map((c) => `| ${c.kind} | [${c.ref}](${c.url}) | ${c.why} | ${c.action} |`);
  const body = [`# Research — ${queries.join(' · ')}`, '', `Date: ${nowIso().slice(0, 10)} · Source: GitHub search and skill catalogs · Ranked by keyword match, recency, stars, license. Nothing here was executed or installed.`, '', '| kind | candidate | why | action |', '|---|---|---|---|', ...rows, ''].join('\n');
  writeAtomic(file, body);
  return file;
}

export async function research(root: string, options: ResearchOptions, client: GithubClient = githubClient()): Promise<ResearchResult> {
  const queries = options.fromIntent ? queriesFromIntent(root) : options.query ? [options.query] : [];
  if (queries.length === 0) throw usage(options.fromIntent ? 'no intent to research — draft one first' : 'research --from-intent | "query"');
  const sources = options.sources ?? [...SOURCES];
  const max = options.max ?? DEFAULT_MAX;
  const catalogs = readConfig(root).catalogs;
  const key = createHash('sha256').update(JSON.stringify([queries, sources, catalogs])).digest('hex').slice(0, 16);
  const cacheFile = vibePath(root, 'cache', 'research', `${key}.json`);
  const cached = readJson<{ at: string; candidates: Candidate[] }>(cacheFile);
  let candidates: Candidate[];
  let fromCache = false;
  if (cached && Date.now() - new Date(cached.at).getTime() < CACHE_TTL_MS) {
    candidates = cached.candidates;
    fromCache = true;
  } else {
    try {
      candidates = await search(client, queries, sources, catalogs);
      writeJson(cacheFile, { at: nowIso(), queries, candidates });
    } catch (error) {
      if (!cached) throw error;
      candidates = cached.candidates;
      fromCache = true;
    }
  }
  candidates = candidates.slice(0, max);
  const file = fromCache && fs.existsSync(cacheFile) ? null : writeNote(root, queries, candidates);
  if (!fromCache) record(root, { event: 'research', client: detectClient(), model: detectModel(), detail: queries.join(' · ') });
  return { queries, sources, candidates, file, cached: fromCache, authenticated: client.authenticated };
}
