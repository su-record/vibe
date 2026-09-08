import fs from 'node:fs';
import path from 'node:path';
import { relPosix } from '../paths.js';

/**
 * Import edges, resolved to a file that exists (or, for Go, a package directory expanded to the
 * files inside it): JS/TS relative specifiers, Python `from`/`import`, Go module-relative imports
 * against `go.mod`, Rust `use crate::…` / `mod x;`, and Java/Kotlin `import a.b.C` against a
 * `src`/`java`/`kotlin` source root. Every result is filtered to files this map already knows.
 */
const JS_IMPORT = /(?:from\s+|import\s*\(?\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
const PY_FROM = /^\s*from\s+([.\w]+)\s+import\b/gm;
const PY_IMPORT = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;
const GO_IMPORT_BLOCK = /import\s*\(([^)]*)\)/gs;
const GO_IMPORT_SINGLE = /^\s*import\s+"([^"]+)"/gm;
const GO_PATH = /"([^"]+)"/g;
const RUST_USE = /^\s*(?:pub\s+)?use\s+((?:crate|self|super)(?:::[\w]+)+);/gm;
const RUST_MOD = /^\s*(?:pub\s+)?mod\s+([A-Za-z_]\w*)\s*;/gm;
const JAVA_IMPORT = /^\s*import\s+(?:static\s+)?([\w.]+)\s*;/gm;
const JS_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function firstExisting(candidates: string[]): string | null {
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

/** A relative JS/TS specifier: as written, with an extension, `.js` read as `.ts`, or an index file. */
function jsTargets(fromDir: string, spec: string): string[] {
  if (!spec.startsWith('.')) return [];
  const base = path.resolve(fromDir, spec);
  const out = [base, ...JS_EXTS.map((e) => base + e), ...JS_EXTS.map((e) => path.join(base, `index${e}`))];
  if (/\.[cm]?js$/.test(base)) out.push(base.replace(/\.[cm]?js$/, '.ts'), base.replace(/\.[cm]?js$/, '.tsx'));
  return out;
}

/** `from .x import` relative to the file, `from pkg.x import` / `import pkg.x` from the root and the file's directory. */
function pyTargets(root: string, fromDir: string, mod: string): string[] {
  if (mod.startsWith('.')) {
    const ups = mod.match(/^\.+/)![0].length - 1;
    const rest = mod.slice(ups + 1).split('.').filter(Boolean);
    const base = path.resolve(fromDir, ...Array(ups).fill('..'), ...rest);
    return [`${base}.py`, path.join(base, '__init__.py')];
  }
  const rest = mod.split('.');
  return [root, fromDir].flatMap((start) => {
    const base = path.resolve(start, ...rest);
    return [`${base}.py`, path.join(base, '__init__.py')];
  });
}

/** The nearest ancestor `go.mod`'s module path, and the directory it lives in. */
function findGoModule(dir: string, root: string): { name: string; dir: string } | null {
  let cur = dir;
  for (;;) {
    const gomod = path.join(cur, 'go.mod');
    if (fs.existsSync(gomod)) {
      const m = /^module\s+(\S+)/m.exec(fs.readFileSync(gomod, 'utf-8'));
      return m ? { name: m[1]!, dir: cur } : null;
    }
    const parent = path.dirname(cur);
    if (cur === root || parent === cur) return null;
    cur = parent;
  }
}

/** A Go import path under the module: the package directory it names, expanded to its files by the caller. */
function goTargets(mod: { name: string; dir: string } | null, importPath: string): string[] {
  if (!mod || !(importPath === mod.name || importPath.startsWith(`${mod.name}/`))) return [];
  const rel = importPath.slice(mod.name.length).replace(/^\//, '');
  return [path.join(mod.dir, rel)];
}

/** `crate::a::b` against the crate's `src/`, most specific candidate first. */
function rustTargets(file: string, use: string): string[] {
  let srcRoot: string | null = path.dirname(file);
  while (srcRoot && path.basename(srcRoot) !== 'src') {
    const parent = path.dirname(srcRoot);
    srcRoot = parent === srcRoot ? null : parent;
  }
  if (!srcRoot) return [];
  const parts = use.split('::').filter((p) => !['crate', 'self', 'super'].includes(p));
  const out: string[] = [];
  for (let k = parts.length; k >= 1; k -= 1) {
    const base = path.join(srcRoot, ...parts.slice(0, k));
    out.push(`${base}.rs`, path.join(base, 'mod.rs'));
  }
  return out;
}

/** `import a.b.C` against the nearest `java`/`kotlin`/`src` ancestor. */
function javaTargets(file: string, importPath: string): string[] {
  let root: string | null = path.dirname(file);
  while (root && !['java', 'kotlin', 'src'].includes(path.basename(root))) {
    const parent = path.dirname(root);
    root = parent === root ? null : parent;
  }
  if (!root) return [];
  const base = path.join(root, ...importPath.split('.'));
  return [`${base}.java`, `${base}.kt`];
}

function goFilesIn(dir: string, knownFiles: ReadonlySet<string>, root: string): string[] {
  return [...knownFiles].filter((rel) => path.dirname(path.resolve(root, rel)) === dir);
}

function targetsFor(root: string, file: string, text: string): string[] {
  const dir = path.dirname(file);
  const ext = path.extname(file);
  const out: string[] = [];
  if (JS_EXTS.includes(ext)) {
    for (const m of text.matchAll(JS_IMPORT)) out.push(...jsTargets(dir, m[1]!));
  } else if (ext === '.py') {
    for (const m of text.matchAll(PY_FROM)) out.push(...pyTargets(root, dir, m[1]!));
    for (const m of text.matchAll(PY_IMPORT)) for (const mod of m[1]!.split(',')) out.push(...pyTargets(root, dir, mod.trim()));
  } else if (ext === '.go') {
    const mod = findGoModule(dir, root);
    const block = [...text.matchAll(GO_IMPORT_BLOCK)].map((m) => m[1]!).join('\n');
    for (const m of [...block.matchAll(GO_PATH), ...text.matchAll(GO_IMPORT_SINGLE)]) out.push(...goTargets(mod, (m[1] ?? m[0]).replace(/^"|"$/g, '')));
  } else if (ext === '.rs') {
    for (const m of text.matchAll(RUST_USE)) out.push(...rustTargets(file, m[1]!));
    for (const m of text.matchAll(RUST_MOD)) out.push(...rustTargets(file, `crate::${m[1]!}`));
  } else if (ext === '.java' || ext === '.kt') {
    for (const m of text.matchAll(JAVA_IMPORT)) out.push(...javaTargets(file, m[1]!));
  }
  return out;
}

/** `file`'s import edges resolved to files this map knows, as paths relative to `root`. Go targets that name a directory expand to every known file directly inside it. */
export function resolveImports(root: string, file: string, text: string, knownFiles: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  for (const candidate of targetsFor(root, file, text)) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      for (const rel of goFilesIn(candidate, knownFiles, root)) out.add(rel);
      continue;
    }
    const hit = firstExisting([candidate]) ?? (path.extname(candidate) ? null : firstExisting([`${candidate}.go`]));
    if (!hit) continue;
    const rel = relPosix(root, hit);
    if (knownFiles.has(rel)) out.add(rel);
  }
  return [...out].sort();
}
