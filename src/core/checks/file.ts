import fs from 'node:fs';
import path from 'node:path';
import { Ajv } from 'ajv';
import type { FileCheck } from '../scenarios.js';
import type { CheckResult } from './run.js';

function done(pass: boolean, started: number, tail: string, reason?: string): CheckResult {
  const result: CheckResult = { pass, exit: pass ? 0 : 1, ms: Date.now() - started, tail };
  if (reason) result.reason = reason;
  return result;
}

/** `file` 검사 — 존재 · 정규식 · 포함 · JSON Schema. 순서대로 전부 통과해야 한다. */
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
  return done(true, started, `ok: ${check.path}`);
}
