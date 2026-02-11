# Feature: ui-ux-pro-max-integration - Phase 5: 워크플로우 통합 + 데이터 배포

**SPEC**: `.claude/vibe/specs/ui-ux-pro-max-integration/phase-5-workflow-integration.md`
**Master Feature**: `.claude/vibe/features/ui-ux-pro-max-integration/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 프레임워크 사용자
**I want** UI/UX 데이터가 자동 배포되고 워크플로우에 자연스럽게 통합되기를
**So that** 별도 설정 없이 /vibe.spec, /vibe.run, /vibe.review 에서 UI/UX 인텔리전스를 활용할 수 있다

## Scenarios

### Scenario 1: vibe update — CSV 데이터 동기화
```gherkin
Scenario: vibe update 실행 시 CSV 데이터가 글로벌 경로로 복사된다
  Given @su-record/core 패키지가 설치되어 있다
  When vibe update 를 실행한다
  Then ~/.claude/vibe/ui-ux-data/ 에 37개 CSV 파일이 복사된다
  And version.json 이 생성/업데이트된다
```
**Verification**: SPEC AC #1

### Scenario 2: 신규 설치 — postinstall 자동 복사
```gherkin
Scenario: npm install 시 CSV 데이터가 자동 배포된다
  Given 새로운 환경에 @su-record/core 를 설치한다
  When postinstall 스크립트가 실행된다
  Then ~/.claude/vibe/ui-ux-data/ 디렉토리가 생성된다
  And 37개 CSV 파일이 자동 복사된다
```
**Verification**: SPEC AC #2

### Scenario 3: 데이터 버전 체크 — delta sync
```gherkin
Scenario: 변경된 파일만 업데이트한다
  Given ~/.claude/vibe/ui-ux-data/version.json 에 v1.0.0 이 기록되어 있다
  And 패키지의 version.json 이 v1.1.0 이다
  When vibe update 를 실행한다
  Then 변경된 CSV 파일만 복사된다
  And version.json 이 v1.1.0 으로 업데이트된다
```
**Verification**: SPEC AC #3

### Scenario 4: 데이터 무결성 — 파일 수 검증
```gherkin
Scenario: 복사 후 파일 수와 헤더를 검증한다
  Given vibe update 가 완료되었다
  When 무결성 검증을 수행한다
  Then ~/.claude/vibe/ui-ux-data/ 에 정확히 37개 파일이 존재한다
  And 각 CSV 파일의 헤더에 필수 컬럼이 존재한다
```
**Verification**: SPEC Phase 5-1 #3

### Scenario 5: /vibe.spec — UI 키워드 감지 시 ①②③ 실행
```gherkin
Scenario: "landing page" SPEC에서 UI 에이전트가 자동 실행된다
  Given 사용자가 /vibe.spec "landing page" 를 실행한다
  When "landing" 키워드가 감지된다
  Then ① ui-industry-analyzer 가 실행된다
  And ①의 결과로 ② ui-design-system-gen 과 ③ ui-layout-architect 가 병렬 실행된다
  And SPEC의 <context> 에 ### Design System 섹션이 추가된다
```
**Verification**: SPEC AC #4

### Scenario 6: /vibe.spec — 비-UI 프로젝트 비활성
```gherkin
Scenario: API 서버 프로젝트에서 UI 에이전트가 실행되지 않는다
  Given 사용자가 /vibe.spec "REST API server" 를 실행한다
  When context에 UI/UX 키워드가 없다
  Then ①②③ 에이전트가 실행되지 않는다
```
**Verification**: SPEC AC #5

### Scenario 7: /vibe.run — ④ 항상 실행
```gherkin
Scenario: 모든 프로젝트에서 ④ 스택 구현자가 실행된다
  Given /vibe.run "my-feature" 가 실행된다
  And FrameworkDetector 가 프레임워크를 감지했다
  When Phase 시작 전 에이전트가 실행된다
  Then ④ ui-stack-implementer 가 항상 실행된다
  And 결과가 구현 에이전트 컨텍스트에 주입된다
```
**Verification**: SPEC AC #6

### Scenario 8: /vibe.run — ⑤ 조건부 실행
```gherkin
Scenario: 차트 키워드가 있을 때만 ⑤가 실행된다
  Given SPEC에 "dashboard with charts" 가 포함되어 있다
  When /vibe.run 이 실행된다
  Then ⑤ ui-dataviz-advisor 가 실행된다

  Given SPEC에 차트 관련 키워드가 없다
  When /vibe.run 이 실행된다
  Then ⑤ 는 실행되지 않는다
```
**Verification**: SPEC AC #6

### Scenario 9: /vibe.run — MASTER.md 자동 참조
```gherkin
Scenario: 디자인 시스템이 구현 컨텍스트에 자동 로드된다
  Given .claude/vibe/design-system/my-project/MASTER.md 가 존재한다
  When /vibe.run "my-project" 가 실행된다
  Then MASTER.md 내용이 구현 에이전트 시스템 프롬프트에 주입된다
  And CSS 변수, 색상 팔레트, 폰트 정보를 직접 참조할 수 있다
```
**Verification**: SPEC AC #7

### Scenario 10: /vibe.review — UI 파일 변경 시 ⑥⑦⑧ 실행
```gherkin
Scenario: UI 파일 변경 시 리뷰 에이전트가 활성화된다
  Given 변경 파일에 .tsx 파일이 포함된다
  When /vibe.review 가 실행된다
  Then ⑥ ux-compliance-reviewer 가 실행된다
  And ⑦ ui-a11y-auditor 가 실행된다
  And ⑧ ui-antipattern-detector 가 실행된다
  And findings 가 기존 리뷰와 통합되어 P1/P2/P3 정렬된다
```
**Verification**: SPEC AC #8

### Scenario 11: /vibe.review — UI 파일 미변경 시 비활성
```gherkin
Scenario: UI 파일 변경이 없으면 리뷰 에이전트가 비활성화된다
  Given 변경 파일이 .ts, .json 만 있다
  When /vibe.review 가 실행된다
  Then ⑥⑦⑧ 은 실행되지 않는다
```
**Verification**: SPEC AC #9

### Scenario 12: config.json — 전체 비활성화 옵션
```gherkin
Scenario: config.json에서 UI/UX 분석을 비활성화한다
  Given .claude/vibe/config.json 에 "uiUxAnalysis": false 가 설정되어 있다
  When /vibe.spec "landing page" 를 실행한다
  Then ①②③ 에이전트가 실행되지 않는다
  When /vibe.run 을 실행한다
  Then ④⑤ 에이전트가 실행되지 않는다
  When /vibe.review 를 실행한다
  Then ⑥⑦⑧ 에이전트가 실행되지 않는다
```
**Verification**: SPEC AC #11

### Scenario 13: CLAUDE.md 업데이트
```gherkin
Scenario: CLAUDE.md에 UI/UX 에이전트 섹션이 추가된다
  Given Phase 5 구현이 완료되었다
  When CLAUDE.md 를 확인한다
  Then ### UI/UX Agents (8) 섹션이 존재한다
  And 8개 에이전트 목록과 실행 시점이 명시되어 있다
```
**Verification**: SPEC AC #12

### Scenario 14: npm 패키지 사이즈
```gherkin
Scenario: CSV 데이터 추가 후 패키지 사이즈가 허용 범위이다
  Given package.json files 배열에 vibe/ui-ux-data/ 가 추가되었다
  When npm pack --dry-run 으로 크기를 확인한다
  Then CSV 데이터로 인한 증가분이 500KB 이하이다
```
**Verification**: SPEC AC #13

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC #1 — vibe update | ⬜ |
| 2 | AC #2 — postinstall | ⬜ |
| 3 | AC #3 — delta sync | ⬜ |
| 4 | Phase 5-1 #3 — 무결성 | ⬜ |
| 5 | AC #4 — /vibe.spec 자동 | ⬜ |
| 6 | AC #5 — 비-UI 비활성 | ⬜ |
| 7 | AC #6 — ④ 항상 실행 | ⬜ |
| 8 | AC #6 — ⑤ 조건부 | ⬜ |
| 9 | AC #7 — MASTER.md 참조 | ⬜ |
| 10 | AC #8 — ⑥⑦⑧ 실행 | ⬜ |
| 11 | AC #9 — ⑥⑦⑧ 비활성 | ⬜ |
| 12 | AC #11 — 전체 비활성화 | ⬜ |
| 13 | AC #12 — CLAUDE.md | ⬜ |
| 14 | AC #13 — 패키지 사이즈 | ⬜ |
