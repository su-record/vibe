import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { capture, runClient } from '../bench/fde/clients.js';
import { CAPTURE } from '../bench/fde/capture-policy.js';
import { recordSession, budgetReason } from '../bench/fde/accounting.js';
import { digest, readLines, usageSummary, attemptEvidence } from '../bench/fde/evidence.js';
import { writeDiagnostic, auditDiagnostics } from '../bench/fde/private-artifacts.js';

const amounts = { input: 12, cacheRead: 5, cacheWrite: 0, output: 3 };
const event = `${JSON.stringify({ type: 'result', result: 'private fixture', total_cost_usd: 0.125,
  modelUsage: { fixture: { inputTokens: 12, cacheReadInputTokens: 5, outputTokens: 3 } } })}\n`;
const policy = (root, id) => ({ enabled: true, directory: path.join(root, `private-${id}`) });
const options = (root, id) => ({ workspace: root, env: { ...process.env, HOME: root, USERPROFILE: root }, prompt: '', timeoutMs: 5000,
  artifactId: id, diagnostics: policy(root, id), limits: { ...CAPTURE, streamBytes: 4096, graceMs: 50 } });

async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('fixture capture did not settle')), 30000); })]); }
  finally { clearTimeout(timer); }
}

function partialAccounting(session, root) {
  const ledger = path.join(root, 'partial.jsonl'), records = [];
  recordSession(session, { identity: { id: 'fixture' }, session: 1, workspace: root, ledger, records, prices: {}, sideCount: 0 });
  const rows = readLines(ledger), summary = rows.find((row) => row.event === 'session-usage');
  assert.deepEqual(rows[0].result.observedUsage.tokens, amounts); assert.equal(rows[0].result.observedUsage.costUsd, 0.125);
  assert.equal(summary.tokens, null); assert.equal(summary.costUsd, null);
  assert.deepEqual(summary.observedUsage.tokens, amounts); assert.equal(summary.observedUsage.costUsd, 0.125);
  assert.equal(summary.observedUsage.tokensComplete, false); assert.equal(summary.observedUsage.costComplete, false);
  assert.equal(summary.observedUsage.reportedMainCostUsd, 0.125);
  assert.equal(summary.observedUsage.unknownTokenSources, 1); assert.equal(summary.observedUsage.unknownCostSources, 1);
  const budget = { rawTokens: 10000, usd: null, wallMs: 10000 };
  assert.equal(budgetReason({ budget }, records, Date.now()), 'USAGE_MISSING', 'partial usage must stop later calls');
  assert.equal(budgetReason({ budget: { ...budget, rawTokens: 20 } }, records, Date.now()), 'TOKEN_BUDGET_REACHED');
  assert.equal(budgetReason({ budget: { ...budget, usd: 0.1 } }, records, Date.now()), 'CURRENCY_BUDGET_REACHED');
  const mixed = usageSummary([session, { tokens: amounts, costUsd: 0.25, complete: true }], [], {});
  assert.equal(mixed.observedUsage.tokens.input, 24); assert.equal(mixed.observedUsage.costUsd, 0.375); assert.equal(mixed.tokens, null);
  const missingSide = usageSummary([session], [{ tokens: { input: 1 } }], {});
  assert.deepEqual(missingSide.observedUsage.tokens, amounts); assert.equal(missingSide.observedUsage.unknownTokenSources, 2);
  const attempt = attemptEvidence({ workspace: root, sessions: [session], answers: [], snapshots: [], events: [], error: 'later grade failed' }, { id: 'fixture' }, null, {});
  assert.equal(attempt.errorCode, 'CLIENT_CAPTURE_OVERFLOW'); assert.equal(attempt.incomplete, true);
  assert.deepEqual(attempt.observedUsage.tokens, amounts); assert.equal(attempt.observedUsage.costUsd, 0.125);
  const priced = usageSummary([session], [], { fixture: { input: 1, cacheRead: 1, cacheWrite: 1, output: 1 } });
  assert.equal(priced.observedUsage.costUsd, 0.125);
  assert.equal(priced.observedUsage.reportedMainCostUsd, 0.125, 'reported money remains visible alongside category recomputation');
}

async function overflowCase(root) {
  const script = path.join(root, 'overflow.cjs');
  fs.writeFileSync(script, `process.stdout.write(${JSON.stringify(event)});process.stdout.write(Buffer.alloc(32768,120));setTimeout(()=>process.exit(0),3000);`);
  const session = await bounded(runClient({ ...options(root, 'overflow'), client: 'claude', settings: { model: 'fixture' }, harness: 'off',
    captureProcess: (_command, _args, opts) => capture(process.execPath, [script], { ...opts, limits: options(root, 'overflow').limits }) }));
  assert.equal(session.errorCode, 'CLIENT_CAPTURE_OVERFLOW'); assert.equal(session.complete, false);
  assert.equal(session.usage, 'incomplete'); assert.equal(session.tokens, null); assert.equal(session.costUsd, null);
  assert.deepEqual(session.observedUsage.tokens, amounts); assert.equal(session.observedUsage.costUsd, 0.125);
  const stream = session.transport.stdout;
  assert.equal(stream.complete, false); assert.equal(stream.retainedBytes, 4096); assert.ok(stream.bytes > stream.retainedBytes);
  const observed = Buffer.concat([Buffer.from(event), Buffer.alloc(stream.bytes - Buffer.byteLength(event), 120)]);
  assert.equal(stream.sha256, digest(observed)); assert.equal(stream.retainedSha256, digest(observed.subarray(0, 4096)));
  const file = session.diagnostics.find((ref) => ref.kind === 'stdout');
  assert.equal(file.bytes, 4096); assert.equal(file.sha256, stream.retainedSha256); assert.equal(file.complete, false);
  auditDiagnostics(options(root, 'overflow').diagnostics, session.diagnostics);
  partialAccounting(session, root);
}

async function boundaryCase(root) {
  const script = path.join(root, 'boundary.cjs');
  fs.writeFileSync(script, "process.stdout.write('a'.repeat(64));process.stderr.write('b'.repeat(64));");
  const result = await bounded(capture(process.execPath, [script], { ...options(root, 'boundary'), limits: { ...CAPTURE, streamBytes: 64 } }));
  assert.equal(result.errorCode, null); assert.equal(result.complete, true); assert.equal(result.exit, 0);
  for (const kind of ['stdout', 'stderr']) {
    assert.equal(result.transport[kind].complete, true); assert.equal(result.transport[kind].bytes, 64);
    assert.equal(result.transport[kind].retainedBytes, 64); assert.equal(result.transport[kind].sha256, result.transport[kind].retainedSha256);
  }
}

async function timeoutCase(root) {
  const script = path.join(root, 'timeout.cjs'); fs.writeFileSync(script, 'setTimeout(()=>process.exit(0),3000);');
  const result = await bounded(capture(process.execPath, [script], { ...options(root, 'timeout'), timeoutMs: 1000 }));
  assert.equal(result.errorCode, 'CLIENT_TIMEOUT'); assert.equal(result.complete, false);
  assert.ok(Object.values(result.transport).every((stream) => stream.complete === false));
}

async function missingExitCase(root, reason) {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
  let kills = 0; child.kill = () => { kills++; return false; }; child.unref = () => undefined;
  const settings = { ...options(root, `noexit-${reason}`), timeoutMs: reason === 'timeout' ? 25 : 5000 };
  const result = await bounded(capture('fixture-not-a-client', [], { ...settings, spawnProcess: () => {
    queueMicrotask(() => {
      if (reason === 'start') child.emit('error', new Error('fixture start error'));
      else if (reason === 'overflow') { child.stdout.write(Buffer.alloc(4096, 97)); child.stdout.write(Buffer.alloc(10, 98)); }
      else child.stdout.write(Buffer.from(event));
    });
    return child;
  } }));
  assert.equal(result.errorCode, { timeout: 'CLIENT_TIMEOUT', start: 'CLIENT_START_FAILED', overflow: 'CLIENT_CAPTURE_OVERFLOW' }[reason]);
  assert.equal(result.complete, false); assert.equal(result.exit, null); assert.ok(kills > 0);
  if (reason === 'overflow') {
    assert.equal(result.transport.stdout.bytes, 4106);
    assert.equal(result.transport.stdout.sha256, digest(Buffer.concat([Buffer.alloc(4096, 97), Buffer.alloc(10, 98)])));
  }
  const before = result.diagnostics.map((ref) => digest(fs.readFileSync(ref.path)));
  assert.doesNotThrow(() => { child.stdout.emit('data', Buffer.from('late')); child.stderr.emit('data', Buffer.from('late')); child.emit('exit', 0); child.emit('close', 0); });
  assert.deepEqual(result.diagnostics.map((ref) => digest(fs.readFileSync(ref.path))), before, 'late data cannot write to closed diagnostic files');
  assert.ok(child.stdout.destroyed && child.stderr.destroyed && child.stdin.destroyed);
}

function detailCase(root) {
  const diagnostics = policy(root, 'details'), data = { private: 'x'.repeat(500) };
  const ref = writeDiagnostic(diagnostics, 'fixture', 'attempt', data, 64);
  assert.equal(ref.bytes, 64); assert.equal(ref.complete, false);
  assert.equal(ref.observedBytes, Buffer.byteLength(JSON.stringify(data))); assert.equal(ref.observedSha256, digest(data));
  auditDiagnostics(diagnostics, [ref]);
}

export async function captureCases(root) {
  const directory = path.join(root, 'capture'); fs.mkdirSync(directory);
  await boundaryCase(directory); await overflowCase(directory); await timeoutCase(directory);
  for (const reason of ['timeout', 'start', 'overflow']) await missingExitCase(directory, reason);
  detailCase(directory);
}
