#!/usr/bin/env node
// The bench judge must be checkable by the harness alone: file checks only, same reference total as the example.
import fs from 'node:fs';
import YAML from 'yaml';
const scenarios = YAML.parse(fs.readFileSync('bench/tasks/settlement/judge/scenarios.yaml', 'utf-8'));
const bad = scenarios.filter((s) => s.check?.type !== 'file');
const total = scenarios.find((s) => s.check?.sum)?.check.sum.equals;
if (bad.length > 0 || total !== 4500.5) {
  console.error(`judge not checkable: non-file ${bad.map((s) => s.id).join(',') || 'none'} · total ${total}`);
  process.exit(1);
}
console.log(`judge: ${scenarios.length} file checks · reference total ${total}`);
