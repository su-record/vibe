import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { actionOf } from './checks/mutation.js';
import { detectClient, detectModel } from './client.js';
import { usage } from './errors.js';
import { loadScenarios } from './intent.js';
import { record, type Edge } from './ledger.js';
import { vibePath } from './paths.js';
import { parseScenarios, type Scenario } from './scenarios.js';
import { ensureDir, readJson, readText, writeAtomic } from './store.js';

/**
 * Regressions — a fixed failure becomes a reproducing check that joins every `check --all`.
 * One file = one scenario. The original check is copied; the id gets an `r-` prefix.
 */
export function regressionsDir(root: string): string {
  return vibePath(root, 'regressions');
}

export interface RegressionRecordInput {
  scenario: string;
  title: string;
  fromEvidence?: string;
}

const ID_MAX = 40;

/** `r-<n>-<slug>` within the 40-character id rule — the slug gives way, the number never does. */
function regressionId(n: number, title: string): string {
  const prefix = `r-${n}-`;
  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const slug = words.slice(0, ID_MAX - prefix.length).replace(/-+$/g, '');
  return `${prefix}${slug || 'regression'}`.slice(0, ID_MAX).replace(/-+$/g, '');
}

function readRegressionFiles(root: string): Array<{ name: string; scenarios: Scenario[]; rejections: string[] }> {
  const dir = regressionsDir(root);
  if (!fs.existsSync(dir)) return [];
  const out: Array<{ name: string; scenarios: Scenario[]; rejections: string[] }> = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.yaml')) continue;
    const text = readText(path.join(dir, name));
    if (text === null) continue;
    const parsed = parseScenarios(text);
    out.push({ name, scenarios: parsed.scenarios, rejections: parsed.rejections.map((r) => `${r.id}: ${r.reason}`) });
  }
  return out;
}

export function listRegressions(root: string): Scenario[] {
  return readRegressionFiles(root).flatMap((f) => f.scenarios);
}

/** Regression files that parse to nothing — a silent gap in `check --all`, so the state view names them. */
export function regressionProblems(root: string): string[] {
  return readRegressionFiles(root).filter((f) => f.rejections.length > 0).map((f) => `regressions/${f.name} is not checked — ${f.rejections.join('; ')}`);
}

export function recordRegression(root: string, input: RegressionRecordInput): { id: string; file: string } {
  const source = loadScenarios(root).find((s) => s.id === input.scenario);
  if (!source) throw usage(`unknown scenario: ${input.scenario}`);
  if (source.check.type === 'human') throw usage('a human scenario cannot become a regression check — it has no verdict');
  if (source.irreversible) throw usage(`a regression must observe — ${source.id} mutates (${actionOf(source.irreversible)}); write a check that reproduces the failure without changing state`);
  if (!input.title.trim()) throw usage('--title is required');
  const existing = readRegressionFiles(root).length;
  const id = regressionId(existing + 1, input.title);
  let tail = '';
  if (input.fromEvidence) {
    const evidence = readJson<{ results?: Array<{ id: string; failureCode?: string }> }>(vibePath(root, 'evidence', `${input.fromEvidence}.json`));
    tail = evidence?.results?.find((r) => r.id === input.scenario)?.failureCode ?? '';
  }
  const entry: Scenario = { id, then: `[regression] ${input.title} — source ${source.id}: ${source.then}`, check: source.check };
  if (source.given) entry.given = source.given;
  if (source.when) entry.when = source.when;
  const body = `# Regression check — ${input.title}\n# Source scenario: ${source.id}${tail ? `\n# Output at the time:\n${tail.split('\n').map((l) => `#   ${l}`).join('\n')}` : ''}\n${YAML.stringify([entry])}`;
  ensureDir(regressionsDir(root));
  const file = path.join(regressionsDir(root), `${id}.yaml`);
  const parsed = parseScenarios(body);
  if (parsed.scenarios.length !== 1) throw usage(`the regression would not parse: ${parsed.rejections.map((r) => r.reason).join('; ')}`);
  writeAtomic(file, body);
  const edges: Edge[] = [{ type: 'caused', from: `regression:${id}`, to: `scenario:${source.id}` }];
  if (input.fromEvidence) edges.push({ type: 'caused', from: `regression:${id}`, to: `run:${input.fromEvidence}` });
  record(root, { event: 'regress', client: detectClient(), model: detectModel(), detail: id, edges });
  return { id, file };
}
