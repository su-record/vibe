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

/** `file` check — existence · regex · substring · JSON Schema. Every rule present must pass. */
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
    let schema: unknown;
    let data: unknown;
    try {
      schema = JSON.parse(fs.readFileSync(path.resolve(root, check.schema), 'utf-8'));
      data = JSON.parse(content);
    } catch (error) {
      return done(false, started, '', `schema/json parse failed: ${(error as Error).message}`);
    }
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema as object);
    if (!validate(data)) {
      const errors = (validate.errors ?? []).slice(0, 5).map((e: { instancePath: string; message?: string }) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('\n');
      return done(false, started, errors, 'schema mismatch');
    }
  }
  if (check.sum !== undefined) {
    const format = formatOf(check.path);
    if (!format) return done(false, started, '', 'sum needs a csv · tsv · jsonl · json file');
    let total = 0;
    let counted = 0;
    try {
      const table = parseTable(content, format);
      if (!table.columns.includes(check.sum.column)) return done(false, started, `columns: ${table.columns.join(', ')}`, `no column "${check.sum.column}"`);
      for (const row of table.rows) {
        const cell = row[check.sum.column];
        if (typeof cell === 'number') {
          total += cell;
          counted += 1;
        }
      }
    } catch (error) {
      return done(false, started, '', `table parse failed: ${(error as Error).message}`);
    }
    const tolerance = check.sum.tolerance ?? 0;
    const ok = Math.abs(total - check.sum.equals) <= tolerance;
    const line = `sum(${check.sum.column}) = ${total} over ${counted} numeric rows · expected ${check.sum.equals}${tolerance ? ` ± ${tolerance}` : ''}`;
    if (!ok) return done(false, started, line, 'sum mismatch');
    return done(true, started, line);
  }
  return done(true, started, `ok: ${check.path}`);
}
