import YAML from 'yaml';

export type CheckType = 'run' | 'file' | 'http' | 'eval' | 'human';

export interface RunCheck {
  type: 'run';
  cmd: string;
  expect?: number;
  timeoutMs?: number;
  cwd?: string;
}
export interface FileCheck {
  type: 'file';
  path: string;
  exists?: boolean;
  pattern?: string;
  contains?: string;
  schema?: string;
  /** Column total of a CSV/TSV/JSONL/JSON table equals a reference value (± tolerance). */
  sum?: { column: string; equals: number; tolerance?: number };
}
export interface HttpCheck {
  type: 'http';
  url: string;
  method?: string;
  expect?: { status?: number; schema?: string; maxMs?: number };
  timeoutMs?: number;
}
export interface EvalCheck {
  type: 'eval';
  cases: string;
  runner: string;
  expect: { pass: number };
  timeoutMs?: number;
}
export interface HumanCheck {
  type: 'human';
  question: string;
}
export type Check = RunCheck | FileCheck | HttpCheck | EvalCheck | HumanCheck;

export interface Scenario {
  id: string;
  given?: string;
  when?: string;
  then: string;
  check: Check;
  irreversible?: string;
  /** DEPENDS_ON edges — this scenario is checked only after every listed scenario has passed. */
  needs?: string[];
}

export interface Rejection {
  id: string;
  reason: string;
}

export interface ParsedScenarios {
  scenarios: Scenario[];
  rejections: Rejection[];
}

const CHECK_TYPES: ReadonlySet<string> = new Set(['run', 'file', 'http', 'eval', 'human']);
const ID_RE = /^[a-z][a-z0-9-]{0,39}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function strList(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string' || !item.trim()) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/**
 * Checkability — a scenario is stored only when bound to exactly one check type.
 * Prose that cannot be checked is not part of the contract (principle ①).
 */
function checkReason(check: unknown): string | null {
  if (!isRecord(check)) return 'missing check — one check type (run·file·http·eval·human) is required';
  const type = check['type'];
  if (typeof type !== 'string' || !CHECK_TYPES.has(type)) return `unknown check type: ${String(type)}`;
  switch (type) {
    case 'run':
      return str(check['cmd']) ? null : 'run check requires cmd';
    case 'file': {
      if (!str(check['path'])) return 'file check requires path';
      const sum = check['sum'];
      if (sum !== undefined && !(isRecord(sum) && str(sum['column']) && typeof sum['equals'] === 'number')) return 'file sum requires column and equals (a number)';
      const hasRule = check['exists'] !== undefined || str(check['pattern']) || str(check['contains']) || str(check['schema']) || sum !== undefined;
      return hasRule ? null : 'file check requires one of exists·pattern·contains·schema·sum';
    }
    case 'http':
      return str(check['url']) ? null : 'http check requires url';
    case 'eval': {
      if (!str(check['cases']) || !str(check['runner'])) return 'eval check requires cases and runner';
      const expect = check['expect'];
      return isRecord(expect) && Number.isInteger(expect['pass']) ? null : 'eval check requires expect.pass (a count)';
    }
    case 'human':
      return str(check['question']) ? null : 'human check requires question';
    default:
      return null;
  }
}

export function parseScenarios(text: string): ParsedScenarios {
  let raw: unknown;
  try {
    raw = YAML.parse(text);
  } catch (error) {
    return { scenarios: [], rejections: [{ id: '(yaml)', reason: `YAML parse failed: ${(error as Error).message}` }] };
  }
  if (!Array.isArray(raw)) return { scenarios: [], rejections: [{ id: '(root)', reason: 'top level must be a list of scenarios' }] };

  const scenarios: Scenario[] = [];
  const rejections: Rejection[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    const label = isRecord(item) && typeof item['id'] === 'string' ? item['id'] : `#${index + 1}`;
    if (!isRecord(item)) return void rejections.push({ id: label, reason: 'item is not an object' });
    const id = str(item['id']);
    if (!id || !ID_RE.test(id)) return void rejections.push({ id: label, reason: 'id must be 1-40 chars of lowercase letters, digits, hyphens' });
    if (seen.has(id)) return void rejections.push({ id, reason: 'duplicate id' });
    const then = str(item['then']);
    if (!then) return void rejections.push({ id, reason: 'then (the success statement) is required' });
    const reason = checkReason(item['check']);
    if (reason) return void rejections.push({ id, reason });
    const needs = strList(item['needs']);
    if (needs === null) return void rejections.push({ id, reason: 'needs must be a list of scenario ids' });
    seen.add(id);
    const scenario: Scenario = { id, then, check: item['check'] as Check };
    const given = str(item['given']);
    const when = str(item['when']);
    const irreversible = str(item['irreversible']);
    if (given) scenario.given = given;
    if (when) scenario.when = when;
    if (irreversible) scenario.irreversible = irreversible;
    if (needs.length > 0) scenario.needs = needs;
    scenarios.push(scenario);
  });
  rejectBadEdges(scenarios, rejections);
  return { scenarios, rejections };
}

/**
 * Edges are validated over the whole set: every `needs` id must exist, must not be a human
 * scenario (it never passes, so the dependent would never run) and must not form a cycle.
 * A scenario with a bad edge is rejected — nothing is stored with a dangling relation.
 */
function rejectBadEdges(scenarios: Scenario[], rejections: Rejection[]): void {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const bad = new Set<string>();
  for (const s of scenarios) {
    for (const need of s.needs ?? []) {
      const parent = byId.get(need);
      if (!parent) rejections.push({ id: s.id, reason: `needs unknown scenario: ${need}` });
      else if (need === s.id) rejections.push({ id: s.id, reason: 'a scenario cannot need itself' });
      else if (parent.check.type === 'human') rejections.push({ id: s.id, reason: `needs ${need}, a human scenario — it has no verdict and would block forever` });
      else continue;
      bad.add(s.id);
    }
  }
  for (const id of cycleMembers(scenarios.filter((s) => !bad.has(s.id)))) {
    rejections.push({ id, reason: 'needs form a cycle' });
    bad.add(id);
  }
  for (let i = scenarios.length - 1; i >= 0; i -= 1) if (bad.has(scenarios[i]!.id)) scenarios.splice(i, 1);
}

function cycleMembers(scenarios: Scenario[]): string[] {
  const indegree = new Map(scenarios.map((s) => [s.id, 0]));
  for (const s of scenarios) for (const need of s.needs ?? []) if (indegree.has(need)) indegree.set(s.id, (indegree.get(s.id) ?? 0) + 1);
  const queue = scenarios.filter((s) => indegree.get(s.id) === 0).map((s) => s.id);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    seen.add(id);
    for (const s of scenarios) {
      if (!s.needs?.includes(id)) continue;
      const left = (indegree.get(s.id) ?? 0) - 1;
      indegree.set(s.id, left);
      if (left === 0) queue.push(s.id);
    }
  }
  return scenarios.filter((s) => !seen.has(s.id)).map((s) => s.id);
}

/** Ancestors of `ids` through `needs`, nearest first, without the ids themselves. */
export function ancestorsOf(scenarios: Scenario[], ids: string[]): string[] {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const out: string[] = [];
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const need of byId.get(id)?.needs ?? []) {
      if (ids.includes(need) || out.includes(need)) continue;
      out.push(need);
      queue.push(need);
    }
  }
  return out;
}

/** The work graph as mermaid — one node per scenario, one edge per `needs` entry, the last result on each node. */
export function graphMermaid(scenarios: Scenario[], lastOf: (id: string) => string): string {
  const mark: Record<string, string> = { pass: '✔', fail: '✘', blocked: '⊘', pending: '?', never: '·' };
  const lines = ['graph LR'];
  for (const s of scenarios) {
    const last = lastOf(s.id);
    lines.push(`  ${s.id}["${s.id} ${mark[last] ?? last}"]:::${last}`);
  }
  for (const s of scenarios) for (const need of s.needs ?? []) lines.push(`  ${need} --> ${s.id}`);
  lines.push('  classDef pass stroke:#2e7d32', '  classDef fail stroke:#c62828', '  classDef blocked stroke:#ef6c00,stroke-dasharray:4', '  classDef pending stroke:#6a1b9a', '  classDef never stroke:#9e9e9e');
  return lines.join('\n');
}

export function isHuman(scenario: Scenario): boolean {
  return scenario.check.type === 'human';
}
