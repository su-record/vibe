import fs from 'node:fs';
import path from 'node:path';
import { usage } from '../errors.js';

/** Files a pack reads: design takes the markup, styles, components and vector art; code takes the languages a maintainer reads. */
export type SourceKind = 'design' | 'code';
const SOURCE_EXT: Record<SourceKind, ReadonlySet<string>> = {
  design: new Set(['.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.svg']),
  code: new Set(['.ts', '.js', '.mjs', '.cjs', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.swift', '.sh', '.sql', '.yaml', '.yml', '.toml']),
};
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'vendor', 'target', '.git']);
const LOCK_FILES = /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|Pipfile\.lock|go\.sum|composer\.lock)$/;

function isBinary(file: string): boolean {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, n).includes(0);
  } finally {
    fs.closeSync(fd);
  }
}

function walk(dir: string, out: string[], kind: SourceKind): void {
  for (const name of fs.readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name) || name.startsWith('.') || LOCK_FILES.test(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out, kind);
    else if (SOURCE_EXT[kind].has(path.extname(name).toLowerCase()) && !isBinary(full)) out.push(full);
  }
}

export function numberLines(text: string): string {
  const lines = text.replace(/\n$/, '').split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width)}| ${line}`).join('\n');
}

/**
 * The artifact as the reviewers see it: one file, or every source file under a directory, each
 * numbered line by line so a finding can name `file:line`. The cap is the reviewer's context.
 */
export function collectSource(root: string, target: string, maxChars: number, kind: SourceKind = 'design'): { files: string[]; text: string } {
  const full = path.resolve(root, target);
  if (!fs.existsSync(full)) throw usage(`no such path: ${target}`);
  const files: string[] = [];
  if (fs.statSync(full).isDirectory()) walk(full, files, kind);
  else files.push(full);
  if (files.length === 0) throw usage(`no source files under ${target}`);
  const blocks: string[] = [];
  let chars = 0;
  const listed: string[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    const body = numberLines(fs.readFileSync(file, 'utf-8'));
    chars += body.length;
    if (chars > maxChars) break;
    listed.push(rel);
    blocks.push(`<file path="${rel}">\n${body}\n</file>`);
  }
  return { files: listed, text: blocks.join('\n\n') };
}
