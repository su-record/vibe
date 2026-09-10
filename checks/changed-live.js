#!/usr/bin/env node
// On this repository, with src/core/checks/source.ts modified in the working tree, the change-scoped
// collector lists source.ts as changed and review.ts (which imports it) as dependent, and lists no
// file that neither changed nor imports a changed file. No model runs.
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { collectChanged } from '../dist/core/checks/changed.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const fail = (msg) => {
  process.stderr.write(`changed-live: ${msg}\n`);
  process.exit(1);
};
const target = 'src/core/checks/source.ts';
const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', target], { encoding: 'utf-8' }).trim() !== '';
let touched = false;
if (!dirty) {
  fs.appendFileSync(`${root}/${target}`, '\n// changed-live probe\n');
  touched = true;
}
try {
  const c = collectChanged(root, 'src', 400_000, 'code', true);
  if (!c.selection.changed.includes(target)) fail(`${target} is not listed as changed: ${c.selection.changed.join(', ')}`);
  // review.ts imports source.ts: it is a dependent, unless the working tree changed it too, in which case it is changed
  const reviewer = 'src/core/checks/review.ts';
  if (!c.selection.dependents.includes(reviewer) && !c.selection.changed.includes(reviewer)) fail(`review.ts is neither dependent nor changed: ${c.selection.dependents.join(', ')}`);
  // every dependent really imports a changed file — checked against the text, not the collector
  const stems = c.selection.changed.map((f) => f.replace(/^.*\//, '').replace(/\.[^.]+$/, ''));
  for (const d of c.selection.dependents) {
    const text = fs.readFileSync(`${root}/${d}`, 'utf-8');
    const imports = [...text.matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    if (!imports.some((i) => stems.some((s) => i.replace(/\.[^.]+$/, '').endsWith(`/${s}`)))) fail(`${d} is listed as dependent but imports no changed file`);
  }
  if (c.selection.changed.includes('src/core/other-nonexistent.ts')) fail('impossible');
  const untouched = ['src/core/lang.ts', 'src/core/tokens.ts'].filter((f) => !c.selection.changed.includes(f) && !c.selection.dependents.includes(f));
  if (untouched.length !== 2) fail(`an unrelated file was listed: ${['src/core/lang.ts', 'src/core/tokens.ts'].join(', ')}`);
  process.stdout.write(`changed-live: ${c.selection.changed.length} changed, ${c.selection.dependents.length} dependent, ${c.files.length} files in the bundle (of 85)\n`);
} finally {
  if (touched) execFileSync('git', ['-C', root, 'checkout', '--', target]);
}
