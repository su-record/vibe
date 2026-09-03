import fs from 'node:fs';
import path from 'node:path';
import { usage } from './errors.js';
import { formatOf, parseTable, type Cell, type Table } from './table.js';

/**
 * Sample profiling — what the harness tells the model before the interview: columns, types,
 * missing values, duplicates, row count. Anomalies come first, at most three, each with its
 * number, so the model can say them before the user asks.
 */
export type CellType = 'number' | 'string' | 'boolean' | 'date' | 'empty';

export interface ColumnProfile {
  name: string;
  type: CellType | 'mixed';
  types: Partial<Record<CellType, number>>;
  missing: number;
  distinct: number;
  min?: number;
  max?: number;
  sample: Cell[];
}

export interface Profile {
  file: string;
  format: Table['format'];
  rows: number;
  columns: ColumnProfile[];
  duplicateRows: number;
  anomalies: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/;
const SAMPLE_SIZE = 3;
const MAX_ANOMALIES = 3;

function typeOf(cell: Cell): CellType {
  if (cell === null) return 'empty';
  if (typeof cell === 'number') return 'number';
  if (typeof cell === 'boolean') return 'boolean';
  return DATE_RE.test(cell.trim()) ? 'date' : 'string';
}

function profileColumn(name: string, cells: Cell[]): ColumnProfile {
  const types: Partial<Record<CellType, number>> = {};
  const distinct = new Set<string>();
  const numbers: number[] = [];
  const sample: Cell[] = [];
  for (const cell of cells) {
    const t = typeOf(cell);
    types[t] = (types[t] ?? 0) + 1;
    if (cell === null) continue;
    distinct.add(String(cell));
    if (typeof cell === 'number') numbers.push(cell);
    if (sample.length < SAMPLE_SIZE && !sample.includes(cell)) sample.push(cell);
  }
  const present = (Object.keys(types) as CellType[]).filter((t) => t !== 'empty');
  const type: ColumnProfile['type'] = present.length === 0 ? 'empty' : present.length === 1 ? present[0]! : 'mixed';
  const column: ColumnProfile = { name, type, types, missing: types.empty ?? 0, distinct: distinct.size, sample };
  if (numbers.length > 0) {
    column.min = Math.min(...numbers);
    column.max = Math.max(...numbers);
  }
  return column;
}

function anomaliesOf(table: Table, columns: ColumnProfile[], duplicateRows: number): string[] {
  const found: string[] = [];
  if (duplicateRows > 0) found.push(`${duplicateRows} duplicate rows (identical in every column)`);
  for (const c of columns) {
    if (c.type === 'empty') found.push(`column "${c.name}" is empty in every row`);
    else if (c.type === 'mixed') found.push(`column "${c.name}" mixes ${Object.keys(c.types).filter((t) => t !== 'empty').join(' and ')}`);
    else if (c.missing > 0) found.push(`column "${c.name}" is missing in ${c.missing} of ${table.rows.length} rows`);
  }
  const untitled = table.columns.filter((c) => c === '').length;
  if (untitled > 0) found.push(`${untitled} columns have no header`);
  return found.slice(0, MAX_ANOMALIES);
}

export function profileTable(table: Table, file: string): Profile {
  const columns = table.columns.map((name) => profileColumn(name, table.rows.map((r) => r[name] ?? null)));
  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of table.rows) {
    const key = JSON.stringify(table.columns.map((c) => row[c] ?? null));
    if (seen.has(key)) duplicateRows += 1;
    else seen.add(key);
  }
  return { file, format: table.format, rows: table.rows.length, columns, duplicateRows, anomalies: anomaliesOf(table, columns, duplicateRows) };
}

export function profileFile(root: string, file: string): Profile {
  const format = formatOf(file);
  if (!format) throw usage(`cannot profile ${path.extname(file) || 'a file without extension'} — csv · tsv · jsonl · json (export spreadsheets as CSV)`);
  const target = path.resolve(root, file);
  if (!fs.existsSync(target)) throw usage(`no such file: ${file}`);
  let table: Table;
  try {
    table = parseTable(fs.readFileSync(target, 'utf-8'), format);
  } catch (error) {
    throw usage(`cannot parse ${file}: ${(error as Error).message}`);
  }
  return profileTable(table, file);
}
