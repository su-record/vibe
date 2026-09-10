#!/usr/bin/env node
// A prepared `on` workspace must hold nothing from key/: not the reference answer, not the expected
// output, not the fake user. This applies bench/run.js's copy rule to every task into a temp dir and
// looks — the 4.1.22 bench copied judge/ (then holding right.cjs and expected.json) into the on arm,
// and the transcripts showed the agent reading it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const tasksDir = path.join(root, 'bench/tasks');
const FORBIDDEN = /^(right|wrong|expected|answer|quote|ledger|report)\.(cjs|json)$/;
const problems = [];

for (const task of fs.readdirSync(tasksDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
  const taskDir = path.join(tasksDir, task);
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), `vibe4-nokey-${task}-`));
  // run.js prepare: everything but judge/ and key/; then draftAndApprove copies judge/ — the intent and scenarios
  for (const f of fs.readdirSync(taskDir)) if (f !== 'judge' && f !== 'key') fs.cpSync(path.join(taskDir, f), path.join(ws, f), { recursive: true });
  fs.cpSync(path.join(taskDir, 'judge'), path.join(ws, 'judge'), { recursive: true });
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' || e.name === '.git' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]));
  for (const file of walk(ws)) {
    const rel = path.relative(ws, file);
    if (rel.startsWith('key/')) problems.push(`${task}: ${rel} reached the workspace`);
    if (FORBIDDEN.test(path.basename(file)) && !rel.startsWith('checks/') && rel !== 'report.cjs') problems.push(`${task}: ${rel} looks like a key file in the workspace`);
  }
  fs.rmSync(ws, { recursive: true, force: true });
}
if (problems.length) {
  console.error(`the on arm can read the key:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('bench-no-key: no task lets a key file into a prepared workspace');
