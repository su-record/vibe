import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pluginTree } from '../dist/install/tree.js';
import { mcpbManifest } from '../dist/install/mcpb.js';

assert.deepEqual(fs.readdirSync('skills'), ['vibe']);
assert.equal(fs.existsSync('agents'), false);
const entry = fs.readFileSync('skills/vibe/SKILL.md', 'utf8');
assert.match(entry, /personal FDE/);
assert.match(entry, /No additional model review by default/);
assert.match(entry, /current checkout/);
assert.match(entry, /internal guide extensions/);
for (const file of fs.readdirSync('internal/guides')) {
  assert.ok(fs.statSync(`internal/guides/${file}`).size < 12000);
}
for (const file of ['hooks/hooks.json', 'hooks/codex-hooks.json']) {
  const hooks = JSON.parse(pluginTree()[file]).hooks;
  assert.equal(hooks.PostToolUse, undefined);
  assert.deepEqual(hooks.PreToolUse.map(entry => entry.matcher), ['Bash']);
  assert.match(hooks.PreToolUse[0].hooks[0].command, /--personal/);
  assert.match(hooks.Stop[0].hooks[0].command, /--personal/);
}
assert.deepEqual(mcpbManifest('test', 'test').tools.map(tool => tool.name), ['vibe']);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const output = JSON.parse(execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 4 * 1024 * 1024,
}));
// npm distributions may return an array or an object keyed by package name.
const packages = Array.isArray(output) ? output : Object.values(output);
assert.equal(packages.length, 1, 'expected one packed package');
const packed = packages[0].files.map(file => file.path);
assert.deepEqual(packed.filter(file => file.startsWith('skills/') && file.endsWith('SKILL.md')), ['skills/vibe/SKILL.md']);
for (const file of ['internal/guides/extensions.md', 'internal/guides/optimization.md', 'internal/guides/verification.md', 'dist/core/performance.js', 'dist/core/verification.js']) assert.ok(packed.includes(file), file);
assert.ok(packed.includes('dist/cli/internal.js'));
assert.ok(packed.includes('mcpb/server/index.js'));
assert.equal(packed.some(file => file.startsWith('agents/')), false);
console.log('personal-fde: one public entry, on-demand guides, lean hooks, MCP facade and npm contents verified; no model called');
