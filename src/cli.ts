#!/usr/bin/env node
/**
 * vibe CLI — verdicts, records, tokens. Skills call this from the shell.
 * Every command accepts --json. The exit code is the verdict (errors.ts).
 * Commands live in cli/: setup · work · human · memory. This file only dispatches.
 */
import fs from 'node:fs';
import path from 'node:path';
import { usage, VibeError } from './core/errors.js';
import { findProjectRoot } from './core/paths.js';
import { ensureGlobal, globalStatus } from './install/global.js';
import { flagString, HELP, packageVersion, parseArgs, type Flags, type Output } from './cli/common.js';
import { cmdAsk, cmdAuthorize, cmdInbox } from './cli/human.js';
import { cmdKnowledge, cmdLedger, cmdRegress, cmdResearch, cmdSkill } from './cli/memory.js';
import { cmdPlugin, cmdStatus, cmdTokens, cmdUninstall, cmdUpdate } from './cli/setup.js';
import { cmdAbandon, cmdApprove, cmdCheck, cmdEvidence, cmdIntent, cmdProfile, cmdRead, cmdSize, cmdState } from './cli/work.js';

export { parseArgs } from './cli/common.js';

type Handler = (root: string, sub: string | undefined, rest: string[], tail: string[], flags: Flags) => Output | Promise<Output>;
const COMMANDS: Record<string, Handler> = {
  status: (root, _s, _r, _t, flags) => cmdStatus(root, flags),
  update: (_root, _s, _r, _t, flags) => cmdUpdate(flags),
  tokens: (root, sub) => cmdTokens(root, sub),
  uninstall: (root, _s, _r, _t, flags) => cmdUninstall(root, flags),
  plugin: (_root, sub, _r, _t, flags) => cmdPlugin(sub, flags),
  state: (root, _s, _r, _t, flags) => cmdState(root, flags),
  profile: (root, sub, _r, _t, flags) => cmdProfile(root, sub, flags),
  read: (root, sub, _r, _t, flags) => cmdRead(root, sub, flags),
  size: (root, _s, _r, tail, flags) => cmdSize(root, tail, flags),
  intent: (root, sub, rest, _t, flags) => cmdIntent(root, sub, rest, flags),
  approve: (root, _s, _r, tail) => cmdApprove(root, tail),
  check: (root, _s, _r, tail, flags) => cmdCheck(root, tail, flags),
  evidence: (root, _s, _r, tail) => cmdEvidence(root, tail),
  abandon: (root, _s, _r, _t, flags) => cmdAbandon(root, flags),
  ask: (root, _s, _r, tail, flags) => cmdAsk(root, tail, flags),
  authorize: (root, _s, _r, tail, flags) => cmdAuthorize(root, tail, flags),
  inbox: (root, sub, rest) => cmdInbox(root, sub, rest),
  regress: (root, sub, _r, _t, flags) => cmdRegress(root, sub, flags),
  knowledge: (root, sub, rest, _t, flags) => cmdKnowledge(root, sub, rest, flags),
  ledger: (root, sub, rest, _t, flags) => cmdLedger(root, sub, rest, flags),
  research: (root, sub, _r, _t, flags) => cmdResearch(root, sub, flags),
  skill: (root, sub, rest, _t, flags) => cmdSkill(root, sub, rest, flags),
};

export async function dispatch(argv: string[]): Promise<Output> {
  const { positionals, flags } = parseArgs(argv);
  const [cmd, sub, ...rest] = positionals;
  if (cmd === 'version' || flags['version'] === true) return { json: { version: packageVersion() }, text: packageVersion(), code: 0 };
  if (!cmd || flags['help'] === true) return { json: { help: HELP }, text: HELP, code: 0 };
  const handler = COMMANDS[cmd];
  if (!handler) throw usage(`unknown command: ${cmd}\n${HELP}`);
  const repaired = process.env['VIBE_SKIP_SETUP'] || cmd === 'uninstall' ? [] : ensureGlobal(flagString(flags, 'home'));
  if (repaired.length > 0) {
    const modes = globalStatus(flagString(flags, 'home')).clients;
    process.stderr.write(`[vibe] set up ${repaired.map((c) => `${c} (${modes[c]?.mode === 'plugin' ? `plugin ${modes[c]?.pluginVersion ?? ''}`.trim() : 'card, skills, hook in home'})`).join(', ')}\n`);
  }
  const root = cmd === 'plugin' ? process.cwd() : findProjectRoot();
  const tail = [sub, ...rest].filter((s): s is string => Boolean(s));
  return handler(root, sub, rest, tail, flags);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wantsJson = argv.includes('--json');
  try {
    const out = await dispatch(argv);
    process.stdout.write(wantsJson ? `${JSON.stringify(out.json, null, 2)}\n` : `${out.text}\n`);
    process.exitCode = out.code;
  } catch (error) {
    const code = error instanceof VibeError ? error.exitCode : 2;
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(wantsJson ? `${JSON.stringify({ error: message, code })}\n` : `vibe: ${message}\n`);
    process.exitCode = code;
  }
}

/** A global install runs this file through a `bin/vibe` symlink, so compare real paths, not argv as given. */
function invokedDirectly(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  const real = (p: string): string => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  return real(argv1) === real(new URL(import.meta.url).pathname);
}
if (invokedDirectly()) void main();

