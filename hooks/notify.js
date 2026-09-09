#!/usr/bin/env node
/**
 * Notification hook — it never judges the work; it gates one thing: an irreversible command without a token.
 *
 *   post  PostToolUse(Edit|Write): runs `vibe state --json` and tells the model about a voided DONE or open inbox items.
 *   pre   PreToolUse(Bash): an irreversible command with no recent authorize record is blocked (exit 2) under the
 *         strict and irreversible token policies, and only warned about under off.
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

const mode = process.argv[2] || 'post';
const asPlugin = process.argv.includes('--plugin');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// Plugin copy and npm copy must not both fire. The npm install writes a notify hook into the
// client's home settings; when that exists, the plugin's hook steps back.
if (asPlugin) {
  const home = process.env.VIBE_HOME_DIR || os.homedir();
  for (const file of [path.join(home, '.claude', 'settings.json'), path.join(home, '.codex', 'hooks.json')]) {
    try {
      if (fs.readFileSync(file, 'utf-8').includes('hooks/notify.js')) process.exit(0);
    } catch {
      /* no such file — keep going */
    }
  }
}

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch {
    return {};
  }
}

function emitContext(text) {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: mode === 'post' ? 'PostToolUse' : 'PreToolUse', additionalContext: text } })}\n`);
}

// The same actions the check gate names (src/core/checks/mutation.ts), so a blocked tool call and a blocked
// check ask for the same `vibe authorize --action`; `send` is the hook's own. A command that only reads —
// grep, cat, git log — is never gated, whatever words it carries.
const IRREVERSIBLE = [
  ['restore', /(?:\b|_)restore\b/i],
  ['reset', /\breset\b/i],
  ['drop', /\bdrop\b/i],
  ['truncate', /\btruncate\b/i],
  ['seed', /\bseed(?:ing|ed)?\b/i],
  ['migrate', /\bmigrat\w*[:\s-]+(?:fresh|down|rollback|refresh|reset)\b|\b(?:rollback|down)[:\s-]+migrat/i],
  ['delete', /\brm\s+-[a-z]*r[a-z]*f?\b|\bDELETE\s+FROM\b|\bkubectl\s+delete\b|\bgit\s+push\s+[^|]*--force\b/i],
  ['push', /\bgit\s+push\b/],
  ['deploy', /\bdeploy\b/i],
  ['publish', /\bnpm\s+publish\b|\bpublish\b/i],
  ['apply', /\bterraform\s+apply\b|\bkubectl\s+apply\b/i],
  ['send', /\b(sendmail|mail\s+-s|curl\s+[^|]*-X\s*POST)\b/],
];
const READS_ONLY = /^\s*(?:grep|rg|cat|head|tail|less|ls|find|wc|echo|printf|sed\s+-n|git\s+(?:log|diff|show|status|grep|blame|branch|ls-files)|vibe\s+(?:state|context|map|read|check|ledger))\b/;

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

if (!fs.existsSync(path.join(root, '.vibe'))) process.exit(0);

function tokenPolicy() {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.vibe', 'config.json'), 'utf-8')).tokens || 'off';
  } catch {
    return 'off';
  }
}
function tokensOff() {
  return tokenPolicy() === 'off';
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
const vibeCommand = fs.existsSync(cli) ? [process.execPath, cli] : ['vibe'];

/** The model's last message, when it claims completion: done, complete, finished, passed, ready, all checks. Read from the
 * transcript the client names (Claude Code and Codex both pass `transcript_path`); null when there is no such claim. */
function completionClaim(transcriptPath) {
  if (!transcriptPath) return null;
  let text = '';
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n');
    for (let i = lines.length - 1; i >= 0 && !text; i -= 1) {
      let m;
      try {
        m = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      const msg = m.type === 'assistant' ? m.message : m.payload && m.payload.type === 'message' && m.payload.role === 'assistant' ? m.payload : null;
      if (!msg) continue;
      for (const c of msg.content || []) if (typeof c.text === 'string') text += c.text;
    }
  } catch {
    return null;
  }
  const m = /[^.\n]*\b(done|complete[d]?|finished|passed|ready|all checks? pass(?:ed)?|everything passes)\b[^.\n]*/i.exec(text);
  return m ? m[0].trim().slice(0, 120) : null;
}

/** Stop: the model is ending its turn. With an approved intent still building, the verdict runs here — once — and its
 * report comes back as the reason the turn is not over; a turn already continued this way is let go (no loop). */
function onStop(payload) {
  if (payload.stop_hook_active) process.exit(0);
  if (!fs.existsSync(path.join(root, '.vibe', 'state.json'))) process.exit(0);
  // `vibe state` rather than the file: an edit after DONE is RUNNING again, and only the CLI knows that
  const s = spawnSync(vibeCommand[0], [...vibeCommand.slice(1), 'state', '--json'], { cwd: root, encoding: 'utf-8', timeout: 20000, shell: vibeCommand.length === 1 && process.platform === 'win32', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
  let state;
  try {
    state = JSON.parse(s.stdout).state;
  } catch {
    process.exit(0);
  }
  if (state !== 'APPROVED' && state !== 'RUNNING') process.exit(0);
  const claim = completionClaim(payload.transcript_path);
  const r = spawnSync(vibeCommand[0], [...vibeCommand.slice(1), 'check', '--all'], { cwd: root, encoding: 'utf-8', timeout: 600000, shell: vibeCommand.length === 1 && process.platform === 'win32', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
  const report = (r.stdout || '').trim();
  if (!report) process.exit(0);
  const done = /\bDONE — every gate scenario passed\b/.test(report);
  const audit = claim && !done ? `unverified: "${claim}" — vibe check says otherwise (below). ` : '';
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason: `[vibe] ${audit}the turn ended without vibe check; it ran now:\n${report}\n${done ? 'Report from this output — no further commands.' : 'Fix what failed, then vibe check <id>; do not say done.'}` })}\n`);
  process.exit(0);
}

/** SessionStart in home/project mode: the card is in CLAUDE.md already; the project's `vibe state` is handed over here,
 * the model's first command already run — the plugin's session.js does the same for the plugin mode. */
if (mode === 'session') {
  readPayload();
  if (!fs.existsSync(path.join(root, '.vibe', 'state.json'))) process.exit(0);
  const s = spawnSync(vibeCommand[0], [...vibeCommand.slice(1), 'state'], { cwd: root, encoding: 'utf-8', timeout: 60000, shell: vibeCommand.length === 1 && process.platform === 'win32', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
  if (s.status === 0 && s.stdout) process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `[vibe state — this is the first command already run; continue from its next line]\n${s.stdout.trim()}` } })}\n`);
  process.exit(0);
}

if (mode === 'stop') {
  onStop(readPayload());
}

if (mode === 'pre') {
  const payload = readPayload();
  if (payload.tool_name === 'Read') {
    adviseRead(payload);
    process.exit(0);
  }
  const command = String((payload.tool_input && payload.tool_input.command) || '');
  // Every segment is judged — `echo x && git push`, `ls; rm -rf build`, `cat x | git push` carry the action in a later one
  const segments = command.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter((s) => s && !READS_ONLY.test(s));
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
