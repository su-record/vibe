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
  expect(r.long).toEqual([{ page: 'practices', lines: 201 }]);
  expect(r.partial).toBe(false);
});

it('reports an empty result for a wiki that does not exist yet', () => {
  expect(lintWiki(path.join(dir, 'none'))).toMatchObject({ pages: 0, broken: [], orphans: [], long: [] });
});
