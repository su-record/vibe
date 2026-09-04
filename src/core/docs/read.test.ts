import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { zipStore } from '../../install/mcpb.js';
import { VibeError } from '../errors.js';
import { profileFile } from '../profile.js';
import { readDocument } from './read.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-read-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const b = (s: string): Buffer => Buffer.from(s, 'utf-8');

function xlsx(): Buffer {
  return zipStore([
    { name: 'xl/workbook.xml', data: b('<workbook xmlns:r="r"><sheets><sheet name="Orders" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets></workbook>') },
    { name: 'xl/_rels/workbook.xml.rels', data: b('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>') },
    { name: 'xl/sharedStrings.xml', data: b('<sst><si><t>order_id</t></si><si><t>amount</t></si><si><t>seller</t></si><si><r><t>Han </t></r><r><t>Traders</t></r></si><si><t>Kim &amp; Co</t></si></sst>') },
    { name: 'xl/worksheets/sheet1.xml', data: b('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2"><v>1001</v></c><c r="B2"><v>1200.5</v></c><c r="C2" t="s"><v>3</v></c></row><row r="3"><c r="A3"><v>1002</v></c><c r="C3" t="s"><v>4</v></c></row><row r="4"><c r="A4"><v>1003</v></c><c r="B4" t="inlineStr"><is><t>n/a</t></is></c><c r="C4" t="b"><v>1</v></c></row></sheetData></worksheet>') },
    { name: 'xl/worksheets/sheet2.xml', data: b('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>memo</t></is></c></row></sheetData></worksheet>') },
  ]);
}

describe('vibe read — the harness reads documents so every client gets the same text', () => {
  it('read: xlsx sheets become tables (shared strings, inline strings, numbers, booleans, gaps); profile reads the first or named sheet', () => {
    fs.writeFileSync(path.join(root, 'orders.xlsx'), xlsx());
    const d = readDocument(root, 'orders.xlsx');
    expect(d).toMatchObject({ format: 'xlsx', method: 'office-xml' });
    expect(d.sections.map((s) => s.title)).toEqual(['Orders', 'Notes']);
    const table = d.sections[0]!.table!;
    expect(table.columns).toEqual(['order_id', 'amount', 'seller']);
    expect(table.rows).toEqual([{ order_id: 1001, amount: 1200.5, seller: 'Han Traders' }, { order_id: 1002, amount: null, seller: 'Kim & Co' }, { order_id: 1003, amount: 'n/a', seller: true }]);
    expect(d.text).toContain('| order_id | amount | seller |');
    expect(readDocument(root, 'orders.xlsx', { sheet: 'Notes' }).sections).toHaveLength(1);
    expect(() => readDocument(root, 'orders.xlsx', { sheet: 'Nope' })).toThrowError(/no sheet/);
    const p = profileFile(root, 'orders.xlsx');
    expect(p).toMatchObject({ rows: 3 });
    expect(p.columns.find((c) => c.name === 'amount')).toMatchObject({ type: 'mixed', missing: 1 });
    expect(profileFile(root, 'orders.xlsx', 'Notes').columns.map((c) => c.name)).toEqual(['memo']);
  });

  it('read: docx paragraphs and tables in order; pptx slides in number order', () => {
    fs.writeFileSync(path.join(root, 'brief.docx'), zipStore([{ name: 'word/document.xml', data: b('<w:document><w:body><w:p><w:r><w:t>Settlement </w:t></w:r><w:r><w:t>brief</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>seller</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>total</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Han</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2,200</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>Send by Friday.</w:t></w:r></w:p></w:body></w:document>') }]));
    const doc = readDocument(root, 'brief.docx');
    expect(doc.sections.map((s) => s.text)).toEqual(['Settlement brief', 'seller | total\nHan | 2,200', 'Send by Friday.']);
    fs.writeFileSync(path.join(root, 'deck.pptx'), zipStore([
      { name: 'ppt/slides/slide10.xml', data: b('<p:sld><p:txBody><a:p><a:r><a:t>Ten</a:t></a:r></a:p></p:txBody></p:sld>') },
      { name: 'ppt/slides/slide2.xml', data: b('<p:sld><p:txBody><a:p><a:r><a:t>Two </a:t></a:r><a:r><a:t>&amp; more</a:t></a:r></a:p><a:p><a:r><a:t>second line</a:t></a:r></a:p></p:txBody></p:sld>') },
    ]));
    const deck = readDocument(root, 'deck.pptx');
    expect(deck.sections.map((s) => [s.title, s.text])).toEqual([['slide 2', 'Two & more\nsecond line'], ['slide 10', 'Ten']]);
  });

  it('read: pdf text through the built-in reader (plain and FlateDecode streams), page ranges, and the method is named', () => {
    const stream = (content: string, flate: boolean): string => {
      const data = flate ? zlib.deflateSync(Buffer.from(content, 'latin1')).toString('latin1') : content;
      return `<< /Length ${data.length}${flate ? ' /Filter /FlateDecode' : ''} >>\nstream\n${data}\nendstream`;
    };
    const pdf = `%PDF-1.4\n1 0 obj\n${stream('BT /F1 12 Tf 72 700 Td (Hello) Tj (, world) Tj T* [(Tot) -500 (al 4500.5)] TJ ET', false)}\nendobj\n2 0 obj\n${stream("BT (Page two) Tj (line \\(two\\)) ' ET", true)}\nendobj\ntrailer\n<< >>\n%%EOF`;
    fs.writeFileSync(path.join(root, 'report.pdf'), Buffer.from(pdf, 'latin1'));
    const d = readDocument(root, 'report.pdf');
    expect(d.method).toMatch(/^(builtin|pdftotext)$/);
    if (d.method === 'builtin') {
      expect(d.sections.map((s) => s.text)).toEqual(['Hello, world\nTot al 4500.5', 'Page two\nline (two)']);
      expect(readDocument(root, 'report.pdf', { pages: '2' }).sections.map((s) => s.title)).toEqual(['page 2']);
    }
    expect(() => readDocument(root, 'report.pdf', { pages: 'x' })).toThrowError(VibeError);
  });

  it('read: tables and plain text pass through; a long document is truncated with a hint; missing files are usage errors', () => {
    fs.writeFileSync(path.join(root, 'a.csv'), 'x,y\n1,2\n');
    expect(readDocument(root, 'a.csv').text).toContain('| x | y |');
    fs.writeFileSync(path.join(root, 'notes.md'), 'hello');
    expect(readDocument(root, 'notes.md')).toMatchObject({ format: 'text', method: 'utf-8' });
    fs.writeFileSync(path.join(root, 'big.txt'), 'a'.repeat(500));
    const big = readDocument(root, 'big.txt', { maxChars: 100 });
    expect(big.truncated).toBe(true);
    expect(big.text).toContain('truncated at 100');
    expect(() => readDocument(root, 'missing.pdf')).toThrowError(/no such file/);
  });
});
