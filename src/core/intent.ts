import { createHash } from 'node:crypto';
import { detectClient, detectModel } from './client.js';
import { approvalNeedsToken, readConfig } from './config.js';
import { denied, usage } from './errors.js';
import { openQuestions, resolve as resolveQuestion } from './inbox.js';
import { record } from './ledger.js';
import { vibePath } from './paths.js';
import { parseScenarios, type Rejection, type Scenario } from './scenarios.js';
import { readState, transition } from './state.js';
import { captureSources, readSourceBasis, saveSourceBasis, sourceValidity, type SourceReference } from './source-basis.js';
import { readText, writeAtomic, writeJson } from './store.js';
import { issueToken, verifyAndConsume } from './tokens.js';
import { consentStatus, saveConsent } from './consent.js';
import { executionPlan } from './inspect.js';

export function intentPath(root: string): string {
  return vibePath(root, 'intent.md');
}
export function scenariosPath(root: string): string {
  return vibePath(root, 'scenarios.yaml');
}

export function intentHash(intentText: string, scenariosText: string, sources: SourceReference[] = []): string {
  const hash = createHash('sha256').update(intentText).update('\n---\n').update(scenariosText);
  if (sources.length) hash.update('\n---sources---\n').update(JSON.stringify(sources));
  return hash.digest('hex').slice(0, 16);
}

export function loadScenarios(root: string): Scenario[] {
  const text = readText(scenariosPath(root));
  if (text === null) return [];
  return parseScenarios(text).scenarios;
}

export function hasIntent(root: string): boolean {
  const text = readText(intentPath(root));
  return text !== null && text.trim().length > 0;
}

export type DraftResult =
  | { ok: true; hash: string; scenarios: Scenario[]; token: string | null; tokenId: string | null; expiresAt: string | null; policy: string }
  | { ok: false; rejections: Rejection[] };

/**
 * Save intent + scenarios. If any scenario lacks a check type nothing is written — the
 * invariant "every stored scenario is checkable" holds. On success an approval token is issued.
 */
export function draft(root: string, intentText: string, scenariosText: string, sources?: string[]): DraftResult {
  if (!intentText.trim()) throw usage('intent body is empty');
  const parsed = parseScenarios(scenariosText);
  if (parsed.rejections.length > 0) return { ok: false, rejections: parsed.rejections };
  if (parsed.scenarios.length === 0) return { ok: false, rejections: [{ id: '(none)', reason: 'no scenarios' }] };
  const sourceBasis = captureSources(root, sources);
  // The hash covers the exact bytes written — approve recomputes it from the files.
  const intentNorm = intentText.endsWith('\n') ? intentText : `${intentText}\n`;
  const scenariosNorm = scenariosText.endsWith('\n') ? scenariosText : `${scenariosText}\n`;
  const hash = intentHash(intentNorm, scenariosNorm, sourceBasis);
  const previousState = readState(root);
  const previous = previousState.intentHash;
  writeAtomic(intentPath(root), intentNorm);
  writeAtomic(scenariosPath(root), scenariosNorm);
  saveSourceBasis(root, sourceBasis);
  writeJson(vibePath(root, 'results.json'), {});
  transition(root, 'DRAFT', { intentHash: hash, approvedAt: null, runs: previousState.runs, failStreak: 0, lastFailHash: null, repair: null, doneAt: null, doneTree: null, abandonedReason: null });
  const policy = readConfig(root).tokens;
  const issued = approvalNeedsToken(policy) ? issueToken(root, 'approve', hash) : null;
  const edges = previous && previous !== hash ? [{ type: 'supersedes' as const, from: `intent:${hash}`, to: `intent:${previous}` }] : [];
  record(root, { event: 'draft', client: detectClient(), model: detectModel(), detail: hash, edges });
  return { ok: true, hash, scenarios: parsed.scenarios, token: issued?.token ?? null, tokenId: issued?.id ?? null, expiresAt: issued?.expiresAt ?? null, policy };
}

/**
 * APPROVED — under `strict` only a human token does it; otherwise a plain approve is recorded as
 * "by chat". Either way the ledger says how it was approved. If the intent changed, the old token's
 * target hash no longer matches.
 */
export function approve(root: string, token: string | null): { hash: string; basis: 'token' | 'chat' } {
  const state = readState(root);
  const renewal = ['APPROVED', 'RUNNING', 'STUCK', 'DONE'].includes(state.state) && !consentStatus(root).valid;
  if ((state.state !== 'DRAFT' && !renewal) || !state.intentHash) throw denied(`nothing to approve (current state ${state.state})`);
  const sourceBasis = readSourceBasis(root);
  const current = intentHash(readText(intentPath(root)) ?? '', readText(scenariosPath(root)) ?? '', sourceBasis);
  if (current !== state.intentHash) throw denied('intent changed since the draft — run `intent draft` again to get a new token');
  const validity = sourceValidity(root, sourceBasis);
  if (validity && !validity.valid) throw denied(`source changed or missing since the draft: ${[...validity.changed, ...validity.missing, ...validity.unreadable].join(', ')} — re-evaluate affected findings and run \`intent draft\` again`);
  const waiting = openQuestions(root).filter((question) => !question.answer?.trim());
  const blocked = waiting.filter((question) => !(token && question.needs === 'approve' && question.target === state.intentHash));
  if (blocked.length) throw denied(`unanswered customer decisions: ${blocked.map((question) => question.id).join(', ')} — obtain an answer or resolve a withdrawn question before approval; defaults are not agreement`);
  const plan = executionPlan(root);
  const policy = readConfig(root).tokens;
  let basis: 'token' | 'chat' = 'chat';
  let by = 'human:chat';
  if (approvalNeedsToken(policy) || token) {
    if (!token) throw denied('this project requires a human token to approve (tokens: strict)');
    const verdict = verifyAndConsume(root, 'approve', state.intentHash, token);
    if (!verdict.ok) throw denied(verdict.reason);
    basis = 'token';
    by = `human:token:${verdict.id}`;
  }
  saveConsent(root, plan);
  if (!renewal) transition(root, 'APPROVED', { approvedAt: new Date().toISOString() });
  for (const question of waiting) resolveQuestion(root, question.id);
  record(root, { event: 'approve', client: detectClient(), model: detectModel(), detail: `${state.intentHash} by ${basis}`, edges: [{ type: 'decided-by', from: `intent:${state.intentHash}`, to: by }] });
  return { hash: state.intentHash, basis };
}

export function abandon(root: string, reason: string): void {
  if (!reason.trim()) throw usage('abandon requires --reason');
  transition(root, 'ABANDONED', { abandonedReason: reason });
  record(root, { event: 'abandon', client: detectClient(), model: detectModel(), detail: reason });
}
