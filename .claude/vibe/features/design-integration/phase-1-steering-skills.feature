# Feature: design-integration — Phase 1: Steering Skills

**SPEC**: `.claude/vibe/specs/design-integration/phase-1-steering-skills.md`
**Master Feature**: `.claude/vibe/features/design-integration/_index.feature`

## User Story (Phase Scope)
**As a** 프론트엔드 개발자
**I want** `/design-audit`, `/design-critique`, `/design-polish` 등의 디자인 커맨드를 사용
**So that** UI 구현 과정에서 체계적으로 디자인 품질을 점검하고 개선할 수 있다

## Scenarios

### Scenario 1: design-audit으로 기술 품질 점검
```gherkin
Scenario: Run design-audit on a React component
  Given 프로젝트에 design-audit skill이 설치되어 있다
  And UI 컴포넌트 파일이 존재한다
  When 사용자가 "/design-audit dashboard"를 실행한다
  Then 5개 차원(Accessibility, Performance, Responsive, Theming, AI Slop) 스코어가 출력된다
  And 각 이슈에 P0-P3 심각도가 태깅된다
  And 코드 수정 없이 리포트만 출력된다
```
**Verification**: SPEC AC #3

### Scenario 2: design-critique으로 UX 리뷰
```gherkin
Scenario: Run design-critique on landing page
  Given 프로젝트에 design-critique skill이 설치되어 있다
  When 사용자가 "/design-critique landing-page"를 실행한다
  Then Nielsen 10 heuristics 기반 스코어(0-4)가 출력된다
  And 5가지 페르소나 관점의 red flags가 식별된다
```
**Verification**: SPEC AC #4

### Scenario 3: design-polish로 최종 패스 적용
```gherkin
Scenario: Run design-polish before shipping
  Given 프로젝트에 design-polish skill이 설치되어 있다
  And UI 구현이 완료된 상태이다
  When 사용자가 "/design-polish checkout-form"을 실행한다
  Then 정렬, 간격, 인터랙션 상태가 점검된다
  And 발견된 이슈가 직접 수정 적용된다
```
**Verification**: SPEC AC #1, #2

### Scenario 4: design-normalize으로 토큰 정렬
```gherkin
Scenario: Normalize hardcoded values to design tokens
  Given 프로젝트에 MASTER.md가 존재한다
  And CSS에 하드코딩된 색상값(#3B82F6)이 있다
  When 사용자가 "/design-normalize"을 실행한다
  Then 하드코딩된 값이 CSS 변수(var(--color-primary))로 교체된다
```
**Verification**: SPEC AC #1

### Scenario 5: design-distill로 단순화
```gherkin
Scenario: Distill complex UI to essential elements
  Given UI에 장식적 요소가 과도하게 포함되어 있다
  When 사용자가 "/design-distill settings-page"를 실행한다
  Then 불필요한 시각 요소가 식별되어 제거된다
  And 핵심 기능에 집중하는 UI로 단순화된다
```
**Verification**: SPEC AC #1

### Scenario 6: design-teach로 디자인 컨텍스트 수집
```gherkin
Scenario: Gather design context for new project
  Given 프로젝트에 design-context.json이 없다
  When 사용자가 "/design-teach"를 실행한다
  Then 코드베이스에서 기존 디자인 정보를 자동 탐색한다
  And 사용자에게 대상 사용자, 브랜드 성격 등을 질문한다
  And 결과를 .claude/vibe/design-context.json에 저장한다
```
**Verification**: SPEC AC #5

### Scenario 7: AI Slop 패턴 탐지
```gherkin
Scenario: Detect AI-generated aesthetic patterns
  Given ui-antipattern-detector에 AI Slop Tells 섹션이 추가되어 있다
  When UI 코드에 cyan-on-dark 색상 조합이 사용되었다
  Then AI Generated Aesthetic 카테고리로 탐지된다
  And 구체적 대안이 제안된다
```
**Verification**: SPEC AC #6

### Scenario 8: Web frontend 스택에 자동 설치
```gherkin
Scenario: Auto-install design skills for React project
  Given typescript-react 스택의 프로젝트이다
  When vibe init을 실행한다
  Then design-audit, design-critique, design-polish, design-normalize, design-distill이 .claude/skills/에 설치된다
```
**Verification**: SPEC AC #7

### Scenario 9: Mobile 스택에 제한적 설치
```gherkin
Scenario: Install only audit and critique for Flutter project
  Given dart-flutter 스택의 프로젝트이다
  When vibe init을 실행한다
  Then design-audit, design-critique만 설치된다
  And design-polish, design-normalize, design-distill은 설치되지 않는다
```
**Verification**: SPEC AC #9

### Scenario 10: design-teach 전역 설치
```gherkin
Scenario: design-teach available globally
  Given vibe 패키지가 설치되어 있다
  When postinstall이 실행된다
  Then design-teach가 ~/.claude/skills/에 설치된다
  And 모든 프로젝트에서 사용 가능하다
```
**Verification**: SPEC AC #8

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-3 (audit 5차원 스코어링) | ✅ |
| 2 | AC-4 (critique heuristics + personas) | ✅ |
| 3 | AC-1, AC-2 (skill 존재 + frontmatter) | ✅ |
| 4 | AC-1 (normalize 동작) | ✅ |
| 5 | AC-1 (distill 동작) | ✅ |
| 6 | AC-5 (design-teach context 저장) | ✅ |
| 7 | AC-6 (antipattern AI slop) | ✅ |
| 8 | AC-7 (STACK_TO_SKILLS web) | ✅ |
| 9 | AC-9 (mobile 제한 설치) | ✅ |
| 10 | AC-8 (GLOBAL_SKILLS) | ✅ |

**Last verified**: 2026-03-31
**Quality score**: 95/100
