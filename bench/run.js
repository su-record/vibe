#!/usr/bin/env node
// Bench — the same task, the same judge, different arms. Each run: fresh workspace from the task,
// the agent works headless (claude -p or codex exec), then vibe 4 judges with the task's scenarios
// and one `check` line lands in bench/ledger.jsonl carrying client, model, harness, turns, cost.
// Read it with: vibe ledger compare --by harness --metric checks --ledger bench/ledger.jsonl
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installSurfaces, projectLayout } from '../dist/install/global.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const client = opt('client', 'claude');
const harness = opt('harness', 'on');
const runs = Number(opt('runs', '1'));
const task = opt('task', 'settlement');
const model = opt('model', null);
const maxTurns = Number(opt('max-turns', '40'));
const ledger = path.join(here, 'ledger.jsonl');
const taskDir = path.join(here, 'tasks', task);

// vibe on PATH must be vibe 4 from this checkout, never a global vibe 3
const shim = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-shim-'));
fs.writeFileSync(path.join(shim, 'vibe'), `#!/bin/sh\nexec node "${repo}/dist/cli.js" "$@"\n`, { mode: 0o755 });
// the arms differ by what the workspace carries, so the operator's ~/.claude must not be touched or repaired mid-run
const env = { ...process.env, PATH: `${shim}:${process.env.PATH}`, VIBE_SKIP_SETUP: '1' };
delete env.CLAUDECODE;
delete env.CLAUDE_CODE_ENTRYPOINT;
delete env.CLAUDE_PROJECT_DIR;

function prepare() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), `vibe4-bench-${client}-${harness}-`));
  for (const f of fs.readdirSync(taskDir)) if (f !== 'judge') fs.cpSync(path.join(taskDir, f), path.join(ws, f), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: ws });
  if (harness === 'on') {
    // card, skills and hook go into the workspace itself — the `off` arm must stay bare
    installSurfaces(ws, projectLayout(client === 'claude' ? 'claude' : 'codex'));
    judge(ws, false); // the agent sees the approved intent and can run `vibe check` itself
  }
  return ws;
}

function judge(ws, run) {
  fs.rmSync(path.join(ws, '.vibe', 'results.json'), { force: true });
  fs.cpSync(path.join(taskDir, 'judge'), path.join(ws, 'judge'), { recursive: true });
  if (!fs.existsSync(path.join(ws, '.vibe'))) fs.mkdirSync(path.join(ws, '.vibe'));
  const stdin = JSON.stringify({ intent: fs.readFileSync(path.join(taskDir, 'judge', 'intent.md'), 'utf-8'), scenarios: fs.readFileSync(path.join(taskDir, 'judge', 'scenarios.yaml'), 'utf-8') });
  const vibe = (a, extra = {}) => spawnSync('node', [path.join(repo, 'dist/cli.js'), ...a, '--json'], { cwd: ws, encoding: 'utf-8', input: extra.input, env: { ...env, ...extra.env } });
  vibe(['tokens', 'off']);
  vibe(['intent', 'draft', '--stdin'], { input: stdin });
  vibe(['approve']);
  if (!run) return null;
  const out = vibe(['check', '--all'], { env: { VIBE_HARNESS: harness, VIBE_CLIENT: run.client, VIBE_MODEL: run.model ?? '', VIBE_TURNS: run.turns ?? '', VIBE_COST_USD: run.costUsd ?? '' } });
  const report = JSON.parse(out.stdout);
  const lines = fs.readFileSync(path.join(ws, '.vibe', 'ledger.jsonl'), 'utf-8').trim().split('\n');
  const check = lines.map((l) => JSON.parse(l)).reverse().find((e) => e.event === 'check');
  fs.appendFileSync(ledger, `${JSON.stringify({ ...check, task, workspace: ws, agentMs: run.ms })}\n`);
  return report;
}

function runClaude(ws) {
  const prompt = fs.readFileSync(path.join(ws, 'TASK.md'), 'utf-8');
  const a = ['-p', prompt, '--output-format', 'json', '--dangerously-skip-permissions', '--max-turns', String(maxTurns)];
  if (model) a.push('--model', model);
  const started = Date.now();
  const r = spawnSync('claude', a, { cwd: ws, encoding: 'utf-8', env, timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  let out = {};
  try {
    out = JSON.parse(r.stdout);
  } catch {
    /* no JSON — the run failed; the judge will say so */
  }
  const used = out.modelUsage ? Object.keys(out.modelUsage).sort((x, y) => (out.modelUsage[y].outputTokens ?? 0) - (out.modelUsage[x].outputTokens ?? 0))[0] : null;
  return { client: 'claude-code', model: used ?? model ?? null, turns: out.num_turns ?? null, costUsd: out.total_cost_usd ?? null, ms: Date.now() - started };
}

function runCodex(ws) {
  const prompt = fs.readFileSync(path.join(ws, 'TASK.md'), 'utf-8');
  const a = ['exec', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox', '--json', '-C', ws];
  if (model) a.push('-m', model);
  const started = Date.now();
  const r = spawnSync('codex', a, { cwd: ws, encoding: 'utf-8', env, input: prompt, timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  // codex exec is one turn; the comparable unit is completed items (commands, messages, patches)
  let turns = 0;
  for (const line of r.stdout.split('\n')) if (line.includes('"item.completed"')) turns += 1;
  let usedModel = model;
  if (!usedModel) {
    try {
      usedModel = /^model\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(os.homedir(), '.codex', 'config.toml'), 'utf-8'))?.[1] ?? null;
    } catch {
      usedModel = null;
    }
  }
  return { client: 'codex', model: usedModel, turns: turns || null, costUsd: null, ms: Date.now() - started };
}

for (let i = 0; i < runs; i += 1) {
  const ws = prepare();
  const run = client === 'claude' ? runClaude(ws) : runCodex(ws);
  const report = judge(ws, run);
  console.log(`${client} ${harness} run ${i + 1}/${runs}: passed ${report.passed} failed ${report.failed} · turns ${run.turns ?? '-'} · cost ${run.costUsd ?? '-'} · ${Math.round(run.ms / 1000)}s · ${ws}`);
}
