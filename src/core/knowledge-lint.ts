import fs from 'node:fs';
import path from 'node:path';

const MAX_PAGES = 2000;
const LONG_LINES = 200;
/** Pages that are entry points or append-only, so nothing has to link to them. */
const ROOTS = new Set(['index', 'log']);

export interface WikiLint {
  dir: string;
  pages: number;
  broken: Array<{ page: string; target: string }>;
  orphans: string[];
  long: Array<{ page: string; lines: number }>;
  partial: boolean;
}

/**
 * The wiki's pages, and the pages of each project's shared knowledge it shows through a folder link
 * (`projects/<name>/`). Those are kept in the project, so they resolve links but are never called orphans.
 */
function pages(dir: string): { files: string[]; shared: Set<string>; partial: boolean } {
  const files: string[] = [];
  const shared = new Set<string>();
  const seen = new Set<string>();
  let partial = false;
  const walk = (current: string, linked: boolean): void => {
    if (seen.has(fs.realpathSync(current))) return;
    seen.add(fs.realpathSync(current));
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (files.length >= MAX_PAGES) { partial = true; return; }
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file, linked);
      else if (entry.isSymbolicLink() && fs.statSync(file, { throwIfNoEntry: false })?.isDirectory()) walk(file, true);
      else if (entry.isFile() && entry.name.endsWith('.md')) { files.push(file); if (linked) shared.add(file); }
    }
  };
  if (fs.existsSync(dir)) walk(dir, false);
  return { files: files.sort(), shared, partial };
}

/** `[[target]]`, `[[target|label]]` and `[[target#heading]]` give `target`; links inside code are still counted. */
export function wikiLinks(text: string): string[] {
  return [...text.matchAll(/\[\[([^\]|#\n]+)(?:[#|][^\]\n]*)?\]\]/g)].map(m => m[1]!.trim()).filter(Boolean);
}

/**
 * Broken links, pages nothing links to and pages too long to read in one pass. A link resolves the way
 * Obsidian resolves it: by the path from the wiki root or by the page's file name alone.
 */
export function lintWiki(dir: string): WikiLint {
  const { files, shared, partial } = pages(dir);
  const name = (file: string): string => path.relative(dir, file).split(path.sep).join('/').replace(/\.md$/, '');
  const known = new Map<string, string>();
  for (const file of files) {
    known.set(name(file).toLowerCase(), name(file));
    known.set(path.basename(file, '.md').toLowerCase(), name(file));
  }
  const broken: WikiLint['broken'] = [];
  const long: WikiLint['long'] = [];
  const linked = new Set<string>();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n').length;
    if (lines > LONG_LINES) long.push({ page: name(file), lines });
    for (const target of wikiLinks(text)) {
      const page = known.get(target.replace(/\.md$/, '').toLowerCase());
      if (page === undefined) broken.push({ page: name(file), target });
      else if (page !== name(file)) linked.add(page);
    }
  }
  const orphans = files.filter(file => !shared.has(file)).map(name).filter(page => !linked.has(page) && !ROOTS.has(page));
  return { dir, pages: files.length, broken, orphans, long, partial };
}
