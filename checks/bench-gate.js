#!/usr/bin/env node
// The gate — every release proves its bench number before it ships: five runs per arm for every
// task, and the harness (`on`) not scoring worse than a bare workspace (`off`) on checks passed.
// Runs as a `vibe check --all` scenario, not in CI — the bench spends real model tokens.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_RUNS = 5;

function armOf(line) {
  return `${line.client}/${line.harness}`;
}

/** The latest `REQUIRED_RUNS` lines by timestamp — an arm run again since always outranks a stale one. */
function latest(lines) {
  return [...lines].sort((a, b) => new Date(a.at) - new Date(b.at)).slice(-REQUIRED_RUNS);
}

function meanPassed(lines) {
  return lines.reduce((sum, l) => sum + (l.passed ?? 0), 0) / lines.length;
}

/** Every client that appears for this task must show both its `on` and `off` arm, each with five
 * runs; a client never benched at all is simply not required — "the arms that exist, at least two". */
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

/** Per client, the `on` arm's mean checks-passed over its latest five runs must not be worse than `off`'s. */
function regressionIn(task, lines) {
  for (const client of new Set(lines.map((l) => l.client))) {
    const on = latest(lines.filter((l) => l.client === client && l.harness === 'on'));
    const off = latest(lines.filter((l) => l.client === client && l.harness === 'off'));
    if (on.length < REQUIRED_RUNS || off.length < REQUIRED_RUNS) continue; // already reported by missingArms
    const onMean = meanPassed(on);
    const offMean = meanPassed(off);
    if (onMean < offMean) return `${task}: ${client} regression — on ${onMean.toFixed(2)} checks passed is worse than off ${offMean.toFixed(2)}`;
  }
  return null;
}

export function taskVerdict(task, lines) {
  if (lines.length === 0) return { ok: false, reason: `missing task: ${task} — no runs in the ledger` };
  const missing = missingArms(task, lines);
  if (missing) return { ok: false, reason: missing };
  const regression = regressionIn(task, lines);
  if (regression) return { ok: false, reason: regression };
  return { ok: true, reason: `${task}: ok` };
}

export function gate(lines, taskNames) {
  const results = taskNames.map((task) => taskVerdict(task, lines.filter((l) => l.task === task)));
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, results, reason: failed.map((r) => r.reason).join('; ') };
}

function readLedger(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((e) => e.event === 'check');
}

function taskDirs(root) {
  const dir = path.join(root, 'bench', 'tasks');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

function runGate(root) {
  return gate(readLedger(path.join(root, 'bench', 'ledger.jsonl')), taskDirs(root));
}

function writeLedger(root, lines) {
  fs.mkdirSync(path.join(root, 'bench'), { recursive: true });
  fs.writeFileSync(path.join(root, 'bench', 'ledger.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

function makeLine(task, client, harness, i, passed) {
  return { event: 'check', at: new Date(2026, 0, 1, 0, i).toISOString(), client, harness, task, run: `r-${i}`, passed, failed: 5 - passed };
}

/** Builds a temporary ledger and exercises the pass case and both failure modes: a task the ledger
 * never mentions, and one whose `on` arm scores worse than `off`. */
function selfTest() {
  const checks = [];
  const check = (name, ok) => checks.push({ name, ok: !!ok });

  const clean = [];
  for (let i = 0; i < REQUIRED_RUNS; i += 1) {
    clean.push(makeLine('t', 'claude-code', 'on', i, 5));
    clean.push(makeLine('t', 'claude-code', 'off', i, 4));
  }
  const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-gate-'));
  fs.mkdirSync(path.join(cleanDir, 'bench', 'tasks', 't'), { recursive: true });
  writeLedger(cleanDir, clean);
  check('a full, non-regressed ledger passes', runGate(cleanDir).ok);

  fs.mkdirSync(path.join(cleanDir, 'bench', 'tasks', 'ghost'), { recursive: true });
  const missingResult = runGate(cleanDir);
  check('a task absent from the ledger fails, naming it', !missingResult.ok && missingResult.reason.includes('ghost'));
  fs.rmSync(path.join(cleanDir, 'bench', 'tasks', 'ghost'), { recursive: true });

  const regressed = [];
  for (let i = 0; i < REQUIRED_RUNS; i += 1) {
    regressed.push(makeLine('t', 'claude-code', 'on', i, 2));
    regressed.push(makeLine('t', 'claude-code', 'off', i, 5));
  }
  const regressedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-gate-'));
  fs.mkdirSync(path.join(regressedDir, 'bench', 'tasks', 't'), { recursive: true });
  writeLedger(regressedDir, regressed);
  const regressedResult = runGate(regressedDir);
  check('on scoring worse than off fails, naming the regression', !regressedResult.ok && regressedResult.reason.includes('regression'));

  for (const dir of [cleanDir, regressedDir]) fs.rmSync(dir, { recursive: true, force: true });

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.error(`bench-gate --self-test failed:\n${failed.map((c) => `  ${c.name}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`bench-gate --self-test: ${checks.length} checks passed`);
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const root = path.resolve(new URL('..', import.meta.url).pathname);
  const result = runGate(root);
  if (!result.ok) {
    console.error(`bench gate failed: ${result.reason}`);
    process.exit(1);
  }
  console.log(`bench gate passed: ${result.results.map((r) => r.reason).join('; ')}`);
}

main();
