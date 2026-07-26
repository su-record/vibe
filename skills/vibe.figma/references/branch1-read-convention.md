# Branch 1 — READ + 프로젝트 컨벤션 준수

> Loaded by vibe.figma SKILL.md when Branch Routing selects Branch 1. Phase 0–6 본문.

**시나리오**: 기존 프로젝트에 새 UI/페이지를 추가. 기존 디자인 토큰·컴포넌트·스타일 컨벤션을 따른다.

**입력**: Figma URL 여러 개 (스토리보드 + MO/PC 디자인을 한 번에). URL 종류 자동 분류.
**출력**: 프로젝트 `components/{feature}/`, `styles/{feature}/` (기존 토큰/컴포넌트 재사용)

### Phase 0 — Setup + URL 수집 + Project Context

```
2. Execute the bundled implementation below — Phase 0 Setup
   → 스택 감지, 디렉토리, 피처명, component-index.json, project-tokens.json

> Read `references/branch-phases.md` for URL pre-collection rules and the design-context loading algorithm (Phase 0, Branch 1).

     - hasTeach == true → 이때만 Load skill `vibe.design-teach`로 인터랙티브 진입
```

### Phase 1 — Storyboard 분석 (선택)

```
Execute the bundled implementation below — Phase 1 Storyboard
```

> Read `references/branch-phases.md` for the storyboard auto-detect/auto-skip rule and output scope (Branch 1, Phase 1).

### Phase 2 — 재료 확보

```
Execute the bundled implementation below — Phase 2 Extract Mode (코디네이터: MO/PC 병렬 워커)
   → tree.json + bg/ + content/ + sections/ (검증용)
```

> Read `references/branch-phases.md` for the input-selection detail and the Audit gate rule (tree.json `auditSummary`, P1/P2 handling).

### Phase 3 — 데이터 정제

```
Execute the bundled implementation below — Phase 3
   ⛔ figma-refine.js 강제 (자체 정제 스크립트 금지)
   → /tmp/{feature}/{bp}-main/sections.json
```

### Phase 4 — BP별 스태틱 구현 (컨벤션 준수)

```
Execute the bundled implementation below — Phase 4 Convert Mode

⤵ Phase 4 후처리
Load skill `vibe.design-refine` — normalize 모드
   → 매칭 안 된 하드코딩 값 → MASTER.md 토큰으로 정렬
   → 새 토큰 필요 항목은 review 큐에 기록
```

> Read `references/branch-phases.md` for the reuse-matching (BLOCKING) rule and the figma-to-scss/figma-validate gate.

### Phase 5 — 컴파일 게이트

```
Execute the bundled implementation below — Phase 5
   → tsc/build/dev 서버. P1=0까지 루프. Stuck → 사용자 질문.
```

### Phase 6 — 시각 검증 + 품질 점검 (MANDATORY)

```
Execute the bundled implementation below — Phase 6 (시각 검증 루프, P1=0까지)

⤵ Phase 6 후처리
Load skill `vibe.design-review` — audit 모드
   → 5-dimension 점검 (a11y, performance, responsive, theming, AI slop)
   → P1 finding은 review 큐에 기록 (read-only)

⛔ Phase 6 + design-review(audit) 완료 전까지 "완료 요약" 출력 금지.
```

> Read `references/branch-phases.md` for the raw-vs-computed reconciliation detail and Phase 6.5 DESIGN.md emission steps.

---

