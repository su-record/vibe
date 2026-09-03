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
 * 검사 가능성 — 시나리오가 검사 유형 하나에 묶여야 저장된다.
 * 검사가 아닌 문장은 Contract 에 들어갈 수 없다 (SPEC 원칙 ①).
 */
function checkReason(check: unknown): string | null {
  if (!isRecord(check)) return 'check 가 없다 — 검사 유형(run·file·http·eval·human) 하나가 필요하다';
  const type = check['type'];
  if (typeof type !== 'string' || !CHECK_TYPES.has(type)) return `알 수 없는 검사 유형: ${String(type)}`;
  switch (type) {
    case 'run':
      return str(check['cmd']) ? null : 'run 검사는 cmd 가 필요하다';
    case 'file': {
      if (!str(check['path'])) return 'file 검사는 path 가 필요하다';
      const hasRule = check['exists'] !== undefined || str(check['pattern']) || str(check['contains']) || str(check['schema']);
      return hasRule ? null : 'file 검사는 exists·pattern·contains·schema 중 하나가 필요하다';
    }
    case 'http':
      return str(check['url']) ? null : 'http 검사는 url 이 필요하다';
    case 'eval': {
      if (!str(check['cases']) || !str(check['runner'])) return 'eval 검사는 cases 와 runner 가 필요하다';
      const expect = check['expect'];
      return isRecord(expect) && Number.isInteger(expect['pass']) ? null : 'eval 검사는 expect.pass(개수)가 필요하다';
    }
    case 'human':
      return str(check['question']) ? null : 'human 검사는 question 이 필요하다';
    default:
      return null;
  }
}

export function parseScenarios(text: string): ParsedScenarios {
  let raw: unknown;
  try {
    raw = YAML.parse(text);
  } catch (error) {
    return { scenarios: [], rejections: [{ id: '(yaml)', reason: `YAML 파싱 실패: ${(error as Error).message}` }] };
  }
  if (!Array.isArray(raw)) return { scenarios: [], rejections: [{ id: '(root)', reason: '최상위는 시나리오 목록이어야 한다' }] };

  const scenarios: Scenario[] = [];
  const rejections: Rejection[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    const label = isRecord(item) && typeof item['id'] === 'string' ? item['id'] : `#${index + 1}`;
    if (!isRecord(item)) return void rejections.push({ id: label, reason: '항목이 객체가 아니다' });
    const id = str(item['id']);
    if (!id || !ID_RE.test(id)) return void rejections.push({ id: label, reason: 'id 는 소문자·숫자·하이픈 1~40자여야 한다' });
    if (seen.has(id)) return void rejections.push({ id, reason: 'id 중복' });
    const then = str(item['then']);
    if (!then) return void rejections.push({ id, reason: 'then(성공 조건 문장)이 필요하다' });
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
