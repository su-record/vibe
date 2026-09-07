#!/usr/bin/env node
// The absent rule through the real check runner: README passes the placeholder gate, and the same
// check with a word README does contain fails with the reason and the line named.
import { fileCheck } from '../dist/core/checks/file.js';
const root = new URL('..', import.meta.url).pathname;
const absent = 'Lorem ipsum|\\[TODO\\]|\\bTBD\\b|Your Company|\\{\\{|\\[\\[';
const fail = (msg) => {
  process.stderr.write(`absent-live: ${msg}\n`);
  process.exit(1);
};
const clean = fileCheck({ type: 'file', path: 'README.md', absent }, root);
if (!clean.pass) fail(`README failed the placeholder gate: ${clean.reason} ${clean.tail}`);
const hit = fileCheck({ type: 'file', path: 'README.md', absent: 'vibe check' }, root);
if (hit.pass || hit.reason !== 'forbidden text present' || !/^line \d+: vibe check/.test(hit.tail)) fail(`the forbidden word was not reported: ${JSON.stringify(hit)}`);
process.stdout.write(`absent-live: README clean; a present word is reported as "${hit.tail.split('\n')[0]}"\n`);
