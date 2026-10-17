#!/usr/bin/env node
// A packaged SessionStart reader: no CLI lookup, parent search or check execution.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import knowledgeAuto from './knowledge-auto.cjs';
import sessionRuntime from './session-state.cjs';
import sessionFiles from './session-files.cjs';

const client = process.argv[2] || 'claude';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = process.env.VIBE_HOME_DIR || os.homedir();
function read(file, limit = 65536) {
  try { return sessionFiles.optional(file, limit) ?? ''; }
  catch { return ''; }
}
function payload() {
  try { return sessionFiles.readPayload(); }
  catch { return { session_id: 'invalid payload' }; }
}
const card = read(path.join(root, 'card.md'), 4096).trim();
const homeCard = client === 'claude' ? path.join(home, '.claude', 'CLAUDE.md') : path.join(home, '.codex', 'AGENTS.md');
const homeOwns = read(homeCard).includes('<!-- vibe:start -->');
const input = payload();
const recall = knowledgeAuto.start(input);
const view = sessionRuntime.sessionStatus(input);
const status = view.status === 'bound' ? 'session status only; run vibe state for the procedure' : `${view.status}; use explicit vibe session bind in the intended worktree`;
const note = sessionRuntime.message(view, status);
const text = [homeOwns ? note : `${card}\n\n${note}`, recall].filter(Boolean).join('\n');
// Codex has no status surface a plugin can draw on; a systemMessage is the one line it shows the person.
const line = client === 'codex' && view.root ? sessionRuntime.overview(view.root) : null;
process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text }, ...(line ? { systemMessage: line } : {}) })}\n`);
