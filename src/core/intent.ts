import { createHash } from 'node:crypto';
import { detectClient, detectModel } from './client.js';
import { approvalNeedsToken, readConfig } from './config.js';
import { denied, usage } from './errors.js';
import { record } from './ledger.js';
import { vibePath } from './paths.js';
import { parseScenarios, type Rejection, type Scenario } from './scenarios.js';
import { readState, transition } from './state.js';
import { readText, writeAtomic, writeJson } from './store.js';
import { issueToken, verifyAndConsume } from './tokens.js';

export function intentPath(root: string): string {
  return vibePath(root, 'intent.md');
}
export function scenariosPath(root: string): string {
  return vibePath(root, 'scenarios.yaml');
}

export function intentHash(intentText: string, scenariosText: string): string {
  return createHash('sha256').update(intentText).update('\n---\n').update(scenariosText).digest('hex').slice(0, 16);
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
export function draft(root: string, intentText: string, scenariosText: string): DraftResult {
  if (!intentText.trim()) throw usage('intent body is empty');
  const parsed = parseScenarios(scenariosText);
  if (parsed.rejections.length > 0) return { ok: false, rejections: parsed.rejections };
  if (parsed.scenarios.length === 0) return { ok: false, rejections: [{ id: '(none)', reason: 'no scenarios' }] };
  // The hash covers the exact bytes written — approve recomputes it from the files.
  const intentNorm = intentText.endsWith('\n') ? intentText : `${intentText}\n`;
  const scenariosNorm = scenariosText.endsWith('\n') ? scenariosText : `${scenariosText}\n`;
  const hash = intentHash(intentNorm, scenariosNorm);
  writeAtomic(intentPath(root), intentNorm);
  writeAtomic(scenariosPath(root), scenariosNorm);
  writeJson(vibePath(root, 'results.json'), {});
  transition(root, 'DRAFT', { intentHash: hash, approvedAt: null, runs: 0, failStreak: 0, lastFailHash: null, doneAt: null, doneTree: null, abandonedReason: null });
  const policy = readConfig(root).tokens;
  const issued = approvalNeedsToken(policy) ? issueToken(root, 'approve', hash) : null;
  record(root, { event: 'draft', client: detectClient(), model: detectModel(), detail: hash });
  return { ok: true, hash, scenarios: parsed.scenarios, token: issued?.token ?? null, tokenId: issued?.id ?? null, expiresAt: issued?.expiresAt ?? null, policy };
}

/**
 * APPROVED — under `strict` only a human token does it; otherwise a plain approve is recorded as
 * "by chat". Either way the ledger says how it was approved. If the intent changed, the old token's
 * target hash no longer matches.
 */
export function approve(root: string, token: string | null): { hash: string; basis: 'token' | 'chat' } {
  const state = readState(root);
  if (state.state !== 'DRAFT' || !state.intentHash) throw denied(`nothing to approve (current state ${state.state})`);
  const current = intentHash(readText(intentPath(root)) ?? '', readText(scenariosPath(root)) ?? '');
  if (current !== state.intentHash) throw denied('intent changed since the draft — run `intent draft` again to get a new token');
  const policy = readConfig(root).tokens;
  let basis: 'token' | 'chat' = 'chat';
  if (approvalNeedsToken(policy) || token) {
    if (!token) throw denied('this project requires a human token to approve (tokens: strict)');
    const verdict = verifyAndConsume(root, 'approve', state.intentHash, token);
    if (!verdict.ok) throw denied(verdict.reason);
    basis = 'token';
  }
  transition(root, 'APPROVED', { approvedAt: new Date().toISOString() });
  record(root, { event: 'approve', client: detectClient(), model: detectModel(), detail: `${state.intentHash} by ${basis}` });
  return { hash: state.intentHash, basis };
}

export function abandon(root: string, reason: string): void {
  if (!reason.trim()) throw usage('abandon requires --reason');
  transition(root, 'ABANDONED', { abandonedReason: reason });
  record(root, { event: 'abandon', client: detectClient(), model: detectModel(), detail: reason });
}
