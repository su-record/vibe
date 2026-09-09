import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileCheck } from '../src/core/checks/file.js';
import { parseScenarios } from '../src/core/scenarios.js';

describe('file check — lines rule', () => {
  it('parseScenarios accepts lines as the only rule', () => {
    const r = parseScenarios('- { id: short, then: x, check: { type: file, path: a.md, lines: { max: 3 } } }\n');
    expect(r.rejections).toEqual([]);
    expect(r.scenarios[0]?.check).toMatchObject({ type: 'file', lines: { max: 3 } });
  });

  it('fileCheck fails over the limit naming the count and passes within it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-lines-'));
    fs.writeFileSync(path.join(root, 'a.md'), 'one\ntwo\nthree\nfour\nfive\n');
    const over = fileCheck({ type: 'file', path: 'a.md', lines: { max: 3 } } as never, root);
    expect(over.pass).toBe(false);
    expect(`${over.reason ?? ''} ${over.tail}`).toMatch(/5/);
    expect(fileCheck({ type: 'file', path: 'a.md', lines: { max: 10 } } as never, root).pass).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
