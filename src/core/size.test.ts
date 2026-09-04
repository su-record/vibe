import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { measureSize } from './size.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-size-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('vibe size — a built-in check for files and functions', () => {
  it('size: counts files, finds a file and a function over the limits, skips tests and node_modules, reads python by indentation', () => {
    fs.mkdirSync(path.join(root, 'src', 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'a.ts'), `export function small(): number {\n  return 1;\n}\n\nexport async function big(x: string): Promise<void> {\n${'  x = x;\n'.repeat(60)}}\n\nconst arrow = async (a: number) => {\n  return a;\n};\n`);
    fs.writeFileSync(path.join(root, 'src', 'a.test.ts'), 'x'.repeat(10).split('').join('\n'));
    fs.writeFileSync(path.join(root, 'src', 'node_modules', 'dep.js'), 'y\n'.repeat(999));
    fs.writeFileSync(path.join(root, 'src', 'long.js'), 'let z = 1;\n'.repeat(120));
    fs.writeFileSync(path.join(root, 'src', 'p.py'), `def ok():\n    return 1\n\ndef long_one():\n${'    pass\n'.repeat(55)}\nclass K:\n    def m(self):\n        return 2\n`);
    const r = measureSize(root, ['src'], { maxFile: 100, maxFunction: 50 });
    expect(r.files).toBe(3);
    expect(r.largestFile).toEqual({ file: 'src/long.js', lines: 121 });
    expect(r.findings.map((f) => `${f.kind}:${f.name}:${f.lines}`).sort()).toEqual(['file:src/long.js:121', 'function:big:62', 'function:long_one:56']);
    expect(measureSize(root, ['src/a.ts'], { maxFile: 400, maxFunction: 100 }).findings).toEqual([]);
  });
});
