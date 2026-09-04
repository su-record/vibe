#!/usr/bin/env node
// The six common skills follow the Agent Skills spec: `name` equals its directory and uses only
// lowercase letters, digits and hyphens; a description is present; bodies reference only skills
// that exist; and none of the six is tracked inside this repository's project skill directories.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const root = new URL('..', import.meta.url).pathname;
const dirs = fs.readdirSync(path.join(root, 'skills')).sort();
const errors = [];
for (const dir of dirs) {
  const body = fs.readFileSync(path.join(root, 'skills', dir, 'SKILL.md'), 'utf-8');
  const name = /^name:\s*(.+)$/m.exec(body)?.[1]?.trim();
  if (!name || !NAME_RE.test(name) || name.length > 64) errors.push(`${dir}: name "${name}" is outside the spec grammar`);
  else if (name !== dir) errors.push(`${dir}: name "${name}" differs from its directory`);
  if (!/^description:\s*\S/m.test(body)) errors.push(`${dir}: no description`);
  for (const [, ref] of body.matchAll(/`(vibe[.-][a-z]+)`/g)) if (!dirs.includes(ref)) errors.push(`${dir}: references unknown skill ${ref}`);
}
const tracked = execFileSync('git', ['ls-files', '.claude/skills', '.codex/skills'], { cwd: root, encoding: 'utf-8' }).split('\n').filter(Boolean);
for (const file of tracked) {
  const top = file.split('/')[2] ?? '';
  if (dirs.includes(top) || /^vibe\./.test(top)) errors.push(`${file}: a common skill tracked inside the project`);
}
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`${dirs.length} common skills: names conform, references resolve, none tracked under .claude/skills or .codex/skills`);
