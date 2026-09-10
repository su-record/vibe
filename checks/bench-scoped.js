#!/usr/bin/env node
// The scoped arm: a workspace with the card, the skills and the hooks — and no intent. The agent scopes for
// itself from the brief; the judge's intent stays hidden until judge time, as for every arm.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = execFileSync('node', ['bench/run.js', '--harness', 'scoped', '--task', 'settlement', '--prepare-only'], { cwd: root, encoding: 'utf-8', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
const { ws, harness } = JSON.parse(out.trim().split('\n').at(-1));
const problems = [];
if (harness !== 'scoped') problems.push(`harness ${harness}`);
if (fs.existsSync(path.join(ws, '.vibe', 'intent.md')) && fs.statSync(path.join(ws, '.vibe', 'intent.md')).size > 0) problems.push('an intent reached the scoped workspace'); // ensureProject seeds an empty file
if (fs.existsSync(path.join(ws, 'judge'))) problems.push('judge/ reached the scoped workspace');
if (!fs.readFileSync(path.join(ws, 'CLAUDE.md'), 'utf-8').includes('vibe:start')) problems.push('no card in CLAUDE.md');
const hooks = JSON.parse(fs.readFileSync(path.join(ws, '.claude', 'settings.local.json'), 'utf-8')).hooks ?? {};
for (const ev of ['SessionStart', 'PreToolUse', 'Stop']) if (!hooks[ev]) problems.push(`no ${ev} hook`);
if (!fs.existsSync(path.join(ws, '.claude', 'skills', 'vibe-scope', 'SKILL.md'))) problems.push('no scope skill');
const state = JSON.parse(execFileSync('node', [path.join(root, 'dist', 'cli.js'), 'state', '--json'], { cwd: ws, encoding: 'utf-8', env: { ...process.env, VIBE_SKIP_SETUP: '1' } }).toString().replace(/^[^{]*/, ''));
if (!/^discover/.test(state.next)) problems.push(`next is "${state.next}", not discover`);
fs.rmSync(ws, { recursive: true, force: true });
if (problems.length) {
  console.error(`scoped arm:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('bench-scoped: card, skills and hooks, no intent, next says discover');
