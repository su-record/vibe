import { spawnSync } from 'node:child_process';
import { hasTool } from '../core/capabilities.js';
import { usage } from '../core/errors.js';
import { blast, buildMap, callersOf, symbolsOf } from '../core/map/index.js';
import { formatBlast, formatCallers, formatMap, formatSymbols } from '../core/map/format.js';
import { flagString, type Flags, type Output } from './common.js';

/**
 * `vibe map`, `symbols`, `callers` and `blast` — Graft's symbol graph when it is on PATH (a
 * project convention, `capabilities.ts`), the regex map otherwise; the output always says which.
 */
function viaGraft(args: string[], root: string): Output | null {
  const r = spawnSync('graft', args, { cwd: root, encoding: 'utf-8', timeout: 30_000 });
  if (r.status !== 0) return null;
  const out = (r.stdout ?? '').trim();
  return { json: { tool: 'graft', out }, text: `(via graft)\n${out}`, code: 0 };
}

export function cmdMap(root: string, args: string[], flags: Flags): Output {
  const target = args[0] ?? '.';
  if (hasTool('graft', root)) {
    const viaTool = viaGraft(['map', target], root);
    if (viaTool) return viaTool;
  }
  const { map, refreshed } = buildMap(root, target);
  return { json: { map, refreshed }, text: `${formatMap(map)}\n(built-in — ${refreshed.length} file(s) refreshed)`, code: 0 };
}

export function cmdSymbols(root: string, args: string[]): Output {
  const file = args[0];
  if (!file) throw usage('symbols <file>');
  const symbols = symbolsOf(root, file);
  return { json: symbols, text: formatSymbols(file, symbols), code: 0 };
}

export function cmdCallers(root: string, args: string[], flags: Flags): Output {
  const symbol = args[0];
  if (!symbol) throw usage('callers <symbol> [--depth N]');
  const depth = Number(flagString(flags, 'depth') ?? 2);
  if (hasTool('graft', root)) {
    const viaTool = viaGraft(['callers', symbol, '--depth', String(depth)], root);
    if (viaTool) return viaTool;
  }
  const callers = callersOf(root, symbol, depth);
  return { json: callers, text: `${formatCallers(symbol, callers)}\n(built-in)`, code: 0 };
}

export function cmdBlast(root: string, args: string[], flags: Flags): Output {
  const target = args[0] ?? '.';
  const depth = Number(flagString(flags, 'depth') ?? 2);
  if (hasTool('graft', root)) {
    const viaTool = viaGraft(['blast', '--depth', String(depth)], root);
    if (viaTool) return viaTool;
  }
  const result = blast(root, depth, target);
  return { json: result, text: `${formatBlast(result)}\n(built-in)`, code: 0 };
}
