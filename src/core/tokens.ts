import { createHash, randomInt } from 'node:crypto';
import { vibePath } from './paths.js';
import { appendJsonl, nowIso, readJsonl } from './store.js';

/**
 * 사람 토큰 — 비밀은 프로세스가 아니라 사람이 쥔다.
 * 6자리 · 10분 · 1회용 · 대상 해시에 묶임. 저장은 해시뿐이라 파일을 읽어도 재사용할 수 없다.
 */
export type TokenKind = 'approve' | 'authorize';
export const TOKEN_TTL_MS = 10 * 60 * 1000;
export const TOKEN_MAX_FAILURES = 3;

interface TokenIssued {
  type: 'token';
  id: string;
  kind: TokenKind;
  target: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
}
interface TokenUsed {
  type: 'token-used';
  id: string;
  at: string;
}
interface TokenFailed {
  type: 'token-failed';
  id: string;
  at: string;
}
export type TokenEvent = TokenIssued | TokenUsed | TokenFailed;

export interface TokenView {
  id: string;
  kind: TokenKind;
  target: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  failures: number;
}

export function tokensPath(root: string): string {
  return vibePath(root, 'inbox.jsonl');
}

export function hashToken(digits: string): string {
  return createHash('sha256').update(`vibe-token:${digits}`).digest('hex');
}

export function hashTarget(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function foldTokens(root: string): Map<string, TokenView> {
  const views = new Map<string, TokenView>();
  for (const event of readJsonl<TokenEvent>(tokensPath(root))) {
    if (event.type === 'token') {
      views.set(event.id, { ...event, usedAt: null, failures: 0 });
    } else if (event.type === 'token-used') {
      const view = views.get(event.id);
      if (view) view.usedAt = event.at;
    } else if (event.type === 'token-failed') {
      const view = views.get(event.id);
      if (view) view.failures += 1;
    }
  }
  return views;
}

function formatDigits(digits: string): string {
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function issueToken(root: string, kind: TokenKind, target: string): { id: string; token: string; expiresAt: string } {
  const digits = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const id = `t-${Date.now().toString(36)}-${randomInt(0, 4096).toString(36)}`;
  const event: TokenIssued = { type: 'token', id, kind, target, tokenHash: hashToken(digits), issuedAt, expiresAt };
  appendJsonl(tokensPath(root), event);
  return { id, token: formatDigits(digits), expiresAt };
}

export type VerifyResult = { ok: true; id: string } | { ok: false; reason: string };

/** 검증 + 1회 사용 처리. 실패는 기록되고 3회면 그 토큰은 죽는다. */
export function verifyAndConsume(root: string, kind: TokenKind, target: string, token: string, now: Date = new Date()): VerifyResult {
  const digits = token.replace(/\D/g, '');
  if (digits.length !== 6) return { ok: false, reason: '토큰은 6자리 숫자다' };
  const wanted = hashToken(digits);
  const candidates = [...foldTokens(root).values()].filter((view) => view.kind === kind && view.target === target && view.usedAt === null);
  if (candidates.length === 0) return { ok: false, reason: `이 대상에 발급된 ${kind} 토큰이 없다 — 다시 발급받아야 한다` };
  const live = candidates.filter((view) => view.failures < TOKEN_MAX_FAILURES && new Date(view.expiresAt).getTime() > now.getTime());
  if (live.length === 0) return { ok: false, reason: '토큰이 만료됐거나 실패 3회로 폐기됐다 — 다시 발급받아야 한다' };
  const match = live.find((view) => view.tokenHash === wanted);
  if (!match) {
    for (const view of live) appendJsonl(tokensPath(root), { type: 'token-failed', id: view.id, at: nowIso() } satisfies TokenFailed);
    return { ok: false, reason: '토큰이 맞지 않는다' };
  }
  appendJsonl(tokensPath(root), { type: 'token-used', id: match.id, at: nowIso() } satisfies TokenUsed);
  return { ok: true, id: match.id };
}
