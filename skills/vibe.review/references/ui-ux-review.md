# Phase 2.5 — UI/UX Review Agents

> vibe.review SKILL.md Phase 2.5 에서 **변경 파일에 UI 파일이 있을 때만** 로드한다.
> UI 변경이 없는 리뷰(백엔드·CLI·설정만 변경)는 이 파일을 읽지 않는다.

### Phase 2.5: UI/UX Review Agents (Auto-triggered)

> **활성화 조건**: 변경된 파일 중 UI 파일 존재 (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`)
> **비활성화**: `.vibe/config.json`에 `"uiUxAnalysis": false` 설정

**기존 Phase 2 리뷰 에이전트와 병렬 실행 — `design-reviewer` 인스턴스 3개 (관점별):**

| Agent (관점) | Role | Output |
|-------|------|--------|
| ⑥ design-reviewer (UX 준수) | UX 가이드라인 준수 검증 | P1/P2/P3 findings |
| ⑦ design-reviewer (접근성) | WCAG 2.1 AA 접근성 감사 | P1/P2/P3 findings |
| ⑧ design-reviewer (안티패턴) | UI 안티패턴 + 디자인 시스템 일관성 | P1/P2/P3 findings |

**실행 방법 — 기존 Phase 2 에이전트와 병렬 실행:**

Use the harness's native collaboration capability for these independent
`design-reviewer` workers. Claude Code maps them to Task/Agent; Codex maps them
to native collaboration. Inherit the session model by default and run them
concurrently when capacity permits:

- UX compliance: review `{changed_ui_files}` against UX and web-interface guidance.
- Accessibility: audit `{changed_ui_files}` for WCAG 2.1 AA compliance.
- Anti-patterns: inspect `{changed_ui_files}` and compare with `.vibe/design-system/{project}/MASTER.md` when present.

#### Visual P1 Baseline

- 프로젝트 루트에 `DESIGN.md` 가 존재하면 **시각 P1 의 1 차 baseline** 으로 사용한다 (§2 Color Palette / §7 Do's & Don'ts).
- `DESIGN.md` 부재 시 기존 폴백을 사용 (WCAG 2.1 AA + `MASTER.md` + design-review(audit 모드) 기본 5 차원).
- v1 범위: hex 컬러 드리프트만 P1 후보. spacing / font 드리프트는 Phase 2+ 에서 추가.
- 안티패턴 검출(⑧) 은 `DESIGN.md §7` 의 "DON'T" 항목을 우선 규칙으로 사용한다.

**findings 통합**: ⑥⑦⑧ findings를 기존 findings[]와 병합 → P1/P2/P3 통합 정렬

**⑦ Critical finding 에스컬레이션**: design-reviewer(접근성)의 P1 finding은 Review Debate(Phase 4.5)에 자동 포함
