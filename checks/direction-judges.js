#!/usr/bin/env node
// Proves each direction task's judge actually tells a wrong answer from a right one, deterministically,
// with no model in the loop. For every task: copy the fixture (minus judge/) to a fresh temp dir, draft
// and approve the task's own judge/intent.md + judge/scenarios.yaml, apply key/wrong.cjs and run
// `check --all` — at least one scenario must fail — then repeat from a clean copy with key/right.cjs,
// where every scenario must pass.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const cli = path.join(root, 'dist/cli.js');
const ALL_TASKS = ['anomaly', 'handover', 'session-split', 'ask', 'irreversible-trap', 'brownfield', 'hidden-requirement', 'regression-trap', 'long-context', 'ambiguous-brief'];
const DIRECTION_TASKS = process.argv.length > 2 ? process.argv.slice(2) : ALL_TASKS;
const env = { ...process.env, VIBE_SKIP_SETUP: '1' };

function vibe(cwd, args) {
  const r = spawnSync('node', [cli, ...args, '--json'], { cwd, encoding: 'utf-8', env });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function mustOk(cwd, args) {
  const r = vibe(cwd, args);
  if (r.code !== 0) throw new Error(`vibe ${args.join(' ')} in ${cwd} exited ${r.code}\n${r.stdout}\n${r.stderr}`);
  return r;
}

/** A fresh copy of the task fixture, judge included, with the judge's own intent drafted and approved. */
function prepare(task) {
  const taskDir = path.join(root, 'bench/tasks', task);
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), `vibe4-direction-${task}-`));
  for (const f of fs.readdirSync(taskDir)) fs.cpSync(path.join(taskDir, f), path.join(ws, f), { recursive: true });
  const prep = path.join(ws, 'judge', 'prepare.cjs');
  if (fs.existsSync(prep)) {
    const r = spawnSync('node', [prep], { cwd: ws, env: { ...env, VIBE_BENCH_REPO: root }, encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`judge/prepare.cjs for ${task} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  }
  mustOk(ws, ['tokens', 'off']);
  mustOk(ws, ['intent', 'draft', 'judge/intent.md', 'judge/scenarios.yaml']);
  mustOk(ws, ['approve']);
  return ws;
}

function applyAnswer(ws, script) {
  const r = spawnSync('node', [path.join('key', script)], { cwd: ws, env });
  if (r.status !== 0) throw new Error(`judge/${script} in ${ws} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
}

function checkAll(ws) {
  const keyFile = path.join(ws, 'key', 'expected.json');
  const keyEnv = fs.existsSync(keyFile) ? { VIBE_KEY_EXPECTED: fs.readFileSync(keyFile, 'utf-8') } : {};
  const r = spawnSync('node', [cli, 'check', '--all', '--json'], { cwd: ws, encoding: 'utf-8', env: { ...env, ...keyEnv } });
  return JSON.parse(r.stdout);
}

function judgeSeparates(task) {
  const wrongWs = prepare(task);
  applyAnswer(wrongWs, 'wrong.cjs');
  const wrongReport = checkAll(wrongWs);
  const rightWs = prepare(task);
  applyAnswer(rightWs, 'right.cjs');
  const rightReport = checkAll(rightWs);

  const problems = [];
  if (wrongReport.failed === 0) problems.push(`${task}: the wrong answer passed every scenario — the judge does not tell it from the right one`);
  if (rightReport.failed > 0) {
    const failing = rightReport.outcomes.filter((o) => o.status === 'fail').map((o) => o.id).join(', ');
    problems.push(`${task}: the right answer failed ${failing}`);
  }
  return problems;
}

const problems = DIRECTION_TASKS.flatMap(judgeSeparates);
if (problems.length > 0) {
  console.error(`direction judges not checkable:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`direction judges: ${DIRECTION_TASKS.length} tasks (${DIRECTION_TASKS.join(', ')}) · wrong answer fails, right answer passes, for every one`);
