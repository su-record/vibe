import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { indexProject, linkProject, projectName } from './knowledge-projects.js';

let home: string;
beforeEach(() => { home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-projects-'))); });
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));
function folder(...parts: string[]): string {
  const dir = path.join(home, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const names = () => JSON.parse(fs.readFileSync(path.join(home, '.config', 'vibe', 'knowledge-projects.json'), 'utf8')).names;

it('names a project by its folder, marks a second folder of the same name and keeps each choice', () => {
  const first = folder('work', 'app'), second = folder('client', 'app'), odd = folder('a[b]#c');
  expect(projectName(second, home, false)).toBe('app');
  expect(fs.existsSync(path.join(home, '.config'))).toBe(false);
  expect(projectName(first, home)).toBe('app');
  const marked = projectName(second, home);
  expect(marked).toMatch(/^app-[a-f0-9]{6}$/);
  expect(projectName(second, home)).toBe(marked);
  expect(projectName(first, home)).toBe('app');
  expect(projectName(odd, home)).toBe('a-b--c');
  expect(names()).toEqual({ app: first, [marked]: second, 'a-b--c': odd });
  fs.writeFileSync(path.join(home, '.config', 'vibe', 'knowledge-projects.json'), '{"names":[]}');
  expect(projectName(second, home, false)).toBe('app');
});

it('links a vibe project\'s shared knowledge into the wiki once, and never into a synced wiki or one inside the project', () => {
  const wiki = folder('wiki');
  const plain = folder('plain');
  expect(linkProject(plain, wiki, 'plain')).toBe('none');
  expect(fs.existsSync(path.join(plain, '.vibe'))).toBe(false);
  const project = folder('repo');
  fs.mkdirSync(path.join(project, '.vibe'));
  expect(linkProject(project, wiki, 'repo')).toBe('linked');
  fs.writeFileSync(path.join(wiki, 'projects', 'repo', 'domain.md'), '# Domain');
  expect(fs.readFileSync(path.join(project, '.vibe', 'knowledge', 'domain.md'), 'utf8')).toBe('# Domain');
  expect(linkProject(project, wiki, 'repo')).toBe('linked');
  expect(linkProject(folder('other', 'repo'), wiki, 'repo')).toBe('none');
  const other = folder('other', 'repo');
  fs.mkdirSync(path.join(other, '.vibe'));
  expect(linkProject(other, wiki, 'repo')).toBe('taken');
  fs.mkdirSync(path.join(wiki, 'projects', 'mine'));
  expect(linkProject(other, wiki, 'mine')).toBe('taken');
  expect(linkProject(project, path.join(project, 'notes'), 'repo')).toBe('inside');
  const synced = folder('Dropbox', 'wiki');
  expect(linkProject(project, synced, 'repo')).toBe('synced');
  expect(fs.existsSync(path.join(synced, 'projects'))).toBe(false);
});

it('lists every shared page on the project page and the page in the index, keeping what others wrote', () => {
  const wiki = folder('wiki');
  const project = folder('repo');
  const shared = folder('repo', '.vibe', 'knowledge');
  fs.writeFileSync(path.join(shared, 'conventions.md'), '# C');
  fs.mkdirSync(path.join(shared, 'research'));
  fs.mkdirSync(path.join(shared, '.cache'));
  for (const file of ['research/b.md', 'research/a.md', 'research/odd#name.md', 'research/data.json', '.cache/x.md']) fs.writeFileSync(path.join(shared, file), 'x');
  indexProject(project, wiki, 'repo');
  const page = () => fs.readFileSync(path.join(wiki, 'projects', 'repo.md'), 'utf8');
  const block = ['<!-- vibe:shared-knowledge -->', 'Shared knowledge of this project (`.vibe/knowledge`), listed by vibe at each session start; edit outside this block.',
    '- pages: [[projects/repo/conventions]]', '- research: [[projects/repo/research/a]] · [[projects/repo/research/b]]', '<!-- /vibe:shared-knowledge -->'].join('\n');
  expect(page()).toBe(`# repo\n\n${block}\n`);
  expect(fs.readFileSync(path.join(wiki, 'index.md'), 'utf8')).toBe("# Index\n- [[projects/repo]] — this project's page and its shared knowledge\n");
  fs.writeFileSync(path.join(wiki, 'projects', 'repo.md'), `# Repo\nGoal: ship.\n\n${block}\n\n## Open\n- one\n`);
  fs.writeFileSync(path.join(wiki, 'index.md'), '# Index\n\n- [[projects/repo|Repo]] — mine\n');
  fs.rmSync(path.join(shared, 'research'), { recursive: true });
  indexProject(project, wiki, 'repo');
  expect(page()).toBe(`# Repo\nGoal: ship.\n\n${block.replace(/\n- research:[^\n]*/, '')}\n\n## Open\n- one\n`);
  expect(fs.readFileSync(path.join(wiki, 'index.md'), 'utf8')).toBe('# Index\n\n- [[projects/repo|Repo]] — mine\n');
  fs.rmSync(path.join(shared, 'conventions.md'));
  for (let i = 0; i < 202; i++) fs.writeFileSync(path.join(shared, `p${String(i).padStart(3, '0')}.md`), 'x');
  indexProject(project, wiki, 'repo.v2');
  const many = fs.readFileSync(path.join(wiki, 'projects', 'repo.v2.md'), 'utf8');
  expect(many).toContain('[[projects/repo.v2/p199]]\n- and 2 more pages\n');
  expect(many).not.toContain('p200');
  expect(fs.readFileSync(path.join(wiki, 'index.md'), 'utf8')).toContain('- [[projects/repo.v2]] —');
  const empty = folder('empty');
  folder('empty', '.vibe', 'knowledge');
  indexProject(empty, wiki, 'empty');
  expect(fs.readFileSync(path.join(wiki, 'projects', 'empty.md'), 'utf8')).toContain('\n- none yet\n');
});
