import fs from 'node:fs';
import path from 'node:path';
import { usage } from '../errors.js';
import { formatOf, parseTable, type Cell, type Table } from '../table.js';
import { readDocx, readPptx, readXlsx, type Sheet } from './office.js';
import { readPdf } from './pdf.js';

/**
 * `vibe read` — the harness reads documents so every client gets the same text: xlsx · docx ·
 * pptx (Office XML, no dependency), pdf (pdftotext or built-in), and the table formats. Images are
 * not read here: the client's own model sees them.
 */
export type DocFormat = 'xlsx' | 'docx' | 'pptx' | 'pdf' | 'csv' | 'tsv' | 'jsonl' | 'json' | 'text';

export interface Section {
  title: string;
  text: string;
  table?: Table;
}
export interface Document {
  file: string;
  format: DocFormat;
  method: string;
  sections: Section[];
  /** Plain text of the whole document, sections joined */
  text: string;
  truncated: boolean;
}

export interface ReadOptions {
  sheet?: string;
  pages?: string;
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 60_000;

export function docFormatOf(file: string): DocFormat {
  const ext = path.extname(file).toLowerCase().slice(1);
  if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xltx') return 'xlsx';
  if (ext === 'docx' || ext === 'dotx') return 'docx';
  if (ext === 'pptx' || ext === 'potx') return 'pptx';
  if (ext === 'pdf') return 'pdf';
  return formatOf(file) ?? 'text';
}

function cellText(c: Cell): string {
  return c === null ? '' : String(c);
}

export function sheetToTable(sheet: Sheet): Table {
  const [head = [], ...rest] = sheet.rows;
  const columns = head.map((h, i) => (cellText(h).trim() || `col${i + 1}`));
  const rows = rest.filter((r) => r.some((c) => c !== null && c !== '')).map((r) => Object.fromEntries(columns.map((c, i) => [c, (r[i] ?? null) as Cell])));
  return { format: 'csv', columns, rows };
}

export function tableMarkdown(table: Table, maxRows = 50): string {
  const line = (cells: string[]): string => `| ${cells.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`;
  const out = [line(table.columns), line(table.columns.map(() => '---')), ...table.rows.slice(0, maxRows).map((r) => line(table.columns.map((c) => cellText(r[c] ?? null))))];
  if (table.rows.length > maxRows) out.push(`| … ${table.rows.length - maxRows} more rows |`);
  return out.join('\n');
}

function pageRange(spec: string | undefined, count: number): number[] {
  if (!spec) return [...Array(count).keys()];
  const m = /^(\d+)(?:-(\d+))?$/.exec(spec);
  if (!m) throw usage('--pages takes N or A-B');
  const a = Number(m[1]);
  const b = Number(m[2] ?? m[1]);
  return [...Array(count).keys()].filter((i) => i + 1 >= a && i + 1 <= b);
}

function sections(file: string, format: DocFormat, buf: Buffer, options: ReadOptions): { method: string; sections: Section[] } {
  if (format === 'xlsx') {
    const sheets = readXlsx(buf).filter((s) => !options.sheet || s.name === options.sheet);
    if (options.sheet && sheets.length === 0) throw usage(`no sheet named ${options.sheet}`);
    return { method: 'office-xml', sections: sheets.map((s) => ({ title: s.name, table: sheetToTable(s), text: tableMarkdown(sheetToTable(s)) })) };
  }
  if (format === 'docx') return { method: 'office-xml', sections: readDocx(buf).map((b, i) => ({ title: b.kind === 'table' ? `table ${i + 1}` : `¶${i + 1}`, text: b.text })) };
  if (format === 'pptx') return { method: 'office-xml', sections: readPptx(buf).map((s) => ({ title: `slide ${s.slide}`, text: s.text })) };
  if (format === 'pdf') {
    const pdf = readPdf(file, buf);
    return { method: pdf.method, sections: pageRange(options.pages, pdf.pages.length).map((i) => ({ title: `page ${i + 1}`, text: pdf.pages[i] ?? '' })) };
  }
  if (format === 'text') return { method: 'utf-8', sections: [{ title: path.basename(file), text: buf.toString('utf-8') }] };
  const table = parseTable(buf.toString('utf-8'), format);
  return { method: 'table', sections: [{ title: path.basename(file), table, text: tableMarkdown(table) }] };
}

export function readDocument(root: string, file: string, options: ReadOptions = {}): Document {
  const target = path.resolve(root, file);
  if (!fs.existsSync(target)) throw usage(`no such file: ${file}`);
  const format = docFormatOf(file);
  let buf: Buffer;
  try {
    buf = fs.readFileSync(target);
  } catch (error) {
    throw usage(`cannot read ${file}: ${(error as Error).message}`);
  }
  let parsed: { method: string; sections: Section[] };
  try {
    parsed = sections(target, format, buf, options);
  } catch (error) {
    if ((error as { exitCode?: number }).exitCode) throw error;
    throw usage(`cannot parse ${file} as ${format}: ${(error as Error).message}`);
  }
  const max = options.maxChars ?? DEFAULT_MAX_CHARS;
  let text = parsed.sections.map((s) => `## ${s.title}\n${s.text}`).join('\n\n');
  const truncated = text.length > max;
  if (truncated) text = `${text.slice(0, max)}\n… truncated at ${max} characters — use --sheet or --pages`;
  return { file, format, method: parsed.method, sections: parsed.sections, text, truncated };
}

/** Table view of a spreadsheet for `vibe profile`: the named sheet, or the first. */
export function xlsxTable(buf: Buffer, sheet?: string): Table {
  const sheets = readXlsx(buf);
  const chosen = sheet ? sheets.find((s) => s.name === sheet) : sheets[0];
  if (!chosen) throw usage(sheet ? `no sheet named ${sheet}` : 'the workbook has no sheets');
  return sheetToTable(chosen);
}
