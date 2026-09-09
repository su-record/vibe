#!/usr/bin/env node
// The suite under the load `vibe check --all` applies: two vitest runs side by side, three rounds.
// A test that fails here and passes alone is flaky — it is named, and the exit code says so.
import { spawn } from 'node:child_process';

const ROUNDS = Number(process.env.VIBE_LOAD_ROUNDS || 3);
const failed = new Map();

function run() {
  return new Promise((resolve) => {
    const child = spawn('npx', ['vitest', 'run'], { encoding: 'utf-8' });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

for (let round = 1; round <= ROUNDS; round += 1) {
  const [a, b] = await Promise.all([run(), run()]);
  for (const r of [a, b]) {
    if (r.code === 0) continue;
    for (const line of r.out.split('\n')) if (/^\s*(×|✗|FAIL)\s/.test(line)) failed.set(line.trim(), (failed.get(line.trim()) ?? 0) + 1);
  }
  process.stdout.write(`round ${round}/${ROUNDS}: ${a.code === 0 && b.code === 0 ? 'both passed' : `exit ${a.code}/${b.code}`}\n`);
}
if (failed.size > 0) {
  process.stdout.write(`flaky under load:\n${[...failed].map(([l, n]) => `  ${n}× ${l}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`suite under load: ${ROUNDS} rounds × 2 parallel runs, nothing failed\n`);
