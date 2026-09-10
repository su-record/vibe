#!/usr/bin/env node
// On this repository, through dist/core/map — not the CLI — the built-in map lists every src file
// with its symbols, callers of reviewCheck name src/core/check.ts as import-confirmed, blast on
// the working tree's changes names the changed symbols and their callers, and a warm rebuild is
// fast. No model runs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMap, callersOf, blast } from '../dist/core/map/index.js';
import { DEFAULT_EXCLUDE, walk } from '../dist/core/size.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const fail = (msg) => {
  process.stderr.write(`map-live: ${msg}\n`);
  process.exit(1);
};

const walked = [];
walk(path.join(root, 'src'), DEFAULT_EXCLUDE, walked);
const { map: cold } = buildMap(root, 'src');
const known = Object.keys(cold.files).filter((f) => f.startsWith('src/')); // the cache may hold other roots from earlier commands
if (known.length !== walked.length) fail(`the map has ${known.length} files, the walk found ${walked.length}`);
const withSymbols = known.filter((f) => cold.files[f].symbols.length > 0);
if (withSymbols.length < known.length * 0.8) fail(`only ${withSymbols.length}/${known.length} files carry a symbol`);
if (!cold.files['src/core/check.ts'] || cold.files['src/core/check.ts'].symbols.length === 0) fail('src/core/check.ts has no symbols');

const callers = callersOf(root, 'reviewCheck', 2);
const checker = callers.find((c) => c.file === 'src/core/check.ts');
if (!checker) fail(`src/core/check.ts is not among reviewCheck's callers: ${callers.map((c) => c.file).join(', ') || 'none'}`);
if (checker.confidence !== 'import') fail(`src/core/check.ts calls reviewCheck but is not import-confirmed: ${checker.confidence}`);

const ERRORS_FILE = path.join(root, 'src', 'core', 'errors.ts');
const USAGE_LINE = 'export const usage = (message: string): VibeError => new VibeError(message, 2);';
const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', 'src'], { encoding: 'utf-8' }).trim() !== '';
let touched = false;
if (!dirty) {
  fs.writeFileSync(ERRORS_FILE, fs.readFileSync(ERRORS_FILE, 'utf-8').replace(USAGE_LINE, `${USAGE_LINE} // map-live probe`));
  touched = true;
}
try {
  const result = blast(root, 2, 'src');
  if (result.changed.length === 0) fail('blast found no changed symbols on a dirty tree');
  if (result.callers.length === 0) fail(`blast found changed symbols (${result.changed.map((c) => c.name).join(', ')}) but no callers`);
  process.stdout.write(`map-live: ${known.length} files mapped (${withSymbols.length} with symbols) · reviewCheck called from ${checker.file} (${checker.confidence}) · blast ${result.changed.length} changed / ${result.callers.length} caller(s)\n`);
} finally {
  if (touched) execFileSync('git', ['-C', root, 'checkout', '--', 'src/core/errors.ts']);
}

const warmStart = Date.now();
buildMap(root, '.');
const warmMs = Date.now() - warmStart;
if (warmMs >= 500) fail(`the warm build took ${warmMs}ms`);
process.stdout.write(`map-live: warm build ${warmMs}ms\n`);
