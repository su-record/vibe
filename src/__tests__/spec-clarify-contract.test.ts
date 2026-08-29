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

/**
 * D8 — 되돌림 비용 표면화 (SPEC: .vibe/specs/spec-reversibility-surface.md).
 *
 * 스윕이 결정 지점을 전부 열거하면서도 사용자에게 아무것도 보여주지 않던 구조를 고친다.
 * 질문 상한(3개)은 그대로 두고, 되돌림 등급으로 **순서**만 바꾸며,
 * `못 되돌린다` 항목만 승인 메시지로 끌어올린다.
 */
describe('D8 — vibe.spec: 되돌림 비용 축', () => {
  const doc = read('skills/vibe.spec/SKILL.md');
  const step3 = clarifySection(doc);

  it('3-a 항목 형식에 되돌림 칸과 세 등급이 있다', () => {
    expect(step3).toMatch(/\{되돌림: 싸다 \| 비싸다 \| 못 되돌린다\}/);
  });

  it('세 등급의 판정 기준이 본문에 정의된다 (등급이 라벨로만 남지 않게)', () => {
    expect(step3).toMatch(/\| 싸다 \| 코드만 고치면 된다/);
    expect(step3).toMatch(/\| 비싸다 \| 고치려면 여러 곳을 함께 바꿔야 한다/);
    expect(step3).toMatch(/\| 못 되돌린다 \| 이미 쌓인 데이터/);
  });

  it('애매하면 등급을 올린다 (비대칭 비용) 가 명시된다', () => {
    expect(step3, '아래로 잘못 판정하면 마이그레이션이 남는다 — 기본 방향이 본문에 있어야 한다')
      .toMatch(/판정이 애매하면 \*\*위로 올린다\*\*/);
  });

  it('훑을 축에 운영 3종이 추가된다', () => {
    expect(step3).toContain('데이터 보존과 마이그레이션 경로');
    expect(step3).toContain('실패했을 때 사용자에게 보이는 것');
    expect(step3).toContain('부하가 늘면 먼저 깨지는 곳');
  });

  it('3-b 선정이 되돌림 등급 우선으로 정렬된다', () => {
    expect(step3).toMatch(/\*\*되돌림 등급이 높은 순\*\*/);
    expect(step3, '동률 처리로 기존 기준이 남아야 정렬이 결정론적이다')
      .toMatch(/같은 등급 안에서는 영향 범위가 큰 순/);
  });

  it('질문 상한 3개는 그대로다 — 순서만 바꾼다', () => {
    expect(step3).toMatch(/\*\*최대 3개\*\*/);
    expect(step3, '상한을 늘리는 형태로 변질되면 인지 예산 계약이 깨진다')
      .toMatch(/상한을 늘리지 않고 \*\*순서만\*\* 바꾼다/);
  });
});

describe('D8 — vibe.spec Step 4·5·6: 되돌림 항목의 귀결', () => {
  const doc = read('skills/vibe.spec/SKILL.md');

  it('Step 4 작성 요건에 되돌리기 어려운 결정 섹션이 명시된다', () => {
    expect(doc).toMatch(/- \*\*되돌리기 어려운 결정\*\* \(해당 시에만\)/);
    expect(doc, 'Assumptions 하위 목록이면 하류가 헤딩으로 찾지 못한다')
      .toMatch(/Assumptions 안의 하위 목록이 아니라 \*\*별도 섹션\*\*/);
  });

  it('Step 5 체크리스트가 되돌림 등급 귀결을 점검한다', () => {
    expect(doc).toMatch(/- \[ \] 3-a 의 모든 항목에 되돌림 등급이 붙었고/);
    expect(doc, '0건일 때 아무것도 없어야 통과라는 조건이 체크리스트에 있어야 한다')
      .toMatch(/0건이면 섹션·블록 모두 없어야 통과/);
  });

  it('Step 6 승인 메시지 블록에 되돌림 노출 자리가 있다', () => {
    expect(doc).toMatch(/\{되돌림 노출 블록 — 아래 규칙 참조/);
  });

  it('노출 게이트가 못 되돌린다 하나로 한정된다', () => {
    expect(doc).toMatch(/\*\*노출 게이트는 `못 되돌린다` 하나뿐이다\.\*\*/);
    expect(doc, '비싸다까지 노출하면 거의 모든 SPEC 에서 블록이 떠 읽히지 않는다')
      .toMatch(/`비싸다` 는 3-b 정렬에만 쓰고 노출하지 않는다/);
  });

  it('0건이면 블록을 통째로 생략한다 (통과 의식화 방지)', () => {
    expect(doc).toMatch(/\*\*0건이면 블록을 통째로 생략한다\.\*\*/);
    expect(doc).toMatch(/해당 없는 SPEC 에서 침묵하지 않으면 통과 의식이 된다/);
  });

  it('노출 상한이 Assumptions 접기와 같은 3으로 통일된다', () => {
    expect(doc, '서로 다른 두 상한이 공존하면 직역 하네스가 어느 쪽을 쓸지 갈린다')
      .toMatch(/최대 3줄\. 초과분은 `그 외 N건은 SPEC 참조` 로 접는다/);
  });

  it('autonomous 에서는 노출이 없고 기록만 남는다', () => {
    expect(doc).toMatch(/승인 메시지 자체가 없으므로 노출도 없다/);
  });

  it('기존 Step 6 선택지 4개 고정이 보존된다 (D5 회귀 방지)', () => {
    expect(doc).toMatch(/선택지 개수는 항상 4개로 고정한다/);
  });
});

describe('D8 — spec-template: 되돌리기 어려운 결정 섹션', () => {
  const tpl = read('vibe/templates/spec-template.md');

  it('Assumptions 뒤, Constraints 앞에 위치한다', () => {
    const assumptions = tpl.indexOf('### Assumptions');
    const reversibility = tpl.indexOf('### 되돌리기 어려운 결정');
    const constraints = tpl.indexOf('### Constraints');
    expect(reversibility, '섹션이 템플릿에 없다').toBeGreaterThan(-1);
    expect(reversibility).toBeGreaterThan(assumptions);
    expect(constraints).toBeGreaterThan(reversibility);
  });

  it('해당 없으면 절을 지우라는 조건부 지시가 붙어 있다', () => {
    expect(tpl, 'Structure 절과 같은 조건부 규약이어야 통과 의식이 되지 않는다')
      .toMatch(/없으면 이 절을 통째로 지운다/);
  });

  it('줄 형식이 평문 한 줄로 고정된다', () => {
    expect(tpl).toMatch(/\{무엇을 정했는가\} → \{나중에 뒤집으면 치를 비용\}/);
  });
});
