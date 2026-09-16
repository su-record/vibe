import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { draft, approve } from './intent.js';
import { runChecks } from './check.js';
import { verificationPlan } from './verification-plan.js';
import { packageRoot } from './paths.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-plan-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function snapshot(dir = root): Record<string, string> {
  return Object.fromEntries(fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const file = path.join(dir, e.name);
    return e.isDirectory() ? Object.entries(snapshot(file)) : [[file, fs.readFileSync(file).toString('base64')]];
  }));
}
function fixture(): void {
  fs.writeFileSync(path.join(root, 'input.txt'), 'ok');
  const result = draft(root, '# Verify existing input', `
- { id: parent, then: input exists, check: { type: file, path: input.txt, contains: ok } }
- { id: child, then: input is correct, needs: [parent], check: { type: file, path: input.txt, contains: ok } }
`);
  expect(result.ok).toBe(true);
  approve(root, result.token);
}

it('does not initialize an untracked directory or manufacture permission', () => {
  const plan = verificationPlan(root);
  expect(plan.blockers).toEqual(['task is NONE; no approved execution']);
  expect(fs.readdirSync(root)).toEqual([]);
});

it('resumes in a fresh CLI process without rerunning successful checks or modifying records', async () => {
  fixture();
  await runChecks(root, { ids: ['parent'] });
  const before = snapshot();
  const process = spawnSync(globalThis.process.execPath,
    [path.join(packageRoot(), 'dist/cli.js'), 'internal', 'verification', '--json'],
    { cwd: root, encoding: 'utf8', env: { ...globalThis.process.env, VIBE_SKIP_SETUP: '1' } });
  expect(process.status, process.stderr).toBe(0);
  const plan = JSON.parse(process.stdout);
  expect(plan.blockers).toEqual([]);
  expect(plan.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'parent', decision: 'reuse', evidence: 'r-1#parent' }),
    expect.objectContaining({ id: 'child', decision: 'selected', prerequisites: [] }),
  ]));
  expect(snapshot()).toEqual(before);
  expect((await runChecks(root)).outcomes.map(o => o.id)).toEqual(['child']);
});

it('includes stale prerequisites and agrees with actual execution after an input changes', async () => {
  fixture(); await runChecks(root);
  fs.writeFileSync(path.join(root, 'input.txt'), 'changed');
  const plan = verificationPlan(root, { ids: ['child'] });
  expect(plan.checks.map(c => [c.id, c.decision, c.last])).toEqual([
    ['parent', 'selected', 'stale'], ['child', 'selected', 'stale'],
  ]);
  expect(plan.checks[1]?.prerequisites).toEqual(['parent']);
  const report = await runChecks(root, { ids: ['child'] });
  expect(report.outcomes.map(o => [o.id, o.status])).toEqual([['parent', 'fail'], ['child', 'blocked']]);
  expect(report.done).toBe(false);
});

it('keeps explicit reruns available, and reports edited contracts without granting reuse authority', async () => {
  fixture(); await runChecks(root);
  expect(verificationPlan(root).checks.every(c => c.decision === 'reuse')).toBe(true);
  expect(verificationPlan(root, { all: true }).checks.every(c => c.decision === 'selected')).toBe(true);
  fs.appendFileSync(path.join(root, '.vibe/intent.md'), '\nChanged objective\n');
  const before = snapshot();
  expect(verificationPlan(root).blockers.some(b => b.includes('approval void'))).toBe(true);
  expect(snapshot()).toEqual(before);
  await expect(runChecks(root)).rejects.toThrow('approval void');
});

it('invalidates an ignored artifact and its dependent on resumption', async () => {
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'dist/proof.txt'), 'ok');
  const draftResult = draft(root, '# Generated proof', `
- {id: output, then: generated output, artifacts: [dist/proof.txt], check: {type: file, path: dist/proof.txt, contains: ok}}
- {id: consumer, then: dependent output, needs: [output], check: {type: file, path: dist/proof.txt, contains: ok}}
`);
  expect(draftResult.ok).toBe(true); approve(root, draftResult.token); await runChecks(root);
  fs.rmSync(path.join(root, 'dist/proof.txt'));
  expect(verificationPlan(root).checks.every(c => c.last === 'stale' && c.decision === 'selected')).toBe(true);
});

it('reports exhausted repair attempts without clearing the wait or running again', async () => {
  draft(root, '# Missing input', '- {id: missing, then: input exists, check: {type: file, path: missing.txt, contains: ok}}');
  approve(root, null);
  for (let i = 0; i < 5; i++) await runChecks(root);
  const before = snapshot();
  expect(verificationPlan(root)).toMatchObject({ retry: { failures: 5, waiting: true },
    blockers: expect.arrayContaining(['repair limit reached; existing question needs an answer']) });
  expect(snapshot()).toEqual(before);
  await expect(runChecks(root)).rejects.toThrow('repair limit');
  fs.rmSync(path.join(root, '.vibe/inbox.jsonl'));
  expect(verificationPlan(root).retry?.waiting).toBe(true);
  await expect(runChecks(root)).rejects.toThrow('repair limit');
});
