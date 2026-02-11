---
status: pending
phase: 3
parentSpec: _index.md
depends: [phase-1-data-engine]
---

# SPEC: Phase 3 — RUN 단계 에이전트 (구현 지침)

## Persona
<role>
프레임워크 전문가 + 데이터 시각화 엔지니어. 13개 기술 스택의 베스트 프랙티스와 27개 차트 타입에 대한 깊은 이해. Claude Code 에이전트 아키텍처 준수.
</role>

## Context
<context>
### Background
`/vibe.run` 실행 시, 구현 단계에서 프레임워크별 가이드와 데이터 시각화 추천을 제공하는 2개 에이전트 필요.

### 프레임워크 데이터 (13개 스택)
- Next.js (54규칙, v15 변경사항 포함), React (55), shadcn/ui (62), HTML+Tailwind (57, v4 포함)
- Svelte (55, Svelte 5 Runes), Vue, Nuxt.js, Nuxt UI, Astro
- Flutter (PopScope), React Native (expo-image), SwiftUI, Jetpack Compose

### 차트 데이터 (27개 타입)
- Line, Bar, Pie/Donut, Scatter, Heatmap, Treemap, Radar, Funnel, Gauge, Gantt, Sankey, Candlestick, Area, Bubble, Waterfall, Box Plot, Violin, Parallel Coordinates, Choropleth, Network Graph, Timeline, Histogram, Stacked Bar, Grouped Bar, Polar Area (총 27개, charts.csv 기준)
- 라이브러리: Chart.js, Recharts, D3.js, ApexCharts, Plotly, Nivo, Mapbox

### Phase 1 도구
- `core_ui_stack_search(query, stack, maxResults)` — 스택 검색
- `core_ui_search(query, "chart", maxResults)` — 차트 검색
- `core_ui_search(query, "icons", maxResults)` — 아이콘 검색
- `core_ui_search(query, "react", maxResults)` — React 성능 검색

### 기존 연동 포인트
- `src/lib/FrameworkDetector.ts` — 프레임워크 자동 감지
</context>

## Task
<task>
### Phase 3-1: ④ ui-stack-implementer 에이전트
1. [ ] `agents/ui/ui-stack-implementer.md` 생성
   - **역할**: 감지된 프레임워크에 맞는 구현 가이드 + 컴포넌트 + 아이콘 추천
   - **모델**: Haiku
   - **도구**: Read, Glob, Grep + `core_ui_stack_search`, `core_ui_search`
   - **데이터 범위**: stacks/{감지된 프레임워크}.csv (Lazy Load) + icons.csv (102행)
   - **프로세스**:
     1. FrameworkDetector 결과 확인 (또는 SPEC에서 스택 정보)
     2. `core_ui_stack_search(context, detectedStack, 10)` → 관련 가이드라인
     3. `core_ui_search(componentNeeds, "icons", 5)` → 아이콘 추천
     4. Severity별 정렬 (Critical → High → Medium → Low)
     5. import 코드 생성
   - **출력**: guidelines[] (severity별), components (imports, icons, patterns)
   - Verify: Next.js 프로젝트에서 "form validation" → Server Components 기본, 인라인 에러 표시 가이드

### Phase 3-2: ⑤ ui-dataviz-advisor 에이전트
2. [ ] `agents/ui/ui-dataviz-advisor.md` 생성
   - **역할**: 데이터 타입 → 차트 타입 + 라이브러리 추천
   - **모델**: Haiku
   - **도구**: Read, Glob, Grep + `core_ui_search`
   - **데이터 범위**: charts.csv (27행), react-performance.csv (46행 — 대시보드일 때)
   - **활성화 조건**: SPEC/구현에 차트/대시보드/데이터 시각화 키워드 있을 때만
   - **프로세스**:
     1. 데이터 타입 키워드 추출 ("매출 추이" → "trend, time-series")
     2. `core_ui_search(keywords, "chart", 3)` → 차트 추천
     3. `core_ui_search(framework, "react", 5)` → 성능 주의사항 (React 프로젝트일 때)
     4. 라이브러리/접근성/성능/인터랙션 레벨 종합
   - **출력**: recommendations[] (chart_type, library, color_guidance, accessibility, performance, interactive_level)
   - Verify: "카테고리별 비교" → Bar Chart, Recharts, Hover+Sort

### Phase 3-3: /vibe.run 파이프라인 연동
3. [ ] `/vibe.run` Phase 1 시작 전에 ④⑤ 자동 실행
   - ④는 항상 실행 (프레임워크 감지 후)
   - ⑤는 조건부 (차트/대시보드 키워드 존재 시)
   - 결과를 구현 에이전트 컨텍스트에 주입
4. [ ] 디자인 시스템 참조 로직
   - `.claude/vibe/design-system/{project}/MASTER.md` 존재 시 자동 로드
   - 페이지별 오버라이드 `pages/{page}.md` 존재 시 MASTER 위에 오버라이드
</task>

## Constraints
<constraints>
- ④는 감지된 프레임워크 CSV만 로드 (13개 전부 로드 금지)
- ⑤는 대시보드/차트가 아닌 프로젝트에서 실행하지 않음
- 아이콘은 Lucide React만 추천 (다른 라이브러리 추천 금지 — CSV 데이터 일관성). 단, React/Vue/Svelte 외 네이티브 스택(SwiftUI, Flutter, Jetpack Compose)에서는 아이콘 추천 생략
- import 코드는 정확한 문법으로 생성 (예: `import { Menu } from 'lucide-react'`)
- ⑤ 차트 라이브러리 추천 시 프레임워크 호환성 확인 필수 (예: Recharts → React only, Chart.js → 범용, D3.js → 범용). `src/lib/ui-ux/constants.ts`에 호환성 매트릭스 정의
- FrameworkDetector 감지 실패 시 기본 스택: "html-tailwind" (가장 범용적)
</constraints>

## Output Format
<output_format>
### Files to Create
- `agents/ui/ui-stack-implementer.md`
- `agents/ui/ui-dataviz-advisor.md`

### Files to Modify
- `/vibe.run` 관련 스킬 — ④⑤ 호출 로직 추가

### Verification
- Next.js + shadcn/ui 프로젝트에서 대시보드 구현 시 ④⑤ 모두 동작
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] ④ Next.js 감지 → stacks/nextjs.csv 54개 규칙 기반 가이드 제공
- [ ] ④ shadcn/ui 감지 → stacks/shadcn.csv 62개 규칙 기반 컴포넌트 추천
- [ ] ④ Lucide 아이콘 추천 + import 코드 생성 (102개 DB 기반)
- [ ] ④ Severity 정렬 (Critical 먼저 표시)
- [ ] ⑤ "trend over time" → Line Chart, Recharts 추천
- [ ] ⑤ 접근성 가이드 포함 (colorblind 패턴 오버레이 등)
- [ ] ⑤ 성능 경고 포함 (React 프로젝트 시 react-performance.csv 참조)
- [ ] 디자인 시스템 MASTER.md 자동 참조 동작
</acceptance>
