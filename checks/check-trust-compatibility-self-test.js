import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCohort } from '../bench/fde/cohort.js';
import { requireCI, checkMigrationDocument } from '../bench/fde/readiness.js';
import { capture, runClient } from '../bench/fde/clients.js';
import { recordSession } from '../bench/fde/accounting.js';
import { attemptEvidence, readLines } from '../bench/fde/evidence.js';
import { ensurePrivateDirectory, auditDiagnostics } from '../bench/fde/private-artifacts.js';

const revision = 'c'.repeat(40), marker = 'PRIVATE_PAYLOAD_7291';
const ci = () => ['linux', 'windows'].map((platform) => ({ platform, revision, status: 'passed', url: 'fixture-only', at: '2026-09-10' }));

async function readinessCases(root) {
  let validations = 0, invocations = 0;
  const services = { validate: () => { validations++; throw new Error('fixture reached post-CI validation'); }, invoke: () => { invocations++; } };
  const options = { protocol: { candidateRevision: revision }, repo: root, ledger: path.join(root, 'ledger.jsonl') };
  for (const records of [[], ci().slice(0, 1), ci().map((entry) => ({ ...entry, revision: 'd'.repeat(40) }))]) {
    await assert.rejects(runCohort({ ...options, ci: records }, services), /CI_REQUIRED/);
    assert.equal(validations, 0); assert.equal(invocations, 0);
  }
  await assert.rejects(runCohort({ ...options, ci: ci() }, services), /post-CI validation/);
  assert.equal(validations, 1); assert.equal(invocations, 0);
  assert.doesNotThrow(() => requireCI(ci(), revision));
  const document = path.join(root, 'check-consent.md');
  fs.writeFileSync(document, '# Fixture migration\n\nUpgrade locally.\n\n## Rollback\nPreserve prior evidence.\n');
  assert.doesNotThrow(() => checkMigrationDocument(document));
  fs.writeFileSync(document, '# Incomplete migration\n');
  assert.throws(() => checkMigrationDocument(document), /MIGRATION_DOCUMENT/);
}

async function privacyCase(root, enabled) {
  const workspace = path.join(root, enabled ? 'enabled-workspace' : 'default-workspace'); fs.mkdirSync(workspace);
  const directory = path.join(root, enabled ? 'private-enabled' : 'private-disabled');
  const diagnostics = { enabled, directory: enabled ? directory : null };
  if (enabled) ensurePrivateDirectory(directory, [workspace]);
  const script = path.join(workspace, 'transport.cjs');
  const events = [{ type: 'item.completed', item: { type: 'command_execution', command: marker, aggregated_output: marker } },
    { type: 'item.completed', item: { type: 'agent_message', text: marker } },
    { type: 'turn.completed', usage: { input_tokens: 25, cached_input_tokens: 5, output_tokens: 3 } }, { type: 'turn.failed', error: { message: marker } }];
  fs.writeFileSync(script, `process.stdout.write(${JSON.stringify(events.map(JSON.stringify).join('\n'))});process.stderr.write(${JSON.stringify(marker)});process.exitCode=3;`);
  const session = await runClient({ client: 'codex', settings: { model: 'fixture' }, harness: 'off', workspace,
    env: { ...process.env, HOME: workspace, USERPROFILE: workspace }, prompt: '', timeoutMs: 5000, diagnostics, artifactId: `fixture-${enabled}`,
    captureProcess: (_command, _args, options) => capture(process.execPath, [script], options) });
  assert.equal(session.finalText, marker, 'customer scheduling may consume the original text in memory');
  assert.equal(session.errorCode, 'CLIENT_EXIT_NONZERO');
  fs.mkdirSync(path.join(workspace, '.vibe'));
  fs.writeFileSync(path.join(workspace, '.vibe/results.json'), JSON.stringify({ output: marker }));
  fs.writeFileSync(path.join(workspace, '.vibe/ledger.jsonl'), JSON.stringify({ event: 'usage', model: 'fixture-helper', tokens: { input: 1, cacheRead: 0, cacheWrite: 0, output: 2 }, report: marker }));
  const ledger = path.join(workspace, 'shared.jsonl');
  recordSession(session, { identity: { id: 'fixture' }, session: 1, workspace, ledger, records: [], prices: {}, sideCount: 0 });
  const context = { workspace, sessions: [session], events: [{ phase: 'handoff', text: marker, allocation: 'unavailable' }], answers: [{ question: marker, answer: marker }], snapshots: [], clarifications: 1, corrections: 0, completed: false, error: `failure ${marker}` };
  const row = attemptEvidence(context, { id: 'fixture' }, { complete: false, error: marker, pilot: { passed: 0, total: 1, failures: [marker] } }, {});
  assert.ok(!JSON.stringify(readLines(ledger)).includes(marker), 'session ledger must exclude payload text');
  assert.ok(!JSON.stringify(row).includes(marker), 'attempt ledger must exclude report, answer and grade error text');
  assert.equal(readLines(ledger)[0].result.tokens.input, 20); assert.equal(row.tokens.output, 5); assert.equal(row.errorCode, 'HARNESS_ERROR');
  const refs = session.diagnostics;
  if (enabled) {
    assert.ok(refs.length >= 2); auditDiagnostics(diagnostics, refs, [workspace]);
    assert.ok(refs.some((ref) => fs.readFileSync(ref.path, 'utf8').includes(marker)));
    fs.appendFileSync(refs[0].path, 'changed');
    assert.throws(() => auditDiagnostics(diagnostics, refs, [workspace]), /DIAGNOSTIC_CHANGED/);
  } else { assert.deepEqual(refs, []); assert.equal(fs.existsSync(directory), false); }
}

export async function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-check-trust-'));
  try {
    await readinessCases(root); await privacyCase(root, false); await privacyCase(root, true);
    assert.throws(() => ensurePrivateDirectory(root, [root]), /PRIVATE_PATH/);
    console.log('check-trust compatibility self-test: pre-run CI, migration boundary and opt-in private diagnostics passed; live calls 0');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
