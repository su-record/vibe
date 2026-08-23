/**
 * Loop Definition Validator — 루프 정의 파일(.vibe/loops/<name>.md) 검증.
 *
 * frontmatter 필수 필드, enum 값, max_iterations 범위(1–50),
 * 조건부 필드(schedule, test_command)를 결정론적으로 검증한다.
 */

// ─── Types ───────────────────────────────────────────────────────────

export type LoopTrigger = 'scheduled' | 'manual' | 'on-event';
/**
 * 완료를 무엇으로 판정하는가.
 *
 * - `ledger` — run-ledger 의 `verifyPassed`
 * - `tests`  — `test_command` 의 exit code
 * - `visual` — `visual_command` 의 exit code **+ 사람이 볼 산출물**
 * - `none`   — 판정 생략(보고만)
 *
 * ⚠️ `visual` 이 "모델이 스크린샷을 보고 판단한다" 는 뜻이 **아니다.** 그건
 * 자기보고이고, loop-contract 가 배제하는 바로 그것이다. 게이트는 명령의 exit
 * code 다 — 베이스라인 diff·접근성 감사·토큰 드리프트처럼 임계값으로 떨어지는
 * 검사여야 한다. `tests` 와 갈리는 지점은 **증거를 남긴다**는 것이다: 스크린샷이나
 * diff 이미지를 남겨 나중에 사람이 눈으로 확인할 수 있어야 한다.
 */
export type LoopVerify = 'ledger' | 'tests' | 'visual' | 'none';
export type LoopIsolation = 'worktree' | 'none';

/**
 * 한 번의 호출에서 몇 바퀴를 도는가.
 *
 * - `continuous` (기본) — `max_iterations` 한도까지 한 세션 안에서 계속 돈다.
 *   회전 사이에 맥락이 남아 이어붙이기 좋지만, 컨텍스트가 단조 증가한다.
 * - `per-iteration` — **한 바퀴만 돌고 끝낸다.** 반복은 스케줄러가 만든다.
 *   호출마다 컨텍스트가 0에서 시작하므로 누적이 없다. 대신 매번 ANCHOR 문서를
 *   다시 읽어야 하고(고정 비용), 회전 사이의 맥락은 파일로만 넘어간다.
 *
 * 어느 쪽이 결과가 나은지는 측정된 바 없다 — 축을 열어두고 선택하게 한다.
 */
export type LoopSession = 'continuous' | 'per-iteration';
export type LoopStatus = 'active' | 'paused';

/** 파싱된 루프 정의 */
export interface ParsedLoopDefinition {
  name: string;
  trigger: LoopTrigger;
  schedule?: string;
  goal: string;
  discover: string;
  pipeline: string[];
  verify: LoopVerify;
  test_command?: string;
  visual_command?: string;
  artifact_dir?: string;
  max_iterations: number;
  isolation: LoopIsolation;
  session: LoopSession;
  status: LoopStatus;
}

/** validateLoopDefinition 반환 타입 */
export interface LoopValidationResult {
  valid: boolean;
  errors: string[];
  definition: ParsedLoopDefinition | null;
}

// ─── Constants ───────────────────────────────────────────────────────

const TRIGGER_VALUES: ReadonlySet<string> = new Set(['scheduled', 'manual', 'on-event']);
const VERIFY_VALUES: ReadonlySet<string> = new Set(['ledger', 'tests', 'visual', 'none']);
const ISOLATION_VALUES: ReadonlySet<string> = new Set(['worktree', 'none']);
const SESSION_VALUES: ReadonlySet<string> = new Set(['continuous', 'per-iteration']);
const STATUS_VALUES: ReadonlySet<string> = new Set(['active', 'paused']);

/** 5-필드 cron 기본 패턴 (과도한 검증 금지) */
const CRON_PATTERN = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/;

const MAX_ITERATIONS_MIN = 1;
const MAX_ITERATIONS_MAX = 50;

// ─── Frontmatter Parser ──────────────────────────────────────────────

/**
 * YAML-like frontmatter 파싱 (scope-from-spec.js#readFrontmatter 의미론 준수).
 * 스칼라 값과 인라인 배열([a, b, c]), 블록 시퀀스(- item)를 처리한다.
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  if (!content.startsWith('---')) return {};
  const end = content.indexOf('\n---', 3);
  if (end < 0) return {};
  const block = content.slice(3, end);
  const out: Record<string, unknown> = {};
  const lines = block.split('\n');

  let currentKey: string | null = null;
  let blockLines: string[] = [];

  const flushBlock = (): void => {
    if (currentKey !== null && blockLines.length > 0) {
      out[currentKey] = blockLines.join('\n').trim();
      currentKey = null;
      blockLines = [];
    }
  };

  for (const line of lines) {
    // block scalar continuation (indented)
    if (currentKey !== null && (line.startsWith('  ') || line === '')) {
      blockLines.push(line.replace(/^  /, ''));
      continue;
    }

    flushBlock();

    // sequence item
    if (line.match(/^- .+/)) {
      // orphan sequence — attach to last key (pipeline etc. as array)
      continue;
    }

    const kv = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const raw = kv[2].trim();

    if (raw === '|' || raw === '>') {
      // block scalar — collect following lines
      currentKey = key;
      blockLines = [];
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      // inline array: [a, b, c]
      out[key] = raw
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (raw === '') {
      // key with no value — sequence follows (like `pipeline:\n  - vibe.spec`)
      out[key] = [];
      currentKey = key + '__seq';
      blockLines = [];
    } else {
      out[key] = raw;
    }
  }

  flushBlock();
  return out;
}

/**
 * 시퀀스 블록 파싱 — frontmatter 내 `key:\n  - item` 형식 전용.
 * parseFrontmatter 를 보완해 pipeline 배열을 올바르게 추출한다.
 */
function extractSequences(content: string): Record<string, string[]> {
  if (!content.startsWith('---')) return {};
  const end = content.indexOf('\n---', 3);
  if (end < 0) return {};
  const block = content.slice(3, end);

  const result: Record<string, string[]> = {};
  const lines = block.split('\n');
  let currentKey: string | null = null;

  for (const line of lines) {
    const kv = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*$/);
    if (kv) {
      currentKey = kv[1];
      result[currentKey] = [];
      continue;
    }
    const item = line.match(/^[ \t]*-\s+(.+)$/);
    if (item && currentKey) {
      result[currentKey].push(item[1].trim());
      continue;
    }
    if (line.match(/^[a-zA-Z_][\w-]*\s*:/)) {
      currentKey = null;
    }
  }

  return result;
}

// ─── Validator ───────────────────────────────────────────────────────

/**
 * 루프 정의 마크다운 문자열을 파싱하고 검증한다.
 *
 * @param content - 루프 정의 파일 전체 내용 (frontmatter 포함 마크다운)
 * @returns LoopValidationResult
 */
export function validateLoopDefinition(content: string): LoopValidationResult {
  const errors: string[] = [];
  const fm = parseFrontmatter(content);
  const seqs = extractSequences(content);

  // pipeline: 블록 시퀀스 우선, 인라인 배열 폴백
  const pipeline: string[] = seqs['pipeline'] ??
    (Array.isArray(fm['pipeline']) ? (fm['pipeline'] as string[]) : []);

  const name = typeof fm['name'] === 'string' ? fm['name'].trim() : '';
  const trigger = typeof fm['trigger'] === 'string' ? fm['trigger'].trim() : '';
  const schedule = typeof fm['schedule'] === 'string' ? fm['schedule'].trim() : undefined;
  const goal = typeof fm['goal'] === 'string' ? fm['goal'].trim() : '';
  const discover = typeof fm['discover'] === 'string' ? fm['discover'].trim() : '';
  const verify = typeof fm['verify'] === 'string' ? fm['verify'].trim() : '';
  const test_command = typeof fm['test_command'] === 'string' ? fm['test_command'].trim() : undefined;
  const visual_command = typeof fm['visual_command'] === 'string' ? fm['visual_command'].trim() : undefined;
  const artifact_dir = typeof fm['artifact_dir'] === 'string' ? fm['artifact_dir'].trim() : undefined;
  const maxIterRaw = fm['max_iterations'];
  const isolation = typeof fm['isolation'] === 'string' ? fm['isolation'].trim() : 'none';
  const session = typeof fm['session'] === 'string' ? fm['session'].trim() : 'continuous';
  const status = typeof fm['status'] === 'string' ? fm['status'].trim() : '';

  // 필수 필드 존재 검사
  if (!name) errors.push('name: 필수 필드가 없거나 비어 있습니다');
  if (!trigger) errors.push('trigger: 필수 필드가 없거나 비어 있습니다');
  if (!goal) errors.push('goal: 필수 필드가 없거나 비어 있습니다');
  if (!discover) errors.push('discover: 필수 필드가 없거나 비어 있습니다');
  if (pipeline.length === 0) errors.push('pipeline: 필수 필드가 없거나 비어 있습니다');
  if (!verify) errors.push('verify: 필수 필드가 없거나 비어 있습니다');
  if (!status) errors.push('status: 필수 필드가 없거나 비어 있습니다');
  if (maxIterRaw === undefined || maxIterRaw === null || maxIterRaw === '') {
    errors.push('max_iterations: 필수 필드가 없거나 비어 있습니다');
  }

  // enum 검사
  if (trigger && !TRIGGER_VALUES.has(trigger)) {
    errors.push(`trigger: 유효하지 않은 값 "${trigger}" — scheduled|manual|on-event 중 하나여야 합니다`);
  }
  if (verify && !VERIFY_VALUES.has(verify)) {
    errors.push(`verify: 유효하지 않은 값 "${verify}" — ledger|tests|none 중 하나여야 합니다`);
  }
  if (isolation && !ISOLATION_VALUES.has(isolation)) {
    errors.push(`isolation: 유효하지 않은 값 "${isolation}" — worktree|none 중 하나여야 합니다`);
  }
  if (session && !SESSION_VALUES.has(session)) {
    errors.push(`session: 유효하지 않은 값 "${session}" — continuous|per-iteration 중 하나여야 합니다`);
  }
  if (status && !STATUS_VALUES.has(status)) {
    errors.push(`status: 유효하지 않은 값 "${status}" — active|paused 중 하나여야 합니다`);
  }

  // 조건부 필드: schedule iff trigger === 'scheduled'
  if (trigger === 'scheduled') {
    if (!schedule) {
      errors.push('schedule: trigger=scheduled 일 때 필수 필드입니다');
    } else if (!CRON_PATTERN.test(schedule)) {
      errors.push(`schedule: 5-필드 cron 형식이 아닙니다 (예: "0 2 * * *") — 받은 값: "${schedule}"`);
    }
  } else if (schedule !== undefined) {
    errors.push('schedule: trigger=scheduled 일 때만 허용됩니다');
  }

  // 조건부 필드: test_command iff verify === 'tests'
  if (verify === 'tests') {
    if (!test_command) {
      errors.push('test_command: verify=tests 일 때 필수 필드입니다');
    }
  } else if (test_command !== undefined) {
    errors.push('test_command: verify=tests 일 때만 허용됩니다');
  }

  // 조건부 필드: visual_command iff verify === 'visual'
  if (verify === 'visual') {
    if (!visual_command) {
      errors.push('visual_command: verify=visual 일 때 필수 필드입니다');
    }
    // 증거가 남지 않으면 `tests` 와 다를 것이 없다 — 나중에 사람이 볼 것이 있어야 한다
    if (!artifact_dir) {
      errors.push(
        'artifact_dir: verify=visual 일 때 필수 필드입니다 — 스크린샷·diff 를 남길 위치. '
        + '증거가 남지 않으면 verify=tests 와 다를 것이 없습니다.'
      );
    }
  } else {
    if (visual_command !== undefined) {
      errors.push('visual_command: verify=visual 일 때만 허용됩니다');
    }
    if (artifact_dir !== undefined) {
      errors.push('artifact_dir: verify=visual 일 때만 허용됩니다');
    }
  }

  // max_iterations 범위 검사
  const maxIter = Number(maxIterRaw);
  if (maxIterRaw !== undefined && maxIterRaw !== null && maxIterRaw !== '') {
    if (!Number.isInteger(maxIter)) {
      errors.push('max_iterations: 정수여야 합니다');
    } else if (maxIter < MAX_ITERATIONS_MIN || maxIter > MAX_ITERATIONS_MAX) {
      errors.push(
        `max_iterations: ${MAX_ITERATIONS_MIN}–${MAX_ITERATIONS_MAX} 범위여야 합니다 — 받은 값: ${maxIter}`
      );
    }
  }

  // session: per-iteration 은 호출당 한 바퀴가 정의다 — max_iterations 와 어긋나면
  // "한 바퀴만" 인지 "열 바퀴까지" 인지 두 값이 서로 다른 말을 하게 된다.
  // 필드 하나가 두 뜻을 갖는 것을 막기 위해 일치를 요구한다.
  if (session === 'per-iteration' && Number.isInteger(maxIter) && maxIter !== 1) {
    errors.push(
      `session: per-iteration 은 max_iterations 가 1 이어야 합니다 — 받은 값: ${maxIter}. `
      + '반복은 스케줄러가 만든다 (trigger/schedule).'
    );
  }

  // pipeline 항목 검사
  for (const entry of pipeline) {
    if (!entry.startsWith('vibe.')) {
      errors.push(`pipeline: 각 항목은 "vibe."으로 시작해야 합니다 — 받은 값: "${entry}"`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, definition: null };
  }

  const definition: ParsedLoopDefinition = {
    name,
    trigger: trigger as LoopTrigger,
    ...(schedule !== undefined ? { schedule } : {}),
    goal,
    discover,
    pipeline,
    verify: verify as LoopVerify,
    ...(test_command !== undefined ? { test_command } : {}),
    ...(visual_command !== undefined ? { visual_command } : {}),
    ...(artifact_dir !== undefined ? { artifact_dir } : {}),
    max_iterations: maxIter,
    session: session as LoopSession,
    isolation: isolation as LoopIsolation,
    status: status as LoopStatus,
  };

  return { valid: true, errors: [], definition };
}
