import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { prepareWorkspace } from '../workspace.js';
import { isolatedEnvironment } from './environment.js';
import { discoverySession } from './session.js';
import { runClient, rawTokens } from './clients.js';
import { append, readLines, digest, privateGrade, attemptEvidence, usageSummary } from './evidence.js';
import { agentEvidence } from '../snapshot.js';
import { authorize, codePins, validateProducts } from './protocol.js';

const require = createRequire(import.meta.url);
const time = () => new Date().toISOString();

function identity(plan, protocol) {
  return { ...plan, task: protocol.task, protocol: protocol.id, protocolHash: digest(protocol),
    runnerHash: protocol.pins.runner, fixtureHash: protocol.pins.fixture,
    harnessRevision: plan.arm === 'scoped-4.1.25' ? protocol.baselineRevision : plan.arm === 'off' ? null : protocol.candidateRevision,
    model: protocol.settings[plan.client].model };
}

function budgetReason(protocol, records, started) {
  const summaries = records.filter((row) => row.event === 'session-usage');
  if (summaries.some((row) => !row.tokens)) return 'missing session usage; additional paid calls stopped';
  if (summaries.reduce((sum, row) => sum + rawTokens(row.tokens), 0) >= protocol.budget.rawTokens) return 'token budget reached';
  if (Date.now() - started >= protocol.budget.wallMs) return 'wall budget reached';
  if (protocol.budget.usd > 0) {
    if (summaries.some((row) => !Number.isFinite(row.costUsd))) return 'currency usage unavailable; additional paid calls stopped';
    if (summaries.reduce((sum, row) => sum + row.costUsd, 0) >= protocol.budget.usd) return 'currency budget reached';
  }
  return null;
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
  const env = isolatedEnvironment(directory, product);
  const harness = plan.arm === 'off' ? 'off' : 'scoped';
  const workspace = prepareWorkspace(task, { repo: product, env, clients: [plan.client], harness });
  const customer = require(path.join(task, 'key/customer.cjs'));
  const { grade } = require(path.join(task, 'judge/grade.cjs'));
  const began = Date.now();
  let sideCount = 0;
  const context = await discoverySession({ workspace, variant: plan.variant, customer, limits: protocol.limits, repo: product, env }, async (session) => {
    const reason = budgetReason(protocol, records, started);
    const remaining = protocol.limits.attemptMs - (Date.now() - began);
    if (reason || remaining <= 0) return { error: reason ?? 'attempt time budget reached', tokens: null, ms: 0, finalText: '', invoked: false };
    const result = await runClient({ client: plan.client, settings: protocol.settings[plan.client], workspace, harness, env,
      prompt: session.prompt, timeoutMs: Math.min(remaining, protocol.limits.sessionMs), log: path.join(directory, `session-${session.index + 1}`) });
    const side = agentEvidence(workspace).sideUsage;
    const measured = { ...id, event: 'session-usage', at: time(), session: session.index + 1,
      ...usageSummary([result], side.slice(sideCount), protocol.prices) };
    sideCount = side.length;
    append(ledger, measured); records.push(measured);
    return result;
  });
  persistSnapshots(context, directory);
  let scored = null;
  try { scored = await privateGrade(workspace, task, grade, plan.variant, context.snapshots.at(-1)); }
  catch (error) { context.error = [context.error, `judge: ${error.message}`].filter(Boolean).join('; '); }
  return attemptEvidence(context, id, scored, protocol.prices);
}

/** Journal a start before invoking a client. A crashed start becomes an error, never a replacement run. */
export async function runCohort(options) {
  const { protocol, approval, repo, task, ledger } = options;
  authorize(protocol, approval);
  validateProducts(protocol, repo, options.baseline);
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
