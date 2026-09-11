#!/usr/bin/env node
/**
 * Notification hook — execution consent and file-reading guidance, never the work's verdict.
 *
 *   post  PostToolUse(Edit|Write): runs `vibe state --json` and tells the model about a voided DONE or open inbox items.
 *   pre   PreToolUse(Bash): an irreversible command with no recent authorize record is blocked (exit 2) under the
 *         strict and irreversible token policies, and only warned about under off.
 *         Partial Bash reads of protected files are blocked; other source/document slices are warned.
 *         PreToolUse(Read): when the file is over READ_ADVISE_LINES, tells the model that `vibe read <file> --ask`
 *         lets a low-reasoning model read it — advice only, the read goes ahead.
 *
 * Without hooks the gate is the same — the verdict is always `vibe check`, anywhere.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sessionRuntime from './session-state.cjs';
import sessionFiles from './session-files.cjs';
import sliceRuntime from './slice-guard.cjs';

const mode = process.argv[2] || 'post';
const asPlugin = process.argv.includes('--plugin');
const personal = process.argv.includes('--personal');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// Plugin copy and npm copy must not both fire. The npm install writes a notify hook into the
// client's home settings; when that exists, the plugin's hook steps back.
if (asPlugin) {
  const home = process.env.VIBE_HOME_DIR || os.homedir();
  for (const file of [path.join(home, '.claude', 'settings.json'), path.join(home, '.codex', 'hooks.json')]) {
    try {
      if ((sessionFiles.optional(file, 65536) ?? '').includes('hooks/notify.js')) process.exit(0);
    } catch {
      /* no such file — keep going */
    }
  }
}

function readPayload() {
  try {
    const value = ['stop', 'session'].includes(mode) ? sessionFiles.readPayload() : JSON.parse(fs.readFileSync(0, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : { session_id: 'invalid payload' };
  }
  catch { return { session_id: 'invalid payload' }; }
}

function structuralSession(payload) {
  const view = sessionRuntime.sessionStatus(payload);
  return sessionRuntime.message(view, view.status === 'bound' ? 'session status only; run vibe state for the procedure' : `${view.status}; use explicit vibe session bind in the intended worktree`);
}
function sliceClient() {
  const declared = process.env.VIBE_CLIENT;
  if (declared) return ['codex', 'chatgpt'].includes(declared) ? 'codex' : 'claude';
  return process.env.CODEX_THREAD_ID && !process.env.CLAUDE_SESSION_ID ? 'codex' : 'claude';
}

function emitContext(text) {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: mode === 'post' ? 'PostToolUse' : 'PreToolUse', additionalContext: text } })}\n`);
}

// The same actions the check gate names (src/core/checks/mutation.ts), so a blocked tool call and a blocked
// check ask for the same `vibe authorize --action`; `send` is the hook's own. A command that only reads —
// grep, cat, git log — is never gated, whatever words it carries.
const IRREVERSIBLE = [
  ['restore', /(?:(?<![-/])\b|_)restore\b/i],
  ['reset', /(?<![-/])\breset\b/i],
  ['drop', /(?<![-/])\bdrop\b/i],
  ['truncate', /(?<![-/])\btruncate\b/i],
  ['seed', /(?<![-/])\bseed(?:ing|ed)?\b/i],
  ['migrate', /(?<![-/])\bmigrat\w*[:\s-]+(?:fresh|down|rollback|refresh|reset)\b|(?<![-/])\b(?:rollback|down)[:\s-]+migrat/i],
  ['delete', /\brm\s+-[a-z]*r[a-z]*f?\b|\bDELETE\s+FROM\b|\bkubectl\s+delete\b|\bgit\s+push\s+[^|]*--force\b/i],
  ['push', /\bgit\s+push\b/],
  ['deploy', /(?<![-/])\bdeploy\b/i],
  ['publish', /\bnpm\s+publish\b|(?<![-/])\bpublish\b/i],
  ['apply', /\bterraform\s+apply\b|\bkubectl\s+apply\b/i],
  ['send', /\b(sendmail|mail\s+-s|curl\s+[^|]*-X\s*POST)\b/],
];
const READS_ONLY = /^\s*(?:grep|rg|cat|head|tail|less|ls|find|wc|echo|printf|sed\s+-n|git\s+(?:log|diff|show|status|grep|blame|branch|ls-files))\b/;

function recentAuthorize(action) {
  try {
    const lines = fs.readFileSync(path.join(root, '.vibe', 'ledger.jsonl'), 'utf-8').trim().split('\n');
    const cutoff = Date.now() - 10 * 60 * 1000;
    return lines.some((line) => {
      try {
        const e = JSON.parse(line);
        return e.event === 'authorize' && String(e.detail || '').startsWith(`${action}:`) && new Date(e.at).getTime() >= cutoff;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

if (!['stop', 'session', 'pre'].includes(mode) && !fs.existsSync(path.join(root, '.vibe'))) process.exit(0);

function tokenPolicy() {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.vibe', 'config.json'), 'utf-8')).tokens || 'off';
  } catch {
    return 'off';
  }
}
const READ_ADVISE_LINES = Number(process.env.VIBE_READ_ADVISE_LINES || 400);

function countLines(file) {
  try {
    const text = fs.readFileSync(file, 'utf-8');
    return text.length === 0 ? 0 : text.replace(/\n$/, '').split('\n').length;
  } catch {
    return 0;
  }
}

function adviseRead(payload) {
  const file = String((payload.tool_input && payload.tool_input.file_path) || '');
  if (!file) return;
  const lines = countLines(path.resolve(root, file));
  if (lines <= READ_ADVISE_LINES) return;
  const shown = (path.isAbsolute(file) ? path.relative(root, file) || file : file).split(path.sep).join('/');
  emitContext(`[vibe] ${shown} is ${lines} lines — when it only has to be understood, not edited or debugged, \`vibe read ${shown} --ask "<question>"\` lets a low-reasoning model read it and returns the answer with line numbers`);
}

const cli = path.join(here, '..', 'dist', 'cli.js');

// Stop never resolves a PATH command or reads a transcript as instructions.
if (mode === 'stop') {
  const result = sessionRuntime.stopDecision(readPayload());
  // Status and failure details belong to explicit state/context requests, not the chat footer.
  const output = !personal && result.decision === 'block'
    ? { decision: 'block', reason: '[vibe] Work remains unverified. Run vibe state for the next step.' }
    : {};
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exit(0);
}
if (mode === 'session') {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: structuralSession(readPayload()) } })}\n`);
  process.exit(0);
}

if (mode === 'pre') {
  const payload = readPayload();
  if (payload.tool_name === 'Read') {
    if (fs.existsSync(path.join(root, '.vibe'))) adviseRead(payload);
    process.exit(0);
  }
  const command = String((payload.tool_input && payload.tool_input.command) || '');
  const cwd = payload.tool_input?.cwd ?? payload.tool_input?.workdir ?? payload.cwd ?? process.cwd();
  if (personal && tokenPolicy() === 'off') process.exit(0);
  const slice = personal ? { decision: 'allow' } : sliceRuntime.sliceGuard(root, command, sliceClient(), cwd);
  if (slice.decision === 'block') { process.stderr.write(`${slice.message}\n`); process.exit(2); }
  if (slice.decision === 'warn') emitContext(slice.message);
  if (!fs.existsSync(path.join(root, '.vibe'))) process.exit(0);
  // Every segment is judged — `echo x && git push`, `ls; rm -rf build`, `cat x | git push` carry the action in a later one
  // Vibe gates its own execution; its approval and inbox commands must remain reachable.
  const segments = command.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter((s) => s && !READS_ONLY.test(s) && !/^vibe(?:\s|$)/.test(s));
  // Under strict and irreversible the gate blocks (exit 2 stops the tool call in Claude Code); under off it only warns.
  for (const [action, re] of IRREVERSIBLE) {
    if (segments.some((s) => re.test(s)) && !recentAuthorize(action)) {
      const blocking = tokenPolicy() !== 'off';
      process.stderr.write(`[vibe] "${action}" is irreversible and no authorize record exists in the last 10 minutes — ${blocking ? 'blocked: ' : ''}get a human token with \`vibe ask --needs authorize:${action}\` and run \`vibe authorize\` first, as its own command: the gate reads the ledger before this command runs, so an authorize chained in front of the action is not seen\n`);
      process.exit(blocking ? 2 : 0);
    }
  }
  process.exit(0);
}

// Inside the npm package dist/cli.js sits next to us; inside a plugin tree it does not, so fall back to `vibe` on PATH.
const result = fs.existsSync(cli)
  ? spawnSync(process.execPath, [cli, 'state', '--json'], { cwd: root, encoding: 'utf-8', timeout: 15000 })
  : spawnSync('vibe', ['state', '--json'], { cwd: root, encoding: 'utf-8', timeout: 15000, shell: process.platform === 'win32' });
if (result.status !== 0 || !result.stdout) process.exit(0);
try {
  const view = JSON.parse(result.stdout);
  const notes = [...(view.notices || [])];
  if (view.inbox && view.inbox.open > 0) notes.push(`${view.inbox.open} inbox question(s) need an answer — \`vibe inbox\``);
  if (notes.length > 0) emitContext(`[vibe] ${notes.join(' · ')}`);
} catch {
  // stay quiet
}
process.exit(0);
