#!/usr/bin/env node
// Exercise the runner's preparation path in every arm; a second copy rule can miss a runner leak.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentEnvironment, prepareWorkspace } from '../bench/workspace.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const tasksDir = path.join(root, 'bench/tasks');
const problems = [];

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink() || ['node_modules', '.git'].includes(entry.name)) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

function digest(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function inspectWorkspace(task, harness, ws, keyHashes) {
  for (const name of ['judge', 'key', 'public']) if (fs.existsSync(path.join(ws, name))) problems.push(`${task}/${harness}: ${name}/ reached the workspace`);
  if (!fs.existsSync(path.join(ws, 'checks/README.md'))) problems.push(`${task}/${harness}: public check instructions are absent`);
  for (const file of files(ws)) {
    const rel = path.relative(ws, file);
    if (keyHashes.has(digest(file))) problems.push(`${task}/${harness}: private key content reached ${rel}`);
  }
}

function inspectTask(task) {
  const taskDir = path.join(tasksDir, task);
  const keyHashes = new Set(files(path.join(taskDir, 'key')).map(digest));
  for (const harness of ['off', 'on', 'scoped']) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `vibe-nokey-home-${task}-`));
    const env = agentEnvironment({ ...process.env, HOME: home, USERPROFILE: home, VIBE_SKIP_SETUP: '1', VIBE_KEY_SENTINEL: 'private-key-sentinel', VIBE_JUDGE_SENTINEL: 'private-judge-sentinel' });
    let ws;
    try {
      if (Object.keys(env).some((name) => /^VIBE_(KEY|JUDGE)_/i.test(name))) problems.push(`${task}/${harness}: private environment remains`);
      ws = prepareWorkspace(taskDir, { repo: root, env, harness, clients: ['claude', 'codex'] });
      inspectWorkspace(task, harness, ws, keyHashes);
    } finally {
      if (ws) fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
}

const tasks = fs.readdirSync(tasksDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
for (const task of tasks) inspectTask(task);
if (problems.length) {
  console.error(`agent preparation leaks private grading:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`bench-no-key: ${tasks.length} tasks × 3 arms; private bundles and key content absent, public checks available`);
