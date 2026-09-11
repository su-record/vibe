import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeConfig } from './config.js';
import { VibeError } from './errors.js';
import { answer, ask, openQuestions, resolve } from './inbox.js';
import { abandon, approve, draft, intentHash, loadScenarios } from './intent.js';
import { readLedger } from './ledger.js';
import { readState } from './state.js';
import { readSourceBasis, sourceValidity } from './source-basis.js';
import { foldTokens } from './tokens.js';

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
    expect(result.policy).toBe('off');
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

describe('agreement before approval', () => {
  it('an unanswered default stays unresolved until the customer answers', () => {
    const question = ask(root, { question: 'Which currency?', default: 'USD' });
    draft(root, INTENT, OK);
    expect(() => approve(root, null)).toThrow(/unanswered customer decisions.*defaults are not agreement/);
    expect(readState(root).state).toBe('DRAFT');
    expect(openQuestions(root)[0]?.answer).toBeNull();
    answer(root, question.id, 'KRW');
    expect(approve(root, null).basis).toBe('chat');
  });

  it('a matching approval token satisfies its own question but cannot bypass a material decision', () => {
    writeConfig(root, { tokens: 'strict' });
    const result = draft(root, INTENT, OK);
    if (!result.ok) throw new Error('draft failed');
    const approval = ask(root, { question: 'Approve this scope?', needs: { kind: 'approve', target: result.hash } });
    const decision = ask(root, { question: 'Which priority?', default: 'status' });
    expect(() => approve(root, approval.token)).toThrow(/unanswered customer decisions/);
    expect([...foldTokens(root).values()].every((token) => token.usedAt === null)).toBe(true);
    answer(root, decision.id, 'followup');
    expect(approve(root, approval.token)).toEqual({ hash: result.hash, basis: 'token' });
    expect(openQuestions(root).map((question) => question.id)).toEqual([decision.id]);
    expect([...foldTokens(root).values()].filter((token) => token.usedAt !== null)).toHaveLength(1);
  });

  it('approval cannot consume authorization for another action or approve a question for another scope', () => {
    writeConfig(root, { tokens: 'strict' });
    const result = draft(root, INTENT, OK);
    if (!result.ok) throw new Error('draft failed');
    const other = ask(root, { question: 'Approve the old scope?', needs: { kind: 'approve', target: 'older-intent' } });
    expect(() => approve(root, result.token)).toThrow(/unanswered customer decisions/);
    resolve(root, other.id);
    const authority = ask(root, { question: 'Send this?', needs: { kind: 'authorize', target: 'send:invoice' } });
    expect(() => approve(root, authority.token)).toThrow(/unanswered customer decisions/);
    answer(root, authority.id, 'No send is needed');
    expect(() => approve(root, authority.token)).toThrow(/token does not match/);
    expect([...foldTokens(root).values()].every((token) => token.usedAt === null)).toBe(true);
  });
});

describe('source-backed intent', () => {
  it('hashes source content once per normalized path and preserves the legacy hash without sources', () => {
    fs.writeFileSync(path.join(root, 'facts.md'), 'Observed facts\n');
    const first = draft(root, INTENT, OK, ['facts.md', './facts.md']);
    const repeated = draft(root, INTENT, OK, ['facts.md']);
    if (!first.ok || !repeated.ok) throw new Error('draft failed');
    expect(repeated.hash).toBe(first.hash);
    expect(readSourceBasis(root)).toHaveLength(1);
    expect(sourceValidity(root)).toMatchObject({ valid: true, sources: [{ path: 'facts.md', status: 'unchanged' }] });
    const legacy = draft(root, INTENT, OK);
    if (!legacy.ok) throw new Error('draft failed');
    expect(legacy.hash).toBe(intentHash(INTENT, OK));
    expect(legacy.hash).toBe('e3c00f947a89051e');
    expect(legacy.hash).not.toBe(first.hash);
    expect(fs.existsSync(path.join(root, '.vibe/source-basis.json'))).toBe(false);
    expect(sourceValidity(root)).toBeNull();
  });

  it('rejects changed or missing inputs before approval and accepts a re-evaluated fresh draft', () => {
    const file = path.join(root, 'facts.md');
    fs.writeFileSync(file, 'first facts');
    const first = draft(root, INTENT, OK, ['facts.md']);
    if (!first.ok) throw new Error('draft failed');
    fs.writeFileSync(file, 'revised facts');
    expect(sourceValidity(root)).toMatchObject({ valid: false, changed: ['facts.md'], missing: [] });
    expect(() => approve(root, null)).toThrow(/facts.md.*re-evaluate/);
    fs.rmSync(file);
    expect(sourceValidity(root)).toMatchObject({ valid: false, changed: [], missing: ['facts.md'] });
    expect(() => approve(root, null)).toThrow(/facts.md.*re-evaluate/);
    fs.writeFileSync(file, 'revised facts');
    const revised = draft(root, `${INTENT}\nUpdated findings\n`, OK, ['facts.md']);
    if (!revised.ok) throw new Error('draft failed');
    expect(revised.hash).not.toBe(first.hash);
    expect(approve(root, null).hash).toBe(revised.hash);
  });

  it('validates every source before overwriting a prior draft or approval token', () => {
    writeConfig(root, { tokens: 'strict' });
    fs.writeFileSync(path.join(root, 'facts.md'), 'facts');
    const first = draft(root, INTENT, OK, ['facts.md']);
    if (!first.ok) throw new Error('draft failed');
    const records = path.join(root, '.vibe');
    const before = Object.fromEntries(fs.readdirSync(records).map((name) => [name, fs.readFileSync(path.join(records, name), 'utf-8')]));
    fs.mkdirSync(path.join(root, 'docs'));
    expect(() => draft(root, '# changed', OK, ['facts.md', 'absent.csv'])).toThrow(/absent.csv/);
    expect(() => draft(root, '# changed', OK, ['.'])).toThrow(/regular file inside the project/);
    expect(() => draft(root, '# changed', OK, ['docs'])).toThrow(/not a directory/);
    expect(() => draft(root, '# changed', OK, ['../outside.csv'])).toThrow(/inside the project/);
    expect(Object.fromEntries(fs.readdirSync(records).map((name) => [name, fs.readFileSync(path.join(records, name), 'utf-8')]))).toEqual(before);
    expect(approve(root, first.token).hash).toBe(first.hash);
  });

  it('does not follow an input link outside the project or read bookkeeping as evidence', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-source-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'facts.md'), 'outside project');
      fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
      expect(() => draft(root, INTENT, OK, ['linked/facts.md'])).toThrow(/inside the project/);
      expect(() => draft(root, INTENT, OK, ['.vibe/state.json'])).toThrow(/not project bookkeeping/);
      expect(readState(root).state).toBe('NONE');
    } finally { fs.rmSync(outside, { recursive: true, force: true }); }
  });
});
