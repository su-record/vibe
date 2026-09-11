import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { parseScenarios } from './scenarios.js';
import { draft, approve } from './intent.js';
import { runChecks, invalidateDoneIfEdited } from './check.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-risk-')); fs.mkdirSync(path.join(root, '.vibe')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const risk = { kind: 'access', impact: 'Another tenant may be modified.', recovery: 'Disable writes and recover the verified snapshot.', failureChecks: ['failure'], recoveryChecks: ['recovery'] };
function contract(overrides = {}) {
  return JSON.stringify([
    { id: 'failure', then: 'Rejected requests preserve data', check: { type: 'file', path: 'failure.txt', contains: 'safe' } },
    { id: 'recovery', then: 'Recovery preserves original values', check: { type: 'file', path: 'recovery.txt', contains: 'safe' } },
    { id: 'update', then: 'Authorized writes succeed', risk: { ...risk, ...overrides }, check: { type: 'run', cmd: 'node -e "0"' } },
  ]);
}

it('rejects missing obligations, unknown risks, references, self references and human substitutes before saving', () => {
  for (const change of [{ failureChecks: [] }, { kind: 'low' }, { recovery: '' }, { recoveryChecks: ['missing'] }, { failureChecks: ['update'] }, { surprise: true }]) {
    expect(draft(root, '# Update', contract(change)).ok).toBe(false);
    expect(fs.existsSync(path.join(root, '.vibe', 'intent.md'))).toBe(false);
  }
  const values = JSON.parse(contract());
  values[0].check = { type: 'human', question: 'Looks okay?' };
  expect(parseScenarios(JSON.stringify(values)).rejections.some(r => r.reason.includes('machine check'))).toBe(true);
});

it('rejects weak, unbound or irreversible prerequisites and risk dependency cycles', () => {
  for (const check of [{ type: 'file', path: 'x', exists: true }, { type: 'file', path: 'x', exists: true, timeoutMs: 10 }, { type: 'file', path: 'x', exists: true, contains: '' }, { type: 'file', path: 'x', exists: false, contains: 'safe' }, { type: 'run', cmd: 'node -e 0' }, { type: 'run', cmd: 'git push' }, { type: 'review', path: 'x' }]) {
    const values = JSON.parse(contract());
    values[0].check = check;
    expect(parseScenarios(JSON.stringify(values)).rejections.length).toBeGreaterThan(0);
  }
  const values = JSON.parse(contract());
  values[0].needs = ['update'];
  expect(parseScenarios(JSON.stringify(values)).rejections.some(r => r.reason.includes('cycle'))).toBe(true);
});

it('selected risky work pulls in obligations, blocks on failure, then passes only with fresh evidence', async () => {
  fs.writeFileSync(path.join(root, 'recovery.txt'), 'safe');
  fs.writeFileSync(path.join(root, 'failure.txt'), 'denial broken');
  expect(draft(root, '# Update', contract()).ok).toBe(true);
  approve(root, null);
  const first = await runChecks(root, { ids: ['update'] });
  expect(first.done).toBe(false);
  expect(first.outcomes.find(o => o.id === 'update')).toMatchObject({ status: 'blocked', blockedBy: ['failure'] });
  fs.writeFileSync(path.join(root, 'failure.txt'), 'safe');
  const next = await runChecks(root, { ids: ['update'] });
  expect(next.done).toBe(true);
  expect(next.outcomes.filter(o => o.status === 'pass')).toHaveLength(3);
  fs.writeFileSync(path.join(root, 'recovery.txt'), 'broken');
  expect(invalidateDoneIfEdited(root)).toBe(true);
  const changed = await runChecks(root, { ids: ['update'] });
  expect(changed.done).toBe(false);
  expect(changed.outcomes.find(o => o.id === 'update')?.status).toBe('blocked');
});

it('binds executable prerequisite bytes and rejects later verifier edits before execution', async () => {
  fs.writeFileSync(path.join(root, '.vibe', 'verify.cjs'), 'process.exitCode = 0;');
  fs.writeFileSync(path.join(root, 'recovery.txt'), 'safe');
  const values = JSON.parse(contract());
  values[0].check = { type: 'run', cmd: 'node .vibe/verify.cjs' };
  values[0].verifiers = ['.vibe/verify.cjs'];
  expect(draft(root, '# Update', JSON.stringify(values)).ok).toBe(true);
  approve(root, null);
  expect((await runChecks(root)).done).toBe(true);
  fs.writeFileSync(path.join(root, '.vibe', 'verify.cjs'), 'process.exitCode = 1;');
  expect(invalidateDoneIfEdited(root)).toBe(true);
  await expect(runChecks(root)).rejects.toThrow();
});
