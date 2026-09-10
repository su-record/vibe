#!/usr/bin/env node
// Private artifact grades stay deterministic; public approval contracts expose no private oracle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const tasksDir = path.join(root, 'bench/tasks');
/** Tasks whose judge is allowed a `run` check, alongside `file` checks. Every other task: file only. */
const RUN_ALLOWED = new Set(['vibe-fix', 'regression-trap', 'long-context', 'ambiguous-brief', 'brownfield', 'irreversible-trap', 'session-split', 'ask', 'anomaly', 'handover', 'work-opportunities']);
const REFERENCE_TOTAL = 4500.5;

function scenariosOf(task, contract = 'judge') {
  const file = path.join(tasksDir, task, contract, 'scenarios.yaml');
  return YAML.parse(fs.readFileSync(file, 'utf-8'));
}

function badChecks(task, scenarios) {
  const allowed = RUN_ALLOWED.has(task) ? new Set(['file', 'run']) : new Set(['file']);
  return scenarios.filter((s) => !allowed.has(s.check?.type));
}

/** Only public/ is approved in an agent workspace. Private checks may use judge/ and key/. */
function keyLeaks(task, scenarios) {
  const problems = [];
  for (const s of scenarios) {
    const text = JSON.stringify(s.check ?? {});
    if (/\b(judge|key)[/\\]|VIBE_(KEY|JUDGE)_/.test(text)) problems.push(`${task}: public scenario ${s.id} depends on private grading`);
  }
  const keyFile = path.join(tasksDir, task, 'key', 'expected.json');
  if (!fs.existsSync(keyFile)) return problems;
  const seen = fs.readFileSync(path.join(tasksDir, task, 'public', 'intent.md'), 'utf-8') + fs.readFileSync(path.join(tasksDir, task, 'public', 'scenarios.yaml'), 'utf-8');
  const values = [];
  const walk = (v) => (Array.isArray(v) ? v.forEach(walk) : v && typeof v === 'object' ? Object.values(v).forEach(walk) : values.push(String(v)));
  walk(JSON.parse(fs.readFileSync(keyFile, 'utf-8')));
  for (const v of values) if (v.length >= 3 && seen.includes(v)) problems.push(`${task}: the public intent or scenarios carry the key value "${v}"`);
  return problems;
}

function checkTask(task) {
  const scenarios = scenariosOf(task);
  const bad = badChecks(task, scenarios);
  const publicScenarios = scenariosOf(task, 'public');
  const problems = keyLeaks(task, publicScenarios);
  for (const scenario of publicScenarios) if (!['file', 'run'].includes(scenario.check?.type)) problems.push(`${task}: public scenario ${scenario.id} is not executable`);
  if (bad.length > 0) problems.push(`${task}: non-deterministic check(s) ${bad.map((s) => s.id).join(',')}`);
  return problems.length ? problems.join('; ') : null;
}

const tasks = fs.readdirSync(tasksDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const problems = tasks.map(checkTask).filter((p) => p !== null);

const settlementTotal = scenariosOf('settlement').find((s) => s.check?.sum)?.check.sum.equals;
if (settlementTotal !== REFERENCE_TOTAL) problems.push(`settlement: reference total moved to ${settlementTotal}, expected ${REFERENCE_TOTAL}`);

if (problems.length > 0) {
  console.error(`judge not checkable:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`judge: ${tasks.length} tasks (${tasks.join(', ')}) · deterministic private grades · separate executable public contracts · no key value in a public intent · settlement reference total ${settlementTotal}`);
