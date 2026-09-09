#!/usr/bin/env node
// Every bench judge must be checkable by the harness alone: `file` checks everywhere, `run`
// checks only where a task's own tests are the judge (vibe-fix). No model-judged check — no
// `review`, no `human`, no `eval` — ever lands in the bench.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const tasksDir = path.join(root, 'bench/tasks');
/** Tasks whose judge is allowed a `run` check, alongside `file` checks. Every other task: file only. */
const RUN_ALLOWED = new Set(['vibe-fix', 'regression-trap', 'long-context', 'ambiguous-brief', 'brownfield', 'irreversible-trap', 'session-split', 'ask', 'anomaly', 'handover']);
const REFERENCE_TOTAL = 4500.5;

function scenariosOf(task) {
  const file = path.join(tasksDir, task, 'judge', 'scenarios.yaml');
  return YAML.parse(fs.readFileSync(file, 'utf-8'));
}

function badChecks(task, scenarios) {
  const allowed = RUN_ALLOWED.has(task) ? new Set(['file', 'run']) : new Set(['file']);
  return scenarios.filter((s) => !allowed.has(s.check?.type));
}

/** The on arm reads judge/intent.md and judge/scenarios.yaml; a check runs in the workspace. Neither may name the key. */
function keyLeaks(task, scenarios) {
  const problems = [];
  for (const s of scenarios) {
    const text = JSON.stringify(s.check ?? {});
    if (/\b(judge|key)\//.test(text)) problems.push(`${task}: scenario ${s.id} reaches into judge/ or key/ — a check may use checks/ only`);
  }
  const keyFile = path.join(tasksDir, task, 'key', 'expected.json');
  if (!fs.existsSync(keyFile)) return problems;
  const seen = fs.readFileSync(path.join(tasksDir, task, 'judge', 'intent.md'), 'utf-8') + fs.readFileSync(path.join(tasksDir, task, 'judge', 'scenarios.yaml'), 'utf-8');
  const values = [];
  const walk = (v) => (Array.isArray(v) ? v.forEach(walk) : v && typeof v === 'object' ? Object.values(v).forEach(walk) : values.push(String(v)));
  walk(JSON.parse(fs.readFileSync(keyFile, 'utf-8')));
  for (const v of values) if (v.length >= 3 && seen.includes(v)) problems.push(`${task}: the intent or scenarios carry the key value "${v}"`);
  return problems;
}

function checkTask(task) {
  const scenarios = scenariosOf(task);
  const bad = badChecks(task, scenarios);
  const problems = keyLeaks(task, scenarios);
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
console.log(`judge: ${tasks.length} tasks (${tasks.join(', ')}) · every check deterministic · no check reaches judge/ or key/ · no key value in an intent · settlement reference total ${settlementTotal}`);
