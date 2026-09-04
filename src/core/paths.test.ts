import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findProjectRoot, isProjectDir } from './paths.js';

let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-root-'));
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

const mk = (...parts: string[]): string => {
  const p = path.join(home, ...parts);
  fs.mkdirSync(p, { recursive: true });
  return p;
};

describe('findProjectRoot — .vibe means a project only when it holds a record', () => {
  it('a project folder under a home that carries only the plugin store resolves to itself, not the home', () => {
    mk('.vibe', 'plugin', 'vibe');
    const project = mk('work', 'site');
    expect(isProjectDir(home)).toBe(false);
    expect(findProjectRoot(project, home)).toBe(project);
  });

  it('the home is a root only when the search starts there', () => {
    fs.writeFileSync(path.join(mk('.vibe'), 'state.json'), '{}');
    const below = mk('notes');
    expect(findProjectRoot(home, home)).toBe(home);
    expect(findProjectRoot(below, home)).toBe(below);
  });

  it('stops at the first directory that contains .git', () => {
    fs.writeFileSync(path.join(mk('outer', '.vibe'), 'intent.md'), '# x');
    const repo = mk('outer', 'repo');
    mk('outer', 'repo', '.git');
    const deep = mk('outer', 'repo', 'src', 'lib');
    expect(findProjectRoot(deep, home)).toBe(deep);
    fs.writeFileSync(path.join(mk('outer', 'repo', '.vibe'), 'ledger.jsonl'), '');
    expect(findProjectRoot(deep, home)).toBe(repo);
  });

  it('a .vibe with state.json wins over an empty .vibe in between', () => {
    const a = mk('a');
    fs.writeFileSync(path.join(mk('a', '.vibe'), 'state.json'), '{}');
    mk('a', 'b', '.vibe');
    const start = mk('a', 'b', 'c');
    expect(findProjectRoot(start, home)).toBe(a);
  });
});
