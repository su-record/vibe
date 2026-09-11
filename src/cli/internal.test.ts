import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cmdInternal } from './internal.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-internal-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

it('provides task guidance without initializing a project or calling a model', () => {
  const guide = cmdInternal(root, 'guide', ['code']);
  expect(guide.text).toContain('existing conventions');
  expect(guide.text).toContain('Do not start a reviewer');
  expect(fs.readdirSync(root)).toEqual([]);
  expect(cmdInternal(root, 'brief', ['entry']).text).toContain("You are the user's FDE");
  expect(() => cmdInternal(root, 'guide', ['../../package.json'])).toThrow('unknown guide');
});

it('returns the saved outcome and knowledge without indexing or rewriting records', () => {
  fs.mkdirSync(path.join(root, '.vibe', 'knowledge'), { recursive: true });
  fs.writeFileSync(path.join(root, '.vibe', 'intent.md'), '# Existing pilot\nUse the customer workflow.\n');
  fs.writeFileSync(path.join(root, '.vibe', 'knowledge', 'customer.md'), '# Customer\nUse the local connector.\n');
  fs.writeFileSync(path.join(root, '.vibe', 'state.json'), '{"state":"STUCK"}\n');
  const before = fs.readFileSync(path.join(root, '.vibe', 'state.json'), 'utf8');
  const brief = cmdInternal(root, 'brief', []);
  expect(brief.text).toContain('Existing pilot');
  expect(brief.text).toContain('customer.md');
  expect(fs.readFileSync(path.join(root, '.vibe', 'state.json'), 'utf8')).toBe(before);
  expect(fs.existsSync(path.join(root, '.vibe', 'cache'))).toBe(false);
  expect(fs.existsSync(path.join(root, '.vibe', 'ledger.jsonl'))).toBe(false);
});

it('keeps extension research, installation and creation reachable through internal help', () => {
  const help = cmdInternal(root, 'tools', []);
  expect(help.text).toContain('skill search');
  expect(help.text).toContain('skill add');
  expect(help.text).toContain('skill create');
});
