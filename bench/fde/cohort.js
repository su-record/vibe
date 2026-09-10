import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { prepareWorkspace } from '../workspace.js';
import { isolatedEnvironment } from './environment.js';
import { discoverySession } from './session.js';
import { runClient } from './clients.js';
import { append, readLines, digest, privateGrade, attemptEvidence } from './evidence.js';
import { budgetReason, recordSession } from './accounting.js';
import { authorize, codePins, validateProducts, clientVersions } from './protocol.js';
import { requireCI } from './readiness.js';
import { ensurePrivateDirectory, writeDiagnostic } from './private-artifacts.js';
import { safeGrade, failureCode, contentSummary } from './privacy.js';

const require = createRequire(import.meta.url);
const time = () => new Date().toISOString();

function identity(plan, protocol) {
  return { id: plan.id, client: plan.client, variant: plan.variant, arm: plan.arm, attempt: plan.attempt, task: protocol.task, protocol: protocol.id, protocolHash: digest(protocol),
    runnerHash: protocol.pins.runner, fixtureHash: protocol.pins.fixture,
    harnessRevision: plan.arm === 'scoped-4.1.25' ? protocol.baselineRevision : plan.arm === 'off' ? null : protocol.candidateRevision,
    model: protocol.settings[plan.client].model };
}

function persistSnapshots(context, directory) {
  context.snapshots = context.snapshots.map((snapshot, index) => {
    const destination = path.join(directory, `scope-${index + 1}`);
    fs.cpSync(snapshot.path, destination, { recursive: true });
    return { ...snapshot, path: destination };
  });
}

async function attempt(plan, options, records, started) {
  const { protocol, repo, baseline, task, output, ledger } = options;
  const id = identity(plan, protocol);
  const directory = path.join(output, plan.id);
  fs.mkdirSync(directory, { recursive: true });
  const product = plan.arm === 'scoped-4.1.25' ? baseline : repo;
  const harness = plan.arm === 'off' ? 'off' : 'scoped';
  const env = isolatedEnvironment(directory, product, process.env, harness);
  const workspace = prepareWorkspace(task, { repo: product, env, clients: [plan.client], harness });
  const customer = require(path.join(task, 'key/customer.cjs'));
  const { grade } = require(path.join(task, 'judge/grade.cjs'));
  const began = Date.now();
  let sideCount = 0;
  const context = await discoverySession({ workspace, variant: plan.variant, customer, limits: protocol.limits, repo: product, env }, async (session) => {
    const reason = budgetReason(protocol, records, started);
    const remaining = protocol.limits.attemptMs - (Date.now() - began);
    if (reason || remaining <= 0) return { error: reason ?? 'ATTEMPT_TIME_LIMIT', tokens: null, ms: 0, finalText: '', invoked: false };
    const sessionStart = { ...id, event: 'session-start', at: time(), session: session.index + 1 };
    append(ledger, sessionStart); records.push(sessionStart);
    const result = await options.invoke({ client: plan.client, settings: protocol.settings[plan.client], workspace, harness, env, diagnostics: protocol.diagnostics, artifactId: `${id.protocolHash}/${plan.id}/${session.index + 1}`,
      prompt: session.prompt, timeoutMs: Math.max(1, Math.min(remaining, protocol.limits.sessionMs, protocol.budget.wallMs - (Date.now() - started))) });
    sideCount = recordSession(result, { identity: id, session: session.index + 1, workspace, ledger, records, prices: protocol.prices, sideCount });
    return result;
  });
  persistSnapshots(context, directory);
  let scored = null;
  const amendments = [];
  try {
    scored = await privateGrade(workspace, task, grade, plan.variant, context.snapshots[0]);
    for (const snapshot of context.snapshots.slice(1)) amendments.push({ scopeHash: snapshot.hash, grade: safeGrade(await privateGrade(workspace, task, grade, plan.variant, snapshot)) });
  }
  catch (error) { context.error = [context.error, `judge: ${error.message}`].filter(Boolean).join('; '); }
  return { ...attemptEvidence(context, id, scored, protocol.prices, protocol.diagnostics), gradedScopeHash: context.snapshots[0]?.hash ?? null, amendedGrades: amendments };
}

function validateCohort(options) {
  const { protocol, approval, repo, task, ledger, output } = options;
  authorize(protocol, approval);
  validateProducts(protocol, repo, options.baseline);
  if (JSON.stringify(clientVersions()) !== JSON.stringify(protocol.clientVersions) || process.version !== protocol.nodeVersion) throw new Error('client/runtime version changed after protocol freeze');
  const pins = codePins(repo, task);
  for (const key of ['runner', 'fixture', 'rubric']) if (pins[key] !== protocol.pins[key]) throw new Error(`${key} changed after protocol freeze`);
  ensurePrivateDirectory(output, [repo, options.baseline, path.dirname(ledger)]);
  if (protocol.diagnostics.enabled) ensurePrivateDirectory(protocol.diagnostics.directory, [repo, options.baseline, path.dirname(ledger), output]);
}

/** CI precedes even client version probes. Fixture injection never changes the CLI's validation. */
export async function runCohort(options, { validate = validateCohort, invoke = runClient } = {}) {
  const { protocol, ledger } = options;
  requireCI(options.ci ?? readLines(path.join(path.dirname(ledger), 'ci.jsonl')), protocol.candidateRevision);
  validate(options);
  const records = readLines(ledger);
  if (records.some((row) => row.protocolHash !== digest(protocol))) throw new Error('ledger belongs to a different protocol');
  const started = records.length ? Date.parse(records[0].at) : Date.now();
  for (const plan of protocol.schedule) {
    if (records.some((row) => row.id === plan.id && row.event === 'attempt')) continue;
    const began = records.some((row) => row.id === plan.id && row.event === 'attempt-start');
    const reason = began ? 'ATTEMPT_INTERRUPTED' : budgetReason(protocol, records, started);
    let row;
    if (reason) row = { ...identity(plan, protocol), event: 'attempt', at: time(), error: reason, errorCode: reason, incomplete: true, stalled: false, invoked: false };
    else {
      const start = { ...identity(plan, protocol), event: 'attempt-start', at: time() };
      append(ledger, start); records.push(start);
      try { row = await attempt(plan, { ...options, invoke }, records, started); }
      catch (error) {
        let reference = null, diagnosticsError = null;
        try { reference = writeDiagnostic(protocol.diagnostics, `${digest(protocol)}/${plan.id}`, 'failure', { message: error.message, stack: error.stack }); }
        catch { diagnosticsError = 'DIAGNOSTIC_WRITE_FAILED'; }
        row = { ...identity(plan, protocol), event: 'attempt', at: time(), error: failureCode(error.message), errorCode: failureCode(error.message), errorDetails: contentSummary(error.message), diagnostics: reference ? [reference] : [], diagnosticsError, incomplete: true };
      }
    }
    append(ledger, row); records.push(row);
    process.stdout.write(`${plan.id}: ${row.errorCode ?? (row.stalled ? 'stalled' : 'recorded; deterministic assessment available')}\n`);
  }
}
