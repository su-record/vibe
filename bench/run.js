#!/usr/bin/env node
// Bench — the same task, the same judge, different arms. Each run: fresh workspace from the task,
// the agent works headless (claude -p or codex exec), then vibe 4 judges with the task's scenarios
// and one `check` line lands in bench/ledger.jsonl carrying client, model, harness, turns, cost,
// tokens (`usage: missing` names a run whose client never reported them), a recomputed cost and the
// agent's wall-clock time; a task with `judge/meta.json` sessions runs the agent that many times on one
// workspace and sums.
// Read it with: vibe ledger compare --by harness --metric checks --ledger bench/ledger.jsonl
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installSurfaces, projectLayout, SKILL_NAMES } from '../dist/install/global.js';
import { answerQuestions, stalled } from './dialogue.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
// `--client claude:codex` names one client per session on a two-session task (a handover); `client` is the first
const clients = opt('client', 'claude').split(':');
const client = clients[0];
// `off` bare · `on` the judge's intent given · `scoped` vibe scopes for itself from the brief (card, skills, hooks, no intent)
const harness = opt('harness', 'on');
const prepareOnly = process.argv.includes('--prepare-only');
const runs = Number(opt('runs', '1'));
const taskArg = opt('task', 'settlement');
const setArg = opt('set', null);
const model = opt('model', null);
const maxTurns = Number(opt('max-turns', '40'));
const parallel = Math.max(1, Number(opt('parallel', '4')));
const ledger = path.resolve(opt('ledger', path.join(here, 'ledger.jsonl')));
const AGENT_TIMEOUT_MS = 15 * 60_000;
const MAX_CAPTURE = 64 * 1024 * 1024;

// vibe on PATH must be vibe 4 from this checkout, never a global vibe 3
const shim = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-shim-'));
fs.writeFileSync(path.join(shim, 'vibe'), `#!/bin/sh\nexec node "${repo}/dist/cli.js" "$@"\n`, { mode: 0o755 });
// The arms differ only by what the workspace carries. Both run under an isolated home: the operator's
// ~/.claude plugin and ~/.agents marketplace (vibe itself, on this machine) must not reach either arm —
// an `off` run that can call `vibe regress record` is not an `off` run. Credentials are copied in.
const isoHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-bench-home-'));
for (const [dir, files] of [['.claude', ['.credentials.json']], ['.codex', ['auth.json', 'config.toml']]]) {
  fs.mkdirSync(path.join(isoHome, dir), { recursive: true });
  for (const f of files) {
    const from = path.join(os.homedir(), dir, f);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(isoHome, dir, f));
  }
}
const env = { ...process.env, PATH: `${shim}:${process.env.PATH}`, VIBE_SKIP_SETUP: '1', HOME: isoHome, USERPROFILE: isoHome, CODEX_HOME: path.join(isoHome, '.codex'), VIBE_HOME_DIR: isoHome };
delete env.CLAUDECODE;
delete env.CLAUDE_CODE_ENTRYPOINT;
delete env.CLAUDE_PROJECT_DIR;

// Overhead measures saturated tasks; direction spans sessions and clients.
// Retired tasks remain runnable by name — bench/README.md holds their inventory and reasons.
// `--set` picks a named group; `--task` (still the default) picks one task, or every directory
// under tasks/ with `all`.
const SETS = { overhead: ['settlement', 'vibe-fix', 'report'], direction: ['handover', 'session-split'], context: ['brownfield'] };
SETS.all = [...SETS.overhead, ...SETS.direction, ...SETS.context];

function taskNames() {
  if (setArg) {
    if (!SETS[setArg]) throw new Error(`unknown --set ${setArg} (overhead|direction|context|all)`);
    return SETS[setArg];
  }
  if (taskArg !== 'all') return [taskArg];
  return fs.readdirSync(path.join(here, 'tasks'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

function prepare(task) {
  const taskDir = path.join(here, 'tasks', task);
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), `vibe4-bench-${client}-${harness}-`));
  // both arms get the same files: the task, and checks/ (what a check needs to run); judge/ and key/ never — see checks/bench-no-key.js
  for (const f of fs.readdirSync(taskDir)) if (f !== 'judge' && f !== 'key') fs.cpSync(path.join(taskDir, f), path.join(ws, f), { recursive: true });
  // a task may prepare its workspace itself (brownfield: this repository archived and built); the judge stays hidden
  const prep = path.join(taskDir, 'judge', 'prepare.cjs');
  if (fs.existsSync(prep)) execFileSync('node', [prep], { cwd: ws, env: { ...env, VIBE_BENCH_REPO: repo }, stdio: 'ignore' });
  execFileSync('git', ['init', '-q'], { cwd: ws });
  if (harness === 'on' || harness === 'scoped') {
    // card, skills and hook go into the workspace itself — the `off` arm must stay bare; a two-client task gets both layouts
    for (const c of new Set(clients)) {
      const layout = projectLayout(c === 'claude' ? 'claude' : 'codex');
      installSurfaces(ws, layout);
      // the six common skills only — a pack rides along only when the judge uses a review check (none does today)
      const skillsDir = path.join(ws, layout.skills);
      for (const d of fs.readdirSync(skillsDir)) if (!SKILL_NAMES.includes(d)) fs.rmSync(path.join(skillsDir, d), { recursive: true, force: true });
    }
    if (harness === 'on') draftAndApprove(ws, taskDir);
    // scoped: no intent — the agent runs discover and scope itself; `tokens off` lets it approve without a human
    if (harness === 'scoped') vibeSync(ws, ['tokens', 'off']);
    // the policy an install has by default: the hook blocks an irreversible command until `vibe authorize`
    if (harness === 'on') vibeSync(ws, ['tokens', 'irreversible']);
  }
  return ws;
}

/** A task's `judge/meta.json`: `sessions` lists one entry per agent session on the same workspace — `{ maxTurns }`
 * (claude) or `{ cutMs }` (codex, which has no turn cap) — so a task can be cut and resumed with no memory between. */
function meta(task) {
  try {
    return JSON.parse(fs.readFileSync(path.join(here, 'tasks', task, 'judge', 'meta.json'), 'utf-8'));
  } catch {
    return {};
  }
}

function vibeSync(ws, a, extra = {}) {
  return spawnSync('node', [path.join(repo, 'dist/cli.js'), ...a, '--json'], { cwd: ws, encoding: 'utf-8', input: extra.input, env: { ...env, ...extra.env } });
}

/** The intent the task's own judge defines, drafted and approved so `vibe check --all` can score it. */
function draftAndApprove(ws, taskDir) {
  fs.rmSync(path.join(ws, '.vibe', 'results.json'), { force: true });
  fs.cpSync(path.join(taskDir, 'judge'), path.join(ws, 'judge'), { recursive: true });
  if (!fs.existsSync(path.join(ws, '.vibe'))) fs.mkdirSync(path.join(ws, '.vibe'));
  const stdin = JSON.stringify({ intent: fs.readFileSync(path.join(taskDir, 'judge', 'intent.md'), 'utf-8'), scenarios: fs.readFileSync(path.join(taskDir, 'judge', 'scenarios.yaml'), 'utf-8') });
  vibeSync(ws, ['tokens', 'off']);
  vibeSync(ws, ['intent', 'draft', '--stdin'], { input: stdin });
  vibeSync(ws, ['approve']);
}

/** After the agent stops: judge with the task's real scenarios and append one ledger line. */
function stateOf(ws) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ws, '.vibe', 'state.json'), 'utf-8')).state;
  } catch {
    return 'NONE';
  }
}

/** What a scoped agent wrote for itself — scenario count and check types — read before the judge's intent replaces it. */
function scopedWork(ws) {
  try {
    const text = fs.readFileSync(path.join(ws, '.vibe', 'scenarios.yaml'), 'utf-8');
    const checks = [...text.matchAll(/type:\s*(\w+)/g)].map((m) => m[1]);
    const approved = fs.existsSync(path.join(ws, '.vibe', 'state.json')) && JSON.parse(fs.readFileSync(path.join(ws, '.vibe', 'state.json'), 'utf-8')).approvedAt !== null;
    return { scenarios: checks.length, checks: [...new Set(checks)], approved };
  } catch {
    return { scenarios: 0, checks: [], approved: false };
  }
}

function judge(ws, run, task, index) {
  const taskDir = path.join(here, 'tasks', task);
  const scoped = harness === 'scoped' ? scopedWork(ws) : null;
  // the key — the reference answer, the expected output — reaches the workspace only now, after the agent is done
  if (fs.existsSync(path.join(taskDir, 'key'))) fs.cpSync(path.join(taskDir, 'key'), path.join(ws, 'key'), { recursive: true });
  draftAndApprove(ws, taskDir); // idempotent — the `off` arm never drafted, the `on` arm re-drafts the same intent
  // the judge runs the task's scenarios only: a regression the agent recorded is the agent's, counted apart
  const regDir = path.join(ws, '.vibe', 'regressions');
  const agentRegressions = fs.existsSync(regDir) ? fs.readdirSync(regDir).filter((f) => f.endsWith('.yaml')).length : 0;
  fs.rmSync(regDir, { recursive: true, force: true });
  const keyFile = path.join(taskDir, 'key', 'expected.json');
  const keyEnv = fs.existsSync(keyFile) ? { VIBE_KEY_EXPECTED: fs.readFileSync(keyFile, 'utf-8') } : {};
  const out = vibeSync(ws, ['check', '--all'], { env: { VIBE_HARNESS: harness, VIBE_CLIENT: clients.length > 1 ? clients.map((c) => (c === 'claude' ? 'claude-code' : c)).join('→') : run.client, VIBE_MODEL: run.model ?? '', VIBE_TURNS: run.turns ?? '', VIBE_COST_USD: run.costUsd ?? '', ...keyEnv } });
  const report = JSON.parse(out.stdout);
  const lines = fs.readFileSync(path.join(ws, '.vibe', 'ledger.jsonl'), 'utf-8').trim().split('\n');
  const events = lines.map((l) => JSON.parse(l));
  const check = events.reverse().find((e) => e.event === 'check');
  // tokens a reader or reviewer spent on the agent's behalf (`usage` events) are the agent's cost too — nothing hides in a side model
  const side = events.filter((e) => e.event === 'usage' && e.tokens);
  if (side.length && run.tokens) for (const e of side) for (const k of ['input', 'cacheRead', 'cacheWrite', 'output']) run.tokens[k] = (run.tokens[k] ?? 0) + (e.tokens[k] ?? 0);
  const sideModels = [...new Set(side.map((e) => e.detail))];
  const line = { ...check, task, workspace: ws, ms: run.ms, tokens: run.tokens ?? null, usage: run.usage ?? (run.tokens ? 'captured' : 'missing'), ...(run.error ? { error: run.error } : {}), ...(run.stalled ? { stalled: true } : {}), ...(sideModels.length ? { sideModels } : {}), ...(scoped ? { scoped: { ...scoped, approvals: run.approvals ?? 0 } } : {}), ...(clients.length > 1 ? { clients } : {}), sessions: run.sessions ?? 1, asked: run.asked ?? 0, costRecomputed: recomputedCost(run.tokens), armPassed: !run.stalled && check.failed === 0, agentRegressions, pair: `${task}#${index}` };
  fs.appendFileSync(ledger, `${JSON.stringify(line)}\n`);
  return report;
}

function priceEnv(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** (input + 0.1×cacheRead + 1.25×cacheWrite) × input price + output × output price, per million tokens.
 * Null — never zero — when the price or the tokens are unknown, so an unset price is never read as a claim. */
function recomputedCost(tokens) {
  const inputPrice = priceEnv('VIBE_BENCH_INPUT_PRICE');
  const outputPrice = priceEnv('VIBE_BENCH_OUTPUT_PRICE');
  if (!tokens || inputPrice === null || outputPrice === null) return null;
  const weightedInput = tokens.input + 0.1 * tokens.cacheRead + 1.25 * tokens.cacheWrite;
  return (weightedInput * inputPrice + tokens.output * outputPrice) / 1_000_000;
}

/** Async spawn — a real OS process per call, awaited by promise rather than blocking, so `--parallel`
 * gets genuine concurrency: several long agent runs progressing side by side, not queued behind each other. */
function spawnAsync(cmd, cmdArgs, { cwd, input, timeoutMs = AGENT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd, env });
    let out = '';
    const capture = (chunk) => {
      if (out.length < MAX_CAPTURE) out += chunk.toString('utf-8');
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ stdout: out, code: null });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout: out, code });
    });
    if (input !== undefined) child.stdin?.end(input);
    else child.stdin?.end();
  });
}

function claudeUsage(out) {
  const used = out.modelUsage ? Object.keys(out.modelUsage).sort((x, y) => (out.modelUsage[y].outputTokens ?? 0) - (out.modelUsage[x].outputTokens ?? 0))[0] : null;
  const u = used ? out.modelUsage[used] : null;
  const tokens = u ? { input: u.inputTokens ?? 0, cacheRead: u.cacheReadInputTokens ?? 0, cacheWrite: u.cacheCreationInputTokens ?? 0, output: u.outputTokens ?? 0 } : null;
  return { model: used, tokens };
}

/** The stream's final `result` event carries turns, cost and usage; when the process died before it (timeout,
 * a crash), the assistant events that did arrive still give the turn count and the run is named usage-missing. */
function claudeResult(stdout) {
  let result = null;
  let assistantTurns = 0;
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === 'result') result = event;
      else if (event.type === 'assistant') assistantTurns += 1;
    } catch {
      /* a partial line */
    }
  }
  return { result, assistantTurns };
}

async function runClaude(ws, session = {}) {
  const prompt = fs.readFileSync(path.join(ws, 'TASK.md'), 'utf-8');
  // user settings stay out of both arms; the `on` arm keeps the workspace's own (.claude/settings.local.json, skills)
  const a = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', '--max-turns', String(session.maxTurns ?? maxTurns), '--setting-sources', harness === 'off' ? '' : 'project,local'];
  if (model) a.push('--model', model);
  const started = Date.now();
  const r = await spawnAsync('claude', a, { cwd: ws });
  const { result, assistantTurns } = claudeResult(r.stdout);
  const out = result ?? {};
  const error = out.is_error && typeof out.result === 'string' ? out.result.slice(0, 160) : /rate limit|usage limit|overloaded|credit balance/i.test(r.stdout) && !out.usage ? 'client error: limit or overload' : null;
  const { model: used, tokens } = claudeUsage(out);
  return { client: 'claude-code', model: used ?? model ?? null, turns: out.num_turns ?? (assistantTurns || null), costUsd: out.total_cost_usd ?? null, ms: Date.now() - started, tokens, usage: tokens ? 'captured' : 'missing', finalText: typeof out.result === 'string' ? out.result : '', ...(error ? { error } : {}) };
}

/** codex exec `--json` streams one line per event; `turn.completed` carries the turn's own usage. */
function codexUsage(stdout) {
  for (const line of stdout.split('\n')) {
    if (!line.includes('"turn.completed"')) continue;
    try {
      const event = JSON.parse(line);
      const u = event.usage ?? event.item?.usage ?? null;
      if (!u) continue;
      // codex's input_tokens includes cached_input_tokens; the bench's input is the uncached part, so the cache weight is not paid twice
      const cached = u.cached_input_tokens ?? u.cachedInputTokens ?? 0;
      return { input: Math.max(0, (u.input_tokens ?? u.inputTokens ?? 0) - cached), cacheRead: cached, cacheWrite: 0, output: u.output_tokens ?? u.outputTokens ?? 0 };
    } catch {
      /* not this line */
    }
  }
  return null;
}

async function runCodex(ws, session = {}) {
  const prompt = fs.readFileSync(path.join(ws, 'TASK.md'), 'utf-8');
  // the workspace's own hooks (the on arm's gate, session hand-over and stop verdict) run without a persisted trust entry
  const a = ['exec', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox', '--dangerously-bypass-hook-trust', '--json', '-C', ws];
  if (model) a.push('-m', model);
  const started = Date.now();
  const r = await spawnAsync('codex', a, { cwd: ws, input: prompt, timeoutMs: session.cutMs ?? AGENT_TIMEOUT_MS });
  // codex exec is one turn; the comparable unit is completed items (commands, messages, patches)
  let turns = 0;
  let finalText = '';
  let error = null;
  for (const line of r.stdout.split('\n')) {
    if (line.includes('"error"') && /usage limit|at capacity|rate limit|insufficient|quota/i.test(line)) error = (/"message":"([^"]{0,160})/.exec(line)?.[1] ?? 'client error').replace(/\\n/g, ' ');
    if (!line.includes('"item.completed"')) continue;
    turns += 1;
    try {
      const item = JSON.parse(line).item;
      if (item?.type === 'agent_message' && typeof item.text === 'string') finalText = item.text;
    } catch {
      /* not this line */
    }
  }
  let usedModel = model;
  if (!usedModel) {
    try {
      usedModel = /^model\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(os.homedir(), '.codex', 'config.toml'), 'utf-8'))?.[1] ?? null;
    } catch {
      usedModel = null;
    }
  }
  const tokens = codexUsage(r.stdout);
  return { client: 'codex', model: usedModel, turns: turns || null, costUsd: null, ms: Date.now() - started, tokens, usage: tokens ? 'captured' : 'missing', finalText, ...(error ? { error } : {}) };
}

/** Two sessions on one workspace add up: turns, cost, time and tokens are the task's total; the model is the last one. */
function sumRuns(a, b) {
  const add = (x, y) => (x === null && y === null ? null : (x ?? 0) + (y ?? 0));
  const tokens = a.tokens && b.tokens ? Object.fromEntries(Object.keys(a.tokens).map((k) => [k, a.tokens[k] + b.tokens[k]])) : null;
  return { client: a.client, model: b.model ?? a.model, turns: add(a.turns, b.turns), costUsd: add(a.costUsd, b.costUsd), ms: a.ms + b.ms, tokens, usage: tokens ? 'captured' : 'missing', sessions: (a.sessions ?? 1) + 1, finalText: b.finalText ?? '' };
}

async function runOneJob(job) {
  const ws = prepare(job.task);
  if (prepareOnly) {
    console.log(JSON.stringify({ ws, harness, clients, task: job.task }));
    return { ...job, ws, run: { client, turns: null, ms: 0, tokens: null }, report: { passed: 0, failed: 0 } };
  }
  const config = meta(job.task);
  const sessions = config.sessions ?? [{}];
  let run = null;
  let asked = 0;
  let approvals = 0;
  for (let i = 0; i < sessions.length; i += 1) {
    const session = sessions[i];
    const sessionClient = clients[i % clients.length];
    const one = sessionClient === 'claude' ? await runClaude(ws, session) : await runCodex(ws, session);
    if (one.error) { run = { ...(run ? sumRuns(run, one) : one), error: one.error }; break; }
    run = run ? sumRuns(run, one) : one;
    if (config.fakeUser && i < sessions.length - 1) asked += answerQuestions(ws, path.join(here, 'tasks', job.task, config.fakeUser), one.finalText);
    // scoped: the agent stopped at the approval message, as the flow says — the user says yes, and the work goes on in a new session
    if (harness === 'scoped' && approvals === 0 && stateOf(ws) === 'DRAFT') {
      vibeSync(ws, ['approve']);
      fs.appendFileSync(path.join(ws, 'TASK.md'), '\n\nUser: yes — approved as proposed; go ahead and build.\n');
      approvals += 1;
      if (i === sessions.length - 1) sessions.push({});
    }
  }
  run.approvals = approvals;
  run.asked = asked;
  run.stalled = stalled(ws, config.outputs);
  const report = judge(ws, run, job.task, job.index);
  return { ...job, ws, run, report };
}

if (prepareOnly) {
  await runOneJob({ task: taskNames()[0], index: 0 });
  process.exit(0);
}

/** A fixed-size pool of workers pulling from a shared queue — `--parallel` concurrent agent runs at once. */
async function runPool(jobs, size) {
  const queue = [...jobs];
  const results = [];
  async function worker() {
    let job;
    while ((job = queue.shift())) {
      const outcome = await runOneJob(job);
      results.push(outcome);
      if (outcome.run.error) {
        console.error(`${client} ${harness} ${job.task}: ${outcome.run.error} — the arm stops here; a limit is not a measurement`);
        queue.length = 0;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, worker));
  return results;
}

function report(outcome) {
  const { task, index, run, report: r, ws } = outcome;
  const cost = run.costUsd ?? '-';
  console.log(`${client} ${harness} ${task} run ${index + 1}/${runs}: passed ${r.passed} failed ${r.failed} · turns ${run.turns ?? '-'} · cost ${cost} · ${Math.round(run.ms / 1000)}s · ${ws}${run.stalled ? ' · STALLED (excluded from quality)' : ''}${run.error ? ` · ERROR ${run.error}` : ''}`);
}

const jobs = taskNames().flatMap((task) => Array.from({ length: runs }, (_, index) => ({ task, index })));
const outcomes = await runPool(jobs, parallel);
for (const outcome of outcomes) report(outcome);
