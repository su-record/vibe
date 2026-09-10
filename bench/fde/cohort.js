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

const require = createRequire(import.meta.url);
const time = () => new Date().toISOString();

function identity(plan, protocol) {
  return { ...plan, task: protocol.task, protocol: protocol.id, protocolHash: digest(protocol),
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
    if (reason || remaining <= 0) return { error: reason ?? 'attempt time budget reached', tokens: null, ms: 0, finalText: '', invoked: false };
    const sessionStart = { ...id, event: 'session-start', at: time(), session: session.index + 1 };
    append(ledger, sessionStart); records.push(sessionStart);
    const result = await runClient({ client: plan.client, settings: protocol.settings[plan.client], workspace, harness, env,
      prompt: session.prompt, timeoutMs: Math.max(1, Math.min(remaining, protocol.limits.sessionMs, protocol.budget.wallMs - (Date.now() - started))), log: path.join(directory, `session-${session.index + 1}`) });
    sideCount = recordSession(result, { identity: id, session: session.index + 1, workspace, ledger, records, prices: protocol.prices, sideCount });
    return result;
  });
  persistSnapshots(context, directory);
  let scored = null;
  const amendments = [];
  try {
    scored = await privateGrade(workspace, task, grade, plan.variant, context.snapshots[0]);
    for (const snapshot of context.snapshots.slice(1)) amendments.push({ scopeHash: snapshot.hash, grade: await privateGrade(workspace, task, grade, plan.variant, snapshot) });
  }
  catch (error) { context.error = [context.error, `judge: ${error.message}`].filter(Boolean).join('; '); }
  return { ...attemptEvidence(context, id, scored, protocol.prices), gradedScopeHash: context.snapshots[0]?.hash ?? null, amendedGrades: amendments };
}

/** Journal a start before invoking a client. A crashed start becomes an error, never a replacement run. */
export async function runCohort(options) {
  const { protocol, approval, repo, task, ledger } = options;
  authorize(protocol, approval);
  validateProducts(protocol, repo, options.baseline);
  if (JSON.stringify(clientVersions()) !== JSON.stringify(protocol.clientVersions) || process.version !== protocol.nodeVersion) throw new Error('client/runtime version changed after protocol freeze');
  const pins = codePins(repo, task);
  for (const key of ['runner', 'fixture', 'rubric']) if (pins[key] !== protocol.pins[key]) throw new Error(`${key} changed after protocol freeze`);
  const records = readLines(ledger);
  if (records.some((row) => row.protocolHash !== digest(protocol))) throw new Error('ledger belongs to a different protocol');
  const started = records.length ? Date.parse(records[0].at) : Date.now();
  for (const plan of protocol.schedule) {
    if (records.some((row) => row.id === plan.id && row.event === 'attempt')) continue;
    const began = records.some((row) => row.id === plan.id && row.event === 'attempt-start');
    const reason = began ? 'interrupted attempt preserved; no replacement authorized' : budgetReason(protocol, records, started);
    let row;
    if (reason) row = { ...identity(plan, protocol), event: 'attempt', at: time(), error: reason, incomplete: true, stalled: false, invoked: false };
    else {
      const start = { ...identity(plan, protocol), event: 'attempt-start', at: time() };
      append(ledger, start); records.push(start);
      try { row = await attempt(plan, options, records, started); }
      catch (error) { row = { ...identity(plan, protocol), event: 'attempt', at: time(), error: `harness: ${error.message}`, incomplete: true }; }
    }
    append(ledger, row); records.push(row);
    process.stdout.write(`${plan.id}: ${row.error ?? (row.stalled ? 'stalled' : 'recorded; human review pending')}\n`);
  }
}
