import { createHash } from 'node:crypto';
import { detectClient, detectModel } from './client.js';
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
  | { ok: true; hash: string; scenarios: Scenario[]; token: string; tokenId: string; expiresAt: string }
  | { ok: false; rejections: Rejection[] };

/**
 * Intent + 시나리오 저장. 검사 유형이 없는 시나리오가 하나라도 있으면 아무것도 쓰지 않는다 —
 * 저장된 시나리오는 전부 검사 가능하다는 불변식을 지킨다. 성공하면 승인 토큰을 발급한다.
 */
export function draft(root: string, intentText: string, scenariosText: string): DraftResult {
  if (!intentText.trim()) throw usage('intent 본문이 비어 있다');
  const parsed = parseScenarios(scenariosText);
  if (parsed.rejections.length > 0) return { ok: false, rejections: parsed.rejections };
  if (parsed.scenarios.length === 0) return { ok: false, rejections: [{ id: '(none)', reason: '시나리오가 하나도 없다' }] };
  // 해시는 저장되는 바이트 그대로 — 나중에 파일에서 다시 계산한 값과 같아야 한다
  const intentNorm = intentText.endsWith('\n') ? intentText : `${intentText}\n`;
  const scenariosNorm = scenariosText.endsWith('\n') ? scenariosText : `${scenariosText}\n`;
  const hash = intentHash(intentNorm, scenariosNorm);
  writeAtomic(intentPath(root), intentNorm);
  writeAtomic(scenariosPath(root), scenariosNorm);
  writeJson(vibePath(root, 'results.json'), {});
  transition(root, 'DRAFT', { intentHash: hash, approvedAt: null, runs: 0, failStreak: 0, lastFailHash: null, doneAt: null, doneTree: null, abandonedReason: null });
  const issued = issueToken(root, 'approve', hash);
  record(root, { event: 'draft', client: detectClient(), model: detectModel(), detail: hash });
  return { ok: true, hash, scenarios: parsed.scenarios, token: issued.token, tokenId: issued.id, expiresAt: issued.expiresAt };
}

/** 사람 토큰으로만 APPROVED 가 된다. Intent 가 바뀌면 이전 토큰은 대상 해시가 달라 무효다. */
export function approve(root: string, token: string): { hash: string } {
  const state = readState(root);
  if (state.state !== 'DRAFT' || !state.intentHash) throw denied(`승인할 DRAFT 가 없다 (현재 ${state.state})`);
  const current = intentHash(readText(intentPath(root)) ?? '', readText(scenariosPath(root)) ?? '');
  if (current !== state.intentHash) throw denied('Intent 가 초안 이후 바뀌었다 — intent draft 를 다시 실행해 새 토큰을 받아야 한다');
  const verdict = verifyAndConsume(root, 'approve', state.intentHash, token);
  if (!verdict.ok) throw denied(verdict.reason);
  transition(root, 'APPROVED', { approvedAt: new Date().toISOString() });
  record(root, { event: 'approve', client: detectClient(), model: detectModel(), detail: state.intentHash });
  return { hash: state.intentHash };
}

export function abandon(root: string, reason: string): void {
  if (!reason.trim()) throw usage('abandon 에는 --reason 이 필요하다');
  transition(root, 'ABANDONED', { abandonedReason: reason });
  record(root, { event: 'abandon', client: detectClient(), model: detectModel(), detail: reason });
}
