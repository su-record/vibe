#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentEnvironment, approveContract, gradingWorkspace, prepareWorkspace, vibeSync } from '../bench/workspace.js';
import { agentEvidence, freezeScope, treeManifest } from '../bench/snapshot.js';
import { gradeWorkspace } from '../bench/grading.js';
import { answerQuestions } from '../bench/dialogue.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const cleanup = [];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-public-check-'));
cleanup.push(temporary);
const env = agentEnvironment({ ...process.env, HOME: temporary, USERPROFILE: temporary,
  VIBE_HOME_DIR: temporary, VIBE_SKIP_SETUP: '1', VIBE_KEY_EXPECTED: 'private-env-sentinel', VIBE_JUDGE_SECRET: 'private-env-sentinel' });
const context = { repo, env };

function referenceOutput(ws, taskDir, task) {
  const scratch = gradingWorkspace(ws, taskDir);
  try {
    execFileSync(process.execPath, [path.join(scratch.workspace, 'key/right.cjs')], { cwd: scratch.workspace, env });
    for (const name of task === 'ask' ? ['quote.cjs', 'quote.txt'] : ['out']) {
      fs.cpSync(path.join(scratch.workspace, name), path.join(ws, name), { recursive: true });
    }
  } finally {
    fs.rmSync(scratch.root, { recursive: true, force: true });
  }
}

function taskCopy(task) {
  const taskDir = path.join(temporary, task);
  fs.cpSync(path.join(repo, 'bench/tasks', task), taskDir, { recursive: true });
  fs.writeFileSync(path.join(taskDir, 'key/private-sentinel.txt'), 'private-file-sentinel');
  return taskDir;
}

function assertPrivateAbsent(ws) {
  for (const name of ['judge', 'key', 'public']) assert.equal(fs.existsSync(path.join(ws, name)), false, `${name} reached agent workspace`);
  for (const name of Object.keys(treeManifest(ws))) {
    assert.ok(!fs.readFileSync(path.join(ws, name), 'utf8').includes('private-file-sentinel'), `private sentinel in ${name}`);
  }
  assert.equal(env.VIBE_KEY_EXPECTED, undefined);
  assert.equal(env.VIBE_JUDGE_SECRET, undefined);
}

function validateTask(task, harness) {
  const taskDir = path.join(temporary, task);
  const ws = prepareWorkspace(taskDir, { ...context, harness, clients: ['claude', 'codex'] });
  cleanup.push(ws);
  assertPrivateAbsent(ws);
  if (harness !== 'on') assert.equal(fs.existsSync(path.join(ws, '.vibe/intent.md')) && fs.readFileSync(path.join(ws, '.vibe/intent.md'), 'utf8').trim().length > 0, false);
  if (task === 'ask') answerQuestions(ws, path.join(taskDir, 'key/answer.cjs'), 'Please confirm the customer currency and discount.');
  if (harness !== 'on') approveContract(ws, path.join(taskDir, 'public'), context);
  const snapshot = freezeScope(ws);
  cleanup.push(snapshot.path);
  referenceOutput(ws, taskDir, task);
  const publicResult = vibeSync(ws, ['check', '--all'], context);
  assert.equal(publicResult.status, 0, `${task}/${harness} public checks: ${publicResult.stderr || publicResult.stdout}`);
  assertPrivateAbsent(ws);
  const before = treeManifest(ws);
  const verification = agentEvidence(ws).verification;
  const run = { harness, client: 'fixture', model: 'fixture', turns: 0, costUsd: 0 };
  const good = gradeWorkspace(ws, taskDir, context, run);
  assert.equal(good.check.failed, 0, `${task}/${harness} private good fixture failed`);
  assert.deepEqual(treeManifest(ws), before, 'private grading changed agent evidence');
  assert.deepEqual(agentEvidence(ws).verification, verification);
  assert.deepEqual(treeManifest(path.join(snapshot.path, 'files')), snapshot.manifest, 'frozen scope changed');
  fs.writeFileSync(path.join(ws, task === 'ask' ? 'quote.txt' : 'out/summary.json'), task === 'ask' ? 'TOTAL: 0\n' : '{}');
  const broken = vibeSync(ws, ['check', '--all'], context);
  assert.equal(broken.status, 1, `${task}/${harness} public check accepted broken output`);
  assert.ok(!/VIBE_KEY_EXPECTED|judge-time only/.test(broken.stdout), 'public failure depends on judge infrastructure');
  assert.ok(gradeWorkspace(ws, taskDir, context, run).check.failed > 0, 'private judge accepted broken output');
}

try {
  for (const task of ['anomaly', 'ask']) taskCopy(task);
  for (const task of ['anomaly', 'ask']) for (const harness of ['off', 'on', 'scoped']) validateTask(task, harness);
  for (const script of ['bench-judge.js', 'bench-no-key.js']) execFileSync(process.execPath, [path.join(repo, 'checks', script)], { cwd: repo, env, stdio: 'inherit', timeout: 240000 });
  console.log('bench-public: six real preparations, runnable public checks, private-only grading, immutable agent scopes');
} finally {
  for (const directory of cleanup.reverse()) fs.rmSync(directory, { recursive: true, force: true });
}
