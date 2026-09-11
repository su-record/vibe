import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { evalCheck } from './checks/eval.js';
import { reviewCheck } from './checks/review.js';
import { CAPTURE_LIMIT } from './output-capture.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-composite-')); });
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(root, { recursive: true, force: true }); });
function emitter(): void {
  fs.writeFileSync(path.join(root, 'emit.cjs'), 'process.stdout.write(Buffer.alloc(2 * 1024 * 1024, 65));');
}
const digest = (length: number): string => createHash('sha256').update(Buffer.alloc(length, 65)).digest('hex');

it('eval fingerprints every observed byte after its retained prefix overflows', async () => {
  emitter(); fs.writeFileSync(path.join(root, 'cases.jsonl'), JSON.stringify({ input: '', expected: '' }));
  const result = await evalCheck({ type: 'eval', cases: 'cases.jsonl', runner: 'node emit.cjs', expect: { pass: 1 } }, root);
  expect(result).toMatchObject({ pass: false, failureCode: 'capture-overflow' });
  const stream = result.capture!.stdout;
  expect(stream.bytes).toBeGreaterThan(CAPTURE_LIMIT);
  expect(stream.sha256).toBe(digest(stream.bytes)); expect(stream.complete).toBe(false);
  expect(result.raw!.stdout.length).toBe(CAPTURE_LIMIT);
});
it('review fingerprints original streams and distinguishes REJECT from incomplete capture', async () => {
  emitter(); fs.writeFileSync(path.join(root, 'artifact.md'), 'A reviewable artifact.');
  vi.stubEnv('VIBE_REVIEW_CMD', 'node emit.cjs');
  const result = await reviewCheck({ type: 'review', path: 'artifact.md', pack: 'en' }, root);
  expect(result).toMatchObject({ pass: false, failureCode: 'capture-overflow' });
  const stream = result.capture!.stdout;
  expect(stream.bytes).toBeGreaterThan(CAPTURE_LIMIT); expect(stream.sha256).toBe(digest(stream.bytes));
  fs.writeFileSync(path.join(root, 'emit.cjs'), 'process.stdout.write("REJECT");');
  const rejected = await reviewCheck({ type: 'review', path: 'artifact.md', pack: 'en' }, root);
  expect(rejected.pass).toBe(false);
  expect(rejected.capture?.stdout).toMatchObject({ bytes: 6, complete: true });
});
