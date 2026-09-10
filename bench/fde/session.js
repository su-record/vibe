import fs from 'node:fs';
import path from 'node:path';
import { answer, openQuestions } from '../../dist/core/inbox.js';
import { freezeScope, readJson, treeManifest } from '../snapshot.js';
import { vibeSync } from '../workspace.js';

const now = () => new Date().toISOString();
const exists = (workspace, file) => fs.existsSync(path.join(workspace, file));
function event(context, phase, detail = {}) {
  const entry = { at: now(), phase, ...detail, allocation: 'unavailable' };
  context.events.push(entry);
  return entry;
}

function deliver(context, question, response) {
  const { workspace } = context;
  const directory = path.join(workspace, 'customer');
  fs.mkdirSync(directory, { recursive: true });
  context.answers.push({ question: question.text, answer: response.answer, decision: response.decision ?? null });
  fs.writeFileSync(path.join(directory, 'answers.json'), `${JSON.stringify({ answers: context.answers }, null, 2)}\n`);
  fs.appendFileSync(path.join(workspace, 'TASK.md'), `\n\nCustomer reply: ${response.answer}\nDelivered answers: customer/answers.json.\n`);
  if (question.id) answer(workspace, question.id, response.answer);
}

function questions(context, finalText) {
  const pending = openQuestions(context.workspace).filter((q) => !q.answer).map((q) => ({ id: q.id, text: q.question }));
  // A final message often repeats an inbox request. Classify both, but deliver a decision once per round.
  const input = [...pending, ...(finalText ? [{ id: null, text: finalText }] : [])];
  const responses = input.map((question) => ({ question, response: context.customer.respond(question.text, context.variant) }));
  const relevant = responses.filter(({ response }) => response.status === 'answer');
  const unknown = responses.find(({ question, response }) => response.status === 'unmatched' && (question.id || !relevant.length));
  if (unknown) throw new Error(`unclassified customer request: ${unknown.question.text}`);
  return relevant;
}

function clarify(context, responses) {
  if (!responses.length) return false;
  if (context.clarifications >= context.limits.clarificationRounds) {
    context.stalled = true;
    event(context, 'clarification', { status: 'unanswered-budget', questions: responses.map((r) => r.question.text) });
    return false;
  }
  context.clarifications += 1;
  const delivered = new Set();
  for (const { question, response } of responses) {
    if (delivered.has(response.answer)) {
      if (question.id) answer(context.workspace, question.id, response.answer);
      continue;
    }
    deliver(context, question, response);
    delivered.add(response.answer);
  }
  event(context, 'clarification', { status: 'answered', responses: [...delivered] });
  return true;
}

function approve(context) {
  const { workspace, variant } = context;
  if (!exists(workspace, 'out/opportunities.json') || !exists(workspace, 'out/scope.json')) return false;
  event(context, 'scope', { status: 'proposed' });
  const decision = context.customer.proposal(workspace, variant);
  event(context, 'approval', { simulated: true, ...decision });
  if (!decision.approved) {
    if (context.corrections >= context.limits.scopeCorrections) { context.stalled = true; return false; }
    context.corrections += 1;
    deliver(context, { text: 'Proposed local pilot', id: null }, decision);
    return true;
  }
  // Clarification replies may be hashed input evidence. Consent must not rewrite that source.
  const consent = path.join(workspace, 'customer/consent.json');
  fs.mkdirSync(path.dirname(consent), { recursive: true });
  fs.writeFileSync(consent, `${JSON.stringify({ ...decision, simulated: true, at: now() }, null, 2)}\n`);
  fs.appendFileSync(path.join(workspace, 'TASK.md'), `\n\nCustomer approval: ${decision.answer}\nConsent record: customer/consent.json. Continue with the approved build.\n`);
  const state = readJson(path.join(workspace, '.vibe/state.json'), {});
  // Consent is authored by the private customer, never inferred from a model-written approval event.
  for (const question of openQuestions(workspace).filter((q) => !q.answer)) {
    const classified = context.customer.respond(question.question, variant);
    if (question.needs === 'approve' || classified.decision === 'proposal-required') answer(workspace, question.id, decision.answer);
  }
  if (state.state === 'DRAFT') {
    const result = vibeSync(workspace, ['approve'], context);
    if (result.status !== 0) throw new Error(`product approval failed: ${result.stderr || result.stdout}`);
  }
  context.snapshots.push(freezeScope(workspace, context.approved ? 'amended-customer-approval' : 'customer-approval'));
  context.approved = true;
  return true;
}

function contextChanged(context) {
  const current = treeManifest(context.workspace);
  const last = context.snapshots.at(-1)?.manifest ?? {};
  const scope = (entries) => Object.entries(entries).filter(([name]) => name.startsWith('checks/') || ['out/scope.json', 'out/opportunities.json', '.vibe/intent.md', '.vibe/scenarios.yaml'].includes(name));
  return JSON.stringify(scope(current)) !== JSON.stringify(scope(last));
}

async function oneSession(context, invoke) {
  const phase = context.approved ? 'implementation' : 'discovery';
  const started = now();
  const result = await invoke({ phase, index: context.sessions.length, prompt: fs.readFileSync(path.join(context.workspace, 'TASK.md'), 'utf8') });
  context.sessions.push({ ...result, phase, started, finished: now(), phaseAllocation: 'unavailable-within-session' });
  if (result.error) { context.error = result.error; return false; }
  const responses = questions(context, result.finalText);
  if (!context.approved && (exists(context.workspace, 'automation/run.cjs') || exists(context.workspace, 'automation/install.cjs'))) context.prematureBuild = true;
  if (responses.length) return clarify(context, responses);
  if (!context.approved || contextChanged(context)) return approve(context);
  event(context, 'proof', { status: 'agent-ended', note: 'Command trace and product verification determine what actually ran.' });
  event(context, 'handoff', { text: result.finalText });
  context.completed = true;
  return false;
}

/** Injecting invoke permits deterministic protocol tests. It never invents a customer or human review. */
export async function discoverySession(options, invoke) {
  const context = { ...options, events: [], answers: [], snapshots: [], sessions: [],
    approved: false, completed: false, stalled: false, prematureBuild: false, clarifications: 0, corrections: 0 };
  event(context, 'intake');
  fs.appendFileSync(path.join(context.workspace, 'TASK.md'), '\n\nExecution protocol: inspect and propose the neutral outputs first. Stop for the customer response before creating automation/run.cjs or installing anything. The harness delivers the same simulated customer consent to every arm.\n');
  try {
    for (let index = 0; index < options.limits.sessions; index += 1) {
      if (!await oneSession(context, invoke)) break;
      if (context.approved) event(context, 'build', { status: 'authorized-continuation' });
    }
  } catch (error) { context.error = `harness: ${error.message}`; }
  context.stalled ||= !context.completed && !context.error;
  return context;
}
