#!/usr/bin/env node
/**
 * SessionStart hook for the marketplace plugins (Claude Code · Codex · ChatGPT desktop).
 *
 * A plugin cannot write the client's CLAUDE.md / AGENTS.md, so the always-on card is handed to
 * the model here as context instead, with one line about the `vibe` CLI the skills call (the
 * npm package that registered this plugin; never installed from here). If the client home already
 * carries the card, the plugin steps back: one card, one hook, never two. Always exits 0.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const client = process.argv[2] || 'claude';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const home = process.env.VIBE_HOME_DIR || os.homedir();
const CARD_START = '<!-- vibe:start -->';

function read(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
}

const version = (() => {
  try {
    return JSON.parse(read(path.join(root, 'package.json'))).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
const card = read(path.join(root, 'card.md')).trim();
const homeCard = client === 'claude' ? path.join(home, '.claude', 'CLAUDE.md') : path.join(home, '.codex', 'AGENTS.md');
if (read(homeCard).includes(CARD_START)) process.exit(0); // the npm install owns this client

function cliVersion() {
  const r = spawnSync('vibe', ['--version'], { encoding: 'utf-8', timeout: 10000, shell: process.platform === 'win32' });
  return r.status === 0 ? (r.stdout || '').trim() : null;
}

function newer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

const installed = cliVersion();
const cliNote = installed && !newer(version, installed)
  ? `vibe CLI ${installed} on PATH`
  : `vibe CLI ${installed ? `${installed} is older than this plugin (${version})` : 'is not on PATH'} — run: npm i -g @su-record/vibe@${version}`;

const text = `${card}\n\n[vibe plugin ${version}] ${cliNote}`;
process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } })}\n`);
process.exit(0);
