import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { usage } from './errors.js';
import { intentPath, loadScenarios } from './intent.js';
import { globalKnowledgeDir, knowledgeDir } from './knowledge.js';
import { readLedger, type LedgerEvent } from './ledger.js';
import { vibePath, relPosix } from './paths.js';
import { resolveImports } from './map/imports.js';
import { buildMap } from './map/index.js';
import { listRegressions } from './regress.js';
import type { Check, Scenario } from './scenarios.js';
import { readJson, readText } from './store.js';
import { readResults } from './check.js';
import { failureLine, type FailureSummary } from './failure.js';

/**
 * `vibe context` — what a scenario needs, assembled once instead of rediscovered every session:
 * the files and symbols its check touches, the ledger's memory of them, the notes that match, the
 * project's conventions, and the check itself. Capped so it fits a prompt; most relevant first.
 */
const CAP = 12_000;
const SKIP_DIRS = new Set(['.git', 'node_modules', '.vibe', 'dist', 'build', 'out', 'coverage', '.claude', '.codex']);
const MAX_DIR_FILES = 30;
const STOP_TERMS = new Set(['then', 'with', 'that', 'this', 'from', 'into', 'have', 'will', 'only', 'when', 'also', 'every', 'which', 'their', 'there', 'these', 'those', 'should', 'would', 'could', 'about', 'being', 'after', 'before']);

export interface MapSymbol {
  name: string;
  kind: string;
  signature: string;
  start: number;
  end: number;
  exported?: boolean;
}
interface MapFileEntry {
  hash: string;
  symbols: MapSymbol[];
  imports: string[];
}
interface MapCache {
  files: Record<string, MapFileEntry>;
}

export interface ContextFile {
  path: string;
  neighbour: boolean;
  symbols: MapSymbol[];
}
export interface ContextEvent {
  at: string;
  event: LedgerEvent['event'];
  detail: string | null;
  tail: string | null;
  source: string;
}
export interface ContextNote {
  title: string;
  source: string;
  excerpt: string;
}
export interface ContextBundle {
  scenarioId: string;
  then: string;
  check: Check;
  checkSource: string;
  files: ContextFile[];
  events: ContextEvent[];
  notes: ContextNote[];
  conventions: { source: string; text: string } | null;
  globalNotes: ContextNote[];
}

export interface ContextOptions {
  home?: string;
}

function findScenario(root: string, id: string): Scenario {
  const found = [...loadScenarios(root), ...listRegressions(root)].find((s) => s.id === id);
  if (!found) throw usage(`unknown scenario: ${id}`);
  return found;
}

function readMapCache(root: string): MapCache | null {
  return readJson<MapCache>(vibePath(root, 'cache', 'map.json'));
}

function walkDir(dir: string, root: string, into: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (into.length >= MAX_DIR_FILES) return;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, root, into);
    else if (entry.isFile()) into.push(relPosix(root, full));
  }
}

/** `check.path` (file or directory) plus the file-looking tokens in a `run` check's `cmd`. */
function touchedPaths(check: Check, root: string): string[] {
  const out: string[] = [];
  if ('path' in check && check.path) {
    const full = path.resolve(root, check.path);
    if (fs.existsSync(full)) {
      if (fs.statSync(full).isDirectory()) walkDir(full, root, out);
      else out.push(relPosix(root, full));
    }
  }
  if (check.type === 'run') {
    for (const token of check.cmd.split(/\s+/)) {
      if (!/[./]/.test(token)) continue;
      const full = path.resolve(root, token);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) out.push(relPosix(root, full));
    }
  }
  return [...new Set(out)];
}

/** One hop: files a touched file imports, and files that import a touched file. */
function neighboursOf(cache: MapCache, touched: string[]): string[] {
  const set = new Set<string>();
  for (const t of touched) for (const imp of cache.files[t]?.imports ?? []) set.add(imp);
  for (const [file, entry] of Object.entries(cache.files)) if (entry.imports.some((imp) => touched.includes(imp))) set.add(file);
  for (const t of touched) set.delete(t);
  return [...set];
}

function buildFiles(root: string, touched: string[]): ContextFile[] {
  const cache = readMapCache(root);
  const files: ContextFile[] = touched.map((p) => ({ path: p, neighbour: false, symbols: cache?.files[p]?.symbols ?? [] }));
  if (!cache) return files;
  for (const n of neighboursOf(cache, touched)) files.push({ path: n, neighbour: true, symbols: cache.files[n]?.symbols ?? [] });
  return files;
}

function nodeMatches(node: string, scenarioId: string, files: string[]): boolean {
  return node === `scenario:${scenarioId}` || files.some((f) => node === `file:${f}`);
}

function evidenceTail(root: string, run: string | undefined, scenarioId: string): string | null {
  if (!run) return null;
  const evidence = readJson<{ schemaVersion?: number; results?: Array<{ id: string; failureCode?: string; exit?: number; failure?: FailureSummary }> }>(vibePath(root, 'evidence', `${run}.json`));
  const result = evidence?.results?.find((r) => r.id === scenarioId);
  if (!result) return null;
  if (evidence?.schemaVersion !== 2) return `legacy evidence ${run}#${scenarioId}; raw output hidden`;
  const summary = result.failure ? `Untrusted failure summary: ${failureLine(result.failure)}` : `${result.failureCode ?? 'check-result'}; exit=${result.exit ?? 'none'}`;
  return `${summary}; evidence=${run}#${scenarioId}`;
}

const RELEVANT_TYPES = new Set<LedgerEvent['event']>(['approve', 'regress', 'check']);

/** Decisions, regressions and this scenario's own check failures — newest first, usage excluded. */
function relevantEvents(root: string, scenarioId: string, files: string[]): ContextEvent[] {
  const out: ContextEvent[] = [];
  for (const e of readLedger(root)) {
    if (!RELEVANT_TYPES.has(e.event)) continue;
    const detailHit = e.detail !== undefined && (e.detail.includes(scenarioId) || files.some((f) => e.detail!.includes(f)));
    const edgeHit = (e.edges ?? []).some((edge) => nodeMatches(edge.from, scenarioId, files) || nodeMatches(edge.to, scenarioId, files));
    const scenarioHit = e.event === 'check' && e.scenarios !== undefined && Object.hasOwn(e.scenarios, scenarioId);
    if (!detailHit && !edgeHit && !scenarioHit) continue;
    if (e.event === 'check' && e.scenarios?.[scenarioId] !== 'fail') continue;
    const tail = e.event === 'check' ? evidenceTail(root, e.run, scenarioId) : null;
    const source = `ledger:${e.event}${e.run ? ` ${e.run}` : ` ${e.at}`}`;
    out.push({ at: e.at, event: e.event, detail: e.detail ?? null, tail, source });
  }
  return out.reverse();
}

function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/`([^`]+)`/g)) out.add(m[1]!.toLowerCase());
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) ?? []) if (!STOP_TERMS.has(w)) out.add(w);
  return out;
}

interface RawNote {
  title: string;
  file: string;
  matchText: string;
  body: string;
}

function readNotesDir(dir: string): RawNote[] {
  if (!fs.existsSync(dir)) return [];
  const out: RawNote[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.md') || name === 'conventions.md') continue;
    const text = readText(path.join(dir, name));
    if (text === null) continue;
    const nonBlank = text.split('\n').filter((l) => l.trim());
    const title = (nonBlank[0] ?? '').replace(/^#+\s*/, '').trim() || name;
    out.push({ title, file: path.join(dir, name), matchText: `${title} ${nonBlank[1] ?? ''}`, body: text });
  }
  return out;
}

function matchingNotes(notes: RawNote[], terms: Set<string>, sourceOf: (file: string) => string): ContextNote[] {
  return notes
    .filter((n) => [...tokenize(n.matchText)].some((t) => terms.has(t)))
    .map((n) => ({ title: n.title, source: sourceOf(n.file), excerpt: n.body.trim().slice(0, 500) }));
}

/** Ordered by priority for `renderContext`: check, files/symbols, conventions, events, notes, global notes. */
/**
 * The files a scenario is about: what its check touches, plus one hop of imports either way from the
 * codebase map (built here when absent or stale — the cache makes that cheap). `vibe state` hands this
 * over so the model reads these and opens nothing else until a check fails.
 */
export function filesFor(root: string, check: Check, limit = 8): string[] {
  // build output, dependencies and the harness's own records are never "the files a scenario is about" —
  // a check that runs `node dist/cli.js …` is about the sources, not the bundle it executes
  const touched = touchedPaths(check, root).filter((p) => !p.split('/').some((seg) => SKIP_DIRS.has(seg)));
  if (touched.length === 0) return [];
  try {
    buildMap(root);
  } catch {
    /* no map — the touched files alone */
  }
  const out = buildFiles(root, touched).map((f) => f.path);
  // a touched file outside the map (a test the size walk excludes, a script) still names what it imports
  const known = new Set(Object.keys(readMapCache(root)?.files ?? {}));
  for (const t of touched) {
    if (known.has(t)) continue;
    const full = path.join(root, t);
    let text = '';
    try {
      text = fs.readFileSync(full, 'utf-8');
    } catch {
      continue;
    }
    for (const imp of resolveImports(root, t, text, known)) if (!out.includes(imp)) out.push(imp);
  }
  return out.slice(0, limit);
}

export function buildContext(root: string, scenarioId: string, options: ContextOptions = {}): ContextBundle {
  const scenario = findScenario(root, scenarioId);
  const home = options.home ?? process.env['VIBE_HOME_DIR'] ?? os.homedir();
  const failure = readResults(root)[scenarioId]?.failure;
  const touched = [...new Set([...(failure?.locations.map(location => location.file) ?? []), ...touchedPaths(scenario.check, root)])];
  const files = buildFiles(root, touched);
  const events = relevantEvents(root, scenarioId, touched);
  const fileTerms = touched.map((f) => path.basename(f, path.extname(f)).toLowerCase());
  const terms = tokenize(`${scenario.then} ${scenario.id} ${fileTerms.join(' ')}`);
  const notes = matchingNotes(readNotesDir(knowledgeDir(root)), terms, (file) => relPosix(root, file));
  const globalNotes = matchingNotes(readNotesDir(globalKnowledgeDir(home)), terms, (file) => `~/${relPosix(home, file)}`);
  const conventionsFile = vibePath(root, 'knowledge', 'conventions.md');
  const conventionsText = readText(conventionsFile);
  const conventions = conventionsText === null ? null : { source: relPosix(root, conventionsFile), text: conventionsText };
  return { scenarioId, then: scenario.then, check: scenario.check, checkSource: `.vibe/scenarios.yaml#${scenarioId}`, files, events, notes, conventions, globalNotes };
}

function checkDetail(check: Check): string {
  switch (check.type) {
    case 'run':
      return `cmd: ${check.cmd}`;
    case 'file':
      return `path: ${check.path}`;
    case 'review':
      return `path: ${check.path}`;
    case 'http':
      return `url: ${check.url}`;
    case 'eval':
      return `cases: ${check.cases} · runner: ${check.runner}`;
    case 'human':
      return `question: ${check.question}`;
  }
}

function renderFile(f: ContextFile): string {
  const head = `## file ${f.path}${f.neighbour ? ' (neighbour)' : ''}\nsource: ${f.path}`;
  const symbols = f.symbols.map((s) => `  - ${s.name} (${s.kind}) ${s.signature} @${s.start}-${s.end}`);
  return [head, ...symbols].join('\n');
}

function renderEvent(e: ContextEvent): string {
  const lines = [`## event ${e.event} ${e.at}`, `source: ${e.source}`];
  if (e.detail) lines.push(e.detail);
  if (e.tail) lines.push(e.tail);
  return lines.join('\n');
}

function renderNote(label: string, n: ContextNote): string {
  return `## ${label} ${n.title}\nsource: ${n.source}\n${n.excerpt}`;
}

/** Sections in priority order, then a hard cap — lower-priority sections are what falls off the end. */
export function renderContext(bundle: ContextBundle): string {
  const sections: string[] = [
    `## check ${bundle.scenarioId} [${bundle.check.type}]\nsource: ${bundle.checkSource}\n${bundle.then}\n${checkDetail(bundle.check)}`,
    ...bundle.files.map(renderFile),
    ...(bundle.conventions ? [`## conventions\nsource: ${bundle.conventions.source}\n${bundle.conventions.text.trim()}`] : []),
    ...bundle.events.map(renderEvent),
    ...bundle.notes.map((n) => renderNote('note', n)),
    ...bundle.globalNotes.map((n) => renderNote('global note', n)),
  ];
  return sections.join('\n\n').slice(0, CAP);
}
