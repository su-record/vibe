import fs from 'node:fs';
import path from 'node:path';
import { Ajv } from 'ajv';
import type { HttpCheck } from '../scenarios.js';
import { tail, type CheckResult } from './run.js';

const DEFAULT_TIMEOUT_MS = 30_000;

/** `http` check — status code, body against a JSON Schema, latency ceiling. The harness makes the request. */
export async function httpCheck(check: HttpCheck, root: string): Promise<CheckResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), check.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  let body: string;
  try {
    response = await fetch(check.url, { method: check.method ?? 'GET', signal: controller.signal, redirect: 'manual' });
    body = await response.text();
  } catch (error) {
    clearTimeout(timer);
    return { pass: false, exit: null, ms: Date.now() - started, tail: '', reason: `request failed: ${(error as Error).message}` };
  }
  clearTimeout(timer);
  const ms = Date.now() - started;
  const expect = check.expect ?? {};
  const status = expect.status ?? 200;
  const base = { exit: response.status, ms, tail: tail(body) };
  if (response.status !== status) return { ...base, pass: false, reason: `status ${response.status}, expected ${status}` };
  if (expect.maxMs !== undefined && ms > expect.maxMs) return { ...base, pass: false, reason: `${ms}ms, limit ${expect.maxMs}ms` };
  if (expect.schema !== undefined) {
    let schema: unknown;
    let data: unknown;
    try {
      schema = JSON.parse(fs.readFileSync(path.resolve(root, expect.schema), 'utf-8'));
      data = JSON.parse(body);
    } catch (error) {
      return { ...base, pass: false, reason: `schema/json parse failed: ${(error as Error).message}` };
    }
    const validate = new Ajv({ allErrors: true, strict: false }).compile(schema as object);
    if (!validate(data)) {
      const errors = (validate.errors ?? []).slice(0, 5).map((e: { instancePath: string; message?: string }) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('\n');
      return { ...base, pass: false, tail: errors, reason: 'schema mismatch' };
    }
  }
  return { ...base, pass: true };
}
