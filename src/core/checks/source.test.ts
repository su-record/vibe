import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
