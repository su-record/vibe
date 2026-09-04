import fs from 'node:fs';
import path from 'node:path';
import { Ajv } from 'ajv';
import type { FileCheck } from '../scenarios.js';
import { formatOf, parseTable } from '../table.js';
import type { CheckResult } from './run.js';

function done(pass: boolean, started: number, tail: string, reason?: string): CheckResult {
  const result: CheckResult = { pass, exit: pass ? 0 : 1, ms: Date.now() - started, tail };
  if (reason) result.reason = reason;
  return result;
}

function schemaRule(schemaPath: string, content: string, root: string, started: number): CheckResult | null {
  let schema: unknown;
  let data: unknown;
  try {
    schema = JSON.parse(fs.readFileSync(path.resolve(root, schemaPath), 'utf-8'));
    data = JSON.parse(content);
  } catch (error) {
    return done(false, started, '', `schema/json parse failed: ${(error as Error).message}`);
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as object);
  if (validate(data)) return null;
  const errors = (validate.errors ?? []).slice(0, 5).map((e: { instancePath: string; message?: string }) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('\n');
  return done(false, started, errors, 'schema mismatch');
}

function sumRule(check: FileCheck, content: string, started: number): CheckResult {
  const sum = check.sum!;
  const format = formatOf(check.path);
  if (!format) return done(false, started, '', 'sum needs a csv · tsv · jsonl · json file');
  let total = 0;
  let counted = 0;
  try {
    const table = parseTable(content, format);
    if (!table.columns.includes(sum.column)) return done(false, started, `columns: ${table.columns.join(', ')}`, `no column "${sum.column}"`);
    for (const row of table.rows) {
      const cell = row[sum.column];
      if (typeof cell === 'number') {
        total += cell;
        counted += 1;
      }
    }
  } catch (error) {
    return done(false, started, '', `table parse failed: ${(error as Error).message}`);
  }
  const tolerance = sum.tolerance ?? 0;
  const ok = Math.abs(total - sum.equals) <= tolerance;
  const line = `sum(${sum.column}) = ${total} over ${counted} numeric rows · expected ${sum.equals}${tolerance ? ` ± ${tolerance}` : ''}`;
  return ok ? done(true, started, line) : done(false, started, line, 'sum mismatch');
}

/** `file` check — existence · regex · substring · JSON Schema · column sum. Every rule present must pass. */
export function fileCheck(check: FileCheck, root: string): CheckResult {
  const started = Date.now();
  const target = path.resolve(root, check.path);
  const exists = fs.existsSync(target);
  if (check.exists === false) return done(!exists, started, exists ? `exists: ${check.path}` : `absent: ${check.path}`);
  if (!exists) return done(false, started, `missing: ${check.path}`, 'file not found');

  let content: string;
  try {
    content = fs.readFileSync(target, 'utf-8');
  } catch (error) {
    return done(false, started, '', `read failed: ${(error as Error).message}`);
  }
  if (check.pattern !== undefined) {
    let re: RegExp;
    try {
      re = new RegExp(check.pattern, 'm');
    } catch (error) {
      return done(false, started, '', `bad pattern: ${(error as Error).message}`);
    }
    if (!re.test(content)) return done(false, started, `pattern not found: /${check.pattern}/`);
  }
  if (check.contains !== undefined && !content.includes(check.contains)) {
    return done(false, started, `text not found: ${JSON.stringify(check.contains)}`);
  }
  if (check.schema !== undefined) {
    const failed = schemaRule(check.schema, content, root, started);
    if (failed) return failed;
  }
  if (check.sum !== undefined) return sumRule(check, content, started);
  return done(true, started, `ok: ${check.path}`);
}
