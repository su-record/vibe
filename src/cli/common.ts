import fs from 'node:fs';
import path from 'node:path';
import { usage } from '../core/errors.js';
import { packageRoot } from '../core/paths.js';
import { readJson } from '../core/store.js';

export type Flags = Record<string, string | boolean>;
export interface Parsed {
  positionals: string[];
  flags: Flags;
}
export interface Output {
  json: unknown;
  text: string;
  code: number;
}

const BOOLEAN_FLAGS = new Set(['json', 'all', 'stdin', 'purge-state', 'dry-run', 'yes', 'help', 'version']);

export function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (eq !== -1) {
      flags[key] = arg.slice(eq + 1);
    } else if (BOOLEAN_FLAGS.has(key) || i + 1 >= argv.length || (argv[i + 1] as string).startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = argv[i + 1] as string;
      i += 1;
    }
  }
  return { positionals, flags };
}

export function flagString(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

export const HELP = `vibe — an AX/FDE harness. The harness judges; a human approves.

  setup     update [--check] · status · tokens [strict|irreversible|off] · uninstall [--purge-state]   (card, skills and hook live in ~/.claude and ~/.codex;
            npm i -g puts them there and any vibe command repairs them; uninstall also clears what an older init left in the project)
            plugin build [--check] (manifests from package.json) · plugin mcpb [--out vibe.mcpb] (Claude desktop app bundle) · plugin install | status [--home <dir>]
  work      state [--graph] · read <file> [--sheet] [--pages] (xlsx·docx·pptx·pdf·hwp·hwpx·html·tables) · profile <file> [--sheet] (csv·tsv·jsonl·json·xlsx) · intent draft <intent.md> <scenarios.yaml> | --stdin · intent show
            approve [token] · check [id…] [--all] · evidence [run] · abandon --reason "…"
  checks    run (exit code) · file (exists·pattern·contains·schema·sum) · http (status·schema·maxMs) · eval (matching cases ≥ expect.pass) · human (inbox, no verdict)
            size [paths…] [--max-file 400] [--max-function 50]  — a built-in check for a scenario: exit 1 when a file or function is over
  human     ask "question" [--options "a|b"] [--default a] [--needs approve|authorize:<action>] [--target "…"]
            authorize <token> --action push|deploy|send|delete|spend [--target "…"] · inbox [list|answer <id> "text"|resolve <id>]
  memory    regress record --scenario <id> --title "…" [--check-from-evidence <run>] · regress list
            knowledge add <file|--stdin> --title "…"
  research  research --from-intent | "query" [--sources repos,code,skills] [--max 5]   (GitHub · skill catalogs · 24h cache)
  skills    skill suggest [--all] · skill create <name> --check run|file|http|eval [--from-scenario <id>]
            skill add owner/repo[@name] [--pin <sha>] [--yes] · skill search <keyword> · skill list
            skill used <name> · skill prune [--unused-runs 10] [--dry-run] · skill dismiss <ref>
  ledger    ledger [--since 7d] · ledger compare --by client|model|harness --metric checks|turns|cost [--min-runs 5] [--ledger <file>]
            ledger why <node> [--depth 3] · ledger edges [--type supersedes|decided-by|implements|caused]

A scenario may declare needs: [ids] — independent scenarios are checked in parallel, dependents after their parents pass.

Every command accepts --json. Exit codes: 0 ok · 1 verdict failed · 2 usage · 3 token · 4 invalid transition
`;
export function readStdin(): string {
  return fs.readFileSync(0, 'utf-8');
}

export function parseSince(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(\d+)([dhm])$/.exec(value);
  if (!match) throw usage('--since takes forms like 7d · 12h · 30m');
  const n = Number(match[1]);
  const unit = { d: 86_400_000, h: 3_600_000, m: 60_000 }[match[2] as 'd' | 'h' | 'm'];
  return n * unit;
}

export function packageVersion(): string {
  return readJson<{ version: string }>(path.join(packageRoot(), 'package.json'))?.version ?? 'unknown';
}
