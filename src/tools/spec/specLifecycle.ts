/**
 * SPEC lifecycle 규율 — 헤더의 닫힌 집합과 "썩은 앵커" 를 판정한다.
 *
 * 배경: `.vibe/specs/**` 는 VERIFIED 로 확정된 뒤에도 코드가 움직이면 그대로 남는다.
 * 실측(2026-09-02): 29개 중 20개에 Status 줄이 아예 없었고, 남은 9개의 값은 5가지
 * 형태로 갈라져 있었다 (`COMPLETE`, 소문자 `verified`, 후행 공백 …). 템플릿은
 * `DRAFT | APPROVED` 만 선언했으니 선언과 실물이 이미 어긋나 있었다.
 *
 * 두 가지를 고정한다:
 *  - **닫힌 집합** — Status·Class 는 여기 있는 값만 쓸 수 있다. 새 값을 만들려면
 *    이 파일을 고쳐야 하고, 그 순간 리뷰 대상이 된다.
 *  - **Anchors** — VERIFIED 이고 코드에 고정되는 Class 인 SPEC 은 자기가 안착한
 *    경로를 나열해야 한다. 그 경로가 사라지면 게이트가 실패한다. lifecycle 표기만으로는
 *    썩음을 못 잡는다 — 문서는 Status 를 바꾸지 않은 채 늙기 때문이다.
 *
 * 경로 존재 검사는 여기서 하지 않는다. 이 모듈은 순수 함수로 두고(하네스·CWD 무관),
 * 파일시스템 판정은 `scripts/validate-spec-lifecycle.ts` 가 맡는다.
 */
import path from 'path';

/** SPEC 이 가질 수 있는 lifecycle 상태 — 이 집합 밖의 값은 게이트가 거부한다 */
export const SPEC_STATUSES = ['DRAFT', 'APPROVED', 'VERIFIED', 'SUPERSEDED', 'REJECTED'] as const;
export type SpecStatus = (typeof SPEC_STATUSES)[number];

/** SPEC 의 변경 종류 — dsh Agent Note 의 닫힌 6종을 그대로 쓴다 */
export const SPEC_CLASSES = [
  'feature',
  'bug-fix',
  'simplification',
  'architecture',
  'process',
  'testing',
] as const;
export type SpecClass = (typeof SPEC_CLASSES)[number];

/**
 * Anchors 를 요구하는 Class.
 *
 * 코드 경로에 실제로 안착하는 종류만 넣는다. process/testing/simplification 은
 * 규약·워크플로 변경이라 고정할 경로가 없는 경우가 많고, 억지로 요구하면 통과 의식이 된다.
 */
export const ANCHOR_REQUIRED_CLASSES: readonly SpecClass[] = ['feature', 'bug-fix', 'architecture'];

export interface SpecLifecycleHeader {
  status?: string;
  specClass?: string;
  /** `## Anchors` 절에서 뽑은 경로. 절이 없으면 undefined (빈 배열과 구분한다) */
  anchors?: string[];
}

export interface LifecycleFinding {
  code: string;
  message: string;
}

const STATUS_LINE = /^\s*[-*]?\s*\*{0,2}Status\*{0,2}\s*[:：]\s*(.+)$/im;
const CLASS_LINE = /^\s*[-*]?\s*\*{0,2}Class\*{0,2}\s*[:：]\s*(.+)$/im;
const ANCHORS_HEADING = /^#{2,4}\s*(?:Anchors|앵커)\s*$/im;
const LIST_ITEM = /^\s*[-*]\s+(.+)$/;

/**
 * 분할 SPEC 의 phase 파일은 헤더를 요구하지 않는다 — 헤더는 `_index.md` 한 벌이
 * SSOT 다. phase 파일마다 Status 를 두면 둘이 어긋나는 새 드리프트를 만든다.
 */
export function isLifecycleExempt(specPath: string): boolean {
  return /^phase-\d+-/.test(path.basename(specPath));
}

/**
 * 헤더 값에서 첫 토큰만 뽑는다 — `VERIFIED (2026-08-29 — …)` 의 괄호 뒷말은 자유 서술이다.
 *
 * 하이픈은 구분자로 쓰지 않는다: Class `bug-fix` 가 `bug` 로 잘린다.
 */
function firstToken(value: string): string {
  return value.trim().split(/[\s(·—]/)[0].trim();
}

function parseAnchors(content: string): string[] | undefined {
  const heading = content.match(ANCHORS_HEADING);
  if (!heading) return undefined;

  const level = (heading[0].match(/^#+/) ?? ['#'])[0].length;
  const after = content.slice((heading.index ?? 0) + heading[0].length);
  const next = after.search(new RegExp(`^#{1,${level}}\\s`, 'm'));
  const body = next === -1 ? after : after.slice(0, next);

  const out: string[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(LIST_ITEM);
    if (!m) continue;
    const code = m[1].match(/`([^`]+)`/);
    out.push((code ? code[1] : m[1]).trim());
  }
  return out;
}

/** SPEC 원문에서 lifecycle 헤더를 읽는다 */
export function parseSpecLifecycle(content: string): SpecLifecycleHeader {
  const status = content.match(STATUS_LINE);
  const specClass = content.match(CLASS_LINE);
  return {
    status: status ? firstToken(status[1]) : undefined,
    specClass: specClass ? firstToken(specClass[1]).toLowerCase() : undefined,
    anchors: parseAnchors(content),
  };
}

function checkStatus(header: SpecLifecycleHeader, out: LifecycleFinding[]): void {
  if (!header.status) {
    out.push({
      code: 'no-spec-status',
      message: `Status 필드가 없다 — lifecycle 을 판정할 수 없다 (${SPEC_STATUSES.join(' | ')}).`,
    });
    return;
  }
  if (!(SPEC_STATUSES as readonly string[]).includes(header.status)) {
    out.push({
      code: 'invalid-spec-status',
      message: `Status 값을 알 수 없다: "${header.status}" — ${SPEC_STATUSES.join(' | ')} 중 하나여야 한다.`,
    });
  }
}

function checkClass(header: SpecLifecycleHeader, out: LifecycleFinding[]): void {
  if (!header.specClass) {
    out.push({
      code: 'no-spec-class',
      message: `Class 필드가 없다 — Anchors 요구 여부를 판정할 수 없다 (${SPEC_CLASSES.join(' | ')}).`,
    });
    return;
  }
  if (!(SPEC_CLASSES as readonly string[]).includes(header.specClass)) {
    out.push({
      code: 'invalid-spec-class',
      message: `Class 값을 알 수 없다: "${header.specClass}" — ${SPEC_CLASSES.join(' | ')} 중 하나여야 한다.`,
    });
  }
}

/** VERIFIED + 코드성 Class 면 Anchors 절이 있고 비어 있지 않아야 한다 */
export function anchorsRequired(header: SpecLifecycleHeader): boolean {
  return header.status === 'VERIFIED'
    && (ANCHOR_REQUIRED_CLASSES as readonly string[]).includes(header.specClass ?? '');
}

function checkAnchors(header: SpecLifecycleHeader, out: LifecycleFinding[]): void {
  if (!anchorsRequired(header)) return;
  if (!header.anchors || header.anchors.length === 0) {
    out.push({
      code: 'no-anchors',
      message: `VERIFIED + Class ${header.specClass} 인 SPEC 은 "## Anchors" 절에 안착한 경로를 나열해야 한다 `
        + '— 경로가 사라지면 게이트가 썩음을 잡는다.',
    });
  }
}

/**
 * 내용만으로 판정 가능한 lifecycle 검사.
 *
 * @param content SPEC 마크다운 원문
 * @param specPath 파일 경로 — phase 파일 면제 판정에 쓴다
 */
export function checkSpecLifecycle(content: string, specPath?: string): LifecycleFinding[] {
  if (specPath && isLifecycleExempt(specPath)) return [];

  const header = parseSpecLifecycle(content);
  const out: LifecycleFinding[] = [];
  checkStatus(header, out);
  checkClass(header, out);
  checkAnchors(header, out);
  return out;
}
