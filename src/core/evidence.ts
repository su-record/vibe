import { createHash, randomBytes } from 'node:crypto';
import { CAPTURE_LIMIT } from './output-capture.js';
import type { CheckResult } from './checks/run.js';
import { writePrivate } from './private-store.js';

export function safeText(value: string, limit = 12_000): string {
  return value.slice(0, limit).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function diagnosticFile(root: string, run: string, id: string, result: CheckResult): string {
  const raw = result.raw ?? { stdout: Buffer.from(result.tail), stderr: Buffer.alloc(0) };
  const name = `diagnostic-${run}-${id}-${randomBytes(8).toString('hex')}.json`;
  return writePrivate(root, name, JSON.stringify({ schemaVersion: 1, untrusted: true, run, scenario: id,
    representation: result.raw ? 'original-bytes-base64' : 'adapter-diagnostic-text-base64',
    stdout: raw.stdout.subarray(0, CAPTURE_LIMIT).toString('base64'), stderr: raw.stderr.subarray(0, CAPTURE_LIMIT).toString('base64'),
    streams: Object.fromEntries((['stdout', 'stderr'] as const).map((stream) => [stream, {
      ...(result.capture?.[stream] ?? { bytes: raw[stream].length, sha256: createHash('sha256').update(raw[stream]).digest('hex'), complete: true }),
      retainedBytes: Math.min(raw[stream].length, CAPTURE_LIMIT), truncated: (result.capture?.[stream].bytes ?? raw[stream].length) > CAPTURE_LIMIT,
    }])),
    warning: 'Untrusted local diagnostic. Terminal output can be saved by its recipient; hashes neither redact nor authenticate it.' }));
}

/** A projection, never a migration: legacy bytes stay untouched on disk. */
export function renderEvidence(value: unknown): unknown {
  if (!value || typeof value !== 'object') return { schema: 'invalid', results: [] };
  const evidence = value as Record<string, unknown>;
  const modern = evidence['schemaVersion'] === 2;
  const allowed = ['id', 'type', 'status', 'exit', 'signal', 'ms', 'blockedBy', 'regression', 'failureCode', 'failure', 'capture', 'executionContext', 'evidenceId', 'sources', 'usage', 'cleanupUncertain'];
  const results = Array.isArray(evidence['results']) ? evidence['results'].slice(0, 1000).map((raw: Record<string, unknown>) => {
    const result: Record<string, unknown> = { tail: '', output: modern ? 'raw output omitted' : 'legacy raw output hidden; not recollected' };
    for (const key of allowed) if (key in raw) result[key] = raw[key];
    return result;
  }) : [];
  return { schemaVersion: modern ? 2 : null, schema: modern ? 'v2' : 'legacy', run: evidence['run'], at: evidence['at'], results };
}
