#!/usr/bin/env node
/**
 * vibe for the Claude desktop app — an MCP Bundle server that is nothing but a cable to the
 * `vibe` CLI. Every tool runs `vibe <command> --json` in the project folder the user picked at
 * install time (VIBE_PROJECT_DIR) and returns the JSON. The verdict stays in the CLI; this
 * surface is for the interview, the approval, the judgement and the handoff — not for writing code.
 *
 * MCP over stdio is newline-delimited JSON-RPC 2.0. Three methods matter here: initialize,
 * tools/list, tools/call. No SDK: the protocol subset is small and the bundle stays dependency-free.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PROTOCOL = '2025-06-18';
const VERSION = process.env.VIBE_MCPB_VERSION || '0.0.0';
const project = process.env.VIBE_PROJECT_DIR || process.cwd();

const str = (description) => ({ type: 'string', description });
const TOOLS = [
  { name: 'vibe_state', description: 'Where the project is: state, stage, scenarios with last results, open inbox items, proposals. Call this first.', args: {}, cmd: () => ['state'] },
  { name: 'vibe_profile', description: 'Profile a sample table (csv · tsv · jsonl · json): rows, columns, types, missing values, duplicates, anomalies first.', args: { file: str('Path relative to the project folder') }, required: ['file'], cmd: (a) => ['profile', a.file] },
  { name: 'vibe_intent_draft', description: 'Save the intent (markdown) and scenarios (YAML list, each with a check). Rejected scenarios come back with reasons; nothing is saved then.', args: { intent: str('Intent markdown, English'), scenarios: str('scenarios.yaml text, English') }, required: ['intent', 'scenarios'], cmd: () => ['intent', 'draft', '--stdin'], stdin: (a) => JSON.stringify({ intent: a.intent, scenarios: a.scenarios }) },
  { name: 'vibe_intent_show', description: 'The current intent and its scenarios.', args: {}, cmd: () => ['intent', 'show'] },
  { name: 'vibe_approve', description: 'Approve the drafted intent. Pass the six-digit token when the project policy is strict; otherwise a plain approve is recorded as "by chat".', args: { token: str('Human token, optional') }, cmd: (a) => (a.token ? ['approve', a.token] : ['approve']) },
  { name: 'vibe_check', description: 'The verdict: the harness runs the checks itself. Give scenario ids, or all=true for every scenario and regression.', args: { ids: { type: 'array', items: { type: 'string' }, description: 'Scenario ids' }, all: { type: 'boolean', description: 'Run everything' } }, cmd: (a) => ['check', ...(a.ids || []), ...(a.all ? ['--all'] : [])] },
  { name: 'vibe_evidence', description: 'What a check run actually executed, per scenario.', args: { run: str('Run id such as r-3; latest when omitted') }, cmd: (a) => (a.run ? ['evidence', a.run] : ['evidence']) },
  { name: 'vibe_ask', description: 'Put a question to the human in the inbox; use needs for approval or an irreversible action to get a token issued.', args: { question: str('The question'), options: str('Options separated by |'), needs: str('approve or authorize:<action>'), target: str('What the token is bound to') }, required: ['question'], cmd: (a) => ['ask', a.question, ...(a.options ? ['--options', a.options] : []), ...(a.needs ? ['--needs', a.needs] : []), ...(a.target ? ['--target', a.target] : [])] },
  { name: 'vibe_inbox', description: 'Open inbox questions; answer one with id and answer.', args: { id: str('Question id to answer'), answer: str('The answer') }, cmd: (a) => (a.id ? ['inbox', 'answer', a.id, a.answer || ''] : ['inbox']) },
  { name: 'vibe_ledger', description: 'The ledger: runs, clients, models, results; or why <node> to walk typed edges.', args: { since: str('Window such as 7d'), why: str('A scenario id, regression id, file path, intent hash or run id') }, cmd: (a) => (a.why ? ['ledger', 'why', a.why] : ['ledger', ...(a.since ? ['--since', a.since] : [])]) },
  { name: 'vibe_research', description: 'Search GitHub and skill catalogs for what already exists — from the intent, or a query.', args: { query: str('Free query; omit to research from the intent') }, cmd: (a) => (a.query ? ['research', a.query] : ['research', '--from-intent']) },
  { name: 'vibe_skill_suggest', description: 'Skill proposals from signals in scenarios, regressions, inbox and state.', args: {}, cmd: () => ['skill', 'suggest'] },
];

/**
 * A desktop app does not inherit the shell's PATH (macOS launches it with /usr/bin:/bin), so the
 * CLI is looked up the way a person would: the path given at install, then PATH, then the usual
 * npm prefixes — Homebrew, nvm, fnm, volta, npm's own prefix, ~/.local/bin.
 */
function findVibe() {
  const given = process.env.VIBE_CLI && process.env.VIBE_CLI.trim();
  if (given && fs.existsSync(given)) return given;
  const home = os.homedir();
  const exe = process.platform === 'win32' ? 'vibe.cmd' : 'vibe';
  const dirs = [
    ...(process.env.PATH || '').split(path.delimiter),
    '/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local', 'bin'), path.join(home, '.npm-global', 'bin'), path.join(home, 'node_modules', '.bin'),
    path.join(home, '.volta', 'bin'), path.join(home, 'AppData', 'Roaming', 'npm'),
  ];
  for (const base of [path.join(home, '.nvm', 'versions', 'node'), path.join(home, '.fnm', 'node-versions'), path.join(home, 'Library', 'Application Support', 'fnm', 'node-versions')]) {
    try {
      for (const v of fs.readdirSync(base).sort().reverse()) dirs.push(path.join(base, v, 'bin'), path.join(base, v, 'installation', 'bin'));
    } catch {
      /* not this version manager */
    }
  }
  for (const dir of dirs) {
    const candidate = path.join(dir, exe);
    if (dir && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const VIBE = findVibe();

function runVibe(args, input) {
  if (!VIBE) return { isError: true, text: 'the vibe CLI was not found — install it with `npm i -g @su-record/vibe`, or set its path in the extension settings (vibe executable)' };
  const r = spawnSync(VIBE, [...args, '--json'], { cwd: project, encoding: 'utf-8', input, timeout: 600000, env: { ...process.env, VIBE_CLIENT: 'claude-app', PATH: `${path.dirname(VIBE)}${path.delimiter}${process.env.PATH || ''}` }, shell: process.platform === 'win32' });
  if (r.error) return { isError: true, text: `could not run ${VIBE}: ${r.error.message}` };
  const text = (r.stdout || '').trim() || (r.stderr || '').trim() || `exit ${r.status}`;
  return { isError: r.status !== 0, text };
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}
function fail(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

function handle(msg) {
  if (msg.id === undefined) return; // notification
  const { id, method, params = {} } = msg;
  if (method === 'initialize') {
    return respond(id, { protocolVersion: params.protocolVersion || PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'vibe', version: VERSION }, instructions: `vibe project: ${project}${fs.existsSync(`${project}/.vibe`) ? '' : ' (no .vibe yet — the first intent draft creates it)'} · CLI ${VIBE || 'not found — npm i -g @su-record/vibe'}. Start with vibe_state. Talk to the user in the user's language; write every record in English.` });
  }
  if (method === 'ping') return respond(id, {});
  if (method === 'tools/list') {
    return respond(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: { type: 'object', properties: t.args, ...(t.required ? { required: t.required } : {}) } })) });
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params.name);
    if (!tool) return fail(id, -32602, `unknown tool: ${params.name}`);
    const a = params.arguments || {};
    const r = runVibe(tool.cmd(a), tool.stdin ? tool.stdin(a) : undefined);
    return respond(id, { content: [{ type: 'text', text: r.text }], isError: r.isError });
  }
  return fail(id, -32601, `method not found: ${method}`);
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  try {
    handle(JSON.parse(line));
  } catch (error) {
    fail(null, -32700, `parse error: ${error.message}`);
  }
});
