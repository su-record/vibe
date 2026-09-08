import path from 'node:path';
import type { BlastResult, CallerInfo, CodeMap } from './index.js';
import type { SymbolInfo } from './symbols.js';

/** Text rendering for `vibe map`, `symbols`, `callers` and `blast` — one representation, whatever the caller (CLI, `changed`, `reader`). */
export function formatMap(map: CodeMap): string {
  const files = Object.keys(map.files).sort();
  const lines: string[] = [`${files.length} files`];
  let lastDir = '';
  for (const rel of files) {
    const dir = path.dirname(rel);
    if (dir !== lastDir) {
      lines.push(`${dir}/`);
      lastDir = dir;
    }
    const f = map.files[rel]!;
    lines.push(`  ${path.basename(rel)}${f.imports.length ? ` → ${f.imports.join(', ')}` : ''}`);
    for (const s of f.symbols) lines.push(`    ${s.kind} ${s.signature} L${s.startLine}-${s.endLine}${s.exported ? ' export' : ''}`);
  }
  return lines.join('\n');
}

export function formatSymbols(file: string, symbols: SymbolInfo[]): string {
  if (symbols.length === 0) return `${file}: no symbols found`;
  return [file, ...symbols.map((s) => `  ${s.kind} ${s.signature} L${s.startLine}-${s.endLine}${s.exported ? ' export' : ''}`)].join('\n');
}

export function formatCallers(symbol: string, callers: CallerInfo[]): string {
  if (callers.length === 0) return `${symbol}: no callers found`;
  return [`${symbol}:`, ...callers.map((c) => `  ${c.file} (${c.confidence})`)].join('\n');
}

export function formatBlast(result: BlastResult): string {
  const changedLines = result.changed.length ? result.changed.map((c) => `  ${c.file} › ${c.name}() L${c.startLine}-${c.endLine}`) : ['  none'];
  const callerLines = result.callers.length ? result.callers.map((c) => `  ${c.file} (${c.confidence}, via ${c.symbol})`) : ['  none'];
  return ['Changed symbols:', ...changedLines, 'Affected symbols:', ...callerLines].join('\n');
}

/** The two summary lines `review`'s changed-with-blast bundle opens with, and the caller files behind them. */
export function blastSummary(result: BlastResult): { changedLine: string; affectedLine: string; files: string[] } {
  const changedNames = [...new Set(result.changed.map((c) => c.name))];
  const files = [...new Set(result.callers.map((c) => c.file))].sort();
  return {
    changedLine: `Changed symbols: ${changedNames.join(', ') || 'none'}`,
    affectedLine: `Affected symbols: ${files.join(', ') || 'none'}`,
    files,
  };
}

/** The skeleton `vibe read --ask` prepends to a code file: one line per symbol, name and signature with its line range. */
export function skeletonBlock(relPath: string, symbols: SymbolInfo[]): string {
  if (symbols.length === 0) return '';
  const lines = symbols.map((s) => `${s.signature} L${s.startLine}-${s.endLine}`);
  return `<skeleton path="${relPath}">\n${lines.join('\n')}\n</skeleton>`;
}
