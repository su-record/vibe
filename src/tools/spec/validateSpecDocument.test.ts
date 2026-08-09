/**
 * SPEC Code Guard 테스트.
 *
 * 검사 항목은 취향이 아니라 하류가 실제로 요구하는 것이다 — 각 케이스가 어떤
 * 하류 고장에 대응하는지 함께 적는다.
 */
import { describe, it, expect } from 'vitest';
import { validateSpecDocument, formatSpecValidation, featureSlugFromPath } from './validateSpecDocument.js';

/** 통과하는 최소 SPEC */
const VALID_SPEC = `# SPEC: Login

- **Stakes**: production — 기존 코드 위 작업

## 1. Overview / Goal
로그인 기능을 추가한다.

## 2. Requirements

| ID | Requirement | Done |
|---|---|---|
| REQ-login-001 | 사용자가 이메일로 로그인한다 | D1 |

## 3. Done Criteria (deterministic gates)

| # | Criterion | Verified by |
|---|---|---|
| D1 | 모든 시나리오 통과 | \`npx vitest run\` exit 0 |

## 4. Scenarios
- 정상 로그인
`;

const codesOf = (content: string, specPath?: string): string[] =>
  validateSpecDocument(content, { specPath }).findings.map(f => f.code);

describe('validateSpecDocument — 통과 케이스', () => {
  it('최소 요건을 갖춘 SPEC 은 통과한다', () => {
    const r = validateSpecDocument(VALID_SPEC, { specPath: '.vibe/specs/login.md' });
    expect(r.valid).toBe(true);
    expect(r.findings.filter(f => f.severity === 'P1')).toEqual([]);
    expect(r.requirementIds).toEqual(['REQ-login-001']);
  });

  it('P2 만 있으면 통과한다 (Scenarios 누락)', () => {
    const r = validateSpecDocument(VALID_SPEC.replace('## 4. Scenarios\n- 정상 로그인\n', ''));
    expect(r.valid).toBe(true);
    expect(codesOf(VALID_SPEC.replace('## 4. Scenarios\n- 정상 로그인\n', ''))).toContain('no-scenarios');
  });
});

describe('REQ ID — RTM 이 게이트로 동작하기 위한 조건', () => {
  it('REQ 가 없으면 P1 (RTM 이 status:empty → 판정불가)', () => {
    const spec = VALID_SPEC.replace('REQ-login-001', 'LOGIN-1');
    const r = validateSpecDocument(spec);
    expect(r.valid).toBe(false);
    expect(r.findings[0].code).toBe('no-requirement-ids');
  });

  /**
   * RTM 은 featureName 을 파일 탐색에만 쓰고 REQ 는 슬러그와 무관하게 전부 파싱한다.
   * 즉 게이트가 깨지지는 않는다 — 규약 이탈이므로 P2 로 알리고 통과는 막지 않는다.
   */
  it('파일명과 슬러그가 다르면 P2 (게이트는 깨지지 않는다)', () => {
    const r = validateSpecDocument(VALID_SPEC, { specPath: '.vibe/specs/signup.md' });
    const finding = r.findings.find(f => f.code === 'requirement-id-slug-mismatch');
    expect(finding?.severity).toBe('P2');
    expect(r.valid).toBe(true);
  });

  it('슬러그 불일치는 건수를 모아 한 번만 보고한다', () => {
    const spec = VALID_SPEC.replace(
      '| REQ-login-001 | 사용자가 이메일로 로그인한다 | D1 |',
      '| REQ-login-001 | A | D1 |\n| REQ-login-002 | B | D1 |',
    );
    const hits = validateSpecDocument(spec, { specPath: '.vibe/specs/signup.md' })
      .findings.filter(f => f.code === 'requirement-id-slug-mismatch');
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain('2건');
  });

  it('분할 SPEC 은 디렉토리명을 슬러그로 본다', () => {
    expect(featureSlugFromPath('.vibe/specs/checkout/_index.md')).toBe('checkout');
    expect(featureSlugFromPath('.vibe/specs/login.md')).toBe('login');
  });

  it('중복 ID 는 한 번만 보고한다', () => {
    const spec = VALID_SPEC + '\n추가 언급: REQ-login-001 참조\n';
    expect(validateSpecDocument(spec).requirementIds).toEqual(['REQ-login-001']);
  });
});

describe('Stakes — 디스패처 입력', () => {
  it('없으면 P1', () => {
    expect(codesOf(VALID_SPEC.replace(/- \*\*Stakes\*\*.*\n/, ''))).toContain('no-stakes');
  });

  it('알 수 없는 값이면 P1', () => {
    expect(codesOf(VALID_SPEC.replace('production — 기존 코드 위 작업', 'medium'))).toContain('invalid-stakes');
  });

  it('세 값은 모두 허용한다', () => {
    for (const s of ['demo', 'prototype', 'production']) {
      const spec = VALID_SPEC.replace('production — 기존 코드 위 작업', `${s} — 근거`);
      expect(validateSpecDocument(spec).findings.map(f => f.code)).not.toContain('invalid-stakes');
    }
  });
});

describe('Done Criteria — JUDGE 입력', () => {
  it('섹션이 없으면 P1', () => {
    const spec = VALID_SPEC.replace(/## 3\. Done Criteria[\s\S]*?## 4\./, '## 4.');
    expect(codesOf(spec)).toContain('no-done-criteria');
  });

  it('제목만 있고 기준 항목이 없으면 P1', () => {
    // Requirements 표에도 `| D1 |` 이 있으므로 Done Criteria 의 행을 특정해 지운다
    const spec = VALID_SPEC.replace(/\| D1 \| 모든 시나리오 통과.*\n/, '');
    expect(spec).not.toContain('모든 시나리오 통과');
    expect(codesOf(spec)).toContain('empty-done-criteria');
  });
});

/**
 * 완료 기준 인식 범위 회귀.
 *
 * 최초 가드는 영문 `Done Criteria` 제목 + `D1` 표기만 인식해서, 실제 SPEC 17개 중
 * 12개를 "기준 없음" 으로 오판했다. 그 문서들은 결함이 아니라 표기가 달랐을 뿐이고
 * 내용은 오히려 더 결정론적이었다(`npm run build && npx vitest run` 그린 등).
 * 문자열이 아니라 의미로 찾는다 — 실측한 형식을 전부 고정한다.
 */
describe('완료 기준 — 실제 SPEC 들이 쓰는 표기', () => {
  const withSection = (section: string): string =>
    VALID_SPEC.replace(/## 3\. Done Criteria[\s\S]*?## 4\./, section + '\n\n## 4.');

  it.each([
    ['한국어 제목 + 실행 문구', '## 완료 기준\n완료 판정 = `npm run build && npx vitest run` 그린'],
    ['"Done 의 정의"', '## 목표 (Done 의 정의)\n완료 판정 = 수용 기준 전부 통과 + 빌드 그린'],
    ['"수용 기준"', '## 수용 기준\n- [ ] AC1: 모든 시나리오 통과'],
    ['"Goal — Verifiable" + G 표기', '## Goal — Verifiable\n**G1.** 60초 안에 파일이 생성된다'],
    ['Acceptance Criteria + 체크박스', '## Acceptance Criteria\n- [ ] **AC-1**: 통과한다'],
  ])('%s 를 인식한다', (_label, section) => {
    expect(validateSpecDocument(withSection(section)).findings.map(f => f.code))
      .not.toContain('no-done-criteria');
  });

  it('하위 섹션이 있어도 본문을 끝까지 본다', () => {
    // `## Acceptance Criteria` 밑에 `### …` 를 두고 그 아래 항목을 나열하는 형식
    const spec = withSection('## Acceptance Criteria\n\n### 라벨링 규칙\n\n- [ ] **AC-1**: 통과한다');
    const codes = validateSpecDocument(spec).findings.map(f => f.code);
    expect(codes).not.toContain('no-done-criteria');
    expect(codes).not.toContain('empty-done-criteria');
  });

  it('REQ 별 인라인 `- AC:` 기준도 충족으로 본다', () => {
    const spec = withSection('## 요구사항\n### REQ-login-002: 로그아웃\n- AC: 세션이 삭제된다');
    expect(validateSpecDocument(spec).findings.map(f => f.code)).not.toContain('no-done-criteria');
  });

  it('REQ 별 `| Done Criteria |` 표도 충족으로 본다', () => {
    const spec = withSection('## 요구사항\n\n| Done Criteria | Evidence Required |\n|---|---|\n| exit 0 | 명령 출력 |');
    expect(validateSpecDocument(spec).findings.map(f => f.code)).not.toContain('no-done-criteria');
  });

  it('제목만 있고 판정할 것이 없으면 여전히 잡는다', () => {
    const spec = withSection('## 완료 기준\n\n(추후 작성)');
    expect(validateSpecDocument(spec).findings.map(f => f.code)).toContain('empty-done-criteria');
  });
});

describe('placeholder — 직역 하네스가 실데이터로 넣는 것', () => {
  it('미치환 템플릿 변수는 P1', () => {
    const spec = VALID_SPEC.replace('로그인 기능을 추가한다.', '{{FEATURE_GOAL}}');
    expect(codesOf(spec)).toContain('unresolved-template-var');
  });

  it('템플릿 placeholder 는 P1', () => {
    const spec = VALID_SPEC.replace('사용자가 이메일로 로그인한다', '{Observable functional requirement}');
    expect(codesOf(spec)).toContain('unfilled-placeholder');
  });

  it('한국어 placeholder 표기도 잡는다', () => {
    expect(codesOf(VALID_SPEC.replace('로그인 기능을 추가한다.', '<채워넣을 값>')))
      .toContain('unfilled-placeholder');
  });

  it('코드펜스 안의 중괄호는 예시이므로 잡지 않는다', () => {
    const spec = VALID_SPEC + '\n```ts\nconst x = { Observable: 1 };\n```\n';
    expect(codesOf(spec)).not.toContain('unfilled-placeholder');
  });

  /**
   * 오탐 회귀 (실측 28건). SPEC 은 경로 패턴·데이터 모양·brace expansion 을
   * 인라인 코드로 정상적으로 쓴다 — 중괄호 하나만으로 판단하면 전부 잡힌다.
   */
  it.each([
    ['경로 패턴', '- 입력: `styles/{feature}/` 를 병합한다'],
    ['데이터 모양', '- `fills[0].color {r,g,b,a}` → rgba()'],
    ['파일명 패턴', '- 파일명: `{sectionPrefix}-{nodeName}.webp`'],
    ['셸 brace expansion', '- `hooks/scripts/{sentinel-guard,pre-tool-guard}.js`'],
    ['JSON 리터럴', "- stdout JSON `{decision:'block', reason:'x'}`"],
    ['명령 예시의 템플릿 변수', '- `node -e "import(\'{{VIBE_PATH_URL}}/x.js\')"`'],
  ])('인라인 코드의 %s 는 잡지 않는다', (_label, line) => {
    const codes = codesOf(VALID_SPEC + '\n' + line + '\n');
    expect(codes).not.toContain('unfilled-placeholder');
    expect(codes).not.toContain('unresolved-template-var');
  });

  it('<예시> 는 doctrine 이 권장하는 표기이므로 잡지 않는다', () => {
    // dual-harness-doctrine 운영 규칙 2 — 예시를 <예시> 로 **표기하라**는 지침이다
    expect(codesOf(VALID_SPEC + '\n- 응답 형식: <예시> 참조\n')).not.toContain('unfilled-placeholder');
  });

  it('공백 없는 중괄호는 산문 placeholder 가 아니다', () => {
    expect(codesOf(VALID_SPEC.replace('로그인 기능을 추가한다.', '경로는 .vibe/specs/{feature}.md 다')))
      .not.toContain('unfilled-placeholder');
  });

  it('같은 줄의 중복 보고는 하지 않는다', () => {
    const spec = VALID_SPEC.replace('로그인 기능을 추가한다.', '{A placeholder} 와 {B placeholder}');
    const hits = validateSpecDocument(spec).findings.filter(f => f.code === 'unfilled-placeholder');
    expect(hits).toHaveLength(1);
  });
});

describe('경계', () => {
  it('빈 SPEC 은 P1 하나로 끝낸다', () => {
    const r = validateSpecDocument('   ');
    expect(r.valid).toBe(false);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].code).toBe('empty-spec');
  });

  it('formatSpecValidation 이 통과/실패를 구분해 출력한다', () => {
    const ok = validateSpecDocument(VALID_SPEC, { specPath: '.vibe/specs/login.md' });
    expect(formatSpecValidation(ok)).toContain('✅');

    const bad = validateSpecDocument('# SPEC\n본문만 있음\n');
    expect(formatSpecValidation(bad)).toContain('❌');
    expect(formatSpecValidation(bad)).toContain('no-requirement-ids');
  });
});
