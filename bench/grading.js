import fs from 'node:fs';
import path from 'node:path';
import { approveContract, gradingWorkspace, vibeSync } from './workspace.js';

export function gradeWorkspace(ws, taskDir, context, run) {
  const scratch = gradingWorkspace(ws, taskDir);
  const env = { ...context.env, HOME: scratch.home, USERPROFILE: scratch.home,
    CODEX_HOME: path.join(scratch.home, '.codex'), VIBE_HOME_DIR: scratch.home };
  delete env.VIBE_BENCH_SNAPSHOTS;
  const grading = { ...context, env };
  try {
    approveContract(scratch.workspace, path.join(taskDir, 'judge'), grading);
    const key = path.join(taskDir, 'key/expected.json');
    const keyEnv = fs.existsSync(key) ? { VIBE_KEY_EXPECTED: fs.readFileSync(key, 'utf8') } : {};
    const out = vibeSync(scratch.workspace, ['check', '--all'], grading, { env: {
      VIBE_HARNESS: run.harness, VIBE_CLIENT: run.client, VIBE_MODEL: run.model ?? '',
      VIBE_TURNS: String(run.turns ?? ''), VIBE_COST_USD: String(run.costUsd ?? ''), ...keyEnv,
    } });
    if (out.error) throw out.error;
    if (![0, 1].includes(out.status)) throw new Error(`private judge exited ${out.status}: ${out.stderr || out.stdout}`);
    const report = JSON.parse(out.stdout);
    const events = fs.readFileSync(path.join(scratch.workspace, '.vibe/ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const check = events.filter((event) => event.event === 'check').at(-1);
    if (!check) throw new Error(`private judge for ${taskDir} wrote no check event`);
    return { report, check };
  } finally {
    fs.rmSync(scratch.root, { recursive: true, force: true });
  }
}
