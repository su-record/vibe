import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { runChecks } from './check.js';
import { draft, approve } from './intent.js';
import { answer, openQuestions, resolve } from './inbox.js';
import { readState } from './state.js';
import { buildStateView } from './view.js';
import { buildContext, renderContext } from './context.js';

const { repairMessage } = createRequire(import.meta.url)('../../hooks/session-repair.cjs') as { repairMessage(view: unknown): string };
let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-repair-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function fixture(): void {
  fs.mkdirSync(path.join(root, 'services'), { recursive: true });
  fs.writeFileSync(path.join(root, 'services/worker.ts'), 'export {};');
  fs.writeFileSync(path.join(root, 'failed.log'), 'diagnostic fixture');
  const diagnostic = `${path.join(root, 'services/worker.ts')}:79: error TS2503: Cannot find namespace 'sharp'; token=top-secret user@example.com https://example.test/?key=secret failed.log`;
  fs.writeFileSync(path.join(root, 'emit.cjs'), `console.error(${JSON.stringify(diagnostic)});console.log('RAW-UNRELATED-CANARY');process.exitCode=2;`);
  draft(root, '# diagnosis', '- { id: gates, then: checked, check: { type: run, cmd: "node emit.cjs" } }');
  approve(root, null);
}
it('diagnoses at two, keeps the masked cause and source first, asks at five and blocks further retries', async () => {
  fixture();
  await runChecks(root, { approach: 'check compiler inputs' });
  await runChecks(root, { approach: 'inspect the namespace import' });
  expect(readState(root)).toMatchObject({ state: 'STUCK', failStreak: 2 });
  expect(openQuestions(root)).toHaveLength(0);
  const view = buildStateView(root, root);
  expect(view.scenarios[0]?.files?.[0]).toBe('services/worker.ts');
  expect(view.next).toContain("Cannot find namespace 'sharp'");
  expect(view.next).toContain('vibe context gates');
  const context = buildContext(root, 'gates');
  expect(context.files[0]?.path).toBe('services/worker.ts');
  expect(renderContext(context)).toContain("Cannot find namespace 'sharp'");
  const stopped = repairMessage({ repair: readState(root).repair });
  expect(stopped).toContain("Cannot find namespace 'sharp'");
  expect(stopped).toContain('change the approach');
  for (let i = 0; i < 3; i++) await runChecks(root, { approach: `alternative ${i + 1}` });
  const question = openQuestions(root)[0]!;
  expect(question.question).toContain('exit=2'); expect(question.question).toContain('TS2503');
  expect(question.question).toContain('alternative 3'); expect(question.question).toContain('Cannot find namespace');
  const shared = [question.question, view.next, stopped, fs.readFileSync(path.join(root, '.vibe/evidence/r-2.json'), 'utf8')].join('\n');
  for (const secret of [root, 'top-secret', 'user@example.com', '?key=secret', 'RAW-UNRELATED-CANARY']) expect(shared).not.toContain(secret);
  await expect(runChecks(root)).rejects.toThrow(/repair limit reached/);
  expect(readState(root).runs).toBe(5);
  answer(root, question.id, 'Try the exported sharp type instead of a namespace.');
  resolve(root, question.id);
  await runChecks(root, { approach: 'use the provided type information' });
  expect(readState(root).failStreak).toBe(1);
});
it('cosmetic output changes and approach labels do not erase a failure or invent an approach', async () => {
  fixture(); await runChecks(root);
  const first = readState(root).lastFailHash;
  fs.appendFileSync(path.join(root, 'emit.cjs'), "console.error('additional timestamp 2099-01-01');");
  await runChecks(root, { approach: 'inspect a different import' });
  expect(readState(root)).toMatchObject({ lastFailHash: first, failStreak: 2 });
  expect(readState(root).repair?.attempts[0]?.approach).toBe('not recorded');
});
it('a changed cause clears the repair streak and contract weakening is still refused', async () => {
  fixture(); await runChecks(root); await runChecks(root);
  fs.writeFileSync(path.join(root, 'emit.cjs'), "console.error('Error: function ag_catalog.create_vlabel(unknown, name) does not exist');process.exitCode=1;");
  const changed = await runChecks(root);
  expect(changed.stuck).toBe(false); expect(readState(root).failStreak).toBe(1);
  expect(changed.outcomes[0]?.failure?.message).toContain('function ag_catalog.create_vlabel(unknown, name) does not exist');
  fs.writeFileSync(path.join(root, '.vibe/scenarios.yaml'), '- { id: gates, then: checked, check: { type: run, cmd: "exit 0" } }');
  await expect(runChecks(root)).rejects.toThrow(/approval void/);
});
it('outside-authority actions ask immediately without running the action', async () => {
  draft(root, '# approval', '- { id: deploy, then: deployed, irreversible: deploy, check: { type: run, cmd: "exit 0" } }'); approve(root, null);
  const report = await runChecks(root);
  expect(report.outcomes[0]?.status).toBe('blocked');
  expect(openQuestions(root)[0]?.question).toContain('authorization-required');
  expect(openQuestions(root)[0]?.question).toContain('exit=none');
  expect(readState(root).failStreak).toBe(0);
});
it('human-only contracts keep the explicit verdict while Stop cannot certify completion', async () => {
  draft(root, '# human judgment', '- { id: taste, then: human judgment, check: { type: human, question: "Which wording?" } }'); approve(root, null);
  const report = await runChecks(root);
  expect(report.done).toBe(true); expect(report.pending).toBe(1);
});
