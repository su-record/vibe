import fs from 'node:fs';
import path from 'node:path';
import { usage } from '../errors.js';

/** Files a design pack reads: the markup, the styles, the components, the vector art. */
const SOURCE_EXT = new Set(['.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.svg']);

function walk(dir: string, out: string[]): void {
  for (const name of fs.readdirSync(dir).sort()) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.has(path.extname(name).toLowerCase())) out.push(full);
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
export function collectSource(root: string, target: string, maxChars: number): { files: string[]; text: string } {
  const full = path.resolve(root, target);
  if (!fs.existsSync(full)) throw usage(`no such path: ${target}`);
  const files: string[] = [];
  if (fs.statSync(full).isDirectory()) walk(full, files);
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
