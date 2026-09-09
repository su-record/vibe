#!/usr/bin/env node
// The gate — every release proves its bench number before it ships. Two sets, two rules, both
// pre-registered in bench/claims/: the overhead set (saturated on purpose) measures what the
// harness costs — `on` turns ≤ `off` + 4 and `on` ms ≤ `off` × 1.5 per client, and never worse on
// checks; the direction set measures what it prevents — `on` scores higher on checks for at least
// two of its tasks per client, and a task that does not separate the arms is named for retirement.
// Runs as a `vibe check --all` scenario, not in CI — the bench spends real model tokens.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_RUNS = 5;
export const SETS = {
  overhead: ['settlement', 'vibe-fix', 'report'],
  direction: ['hidden-requirement', 'regression-trap', 'long-context', 'ambiguous-brief'],
};
const TURNS_ALLOWANCE = 4;
const MS_FACTOR = 1.5;

const armOf = (line) => `${line.client}/${line.harness}`;
const latest = (lines) => [...lines].sort((a, b) => new Date(a.at) - new Date(b.at)).slice(-REQUIRED_RUNS);
const mean = (lines, key) => {
  const vals = lines.map((l) => l[key]).filter((v) => typeof v === 'number');
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
};

/** Every client that appears for this task must show both arms with five runs each. */
function missingArms(task, lines) {
  const clients = [...new Set(lines.map((l) => l.client))];
  const wanted = clients.flatMap((c) => [`${c}/on`, `${c}/off`]);
  const present = new Set(lines.map(armOf));
  const missing = wanted.filter((a) => !present.has(a));
  if (missing.length > 0) return `${task}: missing arm(s) ${missing.join(', ')}`;
  if (wanted.length < 2) return `${task}: fewer than two arms to compare`;
  for (const arm of wanted) {
    const count = lines.filter((l) => armOf(l) === arm).length;
    if (count < REQUIRED_RUNS) return `${task}: ${arm} has ${count} run(s), needs ${REQUIRED_RUNS}`;
  }
  return null;
}

function arms(lines, client) {
  return { on: latest(lines.filter((l) => l.client === client && l.harness === 'on')), off: latest(lines.filter((l) => l.client === client && l.harness === 'off')) };
}

/** Overhead: never worse on checks, and the procedure within its allowance — turns and time. */
function overheadVerdict(task, lines) {
  for (const client of new Set(lines.map((l) => l.client))) {
    const { on, off } = arms(lines, client);
    if (on.length < REQUIRED_RUNS || off.length < REQUIRED_RUNS) continue;
    if (mean(on, 'passed') < mean(off, 'passed')) return `${task}: ${client} — on ${mean(on, 'passed').toFixed(2)} checks is worse than off ${mean(off, 'passed').toFixed(2)}`;
    const onT = mean(on, 'turns');
    const offT = mean(off, 'turns');
    if (onT !== null && offT !== null && onT > offT + TURNS_ALLOWANCE) return `${task}: ${client} — on ${onT.toFixed(1)} turns is over off ${offT.toFixed(1)} + ${TURNS_ALLOWANCE}`;
    const onMs = mean(on, 'ms');
    const offMs = mean(off, 'ms');
    if (onMs !== null && offMs !== null && onMs > offMs * MS_FACTOR) return `${task}: ${client} — on ${Math.round(onMs / 1000)}s is over off ${Math.round(offMs / 1000)}s × ${MS_FACTOR}`;
  }
  return null;
}

/** Direction: per client, the tasks where `on` scores higher on checks; fewer than two is a failure that names the rest. */
function directionVerdict(tasksLines) {
  const clients = new Set(tasksLines.flatMap(([, lines]) => lines.map((l) => l.client)));
  const problems = [];
  for (const client of clients) {
    const separating = [];
    const flat = [];
    for (const [task, lines] of tasksLines) {
      const { on, off } = arms(lines, client);
      if (on.length < REQUIRED_RUNS || off.length < REQUIRED_RUNS) continue;
      if (mean(on, 'passed') > mean(off, 'passed')) separating.push(task);
      else flat.push(task);
    }
    if (separating.length < 2) problems.push(`direction: ${client} — only ${separating.length} task(s) separate the arms; the bare model already gets right: ${flat.join(', ') || 'none measured'}`);
  }
  return problems.length ? problems.join('; ') : null;
}

export function gate(lines, sets = SETS) {
  const results = [];
  for (const task of sets.overhead) {
    const mine = lines.filter((l) => l.task === task);
    const reason = mine.length === 0 ? `overhead: missing task ${task}` : missingArms(task, mine) ?? overheadVerdict(task, mine);
    results.push({ set: 'overhead', task, ok: reason === null, reason: reason ?? `overhead: ${task} ok` });
  }
  const direction = sets.direction.map((task) => [task, lines.filter((l) => l.task === task)]);
  for (const [task, mine] of direction) {
    const reason = mine.length === 0 ? `direction: missing task ${task}` : missingArms(task, mine);
    if (reason) results.push({ set: 'direction', task, ok: false, reason });
  }
  const dv = directionVerdict(direction.filter(([, l]) => l.length > 0));
  if (dv) results.push({ set: 'direction', task: '*', ok: false, reason: dv });
  else if (direction.some(([, l]) => l.length > 0)) results.push({ set: 'direction', task: '*', ok: true, reason: 'direction: at least two tasks separate the arms per client' });
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, results, reason: failed.map((r) => r.reason).join('; ') };
}

function readLedger(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function line(task, client, harness, i, passed, turns, ms) {
  return { at: new Date(Date.now() + i * 1000).toISOString(), event: 'check', client, harness, task, passed, failed: 0, turns, ms, armPassed: true };
}

function selfTest() {
  const good = [];
  let i = 0;
  for (const task of SETS.overhead) for (const client of ['claude-code', 'codex']) for (let k = 0; k < 5; k += 1) good.push(line(task, client, 'on', (i += 1), 3, 6, 20000), line(task, client, 'off', (i += 1), 3, 4, 15000));
  for (const task of SETS.direction) for (const client of ['claude-code', 'codex']) for (let k = 0; k < 5; k += 1) good.push(line(task, client, 'on', (i += 1), 3, 9, 30000), line(task, client, 'off', (i += 1), task === 'long-context' ? 3 : 1, 5, 20000));
  const passing = gate(good);
  if (!passing.ok) throw new Error(`self-test: a good ledger failed: ${passing.reason}`);
  const heavy = good.map((l) => (l.task === 'report' && l.harness === 'on' ? { ...l, turns: 20 } : l));
  if (gate(heavy).ok || !gate(heavy).reason.includes('report: claude-code — on 20.0 turns')) throw new Error('self-test: the turns allowance was not enforced');
  const flat = good.map((l) => (SETS.direction.includes(l.task) ? { ...l, passed: 3 } : l));
  const fv = gate(flat);
  if (fv.ok || !fv.reason.includes('only 0 task(s) separate')) throw new Error('self-test: a flat direction set passed');
  const missing = good.filter((l) => l.task !== 'vibe-fix');
  if (gate(missing).ok || !gate(missing).reason.includes('missing task vibe-fix')) throw new Error('self-test: a missing task passed');
  process.stdout.write('bench-gate --self-test: 4 checks passed\n');
}

const here = path.dirname(new URL(import.meta.url).pathname);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here, 'bench-gate.js')) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    const lines = readLedger(path.join(here, '..', 'bench', 'ledger.jsonl'));
    const r = gate(lines);
    process.stdout.write(`${r.ok ? 'bench gate passed' : 'bench gate failed'}: ${r.results.map((x) => x.reason).join('; ')}\n`);
    process.exit(r.ok ? 0 : 1);
  }
}
