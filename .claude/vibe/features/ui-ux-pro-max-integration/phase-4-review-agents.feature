# Feature: ui-ux-pro-max-integration - Phase 4: REVIEW 단계 에이전트

**SPEC**: `.claude/vibe/specs/ui-ux-pro-max-integration/phase-4-review-agents.md`
**Master Feature**: `.claude/vibe/features/ui-ux-pro-max-integration/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자가 /vibe.review 를 실행할 때
**I want** UI/UX 전문 리뷰가 자동으로 수행되기를
**So that** UX 가이드라인 위반, 접근성 문제, 디자인 안티패턴이 배포 전에 탐지된다

## Scenarios

### Scenario 1: ⑥ UX 준수 리뷰어 — 폼 label 누락 탐지
```gherkin
Scenario: label 없는 input 필드를 Critical로 탐지한다
  Given React 컴포넌트에 <input placeholder="Email" /> 이 있다
  And label 요소나 aria-label 이 연결되지 않았다
  When ux-compliance-reviewer 가 검토한다
  Then Critical severity finding 이 생성된다
  And category 가 "Forms" 이다
  And suggestion 에 label 추가 예시가 포함된다
```
**Verification**: SPEC AC #1

### Scenario 2: ⑥ UX 준수 리뷰어 — 키보드 핸들러 누락
```gherkin
Scenario: onClick만 있고 onKeyDown이 없는 요소를 탐지한다
  Given <div onClick={fn} tabIndex={0}> 인터랙티브 요소가 있다
  And onKeyDown 핸들러가 없다
  When ux-compliance-reviewer 가 검토한다
  Then High severity finding 이 생성된다
  And issue 가 "Keyboard Handlers" 이다
  And Code Example Good 이 제시된다
```
**Verification**: SPEC AC #2

### Scenario 3: ⑥ UX 준수 리뷰어 — Do/Don't 코드 대조
```gherkin
Scenario: Don't 패턴과 매칭되는 코드를 찾는다
  Given ux-guidelines.csv 에서 Navigation 카테고리의 Don't 규칙이 로드되었다
  When 구현 코드에서 location.replace() 를 사용하고 있다
  Then finding 이 생성된다
  And Don't 에 "Break browser/app back button behavior" 가 명시된다
  And Do 에 "Preserve navigation history properly" 가 제시된다
```
**Verification**: SPEC AC #3

### Scenario 4: ⑦ 접근성 감사관 — aria-label 누락
```gherkin
Scenario: 아이콘 버튼에 aria-label이 없으면 Critical로 판정한다
  Given <button><XIcon /></button> 아이콘 버튼이 있다
  And aria-label 이 설정되지 않았다
  When ui-a11y-auditor 가 검토한다
  Then Critical severity audit_result 가 생성된다
  And wcag_criterion 이 포함된다
  And fix_example 에 <button aria-label="Close"><XIcon /></button> 가 제시된다
```
**Verification**: SPEC AC #4

### Scenario 5: ⑦ 접근성 감사관 — 비시맨틱 HTML
```gherkin
Scenario: div role="button" 대신 button 사용을 권장한다
  Given <div role="button" onClick={fn}>Submit</div> 이 있다
  When ui-a11y-auditor 가 검토한다
  Then Medium severity audit_result 가 생성된다
  And violation 에 "Use semantic HTML before ARIA attributes" 가 포함된다
  And fix_example 에 <button onClick={fn}>Submit</button> 가 제시된다
```
**Verification**: SPEC AC #5

### Scenario 6: ⑦ 접근성 감사관 — WCAG 수정 예시
```gherkin
Scenario: 모든 위반에 Code Example Good 수정 예시를 제공한다
  Given 3개의 접근성 위반이 탐지되었다
  When audit_results 를 확인한다
  Then 각 결과에 fix_example 필드가 비어있지 않다
  And fix_example 은 web-interface.csv 의 Code Example Good 에서 추출된다
```
**Verification**: SPEC AC #6

### Scenario 7: ⑧ 안티패턴 탐지기 — 산업별 Anti_Patterns
```gherkin
Scenario: SaaS 프로젝트에서 과도한 애니메이션을 탐지한다
  Given 프로젝트가 "SaaS (General)" 카테고리로 분석되었다
  And ui-reasoning.csv 에서 Anti_Patterns 가 "Excessive animation + Dark mode by default" 이다
  When 구현 코드에 500ms 이상의 애니메이션이 3개 이상 있다
  Then HIGH severity antipattern finding 이 생성된다
  And pattern_name 이 "Excessive animation" 이다
```
**Verification**: SPEC AC #7

### Scenario 8: ⑧ 안티패턴 탐지기 — 스타일 부적합 사용
```gherkin
Scenario: 데이터 대시보드에 Neumorphism 사용을 경고한다
  Given styles.csv 에서 Neumorphism 의 "Do Not Use For" 가 "data-heavy dashboards" 를 포함한다
  And 프로젝트가 데이터 대시보드이다
  When ui-antipattern-detector 가 검토한다
  Then antipattern finding 이 생성된다
  And description 에 "Neumorphism은 data-heavy dashboard에 적합하지 않음" 이 포함된다
  And recommendation 에 대안 스타일이 제시된다
```
**Verification**: SPEC AC #8

### Scenario 9: ⑧ 안티패턴 탐지기 — 디자인 시스템 일관성
```gherkin
Scenario: MASTER.md에 정의된 CSS 변수 미사용을 탐지한다
  Given MASTER.md 에 --color-primary: #4A90D9 가 정의되어 있다
  When 구현 코드에서 하드코딩된 color: #4A90D9 를 사용한다
  Then antipattern finding 이 생성된다
  And recommendation 에 "var(--color-primary) 사용" 이 제시된다
```
**Verification**: SPEC AC #9

### Scenario 10: ⑥⑦⑧ 기존 리뷰와 병렬 실행
```gherkin
Scenario: 기존 13개 리뷰 에이전트와 병렬로 실행된다
  Given /vibe.review 가 실행되었다
  And 변경 파일에 .tsx 파일이 포함된다
  When 리뷰 에이전트들이 실행된다
  Then ⑥⑦⑧ 이 기존 13개 에이전트와 동시에 실행된다
  And 모든 findings 가 하나의 리스트로 통합된다
  And P1/P2/P3 우선순위로 정렬된다
```
**Verification**: SPEC AC #10

### Scenario 11: UI 파일 미변경 시 비활성화
```gherkin
Scenario: UI 파일 변경이 없으면 ⑥⑦⑧이 실행되지 않는다
  Given 변경된 파일이 src/lib/utils.ts 만 있다 (.ts, 비-UI)
  When /vibe.review 가 실행된다
  Then ⑥⑦⑧ 에이전트는 실행되지 않는다
  And 기존 13개 리뷰 에이전트만 실행된다
```
**Verification**: SPEC AC #11

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC #1 — 폼 label 누락 | ⬜ |
| 2 | AC #2 — 키보드 핸들러 | ⬜ |
| 3 | AC #3 — Do/Don't 대조 | ⬜ |
| 4 | AC #4 — aria-label 누락 | ⬜ |
| 5 | AC #5 — 비시맨틱 HTML | ⬜ |
| 6 | AC #6 — WCAG 수정 예시 | ⬜ |
| 7 | AC #7 — 산업별 Anti_Patterns | ⬜ |
| 8 | AC #8 — 스타일 Do Not Use For | ⬜ |
| 9 | AC #9 — 디자인 시스템 일관성 | ⬜ |
| 10 | AC #10 — 병렬 실행 | ⬜ |
| 11 | AC #11 — 비활성화 | ⬜ |
