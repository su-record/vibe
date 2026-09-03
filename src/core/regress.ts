import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
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

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'regression';
}

export function listRegressions(root: string): Scenario[] {
  const dir = regressionsDir(root);
  if (!fs.existsSync(dir)) return [];
  const out: Scenario[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.yaml')) continue;
    const text = readText(path.join(dir, name));
    if (text === null) continue;
    out.push(...parseScenarios(text).scenarios);
  }
  return out;
}

export function recordRegression(root: string, input: RegressionRecordInput): { id: string; file: string } {
  const source = loadScenarios(root).find((s) => s.id === input.scenario);
  if (!source) throw usage(`unknown scenario: ${input.scenario}`);
  if (source.check.type === 'human') throw usage('a human scenario cannot become a regression check — it has no verdict');
  if (!input.title.trim()) throw usage('--title is required');
  const existing = listRegressions(root).length;
  const id = `r-${existing + 1}-${slug(input.title)}`;
  let tail = '';
  if (input.fromEvidence) {
    const evidence = readJson<{ results?: Array<{ id: string; tail?: string }> }>(vibePath(root, 'evidence', `${input.fromEvidence}.json`));
    tail = evidence?.results?.find((r) => r.id === input.scenario)?.tail ?? '';
  }
  const entry: Scenario = { id, then: `[regression] ${input.title} — source ${source.id}: ${source.then}`, check: source.check };
  if (source.given) entry.given = source.given;
  if (source.when) entry.when = source.when;
  const body = `# Regression check — ${input.title}\n# Source scenario: ${source.id}${tail ? `\n# Output at the time:\n${tail.split('\n').map((l) => `#   ${l}`).join('\n')}` : ''}\n${YAML.stringify([entry])}`;
  ensureDir(regressionsDir(root));
  const file = path.join(regressionsDir(root), `${id}.yaml`);
  writeAtomic(file, body);
  const edges: Edge[] = [{ type: 'caused', from: `regression:${id}`, to: `scenario:${source.id}` }];
  if (input.fromEvidence) edges.push({ type: 'caused', from: `regression:${id}`, to: `run:${input.fromEvidence}` });
  record(root, { event: 'regress', client: detectClient(), model: detectModel(), detail: id, edges });
  return { id, file };
}
