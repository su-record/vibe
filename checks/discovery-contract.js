#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-discovery-contract-'));
const home = path.join(root, 'home');
fs.mkdirSync(home);
const env = { ...process.env, HOME: home, USERPROFILE: home, VIBE_HOME_DIR: home,
  CODEX_HOME: path.join(home, '.codex'), VIBE_SKIP_SETUP: '1', VIBE_CLIENT: 'fixture' };

function command(cwd, args, input) {
  const result = spawnSync(process.execPath, [cli, ...args, '--json'], {
    cwd, env, input: input === undefined ? undefined : JSON.stringify(input), encoding: 'utf8', timeout: 30000,
  });
  if (result.error) throw result.error;
  return { code: result.status, value: JSON.parse(result.stdout), detail: result.stderr || result.stdout };
}

function project(name) {
  const directory = path.join(root, name);
  fs.mkdirSync(path.join(directory, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'docs/rules.md'), 'The report is internal; retain source IDs.\n');
  fs.writeFileSync(path.join(directory, 'report.txt'), 'internal report with source IDs\n');
  return directory;
}

function draft(cwd, sources = ['docs/rules.md']) {
  const result = command(cwd, ['intent', 'draft', '--stdin'], {
    intent: '# Internal report\n\n## Why\nUse the documented reporting rule.\n\n## What counts as success\n- report.txt keeps source IDs for an internal reader.\n',
    scenarios: '- id: report\n  then: report.txt retains source IDs\n  check: {type: file, path: report.txt, contains: source IDs}\n', sources,
  });
  assert.equal(result.code, 0, result.detail);
  return result.value;
}

function clearRequest() {
  const cwd = project('clear');
  const first = draft(cwd);
  assert.equal(command(cwd, ['approve']).code, 0, 'a fully specified request should need no interview');
  assert.equal(command(cwd, ['inbox']).value.length, 0);
  const a = command(cwd, ['intent', 'show']).value.sourceBasis;
  const b = command(cwd, ['intent', 'show']).value.sourceBasis;
  assert.equal(a.valid, true);
  assert.deepEqual(a, b, 'unchanged source evidence should be reusable');
  assert.equal(draft(cwd).hash, first.hash, 'the same source bytes must not manufacture a new agreement');
  const ledger = fs.readFileSync(path.join(cwd, '.vibe/ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  assert.equal(ledger.some((event) => event.event === 'authorize'), false, 'scope agreement must not authorize an external action');
}

function unansweredDecision() {
  const cwd = project('question');
  draft(cwd);
  const asked = command(cwd, ['ask', 'Who is the report audience?', '--default', 'internal']);
  assert.equal(asked.code, 0);
  const pending = command(cwd, ['approve']);
  assert.notEqual(pending.code, 0, 'an unanswered default became customer agreement');
  assert.equal(command(cwd, ['state']).value.state, 'DRAFT');
  assert.equal(command(cwd, ['inbox']).value[0].answer, null);
  assert.equal(command(cwd, ['inbox', 'answer', asked.value.id, 'The report is internal.']).code, 0);
  const resumed = command(cwd, ['state']).value;
  assert.equal(resumed.stage, 'scope');
  assert.ok(!resumed.next.includes('continue building'), 'an unapproved scope was sent to building');
  assert.equal(command(cwd, ['approve']).code, 0);
  const building = command(cwd, ['state']).value;
  assert.ok(building.next.includes('report') && building.next.includes('report.txt'), 'resumption lost the remaining scenario and file');
  assert.equal(command(cwd, ['ask', 'The report is finished.']).code, 2, 'a completion report became a question');
}

function changedEvidence() {
  const cwd = project('changed');
  const original = draft(cwd).hash;
  fs.writeFileSync(path.join(cwd, 'docs/rules.md'), 'The internal report must retain source IDs and dates.\n');
  const rejected = command(cwd, ['approve']);
  assert.notEqual(rejected.code, 0);
  assert.ok(rejected.detail.includes('docs/rules.md'), 'changed evidence was not named');
  assert.equal(command(cwd, ['intent', 'show']).value.sourceBasis.valid, false);
  assert.notEqual(draft(cwd).hash, original);
  assert.equal(command(cwd, ['approve']).code, 0);
  fs.rmSync(path.join(cwd, 'docs/rules.md'));
  const view = command(cwd, ['intent', 'show']).value.sourceBasis;
  assert.equal(view.valid, false);
  assert.ok(view.missing.includes('docs/rules.md'));
  assert.notEqual(command(cwd, ['check', '--all']).code, 0, 'missing evidence did not invalidate verification');
}

try {
  clearRequest();
  unansweredDecision();
  changedEvidence();
  console.log('discovery-contract: no required interview, no silent default, source-bound approval, correct resumption; agent adherence remains a cohort measurement');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
