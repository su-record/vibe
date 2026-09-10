import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { approve, draft } from './intent.js';
import { runChecks } from './check.js';
import { handoffScenario, reopenScenario, readHandoffs } from './handoff.js';
import { readLedger } from './ledger.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-handoff-'));
  draft(root, '# handoff', '- { id: input, then: available, check: { type: file, path: input.txt, exists: true } }\n- { id: child, needs: [input], then: built, check: { type: run, cmd: "echo ran > marker" } }\n- { id: peer, then: done, check: { type: run, cmd: "exit 0" } }');
  approve(root, null);
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
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
