import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { findKnowledge, properties, queryTerms } from './knowledge-find.js';
import { packageRoot } from './paths.js';

let dir: string;
beforeEach(() => { dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-find-'))); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function page(name: string, text: string): void {
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), text);
}

it('reads properties as text or lists and leaves a page without them whole', () => {
  expect(properties('---\nsummary: "Ship it."\ntags: [release, npm]\naliases:\n  - publish flow\n  - 배포\nbad line\n---\n# T\n')).toEqual({
    props: { summary: 'Ship it.', tags: ['release', 'npm'], aliases: ['publish flow', '배포'] }, body: '# T\n' });
  expect(properties('# No properties\n---\n')).toEqual({ props: {}, body: '# No properties\n---\n' });
});

it('keeps the words of a query, without short Latin words or repeats', () => {
  expect(queryTerms('How to release the NPM package, release 배포 a')).toEqual(['release', 'npm', 'package', '배포']);
});

it('ranks a word in the title, aliases, tags or summary over repeats in the text, prefers pages matching every word, and shows what each page holds', () => {
  page('wiki/release.md', '---\nsummary: Releasing through a release branch and a tag.\ntags: [npm]\naliases: [배포 절차]\n---\n# Releasing vibe\n\nSteps.\n');
  page('wiki/notes.md', '# Notes\n\nWe talked about release once. Released, releasing, release.\n');
  page('wiki/npm-only.md', '# npm tokens\n\nThe npm token.\n');
  page('wiki/unrelated.md', '# Cooking\n\nRelevant? No; "prerelease" is not a word start.\n');
  page('wiki/projects/app.md', '- [[projects/app/billing]] the refund rule\n');
  const r = findKnowledge(path.join(dir, 'wiki'), 'release npm');
  expect(r.found.map(f => f.page)).toEqual(['release', 'npm-only', 'notes']);
  expect(r.found[0]).toMatchObject({ title: 'Releasing vibe', summary: 'Releasing through a release branch and a tag.', tags: ['npm'], file: path.join(dir, 'wiki', 'release.md') });
  expect(r.found[2]).toMatchObject({ summary: 'We talked about release once. Released, releasing, release.' });
  expect(findKnowledge(path.join(dir, 'wiki'), '배포').found.map(f => f.page)).toEqual(['release']);
  expect(findKnowledge(path.join(dir, 'wiki'), 'the a').found).toEqual([]);
  expect(findKnowledge(path.join(dir, 'wiki'), 'release', [], 1).found).toHaveLength(1);
});

it('searches the project\'s shared folder once, through the wiki\'s link when there is one, and a missing wiki finds nothing', () => {
  page('project/.vibe/knowledge/billing.md', '# Billing\n\nThe refund rule.\n');
  const shared = path.join(dir, 'project', '.vibe', 'knowledge');
  expect(findKnowledge(path.join(dir, 'none'), 'refund', [shared]).found).toMatchObject([{ page: null, file: path.join(shared, 'billing.md') }]);
  fs.mkdirSync(path.join(dir, 'wiki', 'projects'), { recursive: true });
  fs.symlinkSync(shared, path.join(dir, 'wiki', 'projects', 'app'), 'junction');
  expect(findKnowledge(path.join(dir, 'wiki'), 'refund', [shared]).found).toMatchObject([{ page: 'projects/app/billing', title: 'Billing' }]);
});

it('answers vibe knowledge find with the pages and rejects a call without words or with a bad limit', () => {
  page('wiki/release.md', '---\nsummary: Releasing through a tag.\ntags: [npm]\n---\n# Releasing vibe\n');
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, VIBE_HOME_DIR: dir, VIBE_SKIP_SETUP: '1' };
  const cli = (...args: string[]) => spawnSync(process.execPath, [path.join(packageRoot(), 'dist/cli.js'), 'knowledge', 'find', ...args], { cwd: dir, env, encoding: 'utf8', timeout: 20000 });
  const text = cli('release', '--dir', path.join(dir, 'wiki'));
  expect(text.status).toBe(0);
  expect(text.stdout).toContain('[[release]] · Releasing vibe — Releasing through a tag. #npm');
  expect(JSON.parse(cli('release', 'tag', '--dir', path.join(dir, 'wiki'), '--json').stdout).found).toHaveLength(1);
  expect(cli('cooking', '--dir', path.join(dir, 'wiki')).stdout).toContain('nothing matches');
  expect(cli().status).toBe(2);
  expect(cli('release', '--limit', '0').status).toBe(2);
});

it('ranks a superseded or archived page below the current one, says so, and narrows by type', () => {
  page('wiki/release-old.md', '---\nsummary: Release by pushing to main.\ntype: decision\n---\n# Release flow\n');
  page('wiki/release-new.md', '---\nsummary: Release through a release branch.\ntype: decision\nsupersedes: "[[release-old]]"\n---\n# Release flow\n');
  page('wiki/projects/legacy.md', '---\nsummary: The release of a finished project.\ntype: project\nstatus: archived\n---\n# Legacy release\n');
  page('wiki/release-steps.md', '---\nsummary: Steps to release.\ntype: method\n---\n# Release steps\n');
  const r = findKnowledge(path.join(dir, 'wiki'), 'release');
  expect(r.found.map(f => [f.page, f.state])).toEqual([['release-new', 'current'], ['release-steps', 'current'], ['projects/legacy', 'archived'], ['release-old', 'superseded']]);
  expect(r.found.find(f => f.page === 'release-old')).toMatchObject({ supersededBy: 'release-new', type: 'decision' });
  expect(findKnowledge(path.join(dir, 'wiki'), 'release', [], 8, 'decision').found.map(f => f.page)).toEqual(['release-new', 'release-old']);
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, VIBE_HOME_DIR: dir, VIBE_SKIP_SETUP: '1' };
  const cli = (...args: string[]) => spawnSync(process.execPath, [path.join(packageRoot(), 'dist/cli.js'), 'knowledge', 'find', ...args, '--dir', path.join(dir, 'wiki')], { cwd: dir, env, encoding: 'utf8', timeout: 20000 });
  expect(cli('release', '--type', 'decision').stdout).toContain('[[release-old]] [decision] (superseded by release-new) · Release flow');
  expect(cli('release').stdout).toContain('[[projects/legacy]] [project] (archived)');
  expect(cli('release', '--type', 'note').status).toBe(2);
});
