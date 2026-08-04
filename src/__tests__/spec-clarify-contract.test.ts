import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Coverage sweep + session boundary — 정적 계약 테스트
 * (SPEC: .vibe/specs/spec-sweep-session-boundary.md).
 *
 * 스킬 본문 규칙은 모델이 읽는 계약이므로, 규칙이 각 파일에 존재·유지되는지를
 * 순수 fs 검사로 고정한다 (stakes-contract / wiring-integrity 선례). D1·D3–D7 게이트.
 */

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/** Step 3 본문 (다음 `### ` 헤더 전까지) */
function clarifySection(doc: string): string {
  const start = doc.indexOf('### 3. Clarify');
  expect(start, 'Step 3 Clarify 섹션을 찾지 못했다').toBeGreaterThan(-1);
  const rest = doc.slice(start + 1);
  const end = rest.indexOf('\n### ');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('D3 — vibe.spec Step 3: 커버리지 스윕 2단 구조', () => {
  const doc = read('skills/vibe.spec/SKILL.md');
  const step3 = clarifySection(doc);

  it('3-a 커버리지 스윕과 3-b 답변 요청이 별도 소제목으로 존재한다', () => {
    expect(step3).toMatch(/####\s*3-a\./);
    expect(step3).toMatch(/####\s*3-b\./);
  });

  it('3-a 는 개수 제한 없이 열거하는 내부 단계다 (사용자 비노출)', () => {
    expect(step3, '3-a 가 무제한 열거임이 명시되어야 한다').toMatch(/개수 제한 없이/);
    expect(step3, '3-a 가 사용자에게 출력되지 않음이 명시되어야 한다')
      .toMatch(/출력하지 않는다/);
  });

  it('3-b 의 사용자 질문 상한이 3개다', () => {
    expect(step3).toMatch(/\*\*최대 3개\*\*/);
  });

  it('제한 축이 질문 수가 아니라 필수 답변 수임을 명시한다', () => {
    expect(step3, '옛 상한 축(질문 수 제한)으로 되돌아가면 스윕이 무력화된다')
      .toMatch(/질문 수가 아니라/);
  });

  it('옛 "최대 5개" 상한 문구가 남아있지 않다 (두 상한 공존 금지)', () => {
    expect(doc).not.toContain('최대 5개');
  });

  it('묻지 않은 3-a 항목의 Assumptions 전량 편입이 명시된다', () => {
    expect(step3).toMatch(/3-b 로 묻지 않은 3-a 항목은 전부/);
    expect(step3).toMatch(/누락 0건/);
  });

  it('Assumptions 접기 임계가 3개로 명시된다', () => {
    expect(step3).toMatch(/3개 초과면 핵심 3개/);
    expect(step3).toMatch(/그 외 N건은 SPEC 참조/);
  });

  it('autonomous 는 3-b 질문을 생략하고 전량 Assumptions 로 간다', () => {
    expect(step3).toMatch(/autonomous.*3-b 질문을 생략/s);
  });
});

describe('D4 — vibe.spec Step 5: 셀프 리뷰 체크리스트', () => {
  const doc = read('skills/vibe.spec/SKILL.md');

  it('커버리지 스윕 귀결 항목이 추가된다', () => {
    expect(doc).toMatch(/- \[ \] 3-a 커버리지 스윕에서 나온 결정 지점이 \*\*전부\*\*/);
  });

  it('기존 stakes 체크리스트 항목이 보존된다 (stakes-contract 회귀 방지)', () => {
    expect(doc).toMatch(/- \[ \] 헤더에 `Stakes:` 필드가 있고/);
  });
});

describe('D5 — vibe.spec Step 6: 세션 경계 선택지 편승', () => {
  const doc = read('skills/vibe.spec/SKILL.md');

  it('승인 메시지 선택지가 4개이며 세션 경계가 [2] 다', () => {
    expect(doc).toMatch(/\[1\] 승인 → 이 세션에서 계속/);
    expect(doc).toMatch(/\[2\] 승인 → 새 세션에서 run/);
    expect(doc).toMatch(/\[3\] 수정 요청/);
    expect(doc).toMatch(/\[4\] 중단/);
  });

  it('선택지 개수가 트리거와 무관하게 항상 4개로 고정된다', () => {
    expect(doc, '조건부로 선택지 수가 변하면 직역 하네스가 분기 해석에 실패한다')
      .toMatch(/선택지 개수는 항상 4개로 고정한다/);
  });

  it('관측 가능한 프록시 트리거 3종이 명시된다', () => {
    expect(doc).toMatch(/명확화 왕복 ≥ 2회/);
    expect(doc).toMatch(/SPEC 수정 요청 ≥ 1회/);
    expect(doc).toMatch(/분할 SPEC \(5\+ phase/);
  });

  it('컨텍스트 사용률(%) 을 트리거로 쓰지 않음이 명시된다', () => {
    expect(doc, '하네스별로 권고 시점이 갈리면 dual-harness doctrine 위반이다')
      .toMatch(/컨텍스트 사용률\(%\)은 트리거로 쓰지 않는다/);
  });

  it('별도 blocking 프롬프트를 만들지 않는다 (의무 게이트 1회 불변식)', () => {
    expect(doc).toMatch(/별도 프롬프트를 만들지 않는다/);
    expect(doc).toMatch(/의무적 사람 개입은 SPEC 승인 1회/);
  });

  it('autonomous 는 세션 경계 권고를 띄우지 않는다', () => {
    expect(doc).toMatch(/세션 경계 권고 없음 — 비대화형이라 리셋 불가/);
  });

  it('[2] 에서 packet 을 미리 컴파일하지 않는다 (컴파일 시점 불변)', () => {
    expect(doc).toMatch(/execution packet 은 지금 컴파일하지 않는다/);
  });

  it('기존 stakes 편승 질문 규칙이 보존된다 (stakes-contract D3 회귀 방지)', () => {
    expect(doc).toContain('Stakes 편승 질문');
    expect(doc).toMatch(/추가 확인 왕복을 만들지 않는다/);
  });
});

describe('D6 — vibe 디스패처 Phase 4: [2] 선택 시 체인 중단', () => {
  const doc = read('skills/vibe/SKILL.md');

  it('[2] 선택 시 체인을 계속하지 않는다고 명시한다', () => {
    expect(doc).toMatch(/\*\*체인을 계속하지 않는다\.\*\*/);
    expect(doc).toMatch(/`vibe\.run` 을 호출하지 말고/);
  });

  it('새 세션 재개 안내를 출력한다', () => {
    expect(doc).toMatch(/새 세션에서 재개하세요/);
    expect(doc).toMatch(/\/vibe\.run "\{feature-name\}"/);
  });

  it('packet 컴파일 시점이 vibe.run Step 1-0 으로 유지된다', () => {
    expect(doc).toMatch(/새 세션의 `vibe\.run` Step 1-0 이 담당한다/);
  });

  it('핸드오프 아티팩트를 신규 생성하지 않는다', () => {
    expect(doc).toMatch(/별도 핸드오프 아티팩트를 만들지 않는다/);
  });

  it('이 종료가 stuck·실행 실패와 구분된다 (루프 종료 사유 오염 방지)', () => {
    expect(doc).toMatch(/stuck 도 실행 실패도 아니다/);
  });
});

describe('D7 — CLAUDE.md ↔ AGENTS.md: 단계 경계 트리거 동기화', () => {
  const claude = read('CLAUDE.md');
  const agents = read('AGENTS.md');

  it.each([
    ['CLAUDE.md', claude],
    ['AGENTS.md', agents],
  ])('%s 에 단계 경계 리셋 서술이 있다', (_rel, doc) => {
    expect(doc).toMatch(/\*\*단계 경계 리셋 \(용량 기준과 병행\)\*\*/);
  });

  it.each([
    ['CLAUDE.md', claude],
    ['AGENTS.md', agents],
  ])('%s 에서 85%% 용량 규칙이 대체되지 않고 병행으로 남는다', (_rel, doc) => {
    expect(doc).toMatch(/At 85%\+ context/);
    expect(doc).toMatch(/85% 규칙을 대체하지 않는다/);
  });

  it.each([
    ['CLAUDE.md', claude],
    ['AGENTS.md', agents],
  ])('%s 의 vibe.spec 설명이 커버리지 스윕을 반영한다', (_rel, doc) => {
    expect(doc).toMatch(/커버리지 스윕 → 최대 3개 인라인 질문/);
  });

  it('AGENTS.md 의 신규 서술에 변환되지 않은 슬래시 진입점이 없다', () => {
    const added = agents
      .split('\n')
      .filter((l) => l.includes('단계 경계 리셋') || l.includes('커버리지 스윕 →'));
    expect(added.length, '동기화 대상 줄을 찾지 못했다').toBeGreaterThan(0);
    // `/new` 는 하네스 공용 컨텍스트 리셋 명령이라 변환 대상이 아니다.
    const leftovers = added.filter((l) => /\/vibe\b/.test(l));
    expect(leftovers, `변환되지 않은 줄:\n${leftovers.join('\n')}`).toEqual([]);
  });
});
