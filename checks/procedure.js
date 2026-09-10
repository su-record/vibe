#!/usr/bin/env node
// One procedure, one source: the phrases in src/core/procedure.ts must appear — backticks and the
// word "vibe" aside — in card rule 2, the router skill and README's flow block. Two procedures in
// two places is how the model came to read intent.md for what a scenario id meant.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const src = fs.readFileSync(path.join(root, 'src/core/procedure.ts'), 'utf-8');
const phrase = (key) => new RegExp(`${key}: '([^']+)'`).exec(src)?.[1];
const norm = (t) => t.replace(/`/g, '').replace(/\bvibe /g, '').replace(/\bthen one\b/g, 'one').replace(/\s+/g, ' ');
const wanted = ['build', 'failure'].map((k) => norm(phrase(k)));

const places = { 'card.md': fs.readFileSync(path.join(root, 'card.md'), 'utf-8'), 'skills/vibe/SKILL.md': fs.readFileSync(path.join(root, 'skills/vibe/SKILL.md'), 'utf-8'), 'README.md': fs.readFileSync(path.join(root, 'README.md'), 'utf-8') };
const problems = [];
for (const [file, text] of Object.entries(places)) for (const w of wanted) if (!norm(text).includes(w)) problems.push(`${file} does not say "${w}"`);
if (problems.length) {
  console.error(`the procedure is written in more than one way:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`procedure: card, router and README quote "${wanted.join('" and "')}"`);
