import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { usage } from '../errors.js';
import { isSourceOf, listSource, renderSource, type SourceKind } from './source.js';

/**
 * A code review reads what changed and what depends on it. git says what changed under `path`;
 * one hop of dependents is every source file whose import or require names a changed file. No
 * graph, no index: a regular expression over import lines — deeper reach belongs to tools built for it.
 */
export interface ChangedSelection {
  ref: string;
  changed: string[];
  dependents: string[];
}

function git(root: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf-8', timeout: 30_000, shell: process.platform === 'win32' });
  return { ok: r.status === 0, out: r.stdout ?? '' };
}

/** Modified, added and untracked source files under `target` against `ref` (`true` = HEAD); deleted ones cannot be reviewed and are dropped. */
export function changedFiles(root: string, target: string, ref: string | true, kind: SourceKind): { ref: string; files: string[] } {
  if (!git(root, ['rev-parse', '--is-inside-work-tree']).ok) throw usage('changed needs a git repository');
  const against = ref === true ? 'HEAD' : ref;
  const diff = git(root, ['diff', '--relative', '--name-only', '--diff-filter=d', against, '--', target]);
  if (!diff.ok) throw usage(`git cannot diff against ${against}`);
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '--', target]);
  const names = [...new Set(`${diff.out}\n${untracked.out}`.split('\n').map((l) => l.trim()).filter(Boolean))];
  const files = names.map((n) => path.resolve(root, n)).filter((f) => fs.existsSync(f) && fs.statSync(f).isFile() && isSourceOf(f, kind)).sort();
  return { ref: against, files };
}

const JS_IMPORT = /(?:from\s+|import\s*\(?\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
const PY_FROM = /^\s*from\s+([.\w]+)\s+import\b/gm;
const PY_IMPORT = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.vue', '.svelte'];

/** The files a relative JS/TS specifier may resolve to: as written, with an extension, `.js` read as `.ts`, or an index file. */
function jsTargets(fromDir: string, spec: string): string[] {
  if (!spec.startsWith('.')) return [];
  const base = path.resolve(fromDir, spec);
  const out = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, `index${e}`))];
  if (/\.[cm]?js$/.test(base)) out.push(base.replace(/\.[cm]?js$/, '.ts'), base.replace(/\.[cm]?js$/, '.tsx'));
  return out;
}

/** Python: `from .x import` relative to the file, `from pkg.x import` / `import pkg.x` from the root and from the file's directory. */
function pyTargets(root: string, fromDir: string, mod: string): string[] {
  const out: string[] = [];
  if (mod.startsWith('.')) {
    const ups = mod.match(/^\.+/)![0].length - 1;
    const rest = mod.slice(ups + 1).split('.').filter(Boolean);
    const base = path.resolve(fromDir, ...Array(ups).fill('..'), ...rest);
    out.push(`${base}.py`, path.join(base, '__init__.py'));
  } else {
    const rest = mod.split('.');
    for (const start of [root, fromDir]) {
      const base = path.resolve(start, ...rest);
      out.push(`${base}.py`, path.join(base, '__init__.py'));
    }
  }
  return out;
}

function importsOf(root: string, file: string): Set<string> {
  const text = fs.readFileSync(file, 'utf-8');
  const dir = path.dirname(file);
  const out = new Set<string>();
  if (/\.py$/.test(file)) {
    for (const m of text.matchAll(PY_FROM)) for (const t of pyTargets(root, dir, m[1]!)) out.add(t);
    for (const m of text.matchAll(PY_IMPORT)) for (const mod of m[1]!.split(',')) for (const t of pyTargets(root, dir, mod.trim())) out.add(t);
  } else {
    for (const m of text.matchAll(JS_IMPORT)) for (const t of jsTargets(dir, m[1]!)) out.add(t);
  }
  return out;
}

/** Every source file under `target` that imports one of `changed`, itself not changed. */
export function dependentsOf(root: string, target: string, changed: string[], kind: SourceKind): string[] {
  const changedSet = new Set(changed);
  const out: string[] = [];
  for (const file of listSource(root, target, kind)) {
    if (changedSet.has(file)) continue;
    const imports = importsOf(root, file);
    if (changed.some((c) => imports.has(c))) out.push(file);
  }
  return out.sort();
}

export function collectChanged(root: string, target: string, maxChars: number, kind: SourceKind, ref: string | true): { selection: ChangedSelection; files: string[]; text: string } {
  const { ref: against, files: changed } = changedFiles(root, target, ref, kind);
  const dependents = changed.length ? dependentsOf(root, target, changed, kind) : [];
  const roles = new Map<string, string>([...changed.map((f) => [f, 'changed'] as const), ...dependents.map((f) => [f, 'dependent'] as const)]);
  const rel = (f: string): string => path.relative(root, f);
  const head = `Changed since ${against}: ${changed.map(rel).join(', ') || 'none'}\nDependents (one hop): ${dependents.map(rel).join(', ') || 'none'}`;
  const rendered = renderSource(root, [...changed, ...dependents], maxChars, roles);
  return { selection: { ref: against, changed: changed.map(rel), dependents: dependents.map(rel) }, files: rendered.files, text: `${head}\n\n${rendered.text}` };
}
