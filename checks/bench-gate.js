#!/usr/bin/env node
// The gate — every release proves its bench number before it ships. Three sets, pre-registered in
// bench/claims/. The measure is the user's: tokens and time. The overhead set (saturated on purpose)
// measures what the harness costs — `on` weighted input tokens ≤ `off` × 1.25 and `on` ms ≤ `off` × 1.5
// per client, never worse on checks; turns are reported, not gated (two of them are the harness's own
// commands). The direction set measures what it prevents — a trap task separates when `on` or `scoped` scores
// higher on checks on at least one client and is not worse on the others; a session-split task holds when `on` is not worse on checks and spends no more
// tokens over its sessions. The context set: `on` tokens ≤ `off` × 0.7. A task that does not separate
// the arms is named for retirement.
// Runs as a `vibe check --all` scenario, not in CI — the bench spends real model tokens.
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_RUNS = 5;
export const SETS = {
  overhead: ['settlement', 'vibe-fix', 'report'],
  direction: ['anomaly', 'handover', 'session-split'],
  context: ['brownfield'],
};
const TOKENS_FACTOR = 0.7;
const weighted = (t) => t.input + 0.1 * t.cacheRead + 1.25 * t.cacheWrite;
const TOKENS_OVERHEAD = 1.25;
const MS_FACTOR = 1.5;

const armOf = (line) => `${line.client}/${line.harness}`;
const latest = (lines) => [...lines].sort((a, b) => new Date(a.at) - new Date(b.at)).slice(-REQUIRED_RUNS);
const mean = (lines, key) => {
  const vals = lines.map((l) => l[key]).filter((v) => typeof v === 'number');
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
};

function tokenMean(lines) {
  return lines.reduce((sum, line) => sum + weighted(line.tokens), 0) / lines.length;
}

const observed = (v) => Number.isFinite(v) && v >= 0;
const hasTokens = (l) => l.tokens && ['input', 'cacheRead', 'cacheWrite'].every((k) => observed(l.tokens[k]));

/** Count the same latest attempts the verdict uses; an error cannot be replaced by an older success. */
function missingArms(task, lines, set) {
  const clients = [...new Set(lines.map((l) => l.client))];
  const wanted = clients.flatMap((c) => [`${c}/on`, `${c}/off`, `${c}/scoped`]);
  const present = new Set(lines.map(armOf));
  const missing = wanted.filter((a) => !present.has(a));
  if (missing.length > 0) return `${task}: missing arm(s) ${missing.join(', ')}`;
  for (const arm of wanted) {
    const runs = latest(lines.filter((l) => armOf(l) === arm));
    const count = runs.filter((l) => !l.error && !l.stalled && observed(l.passed)).length;
    const stalled = runs.filter((l) => l.stalled).length;
    if (count < REQUIRED_RUNS) return `${task}: ${arm} has ${count} usable run(s) in its latest ${REQUIRED_RUNS} attempts, needs ${REQUIRED_RUNS}${stalled ? ` (${stalled} stalled)` : ''}`;
    if (arm.endsWith('/scoped')) continue;
    const metrics = set === 'overhead' ? ['tokens', 'ms'] : set === 'context' || DIRECTION_RULES[task] === 'cheaper' ? ['tokens'] : ['turns'];
    for (const metric of metrics) {
      const measured = runs.filter((l) => metric === 'tokens' ? hasTokens(l) && (set !== 'context' || l.armPassed) : observed(l[metric])).length;
      if (measured < REQUIRED_RUNS) return `${task}: ${arm} has ${measured} ${metric} observations, needs ${REQUIRED_RUNS}`;
    }
  }
  return null;
}

/** Three arms: `off` (bare), `on` (the judge's intent given) and `scoped` (vibe scopes for itself from the brief). */
function arms(lines, client) {
  const arm = (h) => latest(lines.filter((l) => l.client === client && l.harness === h));
  return { on: arm('on'), off: arm('off'), scoped: arm('scoped') };
}

/** Scoped quality must not regress; its cost is reported, not bounded. */
function scopedVerdict(task, client, scoped, off) {
  if (mean(scoped, 'passed') < mean(off, 'passed')) return `${task}: ${client} — scoped ${mean(scoped, 'passed').toFixed(2)} checks is worse than off ${mean(off, 'passed').toFixed(2)}`;
  return null;
}

function overheadVerdict(task, lines) {
  for (const client of new Set(lines.map((l) => l.client))) {
    const { on, off, scoped } = arms(lines, client);
    const s = scopedVerdict(task, client, scoped, off);
    if (s) return s;
    if (mean(on, 'passed') < mean(off, 'passed')) return `${task}: ${client} — on ${mean(on, 'passed').toFixed(2)} checks is worse than off ${mean(off, 'passed').toFixed(2)}`;
    const onTok = tokenMean(on);
    const offTok = tokenMean(off);
    if (onTok > offTok * TOKENS_OVERHEAD) return `${task}: ${client} — on ${Math.round(onTok)} weighted tokens is over off ${Math.round(offTok)} × ${TOKENS_OVERHEAD} (turns ${mean(on, 'turns')?.toFixed(1)} vs ${mean(off, 'turns')?.toFixed(1)})`;
    const onMs = mean(on, 'ms');
    const offMs = mean(off, 'ms');
    if (onMs > offMs * MS_FACTOR) return `${task}: ${client} — on ${Math.round(onMs / 1000)}s is over off ${Math.round(offMs / 1000)}s × ${MS_FACTOR}`;
  }
  return null;
}

/** Context: never worse on checks, and `on` weighted input tokens at most 0.7 × `off`, per client, over runs both arms passed. */
function contextVerdict(task, lines) {
  for (const client of new Set(lines.map((l) => l.client))) {
    const { on, off, scoped } = arms(lines, client);
    const s = scopedVerdict(task, client, scoped, off);
    if (s) return s;
    if (mean(on, 'passed') < mean(off, 'passed')) return `${task}: ${client} — on ${mean(on, 'passed').toFixed(2)} checks is worse than off ${mean(off, 'passed').toFixed(2)}`;
    const onTok = tokenMean(on.filter((l) => l.armPassed));
    const offTok = tokenMean(off.filter((l) => l.armPassed));
    if (onTok > offTok * TOKENS_FACTOR) return `${task}: ${client} — on ${Math.round(onTok)} weighted tokens is over off ${Math.round(offTok)} × ${TOKENS_FACTOR}`;
  }
  return null;
}

/** Direction, per task and client: a trap separates when `on` or `scoped` scores higher on checks; a split task holds when `on`
 * is not worse on checks and spends no more tokens over its sessions. A task that does neither is named for retirement. */
const DIRECTION_RULES = { 'session-split': 'cheaper', handover: 'cheaper' };
/** On a trap the harness may ask and wait, but not wander: `on` turns at most this many times `off` turns, per client. */
const TRAP_TURNS_FACTOR = 2;
function directionVerdict(tasksLines) {
  const problems = [];
  for (const [task, lines] of tasksLines) {
    const rule = DIRECTION_RULES[task] ?? 'separates';
    const separated = [];
    const measured = [];
    for (const client of new Set(lines.map((l) => l.client))) {
      const { on, off, scoped } = arms(lines, client);
      const s = scopedVerdict(task, client, scoped, off);
      if (s) problems.push(s);
      const onP = mean(on, 'passed');
      const offP = mean(off, 'passed');
      const scopedP = mean(scoped, 'passed');
      if (rule === 'separates') {
        measured.push(client);
        if (onP > offP || scopedP > offP) separated.push(client);
        if (onP < offP) problems.push(`${task}: ${client} — on ${onP.toFixed(2)} checks is worse than off ${offP.toFixed(2)}`);
        const onT = mean(on, 'turns');
        const offT = mean(off, 'turns');
        if (onT > offT * TRAP_TURNS_FACTOR) problems.push(`${task}: ${client} — on ${onT.toFixed(1)} turns is over off ${offT.toFixed(1)} × ${TRAP_TURNS_FACTOR}`);
      }
      if (rule === 'cheaper') {
        if (onP < offP) problems.push(`${task}: ${client} — on ${onP.toFixed(2)} checks is worse than off ${offP.toFixed(2)}`);
        else {
          const onTok = tokenMean(on);
          const offTok = tokenMean(off);
          if (onTok > offTok) problems.push(`${task}: ${client} — on ${Math.round(onTok)} weighted tokens over two sessions is more than off ${Math.round(offTok)} (turns ${mean(on, 'turns')?.toFixed(1)} vs ${mean(off, 'turns')?.toFixed(1)})`);
        }
      }
    }
    // a trap has something to prevent when at least one client's bare model falls for it; a client that does not fall is named, not failed
    if (rule === 'separates' && measured.length > 0 && separated.length === 0) problems.push(`${task}: no client separates (${measured.join(', ')}) — the bare model already gets it right; retire the task`);
  }
  return problems.length ? problems.join('; ') : null;
}

export function gate(lines, sets = SETS) {
  const results = [];
  for (const task of sets.overhead) {
    const mine = lines.filter((l) => l.event === 'check' && l.task === task);
    const reason = mine.length === 0 ? `overhead: missing task ${task}` : missingArms(task, mine, 'overhead') ?? overheadVerdict(task, mine);
    results.push({ set: 'overhead', task, ok: reason === null, reason: reason ?? `overhead: ${task} ok` });
  }
  for (const task of sets.context ?? []) {
    const mine = lines.filter((l) => l.event === 'check' && l.task === task);
    const reason = mine.length === 0 ? `context: missing task ${task}` : missingArms(task, mine, 'context') ?? contextVerdict(task, mine);
    results.push({ set: 'context', task, ok: reason === null, reason: reason ?? `context: ${task} ok` });
  }
  const direction = sets.direction.map((task) => [task, lines.filter((l) => l.event === 'check' && l.task === task)]);
  const ready = [];
  for (const [task, mine] of direction) {
    const reason = mine.length === 0 ? `direction: missing task ${task}` : missingArms(task, mine, 'direction');
    if (reason) results.push({ set: 'direction', task, ok: false, reason });
    else ready.push([task, mine]);
  }
  const dv = directionVerdict(ready);
  if (dv) results.push({ set: 'direction', task: '*', ok: false, reason: dv });
  else if (ready.length > 0 && ready.length === direction.length) results.push({ set: 'direction', task: '*', ok: true, reason: 'direction: all required tasks meet their per-client rules' });
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, results, reason: failed.map((r) => r.reason).join('; ') };
}

function readLedger(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function line(task, client, harness, i, passed, turns, ms, tokens) {
  return { at: new Date(Date.now() + i * 1000).toISOString(), event: 'check', client, harness, task, passed, failed: 0, turns, ms, armPassed: true, tokens: tokens ?? { input: harness === 'on' ? 1000 : 5000, cacheRead: harness === 'on' ? 10000 : 30000, cacheWrite: 0, output: 100 } };
}

function selfTest() {
  const good = [];
  let i = 0;
  for (const task of SETS.overhead) for (const client of ['claude-code', 'codex']) for (let k = 0; k < 5; k += 1) good.push(line(task, client, 'on', (i += 1), 3, 6, 20000), line(task, client, 'off', (i += 1), 3, 4, 15000), line(task, client, 'scoped', (i += 1), 3, 6, 20000));
  for (const task of SETS.direction) for (const client of ['claude-code', 'codex']) for (let k = 0; k < 5; k += 1) good.push(line(task, client, 'on', (i += 1), 3, 9, 30000), line(task, client, 'off', (i += 1), DIRECTION_RULES[task] === 'cheaper' ? 3 : 1, 10, 20000), line(task, client, 'scoped', (i += 1), 3, 12, 40000, { input: 3000, cacheRead: 20000, cacheWrite: 0, output: 300 }));
  // the overhead arms carry realistic tokens: on within ×1.25 of off
  for (const l of good) if (SETS.overhead.includes(l.task)) l.tokens = { input: l.harness === 'on' ? 1100 : 1000, cacheRead: 10000, cacheWrite: 0, output: 100 };
  for (const task of SETS.context) for (const client of ['claude-code', 'codex']) for (let k = 0; k < 5; k += 1) good.push(line(task, client, 'on', (i += 1), 5, 9, 30000), line(task, client, 'off', (i += 1), 5, 5, 20000), line(task, client, 'scoped', (i += 1), 5, 9, 30000));
  const passing = gate(good);
  if (!passing.ok) throw new Error(`self-test: a good ledger failed: ${passing.reason}`);
  const heavy = good.map((l) => (l.task === 'report' && l.harness === 'on' ? { ...l, tokens: { input: 5000, cacheRead: 10000, cacheWrite: 0, output: 100 } } : l));
  if (gate(heavy).ok || !gate(heavy).reason.includes('report: claude-code — on 6000 weighted tokens is over')) throw new Error('self-test: the tokens allowance was not enforced');
  const trapSets = { ...SETS, direction: ['ask', 'session-split'] };
  const withTrap = [...good];
  for (const client of ['claude-code', 'codex']) for (let k = 0; k < 5; k += 1) withTrap.push(line('ask', client, 'on', (i += 1), 3, 9, 30000), line('ask', client, 'off', (i += 1), 1, 10, 20000), line('ask', client, 'scoped', (i += 1), 3, 9, 30000));
  const flat = gate(withTrap.map((l) => (l.task === 'ask' ? { ...l, passed: 3 } : l)), trapSets);
  if (flat.ok || !flat.reason.includes('ask: no client separates')) throw new Error('self-test: a flat trap passed');
  const oneClient = gate(withTrap.map((l) => (l.task === 'ask' && l.client === 'codex' ? { ...l, passed: 3 } : l)), trapSets);
  if (!oneClient.ok) throw new Error(`self-test: a trap that separates on one client failed: ${oneClient.reason}`);
  const wander = gate(withTrap.map((l) => (l.task === 'ask' && l.client === 'codex' && l.harness === 'on' ? { ...l, turns: 40 } : l)), trapSets);
  if (wander.ok || !wander.reason.includes('ask: codex — on 40.0 turns is over')) throw new Error('self-test: a wandering trap arm passed');
  const redo = good.map((l) => (l.task === 'session-split' && l.harness === 'on' ? { ...l, tokens: { input: 9000, cacheRead: 30000, cacheWrite: 0, output: 100 } } : l));
  if (gate(redo).ok || !gate(redo).reason.includes('over two sessions is more than off')) throw new Error('self-test: a costlier split passed');
  const scopedWorse = gate(good.map((l) => (l.task === 'anomaly' && l.harness === 'scoped' && l.client === 'codex' ? { ...l, passed: 0 } : l)));
  if (scopedWorse.ok || !scopedWorse.reason.includes('scoped 0.00 checks is worse')) throw new Error('self-test: a scoped arm worse than bare passed');
  const hungry = good.map((l) => (l.task === 'brownfield' && l.harness === 'on' ? { ...l, tokens: { input: 5000, cacheRead: 30000, cacheWrite: 0, output: 1 } } : l));
  if (gate(hungry).ok || !gate(hungry).reason.includes('weighted tokens is over')) throw new Error('self-test: the token rule was not enforced');
  const missing = good.filter((l) => l.task !== 'vibe-fix');
  if (gate(missing).ok || !gate(missing).reason.includes('missing task vibe-fix')) throw new Error('self-test: a missing task passed');
  process.stdout.write('bench-gate --self-test: 9 checks passed\n');
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
