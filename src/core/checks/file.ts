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

/**
 * Named expressions for `absent`, so a scenario (and the scope skill) can say what it forbids
 * without spelling the leftovers it forbids: `@placeholders` is lorem-ipsum text, a bracketed TODO,
 * TBD, a company-name placeholder, an unfilled double-brace field, and a double-square-bracket
 * note to the model that was reprinted into the artifact.
 */
export const ABSENT_PRESETS: Readonly<Record<string, string>> = {
  '@placeholders': ['Lorem ipsum', '\\[TODO\\]', '\\bTBD\\b', 'Your Company', '\\{\\{', '\\[\\['].join('|'),
};

export function absentExpression(value: string): string {
  return value.split('|').map((part) => ABSENT_PRESETS[part.trim()] ?? part).join('|');
}

/** `absent` — the expression must match nowhere; the first three matches are named by line so the writer can go there. */
function absentRule(expression: string, content: string, started: number): CheckResult | null {
  let re: RegExp;
  try {
    re = new RegExp(absentExpression(expression), 'g');
  } catch (error) {
    return done(false, started, '', `bad absent: ${(error as Error).message}`);
  }
  const hits: string[] = [];
  for (const m of content.matchAll(re)) {
    if (m[0] === '') break;
    hits.push(`line ${content.slice(0, m.index).split('\n').length}: ${m[0]}`);
    if (hits.length === 3) break;
  }
  return hits.length === 0 ? null : done(false, started, hits.join('\n'), 'forbidden text present');
}

/** `file` check — existence · regex · substring · absence · JSON Schema · column sum. Every rule present must pass. */
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
  if (check.absent !== undefined) {
    const failed = absentRule(check.absent, content, started);
    if (failed) return failed;
  }
  if (check.schema !== undefined) {
    const failed = schemaRule(check.schema, content, root, started);
    if (failed) return failed;
  }
  if (check.sum !== undefined) return sumRule(check, content, started);
  return done(true, started, `ok: ${check.path}`);
}
