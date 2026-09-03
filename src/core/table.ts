import path from 'node:path';

/**
 * Tables — the FDE's raw material. CSV / TSV / JSONL / JSON (array of objects) become rows of
 * cells. No Excel: the harness has no zip reader and takes no dependency for it — export a CSV.
 */
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
export interface Table {
  format: 'csv' | 'tsv' | 'jsonl' | 'json';
  columns: string[];
  rows: Row[];
}

export function formatOf(file: string): Table['format'] | null {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.tsv') return 'tsv';
  if (ext === '.jsonl' || ext === '.ndjson') return 'jsonl';
  if (ext === '.json') return 'json';
  return null;
}

/** RFC 4180 fields: quotes, doubled quotes, delimiters and newlines inside quotes. */
function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((r) => !(r.length === 1 && r[0] === ''));
}

function cellOf(raw: string): Cell {
  const text = raw.trim();
  if (text === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(text) || /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) return Number(text.replace(/,/g, ''));
  if (text === 'true' || text === 'false') return text === 'true';
  return raw;
}

function fromDelimited(text: string, delimiter: string, format: 'csv' | 'tsv'): Table {
  const records = splitRecords(text.replace(/^﻿/, ''), delimiter);
  const columns = (records[0] ?? []).map((c) => c.trim());
  const rows = records.slice(1).map((r) => Object.fromEntries(columns.map((c, i) => [c, cellOf(r[i] ?? '')])));
  return { format, columns, rows };
}

function normalise(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

function fromObjects(objects: unknown[], format: 'jsonl' | 'json'): Table {
  const columns: string[] = [];
  const rows: Row[] = [];
  for (const item of objects) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const row: Row = {};
    for (const [key, value] of Object.entries(item)) {
      if (!columns.includes(key)) columns.push(key);
      row[key] = normalise(value);
    }
    rows.push(row);
  }
  return { format, columns, rows };
}

export function parseTable(text: string, format: Table['format']): Table {
  if (format === 'csv') return fromDelimited(text, ',', 'csv');
  if (format === 'tsv') return fromDelimited(text, '\t', 'tsv');
  if (format === 'jsonl') {
    return fromObjects(text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as unknown), 'jsonl');
  }
  const parsed = JSON.parse(text) as unknown;
  return fromObjects(Array.isArray(parsed) ? parsed : [parsed], 'json');
}
