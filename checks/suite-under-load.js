#!/usr/bin/env node
// The suite under the load `vibe check --all` applies: two vitest runs side by side, three rounds.
// A test that fails here and passes alone is flaky — it is named, and the exit code says so.
import { spawn } from 'node:child_process';

const ROUNDS = Number(process.env.VIBE_LOAD_ROUNDS || 3);
const failed = new Map();
let failedRuns = 0;

function run() {
  return new Promise((resolve) => {
    // npm's Windows shim needs cmd.exe; the command and arguments are fixed.
    const child = process.platform === 'win32'
      ? spawn('npx.cmd vitest run', { shell: true })
      : spawn('npx', ['vitest', 'run']);
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (error) => resolve({ code: 1, out: `could not start npx: ${error.message}\n` }));
    child.on('close', (code) => resolve({ code, out }));
  });
}

for (let round = 1; round <= ROUNDS; round += 1) {
  const [a, b] = await Promise.all([run(), run()]);
  for (const r of [a, b]) {
    if (r.code === 0) continue;
    failedRuns += 1;
    process.stdout.write(r.out);
    for (const line of r.out.split('\n')) if (/^\s*(×|✗|FAIL)\s/.test(line)) failed.set(line.trim(), (failed.get(line.trim()) ?? 0) + 1);
  }
  process.stdout.write(`round ${round}/${ROUNDS}: ${a.code === 0 && b.code === 0 ? 'both passed' : `exit ${a.code}/${b.code}`}\n`);
}
if (failedRuns > 0) {
  process.stdout.write(`suite under load: ${failedRuns} child process(es) failed\n`);
  if (failed.size > 0) process.stdout.write(`flaky under load:\n${[...failed].map(([l, n]) => `  ${n}× ${l}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`suite under load: ${ROUNDS} rounds × 2 parallel runs, nothing failed\n`);
