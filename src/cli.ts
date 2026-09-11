#!/usr/bin/env node
/**
 * vibe CLI — verdicts, records, tokens. Skills call this from the shell.
 * Every command accepts --json. The exit code is the verdict (errors.ts).
 * Commands live in cli/: setup · work · human · memory. This file only dispatches.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usage, VibeError } from './core/errors.js';
import { findProjectRoot } from './core/paths.js';
import { safeText } from './core/evidence.js';
import { flagString, HELP, INTERNAL_HELP, packageVersion, parseArgs, type Flags, type Output } from './cli/common.js';

export { parseArgs } from './cli/common.js';

type Handler = (root: string, sub: string | undefined, rest: string[], tail: string[], flags: Flags) => Output | Promise<Output>;
const COMMANDS: Record<string, Handler> = {
  internal: async (root, sub, rest) => sub === 'risks' ? (await import('./cli/risks.js')).cmdRisks(root) : sub === 'performance'
    ? (await import('./cli/performance.js')).cmdPerformance(root, rest)
    : (await import('./cli/internal.js')).cmdInternal(root, sub, rest),
  status: async (root, _s, _r, _t, flags) => (await import('./cli/setup.js')).cmdStatus(root, flags),
  setup: async (_root, _s, _r, _t, flags) => (await import('./cli/setup.js')).cmdSetup(flags),
  update: async (_root, _s, _r, _t, flags) => (await import('./cli/setup.js')).cmdUpdate(flags),
  tokens: async (root, sub) => (await import('./cli/setup.js')).cmdTokens(root, sub),
  uninstall: async (root, _s, _r, _t, flags) => (await import('./cli/setup.js')).cmdUninstall(root, flags),
  plugin: async (_root, sub, _r, _t, flags) => (await import('./cli/setup.js')).cmdPlugin(sub, flags),
  state: async (root, _s, _r, _t, flags) => (await import('./cli/work.js')).cmdState(root, flags),
  session: async (root, sub, _r, _t, flags) => (await import('./cli/session.js')).cmdSession(root, sub, flags),
  profile: async (root, sub, _r, _t, flags) => (await import('./cli/work.js')).cmdProfile(root, sub, flags),
  read: async (root, _s, _r, tail, flags) => (await import('./cli/work.js')).cmdRead(root, tail, flags),
  size: async (root, _s, _r, tail, flags) => (await import('./cli/work.js')).cmdSize(root, tail, flags),
  map: async (root, _s, _r, tail, flags) => (await import('./cli/map.js')).cmdMap(root, tail, flags),
  symbols: async (root, _s, _r, tail) => (await import('./cli/map.js')).cmdSymbols(root, tail),
  callers: async (root, _s, _r, tail, flags) => (await import('./cli/map.js')).cmdCallers(root, tail, flags),
  blast: async (root, _s, _r, tail, flags) => (await import('./cli/map.js')).cmdBlast(root, tail, flags),
  context: async (root, _s, _r, tail, flags) => (await import('./cli/context.js')).cmdContext(root, tail, flags),
  conventions: async (root, _s, _r, _t, flags) => (await import('./cli/conventions.js')).cmdConventions(root, flags),
  intent: async (root, sub, rest, _t, flags) => (await import('./cli/work.js')).cmdIntent(root, sub, rest, flags),
  approve: async (root, _s, _r, tail, flags) => (await import('./cli/work.js')).cmdApprove(root, tail, flags),
  check: async (root, _s, _r, tail, flags) => (await import('./cli/work.js')).cmdCheck(root, tail, flags),
  evidence: async (root, _s, _r, tail) => (await import('./cli/work.js')).cmdEvidence(root, tail),
  abandon: async (root, _s, _r, _t, flags) => (await import('./cli/work.js')).cmdAbandon(root, flags),
  reopen: async (root, _s, _r, tail, flags) => (await import('./cli/work.js')).cmdReopen(root, tail, flags),
  ask: async (root, _s, _r, tail, flags) => (await import('./cli/human.js')).cmdAsk(root, tail, flags),
  authorize: async (root, _s, _r, tail, flags) => (await import('./cli/human.js')).cmdAuthorize(root, tail, flags),
  inbox: async (root, sub, rest) => (await import('./cli/human.js')).cmdInbox(root, sub, rest),
  regress: async (root, sub, _r, _t, flags) => (await import('./cli/memory.js')).cmdRegress(root, sub, flags),
  knowledge: async (root, sub, rest, _t, flags) => (await import('./cli/memory.js')).cmdKnowledge(root, sub, rest, flags),
  ledger: async (root, sub, rest, _t, flags) => (await import('./cli/memory.js')).cmdLedger(root, sub, rest, flags),
  research: async (root, sub, _r, _t, flags) => (await import('./cli/memory.js')).cmdResearch(root, sub, flags),
  skill: async (root, sub, rest, _t, flags) => (await import('./cli/memory.js')).cmdSkill(root, sub, rest, flags),
};

const REPAIRS = new Set(['update', 'plugin']); // `setup` is the repair itself

async function repairInstall(flags: Flags): Promise<void> {
  const { ensureGlobal, globalStatus } = await import('./install/global.js');
  const home = flagString(flags, 'home');
  const repaired = ensureGlobal(home);
  if (repaired.length === 0) return;
  const modes = globalStatus(home).clients;
  process.stderr.write(`[vibe] set up ${repaired.map((c) => `${c} (${modes[c]?.mode === 'plugin' ? `plugin ${modes[c]?.pluginVersion ?? ''}`.trim() : 'card, skills, hook in home'})`).join(', ')}\n`);
}

export async function dispatch(argv: string[]): Promise<Output> {
  const { positionals, flags } = parseArgs(argv);
  const [cmd, sub, ...rest] = positionals;
  if (cmd === 'version' || flags['version'] === true) return { json: { version: packageVersion() }, text: packageVersion(), code: 0 };
  if (flags['help-internal'] === true) return { json: { help: INTERNAL_HELP }, text: INTERNAL_HELP, code: 0 };
  if (!cmd || flags['help'] === true) return { json: { help: HELP }, text: HELP, code: 0 };
  const handler = COMMANDS[cmd];
  if (!handler) throw usage(`unknown command: ${cmd}\n${HELP}`);
  // A command does only what it says: the install is repaired by `setup`, `update` and `plugin`, never on the way to a query
  if (REPAIRS.has(cmd) && !process.env['VIBE_SKIP_SETUP']) await repairInstall(flags);
  const root = cmd === 'plugin' || cmd === 'session' ? process.cwd() : findProjectRoot();
  const tail = [sub, ...rest].filter((s): s is string => Boolean(s));
  return handler(root, sub, rest, tail, flags);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wantsJson = argv.includes('--json');
  try {
    const out = await dispatch(argv);
    process.stdout.write(wantsJson ? `${JSON.stringify(out.json, null, 2)}\n` : `${safeText(out.text, 200_000)}\n`);
    process.exitCode = out.code;
  } catch (error) {
    const code = error instanceof VibeError ? error.exitCode : 2;
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(wantsJson ? `${JSON.stringify({ error: message, code })}\n` : `vibe: ${safeText(message)}\n`);
    process.exitCode = code;
  }
}

/**
 * A global install runs this file through a `bin/vibe` symlink or npm's `.cmd` shim, so compare
 * real paths, not argv as given. The file's own path comes from `fileURLToPath`, which turns a
 * `file:` URL into a native path on every platform (`/C:/…` from `URL.pathname` never matched on Windows).
 */
export function sameFile(argv1: string | undefined, moduleUrl: string): boolean {
  if (!argv1) return false;
  const real = (p: string): string => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  return real(argv1) === real(fileURLToPath(moduleUrl));
}
if (sameFile(process.argv[1], import.meta.url)) void main();
