import { afterEach, beforeEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agentEvidence, freezeScope, treeManifest } from './snapshot.js';
import { agentEnvironment } from './workspace.js';

let ws;
const snapshots = [];
beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-scope-test-'));
  fs.mkdirSync(path.join(ws, '.vibe'));
  fs.mkdirSync(path.join(ws, 'checks'));
  fs.writeFileSync(path.join(ws, '.vibe/intent.md'), '# A source-backed report\n');
  fs.writeFileSync(path.join(ws, '.vibe/scenarios.yaml'), '- id: report\n  then: the report follows the evidence\n  check:\n    type: run\n    cmd: node checks/report.cjs\n');
  fs.writeFileSync(path.join(ws, 'checks/report.cjs'), 'process.exit(1);\n');
});
afterEach(() => {
  for (const directory of [ws, ...snapshots.splice(0)]) fs.rmSync(directory, { recursive: true, force: true });
});

it('preserves the approved check bytes after implementation replaces a check', () => {
  const snapshot = freezeScope(ws);
  snapshots.push(snapshot.path);
  fs.writeFileSync(path.join(ws, 'checks/report.cjs'), 'process.exit(0);\n');
  fs.writeFileSync(path.join(ws, 'report.md'), 'A later artifact.\n');
  expect(fs.readFileSync(path.join(snapshot.path, 'files/checks/report.cjs'), 'utf8')).toBe('process.exit(1);\n');
  expect(fs.existsSync(path.join(snapshot.path, 'files/report.md'))).toBe(false);
  expect(treeManifest(path.join(snapshot.path, 'files'))).toEqual(snapshot.manifest);
  expect(treeManifest(ws)).not.toEqual(snapshot.manifest);
});

it('does not substitute approval or scenario count for an agent verification result', () => {
  fs.writeFileSync(path.join(ws, '.vibe/state.json'), JSON.stringify({ state: 'APPROVED', approvedAt: '2026-09-10T00:00:00Z' }));
  const evidence = agentEvidence(ws);
  expect(evidence.scoped).toEqual({ scenarios: 1, checks: ['run'], approved: true });
  expect(evidence.verification.passed).toBeNull();
  expect(evidence.verification.failed).toBeNull();
  fs.writeFileSync(path.join(ws, '.vibe/ledger.jsonl'), '{broken}\n');
  expect(() => agentEvidence(ws)).toThrow();
});

it('removes private grading environment values without losing ordinary client settings', () => {
  expect(agentEnvironment({ VIBE_KEY_EXPECTED: 'secret', VIBE_JUDGE_SENTINEL: 'secret', HOME: 'fixture', VIBE_SKIP_SETUP: '1' }))
    .toEqual({ HOME: 'fixture', VIBE_SKIP_SETUP: '1' });
});
