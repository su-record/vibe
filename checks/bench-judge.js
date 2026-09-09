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
const RUN_ALLOWED = new Set(['vibe-fix', 'regression-trap', 'long-context', 'ambiguous-brief', 'brownfield']);
const REFERENCE_TOTAL = 4500.5;

function scenariosOf(task) {
  const file = path.join(tasksDir, task, 'judge', 'scenarios.yaml');
  return YAML.parse(fs.readFileSync(file, 'utf-8'));
}

function badChecks(task, scenarios) {
  const allowed = RUN_ALLOWED.has(task) ? new Set(['file', 'run']) : new Set(['file']);
  return scenarios.filter((s) => !allowed.has(s.check?.type));
}

function checkTask(task) {
  const scenarios = scenariosOf(task);
  const bad = badChecks(task, scenarios);
  return bad.length > 0 ? `${task}: non-deterministic check(s) ${bad.map((s) => s.id).join(',')}` : null;
}

const tasks = fs.readdirSync(tasksDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const problems = tasks.map(checkTask).filter((p) => p !== null);

const settlementTotal = scenariosOf('settlement').find((s) => s.check?.sum)?.check.sum.equals;
if (settlementTotal !== REFERENCE_TOTAL) problems.push(`settlement: reference total moved to ${settlementTotal}, expected ${REFERENCE_TOTAL}`);

if (problems.length > 0) {
  console.error(`judge not checkable:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`judge: ${tasks.length} tasks (${tasks.join(', ')}) · every check deterministic · settlement reference total ${settlementTotal}`);
