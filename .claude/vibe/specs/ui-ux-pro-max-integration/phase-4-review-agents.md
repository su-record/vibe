---
status: pending
phase: 4
parentSpec: _index.md
depends: [phase-1-data-engine]
---

# SPEC: Phase 4 — REVIEW 단계 에이전트 (품질 검증)

## Persona
<role>
UI/UX 품질 보증 전문가 + 웹 접근성(WCAG) 인증 감사관. 100개 UX 가이드라인, 32개 웹 인터페이스 규칙, 102개 UI 추론 규칙에 대한 심층 이해. Claude Code 리뷰 에이전트 패턴 준수.
</role>

## Context
<context>
### Background
`/vibe.review` 실행 시, 기존 13개 리뷰 에이전트와 함께 UI/UX 전문 리뷰를 수행하는 3개 에이전트 필요. 코드와 디자인 시스템을 교차 검증하여 UX 위반, 접근성 문제, 안티패턴을 탐지.

### CSV 데이터 구조
- **ux-guidelines.csv** (100행): Category, Issue, Platform, Description, Do, Don't, Severity
- **web-interface.csv** (32행): Category, Issue, Keywords, Description, Do, Don't, Code Example Good/Bad, Severity
- **ui-reasoning.csv** (102행): UI_Category, Anti_Patterns, Decision_Rules (JSON), Severity
- **styles.csv** (~67행): Style Category, Do Not Use For, Accessibility, Performance, Complexity

### Phase 1 도구
- `core_ui_search(query, domain, maxResults)` — 도메인별 검색
- `core_ui_stack_search(query, stack, maxResults)` — 스택별 검색

### 기존 리뷰 에이전트 패턴
- `agents/review/security-reviewer.md` — findings[] 형식, P1/P2/P3 우선순위
- `agents/review/architecture-reviewer.md` — 위반 탐지 + 개선 제안
- `agents/review/complexity-reviewer.md` — 정량적 메트릭 기반 판정
</context>

## Task
<task>
### Phase 4-1: ⑥ ux-compliance-reviewer 에이전트
1. [ ] `agents/ui/ux-compliance-reviewer.md` 생성
   - **역할**: 구현 코드가 UX 가이드라인을 준수하는지 검증
   - **모델**: Haiku
   - **도구**: Read, Glob, Grep + `core_ui_search`
   - **데이터 범위**: ux-guidelines.csv (100행) + web-interface.csv (32행)
   - **프로세스**:
     1. 변경된 파일 목록 수집 (Glob)
     2. UI 컴포넌트/페이지 코드 식별
     3. `core_ui_search(componentType, "ux", 5)` → 관련 가이드라인 로드
     4. `core_ui_search(componentType, "web", 3)` → 웹 인터페이스 규칙 로드
     5. Do/Don't 기준으로 코드 대조 (Grep)
     6. 위반 사항을 severity별 정렬 (Critical → High → Medium → Low)
   - **출력**: findings[] (severity, category, issue, violation, suggestion, code_location)
   - **검증 카테고리** (18개): Navigation, Animation, Layout, Touch, Interaction, Accessibility, Performance, Forms, Responsive, Typography, Feedback, Content, Onboarding, Search, Data Entry, AI Interaction, Spatial UI, Sustainability
   - Verify: 폼 컴포넌트에서 label 없는 input → Critical finding

### Phase 4-2: ⑦ ui-a11y-auditor 에이전트
2. [ ] `agents/ui/ui-a11y-auditor.md` 생성
   - **역할**: WCAG 2.1 AA 기준 접근성 감사
   - **모델**: Haiku
   - **도구**: Read, Glob, Grep + `core_ui_search`
   - **데이터 범위**: web-interface.csv Accessibility 카테고리 (~20행) + ux-guidelines.csv Accessibility 카테고리 + styles.csv Accessibility 컬럼 + charts.csv Accessibility Notes 컬럼
   - **프로세스**:
     1. 변경된 UI 파일 식별 (JSX/TSX/HTML/Vue/Svelte)
     2. `core_ui_search("accessibility", "web", 10)` → 접근성 규칙 전체 로드
     3. 정적 분석 체크리스트:
        - `aria-label` 존재 여부 (아이콘 버튼)
        - `label` 또는 `aria-label` (폼 컨트롤)
        - `onKeyDown` 동반 여부 (onClick 요소)
        - 시맨틱 HTML 사용 (`button` vs `div role="button"`)
        - `aria-live` 존재 (비동기 업데이트 영역)
        - 색상 대비 (styles.csv Accessibility 컬럼 참조)
        - 차트 접근성 (charts.csv Accessibility Notes 참조)
     4. 위반 사항별 Code Example Good 제시
   - **출력**: audit_results[] (wcag_criterion, severity, element, violation, fix_example, code_location)
   - **Severity 매핑**:
     - Critical: 스크린 리더 완전 차단 (aria-label 미존재, label 미존재)
     - High: 키보드 접근 불가 (onKeyDown 누락, tabIndex 미설정)
     - Medium: 비시맨틱 HTML, aria-live 누락
     - Low: 색상 대비 개선 권장
   - Verify: `<button><XIcon /></button>` → Critical (aria-label 누락)

### Phase 4-3: ⑧ ui-antipattern-detector 에이전트
3. [ ] `agents/ui/ui-antipattern-detector.md` 생성
   - **역할**: 산업/스타일별 안티패턴 탐지 + 디자인 시스템 일관성 검증
   - **모델**: Haiku
   - **도구**: Read, Glob, Grep + `core_ui_search`
   - **데이터 범위**: ui-reasoning.csv Anti_Patterns (102행) + styles.csv Do Not Use For (~67행)
   - **프로세스**:
     1. 프로젝트의 디자인 시스템 로드 (`.claude/vibe/design-system/{project}/MASTER.md`)
     2. MASTER.md에서 카테고리/스타일 추출
     3. `core_ui_search(category, "ui-reasoning", 1)` → 해당 카테고리의 Anti_Patterns 로드
     4. `core_ui_search(style, "style", 1)` → 해당 스타일의 Do Not Use For 로드
     5. 구현 코드에서 안티패턴 매칭:
        - 과도한 애니메이션 (duration > 500ms, 3개 이상 동시 애니메이션)
        - 스타일 부적합 사용 (예: Neumorphism in data-heavy dashboard)
        - 접근성 저해 스타일 (예: Glassmorphism on low-contrast background)
        - Decision_Rules JSON 위반 (if_* 조건 미충족)
     6. 디자인 시스템 일관성 검증 (CSS 변수 미사용, 정의된 폰트 미준수)
   - **출력**: antipatterns[] (pattern_name, severity, category, description, found_in, recommendation)
   - Verify: Fintech 프로젝트에서 과도한 애니메이션 → HIGH finding

### Phase 4-4: /vibe.review 파이프라인 연동
4. [ ] `/vibe.review` 스킬에서 ⑥⑦⑧ 자동 실행 로직 추가
   - 기존 13개 리뷰 에이전트와 병렬 실행
   - UI 파일 변경 감지 시에만 활성화 (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`)
   - 결과는 기존 findings 형식과 통합 (P1/P2/P3 우선순위 매핑)
   - **Finding 중복 제거**: 동일 `{file}:{line}:{rule_type}` 키를 가진 findings 병합 (severity가 더 높은 쪽 우선)
5. [ ] Priority 매핑 규칙
   - Critical severity → P1 (머지 차단)
   - High severity → P2 (수정 권장)
   - Medium/Low severity → P3 (백로그)
</task>

## Constraints
<constraints>
- ⑥⑦⑧ 모두 Read-only (코드 수정 권한 없음 — 리뷰 에이전트)
- findings 형식은 기존 `agents/review/` 패턴과 동일하게 유지
- UI 파일이 없는 프로젝트에서 ⑥⑦⑧ 실행하지 않음
- Severity 판정은 CSV 데이터의 Severity 컬럼을 우선 따름
- 디자인 시스템(MASTER.md)이 없는 프로젝트에서 ⑧의 일관성 검증은 스킵
</constraints>

## Output Format
<output_format>
### Files to Create
- `agents/ui/ux-compliance-reviewer.md`
- `agents/ui/ui-a11y-auditor.md`
- `agents/ui/ui-antipattern-detector.md`

### Files to Modify
- `/vibe.review` 관련 스킬 — ⑥⑦⑧ 호출 로직 추가

### Verification
- React 프로젝트에서 접근성 위반 코드 작성 → ⑦이 Critical finding 생성
- SaaS 프로젝트에서 부적합 스타일 사용 → ⑧이 antipattern finding 생성
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] ⑥ 폼에 label 없는 input 탐지 → Critical finding (web-interface.csv #2 기반)
- [ ] ⑥ 키보드 핸들러 누락 탐지 → High finding (web-interface.csv #3 기반)
- [ ] ⑥ Do/Don't 기준 코드 대조 동작
- [ ] ⑦ aria-label 누락 아이콘 버튼 탐지 → Critical
- [ ] ⑦ 비시맨틱 HTML 사용 탐지 → Medium (div role="button" vs button)
- [ ] ⑦ WCAG 기준 코드 수정 예시 제공 (Code Example Good)
- [ ] ⑧ 산업별 Anti_Patterns 매칭 (ui-reasoning.csv 기반)
- [ ] ⑧ 스타일별 Do Not Use For 매칭 (styles.csv 기반)
- [ ] ⑧ 디자인 시스템 MASTER.md 일관성 검증
- [ ] ⑥⑦⑧ 기존 13개 리뷰 에이전트와 병렬 실행
- [ ] UI 파일 변경 없는 커밋에서 ⑥⑦⑧ 비활성화
</acceptance>
