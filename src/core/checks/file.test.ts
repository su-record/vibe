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

  it('absent: a clean file passes, a placeholder fails naming line and text, a bad expression is reported', () => {
    fs.writeFileSync(path.join(root, 'clean.md'), '# Ward 4B roster\n\nAssign, swap, print.\n');
    fs.writeFileSync(path.join(root, 'draft.md'), '# Title\n\nLorem ipsum dolor.\n\n[[keep this tone]] The figure is TBD.\n');
    const absent = 'Lorem ipsum|\\[TODO\\]|\\bTBD\\b|Your Company|\\{\\{|\\[\\[';
    expect(fileCheck({ type: 'file', path: 'clean.md', absent }, root)).toMatchObject({ pass: true });
    const hit = fileCheck({ type: 'file', path: 'draft.md', absent }, root);
    expect(hit).toMatchObject({ pass: false, reason: 'forbidden text present' });
    expect(hit.tail).toBe('line 3: Lorem ipsum\nline 5: [[\nline 5: TBD');
    expect(fileCheck({ type: 'file', path: 'clean.md', absent: '(' }, root).reason).toMatch(/^bad absent/);
    // the named preset is the same expression, and combines with the author's own
    expect(fileCheck({ type: 'file', path: 'draft.md', absent: '@placeholders' }, root).tail).toBe('line 3: Lorem ipsum\nline 5: [[\nline 5: TBD');
    expect(fileCheck({ type: 'file', path: 'clean.md', absent: '@placeholders|swap' }, root).tail).toBe('line 3: swap');
  });

  it('traceable: every number is in the evidence, a missing one is named by line, a fenced number is ignored', () => {
    fs.writeFileSync(path.join(root, 'evidence.md'), 'bundle 37,576 chars; 13132 tokens; $0.044 then $0.0053; 9.8 s; 5.3 s; measured 2026-09-06\n');
    fs.writeFileSync(path.join(root, 'report.md'), 'A 37,576-character bundle cost 13,132 tokens and $0.044, then $0.0053 in 5.3 s.\n\n```\nport 8080\n```\n\nDated 2026.\n');
    expect(fileCheck({ type: 'file', path: 'report.md', traceable: 'evidence.md' }, root)).toMatchObject({ pass: true });
    fs.appendFileSync(path.join(root, 'report.md'), 'Latency fell 41% to 90 ms.\n');
    const miss = fileCheck({ type: 'file', path: 'report.md', traceable: 'evidence.md' }, root);
    expect(miss).toMatchObject({ pass: false, reason: 'untraceable number' });
    expect(miss.tail).toBe('line 8: 41%\nline 8: 90');
    expect(fileCheck({ type: 'file', path: 'report.md', traceable: 'nowhere.md' }, root).reason).toBe('evidence file missing: nowhere.md');
  });

  it('a11y: alt, heading order, unnamed controls, unlabelled inputs and contrast are named by line; a clean page passes', () => {
    fs.writeFileSync(path.join(root, 'bad.html'), [
      '<style>',
      '.muted { color: #999; background: #fff; }',
      '</style>',
      '<h1>Roster</h1>',
      '<h3>Shifts</h3>',
      '<img src="a.png">',
      '<button></button>',
      '<input type="text" id="q">',
      '<a href="/x"><span></span></a>',
    ].join('\n'));
    const r = fileCheck({ type: 'file', path: 'bad.html', a11y: true }, root);
    expect(r).toMatchObject({ pass: false, reason: 'accessibility defect' });
    expect(r.tail).toBe('line 2: contrast 2.85:1 for color #999 on #fff\nline 5: heading skips from h1 to h3\nline 6: <img> without alt');
    fs.writeFileSync(path.join(root, 'good.html'), '<style>.ink { color: #1a1a1a; background: #fff; }</style>\n<h1>Roster</h1>\n<h2>Shifts</h2>\n<img src="a.png" alt="ward map">\n<button>Assign</button>\n<label for="q">Search</label><input type="text" id="q">\n<a href="/x" aria-label="home"></a>\n');
    expect(fileCheck({ type: 'file', path: 'good.html', a11y: true }, root)).toMatchObject({ pass: true });
    fs.writeFileSync(path.join(root, 'theme.css'), '.a { color: rgb(120,120,120); background-color: #ffffff; }\n.b { color: #000; background: #fff; }\n');
    expect(fileCheck({ type: "file", path: "theme.css", a11y: true }, root).tail).toBe("line 1: contrast 4.42:1 for color rgb(120,120,120) on #ffffff");
  });
});
