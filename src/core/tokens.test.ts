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

describe('human tokens', () => {
  it('issue → verify once → cannot be reused', () => {
    const { token } = issueToken(root, 'approve', 'hash-1');
    expect(token).toMatch(/^\d{3} \d{3}$/);
    expect(verifyAndConsume(root, 'approve', 'hash-1', token)).toMatchObject({ ok: true });
    expect(verifyAndConsume(root, 'approve', 'hash-1', token)).toMatchObject({ ok: false });
  });

  it('stores only the hash — the plain digits never touch the file', () => {
    const { token } = issueToken(root, 'authorize', 'send:acct@example.com');
    const digits = token.replace(/\D/g, '');
    const file = fs.readFileSync(path.join(root, '.vibe', 'inbox.jsonl'), 'utf-8');
    expect(file).not.toContain(digits);
    expect(file).toContain(hashToken(digits));
  });

  it('is bound to its target — an approval token cannot authorize a send', () => {
    const { token } = issueToken(root, 'approve', 'hash-1');
    expect(verifyAndConsume(root, 'authorize', 'send:x', token).ok).toBe(false);
    expect(verifyAndConsume(root, 'approve', 'hash-2', token).ok).toBe(false);
    expect(verifyAndConsume(root, 'approve', 'hash-1', token).ok).toBe(true);
  });

  it('dies after three failures', () => {
    const { token, id } = issueToken(root, 'approve', 'hash-1');
    for (let i = 0; i < TOKEN_MAX_FAILURES; i += 1) expect(verifyAndConsume(root, 'approve', 'hash-1', '000 000').ok).toBe(false);
    expect(foldTokens(root).get(id)?.failures).toBe(TOKEN_MAX_FAILURES);
    expect(verifyAndConsume(root, 'approve', 'hash-1', token)).toMatchObject({ ok: false, reason: expect.stringContaining('revoked') });
  });

  it('expires after ten minutes', () => {
    const { token } = issueToken(root, 'approve', 'hash-1');
    const later = new Date(Date.now() + TOKEN_TTL_MS + 1000);
    expect(verifyAndConsume(root, 'approve', 'hash-1', token, later)).toMatchObject({ ok: false, reason: expect.stringContaining('expired') });
  });
});
