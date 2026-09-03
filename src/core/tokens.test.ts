import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { foldTokens, hashToken, issueToken, TOKEN_MAX_FAILURES, TOKEN_TTL_MS, verifyAndConsume } from './tokens.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-token-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('사람 토큰', () => {
  it('발급 → 검증 1회 → 재사용 불가', () => {
    const { token } = issueToken(root, 'approve', 'hash-1');
    expect(token).toMatch(/^\d{3} \d{3}$/);
    expect(verifyAndConsume(root, 'approve', 'hash-1', token)).toMatchObject({ ok: true });
    expect(verifyAndConsume(root, 'approve', 'hash-1', token)).toMatchObject({ ok: false });
  });

  it('저장은 해시뿐 — 파일에 평문 번호가 없다', () => {
    const { token } = issueToken(root, 'authorize', 'send:acct@example.com');
    const digits = token.replace(/\D/g, '');
    const file = fs.readFileSync(path.join(root, '.vibe', 'inbox.jsonl'), 'utf-8');
    expect(file).not.toContain(digits);
    expect(file).toContain(hashToken(digits));
  });

  it('대상이 다르면 통과하지 않는다 — 승인 토큰으로 발송을 못 한다', () => {
    const { token } = issueToken(root, 'approve', 'hash-1');
    expect(verifyAndConsume(root, 'authorize', 'send:x', token).ok).toBe(false);
    expect(verifyAndConsume(root, 'approve', 'hash-2', token).ok).toBe(false);
    expect(verifyAndConsume(root, 'approve', 'hash-1', token).ok).toBe(true);
  });

  it('3회 실패하면 토큰이 죽는다', () => {
    const { token, id } = issueToken(root, 'approve', 'hash-1');
    for (let i = 0; i < TOKEN_MAX_FAILURES; i += 1) expect(verifyAndConsume(root, 'approve', 'hash-1', '000 000').ok).toBe(false);
    expect(foldTokens(root).get(id)?.failures).toBe(TOKEN_MAX_FAILURES);
    expect(verifyAndConsume(root, 'approve', 'hash-1', token)).toMatchObject({ ok: false, reason: expect.stringContaining('폐기') });
  });

  it('10분이 지나면 만료된다', () => {
    const { token } = issueToken(root, 'approve', 'hash-1');
    const later = new Date(Date.now() + TOKEN_TTL_MS + 1000);
    expect(verifyAndConsume(root, 'approve', 'hash-1', token, later)).toMatchObject({ ok: false, reason: expect.stringContaining('만료') });
  });
});
