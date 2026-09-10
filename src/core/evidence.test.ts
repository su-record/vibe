import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { approve, draft } from './intent.js';
import { runChecks } from './check.js';
import { runCheck } from './checks/run.js';
import { renderEvidence } from './evidence.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-evidence-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
const hash = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
function prepare(): Buffer {
  const bytes = Buffer.from([255, 0, 27, 91, 50, 74, ...Buffer.from('PRIVATE-CANARY')]);
  fs.writeFileSync(path.join(root, 'emit.cjs'), `process.stdout.write(Buffer.from(${JSON.stringify([...bytes])})); process.stderr.write('stderr-canary'); process.exitCode=3;`);
  draft(root, '# evidence', '- { id: proof, then: checked, check: { type: run, cmd: "node emit.cjs" } }');
  approve(root, null); return bytes;
}
it('retains exact byte fingerprints and structured failure without raw default evidence', async () => {
  const bytes = prepare();
  const report = await runChecks(root, { all: true });
  expect(report.outcomes[0]).toMatchObject({ tail: '', failureCode: 'exit-mismatch', capture: { stdout: { bytes: bytes.length, sha256: hash(bytes), complete: true } } });
  const evidence = fs.readFileSync(path.join(root, '.vibe/evidence/r-1.json'), 'utf8');
  expect(JSON.parse(evidence).schemaVersion).toBe(2);
  for (const text of [evidence, JSON.stringify(report), fs.readFileSync(path.join(root, '.vibe/ledger.jsonl'), 'utf8')]) {
    expect(text).not.toContain('PRIVATE-CANARY'); expect(text).not.toContain('stderr-canary');
  }
});
it('raw diagnostics are explicit private files outside the project', async () => {
  prepare(); const report = await runChecks(root, { all: true, diagnostics: true });
  const file = report.outcomes[0]?.diagnostic;
  expect(file).toBeTruthy(); expect(file!.startsWith(root)).toBe(false);
  const raw = JSON.parse(fs.readFileSync(file!, 'utf8'));
  expect(raw.untrusted).toBe(true);
  expect(Buffer.from(raw.stdout, 'base64').toString()).toContain('PRIVATE-CANARY');
  if (process.platform !== 'win32') expect(fs.statSync(file!).mode & 0o077).toBe(0);
});
it('accepts an explicit nonzero exit only after a normal complete process', async () => {
  prepare();
  expect((await runCheck({ type: 'run', cmd: 'node emit.cjs', expect: 3 }, root)).pass).toBe(true);
  fs.writeFileSync(path.join(root, 'hang.cjs'), 'setTimeout(() => {}, 1500);');
  const timed = await runCheck({ type: 'run', cmd: 'node hang.cjs', timeoutMs: 30, expect: 0 }, root);
  expect(timed).toMatchObject({ pass: false, failureCode: 'timeout' });
  fs.writeFileSync(path.join(root, 'large.cjs'), 'process.stdout.write(Buffer.alloc(2 * 1024 * 1024));');
  const large = await runCheck({ type: 'run', cmd: 'node large.cjs' }, root);
  expect(large).toMatchObject({ pass: false, failureCode: 'capture-overflow' });
  expect(large.capture?.stdout.complete).toBe(false);
});
it('legacy renderings hide raw output without rewriting the old evidence', () => {
  const legacy = { run: 'r-1', results: [{ id: 'proof', tail: 'PRIVATE-CANARY', reason: 'RAW-ERROR' }] };
  const copy = JSON.stringify(legacy);
  const shown = JSON.stringify(renderEvidence(legacy));
  expect(shown).not.toContain('PRIVATE-CANARY'); expect(shown).not.toContain('RAW-ERROR');
  expect(shown).toContain('legacy'); expect(JSON.stringify(legacy)).toBe(copy);
});
it('redrafting preserves prior evidence bytes and uses a new run id', async () => {
  prepare(); await runChecks(root);
  const file = path.join(root, '.vibe/evidence/r-1.json');
  const before = fs.readFileSync(file);
  draft(root, '# revised', '- { id: other, then: checked, check: { type: run, cmd: "exit 0" } }');
  approve(root, null);
  const report = await runChecks(root);
  expect(report.run).toBe('r-2');
  expect(fs.readFileSync(file)).toEqual(before);
});
