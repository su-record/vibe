import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { approve, draft } from './intent.js';
import { readResults, runChecks } from './check.js';
import { handoffScenario, reopenScenario, readHandoffs } from './handoff.js';
import { readLedger } from './ledger.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-handoff-'));
  draft(root, '# handoff', '- { id: input, then: available, check: { type: file, path: input.txt, exists: true } }\n- { id: child, needs: [input], then: built, check: { type: run, cmd: "echo ran > marker" } }\n- { id: peer, then: done, check: { type: run, cmd: "exit 0" } }');
  approve(root, null);
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
it('handoff preserves requirements, blocks dependents, and permits independent work', async () => {
  const contract = fs.readFileSync(path.join(root, '.vibe/scenarios.yaml'));
  await runChecks(root);
  handoffScenario(root, 'input', { reason: 'Customer export unavailable', category: 'unavailable-input', nextAction: 'Obtain the export' });
  const report = await runChecks(root, { all: true });
  expect(report.done).toBe(false);
  expect(report.outcomes.map((r) => [r.id, r.status])).toEqual([['input', 'handoff'], ['child', 'blocked'], ['peer', 'pass']]);
  expect(fs.existsSync(path.join(root, 'marker'))).toBe(false);
  expect(fs.readFileSync(path.join(root, '.vibe/scenarios.yaml'))).toEqual(contract);
  expect(readHandoffs(root).input).toMatchObject({ owner: 'unknown', evidence: 'r-1#input' });
  expect(report.remaining).toEqual(['input', 'child']);
});
it('invalid handoff changes nothing; explicit reopen retains history and retries original checks', async () => {
  const before = readLedger(root);
  expect(() => handoffScenario(root, 'absent', { reason: 'x', category: 'environment', nextAction: 'fix' })).toThrow(/unknown scenario/);
  expect(() => handoffScenario(root, 'input', { reason: ' ', category: 'environment', nextAction: 'fix' })).toThrow(/reason/);
  expect(readLedger(root)).toEqual(before);
  handoffScenario(root, 'input', { reason: 'Blocked', category: 'environment', nextAction: 'Repair' });
  fs.writeFileSync(path.join(root, 'input.txt'), 'export');
  reopenScenario(root, 'input', 'Export supplied');
  expect(readHandoffs(root).input).toBeUndefined();
  expect(readLedger(root).filter((e) => ['handoff', 'reopen'].includes(e.event)).map((e) => e.event)).toEqual(['handoff', 'reopen']);
  expect((await runChecks(root, { all: true })).done).toBe(true);
});

it('handing off a passed parent blocks cached dependent passes without rewriting old results', async () => {
  fs.writeFileSync(path.join(root, 'input.txt'), 'export');
  expect((await runChecks(root, { all: true })).done).toBe(true);
  const file = path.join(root, '.vibe/results.json');
  const before = fs.readFileSync(file);
  handoffScenario(root, 'input', { reason: 'Input ownership transferred', category: 'outside-authority', nextAction: 'Confirm the new owner' });
  expect(readResults(root)).toMatchObject({ input: { last: 'handoff' }, child: { last: 'blocked' }, peer: { last: 'pass' } });
  expect(fs.readFileSync(file)).toEqual(before);
  const checked = await runChecks(root);
  expect(checked.done).toBe(false);
  expect(checked.outcomes.map((result) => [result.id, result.status])).toEqual([['input', 'handoff'], ['child', 'blocked']]);
  expect(checked.remaining).toEqual(['input', 'child']);
});

it('reopening without an intervening check requires fresh parent and dependent proof, even at the same timestamp', async () => {
  vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-09-10T12:00:00.000Z');
  fs.writeFileSync(path.join(root, 'input.txt'), 'export');
  const original = await runChecks(root, { all: true });
  expect(original.done).toBe(true);
  const evidence = path.join(root, '.vibe/evidence', `${original.run}.json`);
  const before = fs.readFileSync(evidence);
  handoffScenario(root, 'input', { reason: 'Input needs renewed agreement', category: 'unavailable-input', nextAction: 'Confirm the export' });
  reopenScenario(root, 'input', 'Export confirmed');
  expect(readResults(root)).toMatchObject({ input: { last: 'pending' }, child: { last: 'pending' }, peer: { last: 'pass' } });
  const checked = await runChecks(root);
  expect(checked.done).toBe(true);
  expect(checked.outcomes.map((result) => result.id)).toEqual(['input', 'child']);
  expect(readResults(root)).toMatchObject({ input: { last: 'pass', run: checked.run }, child: { last: 'pass', run: checked.run } });
  expect(fs.readFileSync(evidence)).toEqual(before);
});

it('handoff and reopen invalidate every dependent in a chain but leave independent proof usable', async () => {
  draft(root, '# dependency chain', '- { id: parent, then: checked, check: { type: run, cmd: "exit 0" } }\n- { id: child, needs: [parent], then: checked, check: { type: run, cmd: "exit 0" } }\n- { id: grandchild, needs: [child], then: checked, check: { type: run, cmd: "exit 0" } }\n- { id: peer, then: checked, check: { type: run, cmd: "exit 0" } }');
  approve(root, null);
  await runChecks(root, { all: true });
  handoffScenario(root, 'parent', { reason: 'Environment unavailable', category: 'environment', nextAction: 'Restore it' });
  expect(readResults(root)).toMatchObject({ parent: { last: 'handoff' }, child: { last: 'blocked' }, grandchild: { last: 'blocked' }, peer: { last: 'pass' } });
  reopenScenario(root, 'parent', 'Environment restored');
  expect(readResults(root)).toMatchObject({ parent: { last: 'pending' }, child: { last: 'pending' }, grandchild: { last: 'pending' }, peer: { last: 'pass' } });
});
