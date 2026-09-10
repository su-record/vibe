import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { agentEvidence, treeManifest } from '../snapshot.js';
import { gradingWorkspace } from '../workspace.js';
import { addTokens, weightedInput } from './clients.js';
import { safeSession, safeUsage, safeEvent, safeVerification, safeScope, safeGrade, safeSnapshot, failureCode, contentSummary } from './privacy.js';
import { writeDiagnostic } from './private-artifacts.js';

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
  const price = (model, amount) => {
    if (!amount) return null;
    const costs = Object.keys(amount).map((key) => amount[key] === 0 ? 0 : Number.isFinite(prices[model]?.[key]) ? amount[key] * prices[model][key] / 1e6 : null);
    return costs.every(Number.isFinite) ? costs.reduce((sum, cost) => sum + cost, 0) : null;
  };
  const costs = sessions.flatMap((session) => session.models?.length ? session.models.map((m) => price(m.model, m.tokens)) : [price(session.requestedModel, session.tokens)]).concat(sideUsage.map((s) => price(s.model, s.tokens)));
  const recomputed = costs.length && costs.every(Number.isFinite) ? costs.reduce((a, b) => a + b, 0) : null;
  const sideCosts = sideUsage.map((s) => Number.isFinite(s.costUsd) ? s.costUsd : price(s.model, s.tokens));
  const reportedTotal = reported !== null && sideCosts.every(Number.isFinite) ? reported + sideCosts.reduce((sum, cost) => sum + cost, 0) : null;
  return { tokens, weightedInput: tokens ? weightedInput(tokens) : null, usage: tokens ? 'captured' : 'missing',
    reportedMainCostUsd: reported, recomputedCostUsd: recomputed, costUsd: recomputed ?? reportedTotal,
    costBasis: recomputed !== null ? 'configured-category-prices' : reportedTotal !== null ? 'client-reported-plus-known-side-costs' : 'unknown',
    allocation: 'aggregate-only', sideUsage: sideUsage.map(safeUsage) };
}

export function attemptEvidence(context, identity, grade, prices, diagnostics) {
  let agent;
  try { agent = agentEvidence(context.workspace); }
  catch (error) {
    context.error = 'AGENT_EVIDENCE_UNAVAILABLE';
    agent = { sideUsage: [{ tokens: null, error: 'AGENT_EVIDENCE_UNAVAILABLE' }], verification: null, scoped: null };
  }
  const privateArtifact = writeDiagnostic(diagnostics, `${identity.protocolHash}/${identity.id}`, 'attempt', { sessions: context.sessions, events: context.events, answers: context.answers, agent, grade, error: context.error });
  const manifest = treeManifest(context.workspace);
  return { ...identity, event: 'attempt', at: new Date().toISOString(), workspaceArtifact: { path: context.workspace, private: true, sha256: digest(manifest), files: Object.keys(manifest).length },
    ...usageSummary(context.sessions, agent.sideUsage, prices), sessions: context.sessions.map(safeSession), events: context.events.map(safeEvent),
    customer: { clarificationRounds: context.clarifications, corrections: context.corrections, answers: { count: context.answers.length, ...contentSummary(context.answers) } },
    scopeSnapshots: context.snapshots.map(safeSnapshot), agentVerification: safeVerification(agent.verification), agentScope: safeScope(agent.scoped),
    privateGrade: safeGrade(grade), error: failureCode(context.error), errorCode: failureCode(context.error), errorDetails: contentSummary(context.error), stalled: context.stalled,
    diagnostics: privateArtifact ? [privateArtifact] : [],
    incomplete: !context.completed || !context.snapshots.length || context.prematureBuild,
    prematureBuild: context.prematureBuild,
    ms: context.sessions.reduce((sum, session) => sum + session.ms, 0) };
}
