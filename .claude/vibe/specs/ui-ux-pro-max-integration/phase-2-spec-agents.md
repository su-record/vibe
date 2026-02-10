---
status: pending
phase: 2
parentSpec: _index.md
depends: [phase-1-data-engine]
---

# SPEC: Phase 2 — SPEC 단계 에이전트 (생성/추론)

## Persona
<role>
AI 에이전트 프롬프트 엔지니어 + UI/UX 디자인 시스템 전문가. Claude Code 에이전트 아키텍처를 이해하고, 데이터 기반 추론 에이전트를 설계. 기존 VIBE agents/ 디렉토리 패턴을 정확히 따름.
</role>

## Context
<context>
### Background
`/vibe.spec` 실행 시, 사용자의 제품 설명으로부터 디자인 전략을 자동 생성하는 3개 에이전트 필요. 이 에이전트들은 Phase 1의 검색 엔진과 도구를 사용하여 CSV 데이터를 검색하고 추론함.

### 에이전트 설계 원칙 (리서치 기반)
- **Supervisor-Worker 패턴**: ①산업분석기가 분석 결과를 ②디자인시스템 생성기와 ③레이아웃 설계자에게 전달
- **Semantic Token 3단계**: Primitive → Semantic → Component (Gemini 제안)
- **Description CSO** (superpowers 인사이트): Description에 워크플로우 요약 넣지 않음, 트리거 조건만
- **컨텍스트 최적화**: 각 에이전트가 필요한 데이터만 로드 (전체 146K 토큰 주입 금지)

### Related Code (에이전트 패턴 참조)
- `agents/planning/ux-advisor.md` — 기존 UX 에이전트 (Haiku, Read-only)
- `agents/ui-previewer.md` — 기존 UI 에이전트 (Sonnet, Write-capable)
- `agents/review/security-reviewer.md` — 리뷰 에이전트 패턴 (findings 형식)

### Phase 1 제공 도구
- `core_ui_search(query, domain, maxResults)` — BM25 검색
- `core_ui_stack_search(query, stack, maxResults)` — 스택 검색
- `core_ui_generate_design_system(query, projectName)` — 디자인 시스템 생성
- `core_ui_persist_design_system(ds, projectName, page?)` — 파일 저장
</context>

## Task
<task>
### Phase 2-1: ① ui-industry-analyzer 에이전트
1. [ ] `agents/ui/ui-industry-analyzer.md` 생성
   - **역할**: 사용자 설명 → 제품 카테고리 분석 → 디자인 전략 결정
   - **모델**: Haiku (빠른 검색/매칭)
   - **도구**: Read, Glob, Grep + `core_ui_search`
   - **데이터 범위**: products.csv (98행), ui-reasoning.csv (102행)
   - **출력**: category, style_priority[], color_mood, typography_mood, decision_rules (JSON), anti_patterns[], severity
   - **프로세스**:
     1. `core_ui_search(userDescription, "product", 3)` → 제품 타입 매칭
     2. `core_ui_search(category, "ui-reasoning", 1)` → 추론 규칙 로드
     3. Decision_Rules JSON 파싱 → 조건부 규칙 해석
     4. 구조화된 분석 결과 반환
   - Verify: "핀테크 대시보드" 입력 → "Fintech/Crypto" 카테고리 + Dark Mode 추천

### Phase 2-2: ② ui-design-system-gen 에이전트
2. [ ] `agents/ui/ui-design-system-gen.md` 생성
   - **역할**: ①의 분석 결과 → MASTER.md 디자인 시스템 생성
   - **모델**: Sonnet (생성 작업)
   - **도구**: Read, Write, Glob, Grep + `core_ui_search`, `core_ui_generate_design_system`, `core_ui_persist_design_system`
   - **데이터 범위**: styles.csv (BM25 Top-3), colors.csv, typography.csv
   - **출력**: MASTER.md (CSS 변수 + 컴포넌트 스펙 + 안티패턴 + 체크리스트)
   - **프로세스**:
     1. ①의 style_priority로 `core_ui_search(priority, "style", 3)` → 스타일 스펙
     2. ①의 category로 `core_ui_search(category, "color", 1)` → 색상 팔레트
     3. ①의 typography_mood로 `core_ui_search(mood, "typography", 2)` → 폰트 페어링
     4. `core_ui_generate_design_system(query, projectName)` → 통합
     5. `core_ui_persist_design_system(ds, projectName)` → MASTER.md 저장
   - Verify: MASTER.md에 CSS 변수, Google Fonts URL, 안티패턴 포함

### Phase 2-3: ③ ui-layout-architect 에이전트
3. [ ] `agents/ui/ui-layout-architect.md` 생성
   - **역할**: 페이지 구조/섹션/CTA/효과 설계
   - **모델**: Haiku
   - **도구**: Read, Glob, Grep + `core_ui_search`
   - **데이터 범위**: landing.csv (32행), styles.csv 대시보드 섹션 (rows 29-38)
   - **출력**: pattern, sections[], cta_placement, color_strategy, effects[], conversion_tips, dashboard_layout (해당 시)
   - **프로세스**:
     1. ①의 category → `core_ui_search(category, "landing", 2)` → 랜딩 패턴
     2. 대시보드 타입이면 `core_ui_search(category, "style", 1)` → 대시보드 레이아웃
     3. 섹션 순서, CTA 배치, 효과 추출
   - Verify: "beauty spa" → Hero-Centric + Social Proof 패턴, "dashboard" → Data-Dense 레이아웃

### Phase 2-4: /vibe.spec 파이프라인 연동
4. [ ] `agents/ui/README.md` — 3개 에이전트 등록/활성화 방법 문서화
5. [ ] `/vibe.spec` 스킬에서 UI/UX 프로젝트 감지 시 3개 에이전트 자동 호출 로직 추가
   - 트리거: SPEC의 context에 UI/UX 키워드 포함 (website, landing, dashboard, app, e-commerce, portfolio, SaaS, mobile app, web app, UI, UX, frontend, 디자인)
   - 실행 순서: ①→②③ (①이 supervisor, ②③은 ①의 결과로 병렬 실행)
   - **에이전트 간 데이터 전달**: ①의 결과를 `.claude/vibe/design-system/{project}/analysis-result.json`에 저장 (스키마: `{ category, style_priority[], color_mood, typography_mood, decision_rules, anti_patterns[], severity }`)
   - ②③은 `analysis-result.json`을 Read tool로 로드하여 입력으로 사용
   - 결과는 SPEC의 `<context>` 섹션에 `### Design System` 하위로 자동 주입
</task>

## Constraints
<constraints>
- 에이전트 MD 파일은 기존 패턴 따름 (YAML frontmatter 없이 Markdown)
- Description에 워크플로우 요약 넣지 않음 (Description CSO)
- 각 에이전트는 자기 데이터 범위만 사용 (전체 CSV 주입 금지)
- ①은 반드시 ②③보다 먼저 실행 (의존성)
- ②③은 ①의 결과를 입력으로 받아 병렬 실행 가능
- agents/ui/ 디렉토리에 배치
</constraints>

## Output Format
<output_format>
### Files to Create
- `agents/ui/ui-industry-analyzer.md`
- `agents/ui/ui-design-system-gen.md`
- `agents/ui/ui-layout-architect.md`

### Files to Modify
- `/vibe.spec` 관련 스킬 — UI/UX 에이전트 호출 로직 추가

### Verification
- "핀테크 대시보드" 입력 → ①분석→②MASTER.md 생성→③레이아웃 설계 전체 플로우 동작
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] ① "SaaS general" 입력 → category: "SaaS (General)", style_priority: ["Glassmorphism", "Flat Design"]
- [ ] ① Decision_Rules JSON 파싱 성공 (if_*, must_have 조건 해석)
- [ ] ② MASTER.md 생성 — CSS 변수(--color-primary 등), Google Fonts URL, 컴포넌트 스펙 포함
- [ ] ② 페이지 오버라이드 생성 — 페이지 타입 자동 감지 (Dashboard, Checkout 등)
- [ ] ③ 랜딩 패턴 선택 — 섹션 순서, CTA 배치, 효과 포함
- [ ] ③ 대시보드 레이아웃 — grid 컬럼 수, KPI 카드, 차트 배치 포함
- [ ] ①→②③ 순차/병렬 실행 플로우 동작
- [ ] `/vibe.spec`에서 UI/UX 프로젝트 감지 시 자동 호출
</acceptance>
