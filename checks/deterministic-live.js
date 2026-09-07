#!/usr/bin/env node
// The two fact checks on real files: the slop fixture fails a11y with at least two findings, and
// README's reader-measurement paragraph passes traceable against checks/fixtures/readme-evidence.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileCheck } from '../dist/core/checks/file.js';
const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => {
  process.stderr.write(`deterministic-live: ${msg}\n`);
  process.exit(1);
};
const a11y = fileCheck({ type: 'file', path: 'checks/fixtures/slop/index.html', a11y: true }, root);
if (a11y.pass || a11y.reason !== 'accessibility defect') fail(`the slop fixture passed a11y: ${JSON.stringify(a11y)}`);
if (a11y.tail.split('\n').length < 2) fail(`fewer than two a11y findings: ${a11y.tail}`);
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');
const paragraph = readme.split('\n').find((l) => l.includes('37,576'));
if (!paragraph) fail('README no longer carries the 37,576 measurement paragraph');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-traceable-'));
fs.writeFileSync(path.join(tmp, 'paragraph.md'), `${paragraph}\n`);
fs.copyFileSync(path.join(root, 'checks', 'fixtures', 'readme-evidence.md'), path.join(tmp, 'evidence.md'));
const traced = fileCheck({ type: 'file', path: 'paragraph.md', traceable: 'evidence.md' }, tmp);
fs.rmSync(tmp, { recursive: true, force: true });
if (!traced.pass) fail(`README's measurement paragraph has an untraceable number: ${traced.tail}`);
process.stdout.write(`deterministic-live: a11y found ${a11y.tail.split('\n').length} defects in the fixture; README's measurement paragraph is traceable\n`);
