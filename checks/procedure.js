import assert from 'node:assert/strict';
import fs from 'node:fs';
const skill = fs.readFileSync(new URL('../skills/vibe/SKILL.md', import.meta.url), 'utf8');
assert.match(skill, /internal brief/);
assert.match(skill, /No additional model review by default/);
assert.match(skill, /current checkout/);
for (const [, name] of skill.matchAll(/internal guide ([a-z][a-z0-9-]*)/g)) {
  assert.ok(fs.existsSync(new URL(`../internal/guides/${name}.md`, import.meta.url)), `missing guide ${name}`);
}
assert.equal(/load `vibe-(scope|build|prove)`/.test(skill), false);
console.log('personal FDE procedure: one entry, resolvable internal guides, no automatic review or workspace');
