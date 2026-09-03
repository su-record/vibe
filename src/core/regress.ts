import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { detectClient, detectModel } from './client.js';
import { usage } from './errors.js';
import { loadScenarios } from './intent.js';
import { record } from './ledger.js';
import { vibePath } from './paths.js';
import { parseScenarios, type Scenario } from './scenarios.js';
import { ensureDir, readJson, readText, writeAtomic } from './store.js';

/**
 * 회귀 — 고친 실패를 재현 검사로 남긴다. 다음 `check --all` 에 자동 편입된다.
 * 파일 하나 = 시나리오 하나. 원본 시나리오의 검사를 복사하되 id 는 `r-` 접두다.
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
  return text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'regression';
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
  if (!source) throw usage(`알 수 없는 시나리오: ${input.scenario}`);
  if (source.check.type === 'human') throw usage('human 시나리오는 회귀 검사가 될 수 없다 — 판정이 없다');
  if (!input.title.trim()) throw usage('--title 이 필요하다');
  const existing = listRegressions(root).length;
  const id = `r-${existing + 1}-${slug(input.title)}`;
  let tail = '';
  if (input.fromEvidence) {
    const evidence = readJson<{ results?: Array<{ id: string; tail?: string }> }>(vibePath(root, 'evidence', `${input.fromEvidence}.json`));
    tail = evidence?.results?.find((r) => r.id === input.scenario)?.tail ?? '';
  }
  const entry: Scenario = { id, then: `[회귀] ${input.title} — 원본 ${source.id}: ${source.then}`, check: source.check };
  if (source.given) entry.given = source.given;
  if (source.when) entry.when = source.when;
  const body = `# 회귀 검사 — ${input.title}\n# 원본 시나리오: ${source.id}${tail ? `\n# 당시 출력:\n${tail.split('\n').map((l) => `#   ${l}`).join('\n')}` : ''}\n${YAML.stringify([entry])}`;
  ensureDir(regressionsDir(root));
  const file = path.join(regressionsDir(root), `${id}.yaml`);
  writeAtomic(file, body);
  record(root, { event: 'regress', client: detectClient(), model: detectModel(), detail: id });
  return { id, file };
}
