/**
 * 근거 등급 — SPEC 의 주장이 무엇에 기대는지 밝힌다.
 *
 * SPEC 에는 세 종류가 섞인다: 코드에서 **확인**한 것, 거기서 **해석**한 것, 아직
 * **모르는** 것. 셋이 같은 글머리표로 나열되면 리뷰어가 어디를 의심해야 할지
 * 알 수 없고, 특히 해석을 확인으로 읽으면 **틀린 전제 위에 구현이 쌓인다.**
 *
 * ## 왜 새 섹션이 아니라 항목 표시인가
 *
 * `Context Sources`·`Assumptions`·`Evidence Required` 가 이미 근거를 나눠 다룬다.
 * 여기에 "확인/해석/모름" 섹션을 따로 만들면 같은 사실을 어디에 적을지가 모호해진다
 * (같은 파일 경로가 Context Sources 에도, 확인 섹션에도 들어간다). 그래서 축을
 * 늘리지 않고 **기존 항목에 등급만 붙인다.**
 *
 * ## 왜 P2 인가
 *
 * 등급이 없어도 하류 게이트(RTM·JUDGE)는 돈다. 승인을 막지 않고 승인 메시지에
 * 함께 띄운다 — 막을 근거가 없는 것을 막으면 게이트가 통과 의식이 된다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateSpecDocument } from './validateSpecDocument.js';

const spec = (contextBody: string | null): string => `# SPEC: demo

Stakes: production
${contextBody === null ? '' : `\n## Context Sources\n\n${contextBody}\n`}
## Requirements

- REQ-demo-1: 요구사항 하나

## Done Criteria

- [ ] 판정 가능한 기준

## Scenarios

- 시나리오 하나
`;

const groundingFindings = (body: string | null): ReturnType<typeof validateSpecDocument>['findings'] =>
  validateSpecDocument(spec(body), { specPath: '.vibe/specs/demo.md' })
    .findings.filter((f) => f.code === 'no-grounding-tags');

describe('근거 등급 검사', () => {
  it('등급이 없으면 P2 로 알린다', () => {
    const found = groundingFindings('- src/auth/session.ts 를 참고했다');
    expect(found).toHaveLength(1);
    expect(found[0].severity, '승인을 막지 않는다').toBe('P2');
  });

  it.each(['확인', '해석', '모름'])('[%s] 이 있으면 통과한다', (tag) => {
    expect(groundingFindings(`- [${tag}] src/auth/session.ts — 만료 24h`)).toEqual([]);
  });

  it('세 등급이 섞여 있어도 통과한다 — 분포는 따지지 않는다', () => {
    const body = [
      '- [확인] `src/auth/session.ts:createSession` — 만료 24h 상수',
      '- [해석] 세션 갱신 경로가 없다 — 갱신 함수도 호출부도 없다',
      '- [모름] 동시 로그인 정책 — 코드에 흔적 없음',
    ].join('\n');
    expect(groundingFindings(body)).toEqual([]);
  });

  /** 모른다고 적는 편이 모르는 채로 확언하는 것보다 낫다 */
  it('[모름] 만 있어도 결함으로 보지 않는다', () => {
    expect(groundingFindings('- [모름] 인증 방식 — 아직 확인 못 함')).toEqual([]);
  });
});

describe('검사 대상 경계', () => {
  it('Context Sources 절이 없으면 검사하지 않는다', () => {
    expect(groundingFindings(null)).toEqual([]);
  });

  it('절이 비어 있으면 검사하지 않는다 — 빈 절은 다른 검사의 몫이다', () => {
    expect(groundingFindings('')).toEqual([]);
  });

  /**
   * 섹션 경계가 새면 뒤 섹션(Requirements·Done Criteria)의 글머리표를 끌어와
   * 등급 없는 항목으로 세고, 제대로 태그한 SPEC 에까지 P2 를 띄운다.
   */
  it('뒤 섹션의 글머리표를 끌어오지 않는다', () => {
    // Context Sources 항목은 전부 태그됐고, 뒤 섹션에는 태그 없는 글머리표가 있다
    expect(groundingFindings('- [확인] `src/a.ts:f` — 값 1')).toEqual([]);
  });

  it('경계가 실제로 작동하는지 반대편으로도 확인한다', () => {
    // Context Sources 는 비었고 뒤 섹션에만 글머리표가 있다 → 아무것도 세지 않는다
    expect(groundingFindings('')).toEqual([]);
  });
});

/**
 * 템플릿이 기본 경로다 — 여기에 예시가 없으면 아무도 등급을 쓰지 않는다.
 */
describe('템플릿이 세 등급을 가르친다', () => {
  const template = fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', 'vibe', 'templates', 'spec-template.md'), 'utf-8');

  it.each(['[확인]', '[해석]', '[모름]'])('%s 예시가 있다', (tag) => {
    expect(template).toContain(tag);
  });

  it('확인 항목에 파일 경로를 함께 적으라고 한다', () => {
    expect(template).toMatch(/파일 경로/);
  });
});
