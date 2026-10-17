#!/usr/bin/env node
// UserPromptSubmit (`prompt`) and PostToolUse(Bash) (`tool`): one line in the session-knowledge journal, printing
// nothing. It reads the person's settings before loading anything else, so while session knowledge or its journal
// is off a prompt or a shell call costs only the start of node.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const kind = process.argv[2] === 'prompt' ? 'prompt' : 'tool';
const home = process.env.VIBE_HOME_DIR || os.homedir();

function journalOn() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(home, '.config', 'vibe', 'knowledge.json'), 'utf8'));
    return raw.auto === true && raw.journal !== false;
  } catch { return false; }
}

// As in notify.js: the plugin copy steps back when the npm install wrote its hooks into the client settings.
function npmOwns() {
  for (const file of [path.join(home, '.claude', 'settings.json'), path.join(home, '.codex', 'hooks.json')]) {
    try {
      const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Object.values(settings.hooks ?? {}).some(entries => entries.some(entry =>
        entry.hooks?.some(hook => hook.command?.replaceAll('\\', '/').includes('hooks/notify.js'))))) return true;
    } catch { /* no such file */ }
  }
  return false;
}

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch { /* no payload */ }
if (journalOn() && !(process.argv.includes('--plugin') && npmOwns())) {
  try {
    const payload = JSON.parse(input);
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) require('./knowledge-auto.cjs').observe(kind, payload, home);
  } catch { /* the work goes on without a journal line */ }
}
