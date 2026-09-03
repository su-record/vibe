import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeConfig } from './config.js';
import { VibeError } from './errors.js';
import { abandon, approve, draft, loadScenarios } from './intent.js';
import { readLedger } from './ledger.js';
import { readState } from './state.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-intent-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const INTENT = '# Order sheet → settlement sheet\n\n## Why\nDone by hand every week\n';
const OK = `- { id: s1, then: the settlement sheet is produced, check: { type: file, path: out.xlsx, exists: true } }\n`;

describe('intent draft / approve', () => {
  it('writes nothing when any scenario lacks a check', () => {
    const result = draft(root, INTENT, `${OK}- { id: s2, then: the wording is nice }\n`);
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(root, '.vibe', 'scenarios.yaml'))).toBe(false);
    expect(readState(root).state).toBe('NONE');
  });

  it('saving makes DRAFT; under the default policy no token is issued and a plain approve is recorded "by chat"', () => {
    const result = draft(root, INTENT, OK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(readState(root)).toMatchObject({ state: 'DRAFT', intentHash: result.hash });
    expect(loadScenarios(root).map((s) => s.id)).toEqual(['s1']);
    expect(result.token).toBeNull();
    expect(result.policy).toBe('irreversible');
    expect(approve(root, null)).toEqual({ hash: result.hash, basis: 'chat' });
    expect(readLedger(root).at(-1)?.detail).toContain('by chat');
  });

  it('under strict, never becomes APPROVED without the token — a wrong number exits 3', () => {
    writeConfig(root, { tokens: 'strict' });
    const result = draft(root, INTENT, OK);
    if (!result.ok) throw new Error('draft failed');
    expect(result.token).toMatch(/^\d{3} \d{3}$/);
    expect(() => approve(root, null)).toThrowError(VibeError);
    expect(() => approve(root, '000 000')).toThrowError(VibeError);
    try {
      approve(root, '123456');
    } catch (error) {
      expect((error as VibeError).exitCode).toBe(3);
    }
    expect(readState(root).state).toBe('DRAFT');
  });

  it('under strict, the right token approves once and the same token does not work twice', () => {
    writeConfig(root, { tokens: 'strict' });
    const result = draft(root, INTENT, OK);
    if (!result.ok || !result.token) throw new Error('draft failed');
    expect(approve(root, result.token)).toEqual({ hash: result.hash, basis: 'token' });
    expect(readState(root).state).toBe('APPROVED');
    expect(() => approve(root, result.token)).toThrowError(VibeError);
  });

  it('a changed intent voids the approval regardless of policy', () => {
    const first = draft(root, INTENT, OK);
    if (!first.ok) throw new Error('draft failed');
    fs.writeFileSync(path.join(root, '.vibe', 'scenarios.yaml'), `${OK}- { id: s2, then: one more, check: { type: run, cmd: "exit 0" } }\n`);
    expect(() => approve(root, null)).toThrowError(/changed since the draft/);
  });

  it('abandon needs a reason and is recorded', () => {
    draft(root, INTENT, OK);
    expect(() => abandon(root, '')).toThrowError(VibeError);
    abandon(root, 'the customer changed the scope');
    expect(readState(root)).toMatchObject({ state: 'ABANDONED', abandonedReason: 'the customer changed the scope' });
  });
});
