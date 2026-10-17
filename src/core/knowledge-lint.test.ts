import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { lintWiki, wikiLinks } from './knowledge-lint.js';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-wiki-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function page(name: string, text: string): void {
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), text);
}

it('reads the link target from plain, labelled and heading links', () => {
  expect(wikiLinks('see [[a]], [[projects/b|B]] and [[c#Setup]]; not [x] or [[ ]]')).toEqual(['a', 'projects/b', 'c']);
});

it('resolves links by path or file name, case-insensitively, and reports broken links, orphans and long pages', () => {
  page('index.md', '- [[projects/vibe]] release notes\n- [[Practices]]\n- [[missing page]]\n');
  page('log.md', '- 2026-10-15 · [[projects/gone]] · files changed\n');
  page('projects/vibe.md', 'uses [[practices.md]] and [[vibe]] itself\n');
  page('practices.md', `${'line\n'.repeat(200)}`);
  page('lonely.md', 'links to [[index]]');
  page('.obsidian/workspace.md', '[[nowhere]]');
  const r = lintWiki(dir);
  expect(r.pages).toBe(5);
  expect(r.broken).toEqual([{ page: 'index', target: 'missing page' }, { page: 'log', target: 'projects/gone' }]);
  expect(r.orphans).toEqual(['lonely']);
  expect(r.unlinked).toEqual([]);
  expect(r.long).toEqual([{ page: 'practices', lines: 201 }]);
  expect(r.partial).toBe(false);
});

it('reports a page whose type is not one the guide names', () => {
  page('index.md', '- [[a]] [[b]] [[c]]');
  page('a.md', '---\ntype: decision\n---\n# A');
  page('b.md', '---\nsummary: x\ntype: "Note"\n---\n# B');
  page('c.md', '# C\n\ntype: whatever, not a property');
  expect(lintWiki(dir).badType).toEqual([{ page: 'b', type: 'Note' }]);
});

it('reports an empty result for a wiki that does not exist yet', () => {
  expect(lintWiki(path.join(dir, 'none'))).toMatchObject({ pages: 0, broken: [], orphans: [], long: [] });
});

it('follows a linked project folder once: its pages resolve links and are checked, and are unlinked rather than orphans', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-wiki-project-'));
  try {
    fs.writeFileSync(path.join(project, 'customer.md'), 'see [[conventions]] and [[nowhere]]');
    fs.writeFileSync(path.join(project, 'conventions.md'), `${'rule\n'.repeat(200)}`);
    fs.writeFileSync(path.join(project, 'unlinked.md'), 'no page links here');
    fs.symlinkSync(project, path.join(project, 'loop'), 'junction');
    page('index.md', '- [[projects/app/customer]]');
    fs.mkdirSync(path.join(dir, 'projects'));
    fs.symlinkSync(project, path.join(dir, 'projects', 'app'), 'junction');
    const r = lintWiki(dir);
    expect(r.pages).toBe(4);
    expect(r.broken).toEqual([{ page: 'projects/app/customer', target: 'nowhere' }]);
    expect(r.orphans).toEqual([]);
    expect(r.unlinked).toEqual(['projects/app/unlinked']);
    expect(r.long).toEqual([{ page: 'projects/app/conventions', lines: 201 }]);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});
