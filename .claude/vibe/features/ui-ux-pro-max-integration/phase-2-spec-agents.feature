# Feature: ui-ux-pro-max-integration - Phase 2: SPEC 단계 에이전트

**SPEC**: `.claude/vibe/specs/ui-ux-pro-max-integration/phase-2-spec-agents.md`
**Master Feature**: `.claude/vibe/features/ui-ux-pro-max-integration/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자가 /vibe.spec 을 실행할 때
**I want** 제품 설명으로부터 디자인 전략이 자동 생성되기를
**So that** 전문 디자이너 없이도 산업별 최적 디자인 시스템, 색상, 레이아웃을 SPEC에 포함할 수 있다

## Scenarios

### Scenario 1: ① 산업 분석기 — SaaS 카테고리 매칭
```gherkin
Scenario: SaaS 프로젝트를 정확히 분류한다
  Given ui-industry-analyzer 에이전트가 활성화되었다
  And products.csv, ui-reasoning.csv 데이터가 로드되었다
  When 사용자가 "SaaS general management tool" 을 설명한다
  Then category 가 "SaaS (General)" 로 매칭된다
  And style_priority 에 "Glassmorphism", "Flat Design" 이 포함된다
```
**Verification**: SPEC AC #1

### Scenario 2: ① 산업 분석기 — Decision_Rules JSON 파싱
```gherkin
Scenario: Decision_Rules JSON을 정상 파싱한다
  Given ui-reasoning.csv 에서 SaaS 카테고리의 Decision_Rules 를 로드했다
  When JSON 파싱을 수행한다
  Then if_ux_focused, if_data_heavy 등 조건부 규칙이 추출된다
  And 해당 규칙에 따라 스타일 우선순위가 조정된다
```
**Verification**: SPEC AC #2

### Scenario 3: ① 산업 분석기 — 핀테크 다크모드 추천
```gherkin
Scenario: 핀테크 프로젝트에 다크모드를 추천한다
  Given "핀테크 대시보드" 가 입력되었다
  When ui-industry-analyzer 가 분석을 수행한다
  Then category 가 "Fintech/Crypto" 로 매칭된다
  And color_mood 에 Dark Mode 관련 추천이 포함된다
```
**Verification**: SPEC Phase 2-1 Verify

### Scenario 4: ② 디자인 시스템 생성기 — MASTER.md 생성
```gherkin
Scenario: MASTER.md에 필수 요소가 포함된다
  Given ① 분석 결과가 전달되었다 (category: "SaaS", style_priority: ["Glassmorphism"])
  When ui-design-system-gen 에이전트가 실행된다
  Then .claude/vibe/design-system/{project}/MASTER.md 가 생성된다
  And CSS 변수 (--color-primary 등) 가 포함된다
  And Google Fonts URL 이 포함된다
  And 안티패턴 목록이 포함된다
  And 컴포넌트 스펙이 포함된다
```
**Verification**: SPEC AC #3

### Scenario 5: ② 디자인 시스템 생성기 — 페이지 오버라이드
```gherkin
Scenario: 페이지 타입별 오버라이드를 자동 생성한다
  Given MASTER.md 가 생성되었다
  And SPEC에 Dashboard, Checkout 페이지가 정의되었다
  When 페이지 오버라이드 생성을 실행한다
  Then .claude/vibe/design-system/{project}/pages/dashboard.md 가 생성된다
  And .claude/vibe/design-system/{project}/pages/checkout.md 가 생성된다
  And 각 파일에 페이지별 색상/레이아웃 오버라이드가 포함된다
```
**Verification**: SPEC AC #4

### Scenario 6: ③ 레이아웃 설계자 — 랜딩 패턴
```gherkin
Scenario: 뷰티 스파 프로젝트에 Hero-Centric 패턴을 추천한다
  Given ① 분석 결과에 category: "Beauty/Spa" 가 포함된다
  When ui-layout-architect 에이전트가 실행된다
  Then pattern 이 "Hero-Centric" 을 포함한다
  And sections 에 Social Proof 섹션이 포함된다
  And cta_placement 이 정의된다
```
**Verification**: SPEC AC #5

### Scenario 7: ③ 레이아웃 설계자 — 대시보드 레이아웃
```gherkin
Scenario: 대시보드 타입에 Data-Dense 레이아웃을 설계한다
  Given ① 분석 결과에 category 가 대시보드 관련이다
  When ui-layout-architect 에이전트가 실행된다
  Then dashboard_layout 객체가 반환된다
  And grid 컬럼 수가 정의된다
  And KPI 카드 배치가 포함된다
  And 차트 배치가 포함된다
```
**Verification**: SPEC AC #6

### Scenario 8: ①→②③ 순차/병렬 실행 플로우
```gherkin
Scenario: ①이 먼저 실행되고 ②③이 병렬 실행된다
  Given /vibe.spec 에서 UI/UX 프로젝트가 감지되었다
  When 3개 에이전트를 실행한다
  Then ① ui-industry-analyzer 가 먼저 완료된다
  And ①의 결과를 입력으로 ② ui-design-system-gen 이 실행된다
  And ①의 결과를 입력으로 ③ ui-layout-architect 가 동시에 실행된다
  And ②③ 모두 완료된 후 결과가 SPEC에 주입된다
```
**Verification**: SPEC AC #7

### Scenario 9: /vibe.spec UI/UX 자동 호출
```gherkin
Scenario: UI/UX 관련 SPEC 생성 시 에이전트가 자동 호출된다
  Given 사용자가 /vibe.spec "e-commerce website" 를 실행한다
  When SPEC의 context에 "website" 키워드가 감지된다
  Then ①②③ 에이전트가 자동 실행된다
  And SPEC의 <context> 섹션에 ### Design System 하위 섹션이 추가된다
```
**Verification**: SPEC AC #8

### Scenario 10: 비-UI 프로젝트에서 비활성화
```gherkin
Scenario: CLI 도구 프로젝트에서 UI/UX 에이전트가 실행되지 않는다
  Given 사용자가 /vibe.spec "CLI database migration tool" 을 실행한다
  When SPEC의 context에 UI/UX 키워드가 없다
  Then ①②③ 에이전트가 실행되지 않는다
  And SPEC에 Design System 섹션이 추가되지 않는다
```
**Verification**: SPEC Phase 2-4 — 트리거 조건

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC #1 — SaaS 카테고리 매칭 | ⬜ |
| 2 | AC #2 — Decision_Rules JSON 파싱 | ⬜ |
| 3 | Phase 2-1 Verify — 핀테크 다크모드 | ⬜ |
| 4 | AC #3 — MASTER.md CSS 변수, Fonts | ⬜ |
| 5 | AC #4 — 페이지 오버라이드 | ⬜ |
| 6 | AC #5 — 랜딩 패턴 | ⬜ |
| 7 | AC #6 — 대시보드 레이아웃 | ⬜ |
| 8 | AC #7 — ①→②③ 실행 플로우 | ⬜ |
| 9 | AC #8 — 자동 호출 | ⬜ |
| 10 | 트리거 조건 — 비-UI 비활성화 | ⬜ |
