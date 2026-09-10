import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCohort } from '../bench/fde/cohort.js';
import { requireCI, checkMigrationDocument, readinessCause } from '../bench/fde/readiness.js';
import { capture, runClient } from '../bench/fde/clients.js';
import { recordSession } from '../bench/fde/accounting.js';
import { attemptEvidence, readLines } from '../bench/fde/evidence.js';
import { ensurePrivateDirectory, auditDiagnostics, windowsAclError } from '../bench/fde/private-artifacts.js';
import { contentSummary } from '../bench/fde/privacy.js';
import { captureCases } from './check-trust-capture-self-test.js';

const revision = 'c'.repeat(40), marker = 'PRIVATE_PAYLOAD_7291';
const ci = () => ['linux', 'windows'].map((platform) => ({ platform, revision, status: 'passed', url: 'fixture-only', at: '2026-09-10' }));

function aclFailureCases() {
  const privatePath = 'C:\\Users\\fixture-private\\diagnostic.json';
  const cases = [
    [{ status: 2 }, 'OWNER_MISMATCH'], [{ status: 3 }, 'UNEXPECTED_GRANT'],
    [{ status: 1 }, 'SCRIPT_FAILED'], [{ code: 'ENOENT' }, 'START_FAILED'],
    [{ code: 'EACCES' }, 'START_FAILED'], [{ code: 'ETIMEDOUT', status: null }, 'TIMEOUT'],
    [{ status: null, signal: 'SIGTERM' }, 'UNVERIFIED'],
  ];
  const operations = ['IDENTITY', 'READ', 'PROTECTION', 'RULE_CREATE', 'RULE_SET', 'OWNER_SET', 'WRITE', 'REREAD', 'OWNER_QUERY', 'GRANTS_QUERY'];
  const exceptions = ['UNKNOWN', 'ARGUMENT_EXCEPTION', 'UNAUTHORIZED_ACCESS_EXCEPTION', 'PRIVILEGE_NOT_HELD_EXCEPTION', 'IDENTITY_NOT_MAPPED_EXCEPTION', 'PLATFORM_NOT_SUPPORTED_EXCEPTION'];
  for (const [index, operation] of operations.entries()) for (const [category, exception] of exceptions.entries()) {
    cases.push([{ status: (index + 10) * 10 + category }, `${operation}_FAILED_${exception}`]);
  }
  for (const phase of ['CREATE_DIRECTORY', 'VERIFY_DIRECTORY', 'VERIFY_FILE']) for (const [fields, reason] of cases) {
    const original = Object.assign(new Error(`${marker}: ${privatePath}`), fields, { stderr: Buffer.from(marker), path: privatePath });
    const failure = windowsAclError(original, phase);
    const expected = `PRIVATE_ACL_${phase}_${reason}`;
    assert.equal(failure.message, expected); assert.equal(readinessCause(failure), expected);
    const shared = JSON.stringify({ cause: readinessCause(failure), details: contentSummary(failure.message) });
    assert.ok(!shared.includes(marker)); assert.ok(!shared.includes(privatePath));
    assert.equal(readinessCause(new Error(`${expected}: ${marker}`)), null, 'only complete fixed codes are public');
    assert.equal(readinessCause(new Error(`${expected}\n`)), null);
  }
  assert.equal(windowsAclError(new Error(marker), marker).message, 'PRIVATE_ACL_UNVERIFIED');
}

async function readinessCases(root) {
  aclFailureCases();
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
  for (const code of ['CI_REQUIRED_LINUX', 'CI_REQUIRED_WINDOWS', 'MIGRATION_DOCUMENT_MISSING', 'MIGRATION_DOCUMENT_BOUNDARIES_MISSING']) assert.equal(readinessCause(new Error(code)), code);
  assert.equal(readinessCause(new Error(marker)), null, 'free text must stay out of shared error causes');
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
  assert.equal(session.errorCode, 'CLIENT_EXIT_NONZERO'); assert.equal(session.complete, true);
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
    await captureCases(root);
    assert.throws(() => ensurePrivateDirectory(root, [root]), /PRIVATE_PATH/);
    console.log('check-trust compatibility self-test: pre-run CI, migration boundary, bounded capture, partial accounting and opt-in private diagnostics passed; live calls 0');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
