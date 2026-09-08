import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { vibePath, relPosix } from '../paths.js';
import { DEFAULT_EXCLUDE, SOURCE, walk } from '../size.js';
import { ensureDir, readJson, writeJson } from '../store.js';
import { resolveImports } from './imports.js';
import { symbolsOfFile, type SymbolInfo } from './symbols.js';

export type { SymbolInfo } from './symbols.js';

/**
 * The map: directories → files → symbols and the import edges between them, cached by content
 * hash so a warm build only re-reads what changed. `callersOf` and `blast` walk the import graph
 * outward from a symbol's defining file(s); the confidence a caller carries is never hidden.
 */
export interface FileMap {
  path: string;
  hash: string;
  symbols: SymbolInfo[];
  imports: string[];
}
export interface CodeMap {
  files: Record<string, FileMap>;
}
export interface BuildResult {
  map: CodeMap;
  refreshed: string[];
}
export interface CallerInfo {
  file: string;
  confidence: 'import' | 'name';
}
export interface ChangedSymbol {
  file: string;
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
}
export interface BlastResult {
  changed: ChangedSymbol[];
  callers: Array<{ file: string; confidence: 'import' | 'name'; symbol: string }>;
}

function hashOf(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function cachePath(root: string): string {
  return vibePath(root, 'cache', 'map.json');
}

function discoverFiles(root: string, target: string): string[] {
  const full = path.resolve(root, target);
  if (!fs.existsSync(full)) return [];
  if (!fs.statSync(full).isDirectory()) return SOURCE.test(full) ? [full] : [];
  const out: string[] = [];
  walk(full, DEFAULT_EXCLUDE, out);
  return out;
}

/** Refreshes only files whose content hash changed since the last build; `.vibe/cache/map.json` keeps the rest. */
export function buildMap(root: string, target = '.'): BuildResult {
  const cached = readJson<CodeMap>(cachePath(root)) ?? { files: {} };
  const files = discoverFiles(root, target);
  const known = new Set(files.map((f) => relPosix(root, f)));
  const nextFiles: Record<string, FileMap> = { ...cached.files };
  const targetRel = target === '.' ? '' : relPosix(root, path.resolve(root, target));
  for (const rel of Object.keys(nextFiles)) {
    if ((targetRel === '' || rel === targetRel || rel.startsWith(`${targetRel}/`)) && !known.has(rel)) delete nextFiles[rel];
  }
  const refreshed: string[] = [];
  for (const full of files) {
    const rel = relPosix(root, full);
    const text = fs.readFileSync(full, 'utf-8');
    const hash = hashOf(text);
    if (cached.files[rel]?.hash === hash) continue;
    nextFiles[rel] = { path: rel, hash, symbols: symbolsOfFile(full, text), imports: resolveImports(root, full, text, known) };
    refreshed.push(rel);
  }
  const map: CodeMap = { files: nextFiles };
  ensureDir(path.dirname(cachePath(root)));
  writeJson(cachePath(root), map);
  return { map, refreshed };
}

export function symbolsOf(root: string, file: string): SymbolInfo[] {
  const full = path.resolve(root, file);
  return symbolsOfFile(full, fs.readFileSync(full, 'utf-8'));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function callPattern(name: string): RegExp {
  const escaped = escapeRegExp(name);
  return new RegExp(`(?:^|[^\\w.])${escaped}\\s*\\(|\\.${escaped}\\s*\\(`);
}

function reverseImportersOf(map: CodeMap, target: string): string[] {
  return Object.keys(map.files).filter((f) => map.files[f]!.imports.includes(target));
}

/** A caller is a file that imports the symbol's module and calls it (`import`), or calls it by name with no import edge (`name`); depth widens the search through the callers' own callers. */
export function callersOf(root: string, symbol: string, depth = 2): CallerInfo[] {
  const { map } = buildMap(root, '.');
  const definers = Object.keys(map.files).filter((f) => map.files[f]!.symbols.some((s) => s.name === symbol));
  if (definers.length === 0) return [];
  const pattern = callPattern(symbol);
  const results = new Map<string, 'import' | 'name'>();
  const visited = new Set(definers);
  let frontier = definers;
  for (let level = 1; level <= depth && frontier.length; level += 1) {
    const next: string[] = [];
    for (const target of frontier) {
      for (const caller of reverseImportersOf(map, target)) {
        if (visited.has(caller)) continue;
        visited.add(caller);
        const calls = pattern.test(fs.readFileSync(path.resolve(root, caller), 'utf-8'));
        if (level > 1 || calls) results.set(caller, 'import');
        next.push(caller);
      }
    }
    frontier = next;
  }
  for (const file of Object.keys(map.files)) {
    if (visited.has(file) || definers.includes(file)) continue;
    if (pattern.test(fs.readFileSync(path.resolve(root, file), 'utf-8'))) results.set(file, 'name');
  }
  return [...results.entries()].map(([file, confidence]) => ({ file, confidence })).sort((a, b) => a.file.localeCompare(b.file));
}

interface Hunk {
  file: string;
  ranges: Array<[number, number]>;
}

/** `@@ -a,b +c,d @@` hunk headers against the working tree, one entry per touched file with its added/changed line ranges in the new file. */
function gitDiffHunks(root: string, target: string): Hunk[] {
  const r = spawnSync('git', ['-C', root, 'diff', '--unified=0', '--relative', '--', target], { encoding: 'utf-8' });
  const files: Hunk[] = [];
  let current: Hunk | null = null;
  for (const line of (r.stdout ?? '').split('\n')) {
    const fileMatch = /^\+\+\+ b\/(.+)$/.exec(line);
    if (fileMatch) {
      current = { file: fileMatch[1]!, ranges: [] };
      files.push(current);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const count = hunk[2] !== undefined ? Number(hunk[2]) : 1;
      if (count > 0) current.ranges.push([Number(hunk[1]), Number(hunk[1]) + count - 1]);
    }
  }
  return files;
}

/** The working tree's changed symbols, from `git diff` hunks mapped onto symbol line ranges, and their callers to `depth`. */
export function blast(root: string, depth = 2, target = '.'): BlastResult {
  const changed: ChangedSymbol[] = [];
  for (const hunk of gitDiffHunks(root, target)) {
    const full = path.resolve(root, hunk.file);
    if (!SOURCE.test(hunk.file) || !fs.existsSync(full)) continue;
    for (const s of symbolsOfFile(full, fs.readFileSync(full, 'utf-8'))) {
      if (hunk.ranges.some(([a, b]) => s.startLine <= b && s.endLine >= a)) changed.push({ file: hunk.file, name: s.name, kind: s.kind, startLine: s.startLine, endLine: s.endLine });
    }
  }
  const callers = new Map<string, { confidence: 'import' | 'name'; symbol: string }>();
  for (const symbol of new Set(changed.map((c) => c.name))) {
    for (const caller of callersOf(root, symbol, depth)) {
      const existing = callers.get(caller.file);
      if (!existing || (existing.confidence === 'name' && caller.confidence === 'import')) callers.set(caller.file, { confidence: caller.confidence, symbol });
    }
  }
  return { changed, callers: [...callers.entries()].map(([file, v]) => ({ file, confidence: v.confidence, symbol: v.symbol })) };
}
