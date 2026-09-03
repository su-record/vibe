import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileCheck } from './file.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-file-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('file check — sum', () => {
  it('sum: a column total of a CSV equals the reference, thousands separators and quotes included', () => {
    fs.writeFileSync(path.join(root, 'settlement.csv'), 'order,amount,note\n1,"1,200.50","a, b"\n2,800,\n3,,missing\n');
    expect(fileCheck({ type: 'file', path: 'settlement.csv', sum: { column: 'amount', equals: 2000.5 } }, root)).toMatchObject({ pass: true });
    const off = fileCheck({ type: 'file', path: 'settlement.csv', sum: { column: 'amount', equals: 2000 } }, root);
    expect(off).toMatchObject({ pass: false, reason: 'sum mismatch' });
    expect(off.tail).toBe('sum(amount) = 2000.5 over 2 numeric rows · expected 2000');
    expect(fileCheck({ type: 'file', path: 'settlement.csv', sum: { column: 'amount', equals: 2000, tolerance: 1 } }, root).pass).toBe(true);
    expect(fileCheck({ type: 'file', path: 'settlement.csv', sum: { column: 'total', equals: 1 } }, root).reason).toBe('no column "total"');
  });

  it('sum: works on JSONL and refuses a format it cannot read as a table', () => {
    fs.writeFileSync(path.join(root, 'rows.jsonl'), '{"n":1}\n{"n":2.5}\n{"n":"x"}\n');
    expect(fileCheck({ type: 'file', path: 'rows.jsonl', sum: { column: 'n', equals: 3.5 } }, root).pass).toBe(true);
    fs.writeFileSync(path.join(root, 'rows.txt'), 'n\n1\n');
    expect(fileCheck({ type: 'file', path: 'rows.txt', sum: { column: 'n', equals: 1 } }, root).reason).toContain('sum needs');
  });
});
