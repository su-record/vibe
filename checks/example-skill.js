#!/usr/bin/env node
// The project-local skill made from the settle scenario is registered with its check and survives a prune dry run.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const registry = JSON.parse(fs.readFileSync('.vibe/skills/registry.json', 'utf-8'));
const skill = registry.skills.find((s) => s.name === 'example-settle');
if (!skill || skill.check?.type !== 'run') {
  console.error('example-settle is not registered with a run check — create it with `vibe skill create example-settle --from-scenario settle`');
  process.exit(1);
}
const prune = JSON.parse(execFileSync('node', ['dist/cli.js', 'skill', 'prune', '--dry-run', '--json'], { encoding: 'utf-8' }));
if (prune.removed.includes('example-settle')) {
  console.error('example-settle would be pruned — it is neither used nor recent');
  process.exit(1);
}
for (const p of skill.paths) if (!fs.existsSync(p)) {
  console.error(`missing ${p}`);
  process.exit(1);
}
console.log(`example-settle: check ${skill.check.type} · ${skill.paths.length} files · kept by prune (threshold ${prune.threshold} runs)`);
