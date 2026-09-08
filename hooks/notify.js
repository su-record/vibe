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
const cli = path.join(here, '..', 'dist', 'cli.js');
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

const IRREVERSIBLE = [
  ['push', /\bgit\s+push\b/],
  ['deploy', /\b(vercel|netlify|fly|wrangler|gcloud|aws)\s+(deploy|apply|publish)\b|\bnpm\s+publish\b|\bkubectl\s+apply\b|\bterraform\s+apply\b/],
  ['send', /\b(sendmail|mail\s+-s|curl\s+[^|]*-X\s*POST)\b/],
  ['delete', /\brm\s+-rf\b|\bgit\s+push\s+[^|]*--force\b|\bDROP\s+TABLE\b/i],
];

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
    return JSON.parse(fs.readFileSync(path.join(root, '.vibe', 'config.json'), 'utf-8')).tokens || 'irreversible';
  } catch {
    return 'irreversible';
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

if (mode === 'pre') {
  const payload = readPayload();
  if (payload.tool_name === 'Read') {
    adviseRead(payload);
    process.exit(0);
  }
  const command = String((payload.tool_input && payload.tool_input.command) || '');
  // Under strict and irreversible the gate blocks (exit 2 stops the tool call in Claude Code); under off it only warns.
  for (const [action, re] of IRREVERSIBLE) {
    if (re.test(command) && !recentAuthorize(action)) {
      const blocking = tokenPolicy() !== 'off';
      process.stderr.write(`[vibe] "${action}" is irreversible and no authorize record exists in the last 10 minutes — ${blocking ? 'blocked: ' : ''}get a human token with \`vibe ask --needs authorize:${action}\` and run \`vibe authorize\` first\n`);
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
