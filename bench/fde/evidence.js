import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { agentEvidence, treeManifest } from '../snapshot.js';
import { gradingWorkspace } from '../workspace.js';
import { addTokens, weightedInput } from './clients.js';

export const digest = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const fileHash = (file) => digest(fs.readFileSync(file));
export function readLines(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}
export function append(file, row) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'a');
  try { fs.writeSync(fd, `${JSON.stringify(row)}\n`); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}

export async function privateGrade(workspace, task, grade, variant, snapshot) {
  const before = digest(treeManifest(workspace));
  const frozen = snapshot ? digest(treeManifest(snapshot.path)) : null;
  const scratch = gradingWorkspace(workspace, task);
  try {
    const result = await grade(scratch.workspace, { variant, snapshot });
    if (before !== digest(treeManifest(workspace)) || (snapshot && frozen !== digest(treeManifest(snapshot.path)))) throw new Error('private grading changed original evidence');
    return result;
  } finally { fs.rmSync(scratch.root, { recursive: true, force: true }); }
}

export function usageSummary(sessions, sideUsage, prices = {}) {
  const tokens = addTokens([...sessions.map((s) => s.tokens), ...sideUsage.map((s) => s.tokens)]);
  const reported = sessions.every((s) => Number.isFinite(s.costUsd)) ? sessions.reduce((sum, s) => sum + s.costUsd, 0) : null;
  const price = (model, amount) => amount && prices[model] ? (weightedInput(amount) * prices[model].input + amount.output * prices[model].output) / 1e6 : null;
  const costs = sessions.flatMap((session) => session.models?.length ? session.models.map((m) => price(m.model, m.tokens)) : [price(session.requestedModel, session.tokens)]).concat(sideUsage.map((s) => Number.isFinite(s.costUsd) ? s.costUsd : price(s.model, s.tokens)));
  return { tokens, weightedInput: tokens ? weightedInput(tokens) : null, usage: tokens ? 'captured' : 'missing',
    reportedMainCostUsd: reported, costUsd: costs.length && costs.every(Number.isFinite) ? costs.reduce((a, b) => a + b, 0) : null,
    allocation: 'aggregate-only', sideUsage };
}

export function attemptEvidence(context, identity, grade, prices) {
  const agent = agentEvidence(context.workspace);
  return { ...identity, event: 'attempt', at: new Date().toISOString(), workspace: context.workspace,
    ...usageSummary(context.sessions, agent.sideUsage, prices), sessions: context.sessions, events: context.events,
    customer: { clarificationRounds: context.clarifications, corrections: context.corrections, answers: context.answers },
    scopeSnapshots: context.snapshots, agentVerification: agent.verification, agentScope: agent.scoped,
    privateGrade: grade, error: context.error ?? null, stalled: context.stalled,
    incomplete: !context.completed || !context.snapshots.length || context.prematureBuild,
    prematureBuild: context.prematureBuild, humanReview: { status: 'missing' },
    ms: context.sessions.reduce((sum, session) => sum + session.ms, 0) };
}
