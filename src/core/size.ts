import fs from 'node:fs';
import path from 'node:path';

/**
 * `vibe size` — a built-in check any project can bind to a scenario: no file over N lines, no
 * function over M lines. Size is the earliest sign of a codebase drifting; the harness measures
 * it so nobody has to argue about it. Functions are counted for js/ts/py/go/java/kt/rs/swift/rb
 * by brace or indentation from a `function`, `def`, `func`, `fn` or method-like header.
 */
export interface SizeOptions {
  maxFile: number;
  maxFunction: number;
  exclude?: RegExp;
}
export interface SizeFinding {
  file: string;
  kind: 'file' | 'function';
  name: string;
  lines: number;
  limit: number;
}
export interface SizeReport {
  files: number;
  totalLines: number;
  largestFile: { file: string; lines: number } | null;
  findings: SizeFinding[];
}

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|kt|rs|swift|rb|cs|php)$/;
const DEFAULT_EXCLUDE = /(^|\/)(node_modules|dist|build|out|\.git|\.vibe|vendor|coverage)(\/|$)|\.(test|spec)\.[jt]sx?$|_test\.(go|py)$/;
const BRACE_HEADER = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:public|private|protected|static|override|final|\s)*\s*(?:func|fn)\s+(?:\([^)]*\)\s*)?([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>\s*\{\s*$|(?:public|private|protected|static|async|override|\s)*\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*$)/;
const INDENT_HEADER = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;

function walk(dir: string, exclude: RegExp, into: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (exclude.test(full)) continue;
    if (entry.isDirectory()) walk(full, exclude, into);
    else if (SOURCE.test(entry.name)) into.push(full);
  }
}

/** Lexer state that survives line breaks: open quotes and `${…}` expressions inside template literals. */
interface BraceState {
  stack: Array<'"' | "'" | '`' | 'expr'>;
  exprDepth: number[];
}

function stepCode(ch: string, st: BraceState): number {
  const inExpr = st.stack.at(-1) === 'expr';
  const last = st.exprDepth.length - 1;
  if (ch === '"' || ch === "'" || ch === '`') st.stack.push(ch);
  else if (ch === '{') {
    if (!inExpr) return 1;
    st.exprDepth[last] = (st.exprDepth[last] ?? 0) + 1;
  } else if (ch === '}') {
    if (!inExpr) return -1;
    if ((st.exprDepth[last] ?? 0) === 0) {
      st.stack.pop();
      st.exprDepth.pop();
    } else st.exprDepth[last] = (st.exprDepth[last] ?? 1) - 1;
  }
  return 0;
}

/** Net `{` minus `}` on one line outside strings, template literals and comments; `${…}` inside a template is code again. */
function braceDelta(line: string, st: BraceState): number {
  let depth = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    const top = st.stack.at(-1);
    if (top === '"' || top === "'" || top === '`') {
      if (ch === '\\') i += 1;
      else if (ch === top) st.stack.pop();
      else if (top === '`' && ch === '$' && line[i + 1] === '{') {
        st.stack.push('expr');
        st.exprDepth.push(0);
        i += 1;
      }
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') break;
    if (ch === '/' && line[i + 1] === '*') {
      const close = line.indexOf('*/', i + 2);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    depth += stepCode(ch, st);
  }
  return depth;
}

function braceFunctions(lines: string[]): Array<{ name: string; lines: number }> {
  const out: Array<{ name: string; lines: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = BRACE_HEADER.exec(lines[i]!);
    if (!m || !lines[i]!.includes('{')) continue;
    const name = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '(anonymous)';
    if (['if', 'for', 'while', 'switch', 'catch', 'else', 'return', 'with'].includes(name)) continue;
    let depth = 0;
    let end = i;
    const st: BraceState = { stack: [], exprDepth: [] };
    for (let j = i; j < lines.length; j += 1) {
      depth += braceDelta(lines[j]!, st);
      end = j;
      if (depth <= 0) break;
    }
    out.push({ name, lines: end - i + 1 });
  }
  return out;
}

function indentFunctions(lines: string[]): Array<{ name: string; lines: number }> {
  const out: Array<{ name: string; lines: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = INDENT_HEADER.exec(lines[i]!);
    if (!m) continue;
    const indent = m[1]!.length;
    let end = i;
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j]!;
      if (line.trim() === '') continue;
      if (line.search(/\S/) <= indent) break;
      end = j;
    }
    out.push({ name: m[2]!, lines: end - i + 1 });
  }
  return out;
}

export function measureSize(root: string, paths: string[], options: SizeOptions): SizeReport {
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  const files: string[] = [];
  for (const p of paths.length ? paths : ['.']) {
    const full = path.resolve(root, p);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isDirectory()) walk(full, exclude, files);
    else files.push(full);
  }
  const findings: SizeFinding[] = [];
  let totalLines = 0;
  let largest: SizeReport['largestFile'] = null;
  for (const file of files) {
    const rel = path.relative(root, file);
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    totalLines += lines.length;
    if (!largest || lines.length > largest.lines) largest = { file: rel, lines: lines.length };
    if (lines.length > options.maxFile) findings.push({ file: rel, kind: 'file', name: rel, lines: lines.length, limit: options.maxFile });
    const fns = /\.py$/.test(file) ? indentFunctions(lines) : braceFunctions(lines);
    for (const fn of fns) if (fn.lines > options.maxFunction) findings.push({ file: rel, kind: 'function', name: fn.name, lines: fn.lines, limit: options.maxFunction });
  }
  return { files: files.length, totalLines, largestFile: largest, findings };
}
