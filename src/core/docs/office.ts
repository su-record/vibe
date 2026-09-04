import { readZip } from './zip.js';
import { attr, bodies, decodeEntities, elements, textOf } from './xml.js';

/**
 * Office Open XML without a library: xlsx cells with shared strings, docx paragraphs and tables,
 * pptx slide text. Enough to read what a customer sends; not a renderer.
 */
export interface Sheet {
  name: string;
  rows: Array<Array<string | number | boolean | null>>;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function sharedStrings(zip: Map<string, Buffer>): string[] {
  const xml = zip.get('xl/sharedStrings.xml')?.toString('utf-8') ?? '';
  return bodies(xml, 'si').map((si) => textOf(si, 't'));
}

function sheetFiles(zip: Map<string, Buffer>): Array<{ name: string; file: string }> {
  const workbook = zip.get('xl/workbook.xml')?.toString('utf-8') ?? '';
  const rels = zip.get('xl/_rels/workbook.xml.rels')?.toString('utf-8') ?? '';
  const targets = new Map<string, string>();
  for (const r of elements(rels, 'Relationship')) {
    const id = attr(r.attrs, 'Id');
    const target = attr(r.attrs, 'Target');
    if (id && target) targets.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'));
  }
  return elements(workbook, 'sheet').map((s) => {
    const rid = attr(s.attrs, 'r:id') ?? '';
    return { name: attr(s.attrs, 'name') ?? 'Sheet', file: targets.get(rid) ?? '' };
  }).filter((s) => s.file);
}

function cellValue(attrs: string, body: string, strings: string[]): string | number | boolean | null {
  const type = attr(attrs, 't');
  if (type === 'inlineStr') return textOf(body, 't') || null;
  const v = bodies(body, 'v')[0];
  if (v === undefined || v === '') return null;
  if (type === 's') return strings[Number(v)] ?? null;
  if (type === 'b') return v === '1';
  if (type === 'str' || type === 'e') return decodeEntities(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : decodeEntities(v);
}

export function readXlsx(buf: Buffer): Sheet[] {
  const zip = readZip(buf);
  const strings = sharedStrings(zip);
  return sheetFiles(zip).map(({ name, file }) => {
    const xml = zip.get(file)?.toString('utf-8') ?? '';
    const rows: Sheet['rows'] = [];
    for (const row of elements(xml, 'row')) {
      const cells: Sheet['rows'][number] = [];
      for (const c of elements(row.body, 'c')) {
        const ref = attr(c.attrs, 'r');
        const idx = ref ? colIndex(ref) : cells.length;
        while (cells.length < idx) cells.push(null);
        cells[idx] = cellValue(c.attrs, c.body, strings);
      }
      rows.push(cells);
    }
    return { name, rows };
  });
}

export interface DocBlock {
  kind: 'paragraph' | 'table';
  text: string;
  rows?: string[][];
}

export function readDocx(buf: Buffer): DocBlock[] {
  const xml = readZip(buf).get('word/document.xml')?.toString('utf-8') ?? '';
  const body = bodies(xml, 'w:body')[0] ?? xml;
  const blocks: DocBlock[] = [];
  // top-level tables and paragraphs in document order: split on table boundaries
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/w:p>)/g;
  let depth = 0;
  for (const m of body.matchAll(re)) {
    const chunk = m[0];
    if (chunk.startsWith('<w:tbl>')) {
      const rows = bodies(chunk, 'w:tr').map((tr) => bodies(tr, 'w:tc').map((tc) => textOf(tc, 'w:t').trim()));
      blocks.push({ kind: 'table', text: rows.map((r) => r.join(' | ')).join('\n'), rows });
      depth = 0;
    } else if (depth === 0) {
      const text = textOf(chunk, 'w:t').trim();
      if (text) blocks.push({ kind: 'paragraph', text });
    }
  }
  return blocks;
}

export function readPptx(buf: Buffer): Array<{ slide: number; text: string }> {
  const zip = readZip(buf);
  const slides = [...zip.keys()].map((k) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(k)).filter((m): m is RegExpExecArray => m !== null).sort((a, b) => Number(a[1]) - Number(b[1]));
  return slides.map((m) => {
    const xml = zip.get(m[0])?.toString('utf-8') ?? '';
    const paragraphs = bodies(xml, 'a:p').map((p) => textOf(p, 'a:t').trim()).filter(Boolean);
    return { slide: Number(m[1]), text: paragraphs.join('\n') };
  });
}
