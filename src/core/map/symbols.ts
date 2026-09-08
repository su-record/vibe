import path from 'node:path';
import { BRACE_HEADER, INDENT_HEADER, braceDelta, type BraceState } from '../size.js';

/**
 * Symbols per file, by regular expression over the same headers `vibe size` already counts —
 * plus class-shaped declarations and export statements size.ts has no reason to see. Every
 * language `vibe size` parses gets a symbol here; only ts/py/go are asserted line-for-line.
 */
export type SymbolKind = 'function' | 'method' | 'class' | 'interface' | 'type' | 'export';
export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  /** The declaration, one line, brace stripped. */
  signature: string;
  startLine: number;
  endLine: number;
  exported: boolean;
}

const SKIP_NAMES = new Set(['if', 'for', 'while', 'switch', 'catch', 'else', 'return', 'with']);
const CLASS_HEADER = /^\s*(?:export\s+)?(?:default\s+)?(?:public\s+|private\s+|protected\s+|internal\s+|abstract\s+|final\s+|open\s+|sealed\s+|data\s+|static\s+|pub\s+)*(class|interface|trait|enum)\s+([A-Za-z_$][\w$]*)/;
const GO_TYPE_HEADER = /^\s*type\s+([A-Za-z_]\w*)\s+(struct|interface)\b/;
const TS_TYPE_ALIAS = /^\s*export\s+type\s+([A-Za-z_$][\w$]*)\s*=/;
const EXPORT_VALUE = /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/;
const EXPORT_LIST = /^\s*export\s*\{\s*([^}]+?)\s*\}/;
const PY_CLASS = /^(\s*)class\s+([A-Za-z_]\w*)/;

function declaration(line: string): string {
  return line.trim().replace(/\s*\{\s*$/, '');
}

/** Where a brace-delimited header at `start` closes, walking the multi-line lexer state forward. */
function braceSpan(lines: string[], start: number): number {
  let depth = 0;
  let end = start;
  const st: BraceState = { stack: [], exprDepth: [] };
  for (let j = start; j < lines.length; j += 1) {
    depth += braceDelta(lines[j]!, st);
    end = j;
    if (depth <= 0) break;
  }
  return end;
}

function isExported(ext: string, line: string, name: string): boolean {
  if (ext === 'go') return /^[A-Z]/.test(name);
  return /^\s*(export|pub)\b/.test(line) || /\bpublic\b/.test(line);
}

/** A brace-delimited class, interface, trait or enum, and (for Go) `type X struct|interface {`. */
function scanClassLike(lines: string[], i: number, ext: string): SymbolInfo | null {
  const line = lines[i]!;
  const cls = CLASS_HEADER.exec(line);
  if (cls && line.includes('{')) {
    const end = braceSpan(lines, i);
    return { name: cls[2]!, kind: cls[1] === 'interface' ? 'interface' : 'class', signature: declaration(line), startLine: i + 1, endLine: end + 1, exported: isExported(ext, line, cls[2]!) };
  }
  if (ext === 'go') {
    const gt = GO_TYPE_HEADER.exec(line);
    if (gt) {
      const end = braceSpan(lines, i);
      return { name: gt[1]!, kind: gt[2] === 'interface' ? 'interface' : 'class', signature: declaration(line), startLine: i + 1, endLine: end + 1, exported: /^[A-Z]/.test(gt[1]!) };
    }
  }
  if (ext === 'ts' || ext === 'tsx') {
    const ta = TS_TYPE_ALIAS.exec(line);
    if (ta) {
      const multiline = line.includes('{') && !/\}\s*;?\s*$/.test(line);
      const end = multiline ? braceSpan(lines, i) : i;
      return { name: ta[1]!, kind: 'type', signature: declaration(line), startLine: i + 1, endLine: end + 1, exported: true };
    }
  }
  return null;
}

/** `export const x = …` and `export { a, b }` — a value or re-export with no callable body of its own. */
function scanExportLike(line: string, i: number): SymbolInfo[] {
  const value = EXPORT_VALUE.exec(line);
  if (value) return [{ name: value[1]!, kind: 'export', signature: declaration(line), startLine: i + 1, endLine: i + 1, exported: true }];
  const list = EXPORT_LIST.exec(line);
  if (!list) return [];
  return list[1]!.split(',').map((entry) => entry.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean)
    .map((name) => ({ name, kind: 'export' as const, signature: declaration(line), startLine: i + 1, endLine: i + 1, exported: true }));
}

function scanBrace(lines: string[], ext: string): SymbolInfo[] {
  const out: SymbolInfo[] = [];
  const openClasses: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    while (openClasses.length && i > openClasses[openClasses.length - 1]!) openClasses.pop();
    const line = lines[i]!;
    const cls = scanClassLike(lines, i, ext);
    if (cls) {
      out.push(cls);
      if (cls.kind === 'class') openClasses.push(cls.endLine - 1);
      continue;
    }
    out.push(...scanExportLike(line, i));
    const m = BRACE_HEADER.exec(line);
    if (!m || !line.includes('{')) continue;
    const name = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '(anonymous)';
    if (SKIP_NAMES.has(name)) continue;
    const end = braceSpan(lines, i);
    out.push({ name, kind: openClasses.length ? 'method' : 'function', signature: declaration(line), startLine: i + 1, endLine: end + 1, exported: isExported(ext, line, name) });
  }
  return out;
}

/** Python: `def` and `class`, indentation-delimited like `vibe size`'s own scan. */
function scanIndent(lines: string[]): SymbolInfo[] {
  const out: SymbolInfo[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const def = INDENT_HEADER.exec(line);
    const cls = def ? null : PY_CLASS.exec(line);
    const m = def ?? cls;
    if (!m) continue;
    const indent = m[1]!.length;
    let end = i;
    for (let j = i + 1; j < lines.length; j += 1) {
      const l = lines[j]!;
      if (l.trim() === '') continue;
      if (l.search(/\S/) <= indent) break;
      end = j;
    }
    const name = (def ?? cls)![2]!;
    out.push({ name, kind: def ? (indent > 0 ? 'method' : 'function') : 'class', signature: declaration(line), startLine: i + 1, endLine: end + 1, exported: !name.startsWith('_') });
  }
  return out;
}

export function symbolsOfFile(file: string, text: string): SymbolInfo[] {
  const ext = path.extname(file).slice(1).toLowerCase();
  const lines = text.split('\n');
  return ext === 'py' ? scanIndent(lines) : scanBrace(lines, ext);
}
