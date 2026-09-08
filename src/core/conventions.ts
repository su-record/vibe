import fs from 'node:fs';
import path from 'node:path';
import { readLedger } from './ledger.js';
import { vibePath } from './paths.js';
import { listRegressions } from './regress.js';
import { ensureDir, readJson, readText, writeAtomic } from './store.js';

/**
 * Conventions — learned, not typed. `readConventions` names what the repository already declares;
 * `learnConventions` names what the ledger showed the harness. `updateConventions` is the only
 * writer of `.vibe/knowledge/conventions.md`, and it only ever appends a line it has not seen.
 */
export interface ConventionLine {
  text: string;
  source: string;
}

const LINT_FILES = ['.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yml', '.eslintrc.yaml', '.eslintrc', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'];
const FORMAT_FILES = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.yml', '.prettierrc.yaml', 'prettier.config.js', 'biome.json', '.editorconfig', 'rustfmt.toml', '.golangci.yml', '.golangci.yaml'];
const TS_FLAGS = ['strict', 'noUncheckedIndexedAccess', 'noImplicitReturns', 'noFallthroughCasesInSwitch', 'exactOptionalPropertyTypes'];

function existingFiles(root: string, names: string[]): string[] {
  return names.filter((n) => fs.existsSync(path.join(root, n)));
}

function lintLines(root: string): ConventionLine[] {
  const out: ConventionLine[] = [];
  for (const f of existingFiles(root, LINT_FILES)) out.push({ text: `lint config present (${f})`, source: f });
  for (const f of existingFiles(root, FORMAT_FILES)) out.push({ text: `formatter config present (${f})`, source: f });
  if (fs.existsSync(path.join(root, 'ruff.toml'))) out.push({ text: 'Python lint config present (ruff.toml)', source: 'ruff.toml' });
  const pyproject = readText(path.join(root, 'pyproject.toml'));
  if (pyproject && /\[tool\.(ruff|black)\]/.test(pyproject)) out.push({ text: 'Python lint/format config in pyproject.toml ([tool.ruff]/[tool.black])', source: 'pyproject.toml' });
  return out;
}

function tsconfigLines(root: string): ConventionLine[] {
  const raw = readJson<{ compilerOptions?: Record<string, unknown> }>(path.join(root, 'tsconfig.json'));
  const options = raw?.compilerOptions;
  if (!options) return [];
  const on = TS_FLAGS.filter((f) => options[f] === true);
  return on.length ? [{ text: `tsconfig strict flags: ${on.join(', ')}`, source: 'tsconfig.json' }] : [];
}

function projectFileLines(root: string): ConventionLine[] {
  const out: ConventionLine[] = [];
  const pyproject = readText(path.join(root, 'pyproject.toml'));
  if (pyproject) {
    const version = /^version\s*=\s*"([^"]+)"/m.exec(pyproject)?.[1];
    out.push({ text: `Python project (pyproject.toml)${version ? ` version ${version}` : ''}`, source: 'pyproject.toml' });
  }
  const goMod = readText(path.join(root, 'go.mod'));
  if (goMod) {
    const mod = /^module\s+(\S+)/m.exec(goMod)?.[1] ?? '(unnamed)';
    const goVersion = /^go\s+(\S+)/m.exec(goMod)?.[1];
    out.push({ text: `Go module ${mod}${goVersion ? ` (go ${goVersion})` : ''}`, source: 'go.mod' });
  }
  const cargo = readText(path.join(root, 'Cargo.toml'));
  if (cargo) {
    const name = /^name\s*=\s*"([^"]+)"/m.exec(cargo)?.[1] ?? '(unnamed)';
    const version = /^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
    out.push({ text: `Rust crate ${name}${version ? ` ${version}` : ''}`, source: 'Cargo.toml' });
  }
  return out;
}

function scriptLines(root: string): ConventionLine[] {
  const pkg = readJson<{ scripts?: Record<string, string> }>(path.join(root, 'package.json'));
  const scripts = pkg?.scripts ?? {};
  const out: ConventionLine[] = [];
  for (const key of ['test', 'lint', 'build']) {
    const cmd = scripts[key];
    if (cmd) out.push({ text: `package.json script ${key}: "${cmd}"`, source: 'package.json' });
  }
  return out;
}

function headingLines(root: string): ConventionLine[] {
  const out: ConventionLine[] = [];
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const text = readText(path.join(root, name));
    const heading = text?.split('\n').find((l) => l.trim().startsWith('#'));
    if (heading) out.push({ text: `${name}: ${heading.replace(/^#+\s*/, '').trim()}`, source: name });
  }
  return out;
}

/** What the repository declares, one line per finding, each with the file it came from. */
export function readConventions(root: string): ConventionLine[] {
  return [...lintLines(root), ...tsconfigLines(root), ...projectFileLines(root), ...scriptLines(root), ...headingLines(root)];
}

interface EvidenceResult {
  id: string;
  tail?: string;
}
interface Evidence {
  results?: EvidenceResult[];
}

const REJECT_ITEM_RE = /^[^|]+\|[^|]+\|[^|]+\|[^|]+$/;
const KEEP_RE = /^KEEP\s*\|/;

/** Every reviewer line across every `check` run's evidence, grouped by exact text, with the runs that said it. */
function reviewLines(root: string): Map<string, { kind: 'reject' | 'keep'; runs: Set<string> }> {
  const byLine = new Map<string, { kind: 'reject' | 'keep'; runs: Set<string> }>();
  for (const e of readLedger(root)) {
    if (e.event !== 'check' || !e.run) continue;
    const evidence = readJson<Evidence>(vibePath(root, 'evidence', `${e.run}.json`));
    for (const r of evidence?.results ?? []) {
      for (const raw of (r.tail ?? '').split('\n')) {
        const line = raw.trim();
        const kind = KEEP_RE.test(line) ? 'keep' : REJECT_ITEM_RE.test(line) && line !== 'REJECT' ? 'reject' : null;
        if (!kind) continue;
        const entry = byLine.get(line) ?? { kind, runs: new Set<string>() };
        entry.runs.add(e.run);
        byLine.set(line, entry);
      }
    }
  }
  return byLine;
}

/** A REJECT reason or a KEEP line that recurs across two or more `check` runs — the review is telling us something twice. */
function recurringReviewLines(root: string): ConventionLine[] {
  const out: ConventionLine[] = [];
  for (const [line, { kind, runs }] of reviewLines(root)) {
    if (runs.size < 2) continue;
    const label = kind === 'keep' ? 'KEEP line' : 'REJECT reason';
    out.push({ text: `recurring ${label}: ${line}`, source: `check ${[...runs].sort().join(', ')}` });
  }
  return out;
}

function regressionLines(root: string): ConventionLine[] {
  return listRegressions(root).map((r) => {
    const title = /^\[regression\]\s*(.+?)\s*—\s*source/.exec(r.then)?.[1] ?? r.then;
    return { text: `regression: ${title}`, source: `.vibe/regressions/${r.id}.yaml` };
  });
}

function decisionLines(root: string): ConventionLine[] {
  return readLedger(root)
    .filter((e) => e.event === 'approve')
    .map((e) => ({ text: `decided: ${e.detail ?? ''}`, source: `ledger:approve ${e.at}` }));
}

/** What the ledger showed: recurring review findings, every regression, every approval decided. */
export function learnConventions(root: string): ConventionLine[] {
  return [...recurringReviewLines(root), ...regressionLines(root), ...decisionLines(root)];
}

export function conventionsPath(root: string): string {
  return vibePath(root, 'knowledge', 'conventions.md');
}

function formatLine(l: ConventionLine): string {
  return `- ${l.text} — source: ${l.source}`;
}

/** Append-only: a line already present, byte for byte, is never written twice. */
export function updateConventions(root: string): { added: string[]; total: number } {
  const lines = [...new Set([...readConventions(root), ...learnConventions(root)].map(formatLine))];
  const file = conventionsPath(root);
  const existingText = readText(file);
  const existingLines = new Set((existingText ?? '').split('\n').map((l) => l.trim()).filter(Boolean));
  const added = lines.filter((l) => !existingLines.has(l));
  if (added.length > 0) {
    ensureDir(path.dirname(file));
    const prefix = existingText && existingText.trim() ? `${existingText.trimEnd()}\n` : '';
    writeAtomic(file, `${prefix}${added.join('\n')}\n`);
  }
  return { added, total: existingLines.size + added.length };
}
