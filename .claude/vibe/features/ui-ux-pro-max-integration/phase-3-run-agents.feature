# Feature: ui-ux-pro-max-integration - Phase 3: RUN 단계 에이전트

**SPEC**: `.claude/vibe/specs/ui-ux-pro-max-integration/phase-3-run-agents.md`
**Master Feature**: `.claude/vibe/features/ui-ux-pro-max-integration/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자가 /vibe.run 으로 구현할 때
**I want** 프레임워크별 가이드라인과 데이터 시각화 추천을 자동으로 받기를
**So that** 프레임워크 베스트 프랙티스를 따르고 최적의 차트/시각화를 구현할 수 있다

## Scenarios

### Scenario 1: ④ 스택 구현자 — Next.js 가이드
```gherkin
Scenario: Next.js 프로젝트에서 프레임워크 가이드를 제공한다
  Given FrameworkDetector 가 Next.js 를 감지했다
  When ui-stack-implementer 에이전트가 실행된다
  Then stacks/nextjs.csv 의 54개 규칙이 로드된다
  And "form validation" 관련 가이드가 반환된다
  And Server Components 기본 사용 가이드가 포함된다
```
**Verification**: SPEC AC #1

### Scenario 2: ④ 스택 구현자 — shadcn/ui 컴포넌트 추천
```gherkin
Scenario: shadcn/ui 프로젝트에서 컴포넌트를 추천한다
  Given FrameworkDetector 가 shadcn/ui 를 감지했다
  When ui-stack-implementer 에이전트가 실행된다
  Then stacks/shadcn.csv 의 62개 규칙이 로드된다
  And 관련 컴포넌트 import 코드가 생성된다
```
**Verification**: SPEC AC #2

### Scenario 3: ④ 스택 구현자 — Lucide 아이콘 추천
```gherkin
Scenario: Lucide 아이콘을 추천하고 import 코드를 생성한다
  Given 컴포넌트에 메뉴 아이콘이 필요하다
  When core_ui_search("menu", "icons", 5) 를 호출한다
  Then Lucide React 아이콘이 추천된다
  And import { Menu } from 'lucide-react' 형태의 정확한 import 코드가 생성된다
  And 다른 아이콘 라이브러리는 추천되지 않는다
```
**Verification**: SPEC AC #3

### Scenario 4: ④ 스택 구현자 — Severity 정렬
```gherkin
Scenario: 가이드라인을 Severity 순으로 정렬한다
  Given 10개의 가이드라인 결과가 반환되었다
  When 결과를 정렬한다
  Then Critical 가이드가 가장 먼저 표시된다
  And High → Medium → Low 순서로 정렬된다
```
**Verification**: SPEC AC #4

### Scenario 5: ④ 스택 구현자 — Lazy Load
```gherkin
Scenario: 감지된 프레임워크의 CSV만 로드한다
  Given FrameworkDetector 가 React 를 감지했다
  When ui-stack-implementer 가 실행된다
  Then stacks/react.csv 만 로드된다
  And stacks/nextjs.csv, stacks/vue.csv 등 다른 스택 CSV는 로드되지 않는다
```
**Verification**: SPEC Constraints — 감지된 프레임워크 CSV만 로드

### Scenario 6: ⑤ 데이터 시각화 어드바이저 — 트렌드 차트 추천
```gherkin
Scenario: 시계열 데이터에 Line Chart를 추천한다
  Given SPEC에 "trend over time" 키워드가 포함되어 있다
  When ui-dataviz-advisor 에이전트가 실행된다
  Then chart_type 에 "Line Chart" 가 추천된다
  And library 에 "Recharts" 가 추천된다
```
**Verification**: SPEC AC #5

### Scenario 7: ⑤ 데이터 시각화 어드바이저 — 접근성 가이드
```gherkin
Scenario: 차트 접근성 가이드를 제공한다
  Given 차트 추천 결과가 반환되었다
  When accessibility 정보를 확인한다
  Then colorblind 패턴 오버레이 가이드가 포함된다
  And 스크린 리더용 대안 설명이 포함된다
```
**Verification**: SPEC AC #6

### Scenario 8: ⑤ 데이터 시각화 어드바이저 — React 성능 경고
```gherkin
Scenario: React 프로젝트에서 성능 경고를 포함한다
  Given 감지된 프레임워크가 React 이다
  And 대시보드에 5개 이상의 차트가 포함된다
  When ui-dataviz-advisor 가 실행된다
  Then react-performance.csv 기반 성능 경고가 포함된다
  And 메모이제이션, 가상화 등 최적화 권장사항이 제공된다
```
**Verification**: SPEC AC #7

### Scenario 9: ⑤ 데이터 시각화 어드바이저 — 카테고리 비교
```gherkin
Scenario: 카테고리 비교에 Bar Chart를 추천한다
  Given "카테고리별 비교" 키워드가 추출되었다
  When ui-dataviz-advisor 가 분석한다
  Then chart_type 에 "Bar Chart" 가 추천된다
  And interactive_level 에 "Hover+Sort" 가 포함된다
```
**Verification**: SPEC Phase 3-2 Verify

### Scenario 10: ⑤ 데이터 시각화 어드바이저 — 조건부 활성화
```gherkin
Scenario: 차트 키워드 없는 프로젝트에서 비활성화
  Given SPEC에 차트/대시보드/시각화 키워드가 없다
  When /vibe.run 이 실행된다
  Then ④ ui-stack-implementer 만 실행된다
  And ⑤ ui-dataviz-advisor 는 실행되지 않는다
```
**Verification**: SPEC Phase 3-2 — 활성화 조건

### Scenario 11: 디자인 시스템 자동 참조
```gherkin
Scenario: MASTER.md가 구현 컨텍스트에 자동 로드된다
  Given .claude/vibe/design-system/{project}/MASTER.md 가 존재한다
  When /vibe.run Phase 1 이 시작된다
  Then MASTER.md 가 구현 에이전트 컨텍스트에 주입된다
  And 페이지별 오버라이드가 있으면 MASTER 위에 오버라이드된다
```
**Verification**: SPEC AC #8

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC #1 — Next.js 가이드 | ⬜ |
| 2 | AC #2 — shadcn/ui 컴포넌트 | ⬜ |
| 3 | AC #3 — Lucide 아이콘 import | ⬜ |
| 4 | AC #4 — Severity 정렬 | ⬜ |
| 5 | Constraints — Lazy Load | ⬜ |
| 6 | AC #5 — Line Chart 추천 | ⬜ |
| 7 | AC #6 — 접근성 가이드 | ⬜ |
| 8 | AC #7 — React 성능 경고 | ⬜ |
| 9 | Verify — Bar Chart 추천 | ⬜ |
| 10 | 활성화 조건 — 조건부 | ⬜ |
| 11 | AC #8 — MASTER.md 참조 | ⬜ |
