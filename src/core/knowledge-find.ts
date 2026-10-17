import fs from 'node:fs';
import path from 'node:path';
import { wikiLinks, wikiPages } from './knowledge-lint.js';

/** A page's Obsidian properties (the `---` block at its top) and the text after them. */
export function properties(text: string): { props: Record<string, string | string[]>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { props: {}, body: text };
  const props: Record<string, string | string[]> = {};
  let list: string[] | null = null;
  const unquote = (value: string): string => value.trim().replace(/^(['"])(.*)\1$/, '$2');
  for (const line of match[1]!.split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && list) { list.push(unquote(item[1]!)); continue; }
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const value = pair[2]!.trim();
    if (value === '') props[pair[1]!] = list = [];
    else { list = null; props[pair[1]!] = /^\[.*\]$/.test(value) ? value.slice(1, -1).split(',').map(unquote).filter(Boolean) : unquote(value); }
  }
  return { props, body: text.slice(match[0].length) };
}

export { TYPES as PAGE_TYPES } from './knowledge-lint.js';

export interface FoundPage {
  /** The `[[link]]` target inside the wiki, or null for a project page the wiki does not show. */
  page: string | null;
  file: string;
  title: string;
  summary: string;
  tags: string[];
  type: string | null;
  /** `archived` (status property) and `superseded` (another page's `supersedes` names it) rank lower and say so. */
  state: 'current' | 'archived' | 'superseded';
  supersededBy: string | null;
  score: number;
}

const STOP = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'by', 'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'with']);

/** Words of a query; a Latin word matches the start of a word, so `release` finds `releases`; other scripts match anywhere, so `배포` finds `배포를`. */
export function queryTerms(query: string): string[] {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w && !STOP.has(w) && (w.length > 1 || /[^\x00-\x7f]/.test(w)));
  return [...new Set(words)];
}

function hits(text: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = /^[\x00-\x7f]+$/.test(term) ? new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, 'gu') : new RegExp(escaped, 'gu');
  return text.toLowerCase().match(pattern)?.length ?? 0;
}

const list = (value: string | string[] | undefined): string[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

interface Described {
  title: string; names: string; tags: string[]; summary: string; headings: string; body: string;
  type: string | null; archived: boolean; supersedes: string[];
}

/** What a page says about itself: title, other names, tags, summary, headings, body, type, status and what it replaces. */
export function describePage(file: string): Described {
  const { props, body } = properties(fs.readFileSync(file, 'utf8'));
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  const title = (typeof props['title'] === 'string' && props['title']) || heading || path.basename(file, '.md');
  const first = body.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#')) ?? '';
  const stated = props['summary'] ?? props['description'];
  const summary = (typeof stated === 'string' && stated) || first.replace(/^[-*]\s+/, '');
  const names = [title, path.basename(file, '.md').replace(/[-_]+/g, ' '), ...list(props['aliases'])].join('\n');
  const headings = body.split('\n').filter(line => /^#{2,6}\s/.test(line)).join('\n');
  const type = typeof props['type'] === 'string' ? props['type'].toLowerCase() : null;
  return { title, names, tags: list(props['tags']), summary: summary.length > 160 ? `${summary.slice(0, 157)}...` : summary, headings, body,
    type, archived: props['status'] === 'archived', supersedes: list(props['supersedes']).flatMap(value => wikiLinks(value).length ? wikiLinks(value) : [value]) };
}

/**
 * Score one page: a term in the title or another name of the page counts most, then tags, summary, headings
 * and at most three body mentions; pages matching more of the terms rank above pages repeating one.
 */
function score(page: Described, terms: string[]): number {
  let total = 0, matched = 0;
  for (const term of terms) {
    const value = (hits(page.names, term) ? 6 : 0) + (page.tags.some(tag => hits(tag, term)) ? 4 : 0)
      + (hits(page.summary, term) ? 3 : 0) + (hits(page.headings, term) ? 2 : 0) + Math.min(hits(page.body, term), 3);
    if (value) { total += value; matched++; }
  }
  return terms.length ? Math.round(total * matched / terms.length * 10) / 10 : 0;
}

interface Candidate { page: string | null; file: string; described: Described }

/** Every page once: the wiki with the project folders it shows, then `extra` folders it does not already reach. */
function candidates(wiki: string, extra: string[]): { pages: Candidate[]; partial: boolean } {
  const seen = new Set<string>();
  const pages: Candidate[] = [];
  let partial = false;
  for (const [base, inWiki] of [[wiki, true], ...extra.map(folder => [folder, false] as const)] as const) {
    const walked = wikiPages(base);
    partial ||= walked.partial;
    for (const file of walked.files) {
      const real = fs.realpathSync(file);
      if (seen.has(real)) continue;
      seen.add(real);
      pages.push({ page: inWiki ? path.relative(base, file).split(path.sep).join('/').replace(/\.md$/, '') : null, file, described: describePage(file) });
    }
  }
  return { pages, partial };
}

/** Which page replaces which: a `supersedes` link resolves by path or by file name, as Obsidian resolves links. */
function replacements(pages: Candidate[]): Map<string, string> {
  const byName = new Map<string, Candidate>();
  for (const c of pages) {
    const name = c.page ?? path.basename(c.file, '.md');
    byName.set(name.toLowerCase(), c);
    byName.set(path.basename(c.file, '.md').toLowerCase(), c);
  }
  const replaced = new Map<string, string>();
  for (const c of pages) {
    for (const target of c.described.supersedes) {
      const old = byName.get(target.replace(/\.md$/, '').toLowerCase());
      if (old && old !== c) replaced.set(old.file, c.page ?? c.file);
    }
  }
  return replaced;
}

/**
 * Find the pages a query is about, in the wiki (with the project folders it shows) and in `extra` folders such
 * as the current project's shared knowledge. No model and no index: every page is read, so the answer is current.
 * Archived and superseded pages keep a third of their score, so current knowledge comes first.
 */
export function findKnowledge(wiki: string, query: string, extra: string[] = [], limit = 8, type?: string): { query: string; terms: string[]; found: FoundPage[]; partial: boolean } {
  const terms = queryTerms(query);
  const { pages, partial } = candidates(wiki, extra);
  const replaced = replacements(pages);
  const found: FoundPage[] = [];
  for (const { page, file, described: d } of pages) {
    if (type && d.type !== type) continue;
    const supersededBy = replaced.get(file) ?? null;
    const state = supersededBy ? 'superseded' : d.archived ? 'archived' : 'current';
    const value = score(d, terms) * (state === 'current' ? 1 : 1 / 3);
    if (value > 0) found.push({ page, file, title: d.title, summary: d.summary, tags: d.tags, type: d.type, state, supersededBy, score: Math.round(value * 10) / 10 });
  }
  found.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
  return { query, terms, found: found.slice(0, limit), partial };
}
