import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { collectChanged, dependentsOf } from './changed.js';
import { collectSource } from './source.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-source-'));
  fs.mkdirSync(path.join(root, 'src', 'node_modules', 'dep'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'b.py'), 'print(1)\n');
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(root, 'src', 'page.html'), '<main></main>\n');
  fs.writeFileSync(path.join(root, 'src', 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(root, 'src', 'node_modules', 'dep', 'index.js'), 'x');
  fs.writeFileSync(path.join(root, 'src', 'dist', 'out.js'), 'x');
  fs.writeFileSync(path.join(root, 'src', 'blob.ts'), Buffer.from([0x68, 0x69, 0x00, 0x01]));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('source collector — what the reviewers read', () => {
  it('code: code files in order, numbered; node_modules, dist, the lock file and a binary are skipped; html is not code', () => {
    const r = collectSource(root, 'src', 400_000, 'code');
    expect(r.files).toEqual(['src/a.ts', 'src/b.py']);
    expect(r.text).toContain('<file path="src/a.ts">\n1| export const a = 1;\n</file>');
  });

  it('design: markup and styles, still without node_modules', () => {
    expect(collectSource(root, 'src', 400_000, 'design').files).toEqual(['src/a.ts', 'src/page.html']);
  });

  it('changed: git says what changed, one hop of importers joins with roles; a ref form; no repository fails; nothing changed passes', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-changed-'));
    const g = (...args: string[]): string => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    g('init', '-q');
    fs.mkdirSync(path.join(repo, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'lib', 'core.ts'), 'export const core = 1;\n');
    fs.writeFileSync(path.join(repo, 'src', 'uses.ts'), "import { core } from './lib/core.js';\nexport const u = core;\n");
    fs.writeFileSync(path.join(repo, 'src', 'other.ts'), 'export const o = 2;\n');
    fs.writeFileSync(path.join(repo, 'src', 'gone.ts'), 'export const gone = 3;\n');
    fs.writeFileSync(path.join(repo, 'src', 'mod.py'), 'X = 1\n');
    fs.writeFileSync(path.join(repo, 'src', 'app.py'), 'from .mod import X\n');
    fs.writeFileSync(path.join(repo, 'src', 'far.py'), 'import os\n');
    g('add', '.');
    g('commit', '-q', '-m', 'base');
    fs.appendFileSync(path.join(repo, 'src', 'lib', 'core.ts'), 'export const more = 2;\n');
    fs.appendFileSync(path.join(repo, 'src', 'mod.py'), 'Y = 2\n');
    fs.writeFileSync(path.join(repo, 'src', 'fresh.ts'), 'export const f = 1;\n');
    fs.rmSync(path.join(repo, 'src', 'gone.ts'));
    const c = collectChanged(repo, 'src', 400_000, 'code', true);
    expect(c.selection).toEqual({ ref: 'HEAD', changed: ['src/fresh.ts', 'src/lib/core.ts', 'src/mod.py'], dependents: ['src/app.py', 'src/uses.ts'] });
    expect(c.text.startsWith('Changed since HEAD: src/fresh.ts, src/lib/core.ts, src/mod.py\nDependents (one hop): src/app.py, src/uses.ts')).toBe(true);
    expect(c.text).toContain('<file path="src/lib/core.ts" role="changed">');
    expect(c.text).toContain('<file path="src/uses.ts" role="dependent">');
    expect(c.text).not.toContain('src/other.ts');
    expect(c.text).not.toContain('src/far.py');
    expect(dependentsOf(repo, 'src', [path.join(repo, 'src', 'lib', 'core.ts')], 'code')).toEqual([path.join(repo, 'src', 'uses.ts')]);
    g('add', '-A');
    g('commit', '-q', '-m', 'second');
    expect(collectChanged(repo, 'src', 400_000, 'code', 'HEAD~1').selection.changed).toEqual(['src/fresh.ts', 'src/lib/core.ts', 'src/mod.py']);
    const nothing = collectChanged(repo, 'src', 400_000, 'code', true);
    expect(nothing.selection.changed).toEqual([]);
    expect(nothing.selection.dependents).toEqual([]);
    expect(() => collectChanged(root, 'src', 400_000, 'code', true)).toThrow(/changed needs a git repository/);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});
