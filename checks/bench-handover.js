#!/usr/bin/env node
// A two-client task: `--client claude:codex` names one client per session; the workspace carries both layouts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const meta = JSON.parse(fs.readFileSync(path.join(root, 'bench/tasks/handover/judge/meta.json'), 'utf-8'));
const problems = [];
if (!Array.isArray(meta.clients) || meta.clients.length !== 2) problems.push('meta.clients does not name two clients');
if (!Array.isArray(meta.sessions) || meta.sessions.length !== 2) problems.push('meta.sessions does not name two sessions');
const out = execFileSync('node', ['bench/run.js', '--harness', 'on', '--task', 'handover', '--client', 'claude:codex', '--prepare-only'], { cwd: root, encoding: 'utf-8', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
const { ws, clients } = JSON.parse(out.trim().split('\n').at(-1));
if (JSON.stringify(clients) !== JSON.stringify(['claude', 'codex'])) problems.push(`clients ${JSON.stringify(clients)}`);
if (!fs.existsSync(path.join(ws, 'CLAUDE.md'))) problems.push('no CLAUDE.md for the first session');
if (!fs.existsSync(path.join(ws, 'AGENTS.md'))) problems.push('no AGENTS.md for the second session');
if (!fs.existsSync(path.join(ws, '.codex', 'hooks.json'))) problems.push('no .codex/hooks.json');
if (!fs.existsSync(path.join(ws, '.vibe', 'intent.md'))) problems.push('the on arm has no intent');
fs.rmSync(ws, { recursive: true, force: true });
if (problems.length) {
  console.error(`handover:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('bench-handover: two clients, two sessions, both layouts in the workspace');
