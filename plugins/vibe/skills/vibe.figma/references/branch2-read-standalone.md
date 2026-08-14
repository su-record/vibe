# Branch 2 — READ + 독립 규격 (--new)

> Loaded by vibe.figma SKILL.md when Branch Routing selects Branch 2. Phase 0–6 본문.

**시나리오**: 신규 독립 페이지 (랜딩, 프로토타입). 기존 컨벤션 무시, **Figma 원본 충실도 우선**.

**입력**: Figma URL 여러 개 (Branch 1과 동일 — 스토리보드 + MO/PC 자동 분류)
**출력**: `components/{feature}/` (독립 토큰, 새 컴포넌트 자유 생성)

### Phase 0 — Setup (Lite) + URL 수집

```
2. Execute the bundled implementation below — Phase 0 Setup
```

> Read `references/branch-phases.md` for the URL-reuse note and the Phase 0 (Lite) skip list (component-index/project-tokens).

### Phase 1 — Storyboard 분석 (선택)

```
Execute the bundled implementation below — Phase 1
   → Branch 1 Phase 1과 동일 (storyboard URL이 있으면 분석, 없으면 SKIP)
```

### Phase 2 — 재료 확보

```
Execute the bundled implementation below — Phase 2 Extract Mode
   → Branch 1 Phase 2와 동일 (design URL로 추출)

   🚦 Audit gate: Branch 1과 동일하게 `auditSummary.p1 > 0` 이면 Phase 3 진입 금지.
```

### Phase 3 — 데이터 정제

```
Execute the bundled implementation below — Phase 3 (figma-refine.js 강제)
```

### Phase 4 — BP별 스태틱 구현 (Standalone 모드)

```
Execute the bundled implementation below — Phase 4 Convert Mode
```

> Read `references/branch-phases.md` for the Standalone-mode reuse/token rules (Branch 2, Phase 4).

### Phase 5 — 컴파일 게이트

```
Execute the bundled implementation below — Phase 5
```

### Phase 6 — 시각 검증 + a11y (MANDATORY)

```
Execute the bundled implementation below — Phase 6 (시각 검증 루프, P1=0까지)

⤵ Phase 6 후처리
Load skill `vibe.design-review` — audit 모드
   → a11y는 항상 검증. 컨벤션 무시 모드여도 접근성은 양보 불가.

⛔ Phase 6 + design-review(audit) 완료 전까지 "완료 요약" 출력 금지.
```

> Read `references/branch-phases.md` for the raw-vs-computed note and Phase 6.5 DESIGN.md emission steps (Branch 2).

---

