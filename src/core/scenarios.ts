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
}
export interface HttpCheck {
  type: 'http';
  url: string;
  method?: string;
  expect?: { status?: number; schema?: string; maxMs?: number };
}
export interface EvalCheck {
  type: 'eval';
  cases: string;
  runner: string;
  expect: { pass: number };
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
      const hasRule = check['exists'] !== undefined || str(check['pattern']) || str(check['contains']) || str(check['schema']);
      return hasRule ? null : 'file check requires one of exists·pattern·contains·schema';
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
    seen.add(id);
    const scenario: Scenario = { id, then, check: item['check'] as Check };
    const given = str(item['given']);
    const when = str(item['when']);
    const irreversible = str(item['irreversible']);
    if (given) scenario.given = given;
    if (when) scenario.when = when;
    if (irreversible) scenario.irreversible = irreversible;
    scenarios.push(scenario);
  });
  return { scenarios, rejections };
}

export function isHuman(scenario: Scenario): boolean {
  return scenario.check.type === 'human';
}
