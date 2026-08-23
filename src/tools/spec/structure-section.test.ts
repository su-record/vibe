/**
 * SPEC 의 구조 다이어그램 절 — 승인 전 리뷰 표면.
 *
 * vibe 의 유일한 의무 게이트는 SPEC 승인인데, 그 표면이 산문 + BDD 시나리오뿐이라
 * **구조적 오해가 드러날 자리가 없었다.** 산문은 "박스가 빠졌다 / 화살표가 거꾸로다"
 * 를 숨기고, 구현이 끝난 뒤 diff 에서 발견하면 수정 범위가 커진다.
 *
 * 다만 모든 기능에 그림을 강제하지 않는다 — 시각적 완성도는 정확성을 착각하게
 * 만들고, 해당 없는데 그리면 통과 의식이 된다. 트리거는 **경계가 바뀔 때** 셋뿐이다.
 *
 * 여기서 고정하는 것은 그림의 내용이 아니라 **두 가지 계약**이다:
 *   1. 조건부라는 것 (강제가 아니다)
 *   2. 규범을 복사하지 않는다는 것 (diagram-spec.md 가 SSOT)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const TEMPLATE = read('vibe/templates/spec-template.md');
const SKILL = read('skills/vibe.spec/SKILL.md');
const DIAGRAM_SSOT = 'vibe.docs/references/diagram-spec.md';

describe('구조 절이 존재한다', () => {
  it('SPEC 템플릿에 Structure 절이 있다', () => {
    expect(TEMPLATE).toMatch(/###\s*Structure/);
  });

  it('vibe.spec 이 승인 전 단계로 안내한다', () => {
    expect(SKILL).toContain('구조 다이어그램');
    expect(SKILL, '승인 전이라는 점이 명시돼야 한다').toMatch(/승인 전|승인 \*\*전\*\*/);
  });
});

describe('조건부다 — 강제가 아니다', () => {
  const TRIGGERS = [/경계/, /데이터 흐름/, /3개 이상 모듈/];

  it.each([['템플릿', TEMPLATE], ['스킬', SKILL]])(
    '%s 가 트리거 3가지를 모두 적는다',
    (_label, text) => {
      for (const t of TRIGGERS) expect(text).toMatch(t);
    },
  );

  it('해당 없으면 지우라고 적는다 — 빈 절이 남으면 통과 의식이 된다', () => {
    expect(TEMPLATE).toMatch(/지운다|삭제/);
  });
});

/**
 * 규범을 복사하면 그 순간 두 벌이 된다 — 이 저장소가 반복해서 겪은 실패 형태다.
 */
describe('다이어그램 규범을 복사하지 않는다', () => {
  it('SSOT 를 가리킨다', () => {
    expect(SKILL).toContain(DIAGRAM_SSOT.split('/').pop());
    expect(TEMPLATE).toContain(DIAGRAM_SSOT.split('/').pop());
  });

  it('SSOT 파일이 실재한다', () => {
    expect(fs.existsSync(path.join(ROOT, 'skills', DIAGRAM_SSOT))).toBe(true);
  });

  /** 노드 상한·간선 라벨 같은 세부 규칙이 여기 복사돼 있으면 갈라진다 */
  it('세부 규칙을 옮겨 적지 않는다', () => {
    for (const rule of ['erDiagram', 'flowchart TD', '20 nodes']) {
      expect(SKILL, `${rule} 는 diagram-spec.md 의 몫이다`).not.toContain(rule);
    }
  });
});
