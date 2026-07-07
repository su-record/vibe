# Branch 1 / Branch 2 Phase Detail — Full Reference

> Loaded by vibe.figma SKILL.md Branch 1 (READ + 컨벤션) and Branch 2 (READ + 독립) phase bodies for the full elaboration beyond the `Load skill` call itself.

## Branch 1 Phase 0 — URL 수집 + Design Context 로드

```
1. URL 수집 (스킬 진입 전)
   - urlArgs.length > 0 → 그대로 figma 스킬에 전달 (인터랙티브 질문 생략)
   - urlArgs.length == 0 → figma 스킬이 인터랙티브로 줄바꿈 입력 받음
   ⚠ URL 분류(storyboard vs design, MO vs PC)는 스킬이 자동 처리 — router는 개입하지 않음
     · fileKey 다름 → storyboard vs design
     · ROOT 노드 name에 "MO"/"PC" → 디바이스 구분
```

```
3. Design context 로드 (non-interactive 기본)
   ⛔ design-teach 스킬을 자동으로 로드하지 말 것 (인터랙티브라 흐름이 끊김)

   알고리즘:
     - Read .vibe/design-context.json
     - 존재 → 메모리에 binding 후 계속
     - 없음 → 다음 한 줄만 출력하고 계속:
         "💡 design-context.json 없음 — 기본값으로 진행합니다.
          톤/팔레트/타이포 가이드를 적용하려면 /design-teach 또는
          /vibe.figma --teach 로 다시 실행하세요."
```

## Branch 1 Phase 1 — Storyboard 분석 상세

```
   Phase 0에서 수집한 URL 중 "storyboard"로 자동 분류된 항목이 있으면 분석.
   없으면 이 Phase는 자동 SKIP (스킬 내부 처리).

   → 섹션 목록 + 기능 정의 + TypeScript 인터페이스 초안
   ❌ 코드 파일 생성 금지
```

## Branch 1 Phase 2 — Audit Gate

```
   Phase 0에서 수집한 URL 중 "design"으로 자동 분류된 항목 (MO/PC)을 사용.
   → tree.json + bg/ + content/ + sections/ (검증용)

   🚦 Audit gate (tree.json 루트 `auditSummary` 사용):
     - `auditSummary.p1 > 0` → Phase 3 진입 금지. 각 항목을 해결(디자인 레이어 교체,
       근사치 수용 승인, 알려진 편차로 기록) 후 재추출.
     - P2 항목은 피처 노트에 기록 → Phase 6 리뷰 대상.
```

## Branch 1 Phase 4 — 재사용 매칭 (BLOCKING)

```
   재사용 매칭 (BLOCKING):
     ① component-index.json 매칭 → import (새로 만들지 않음)
     ② project-tokens.json 매칭 → @use (새 토큰 생성 최소화)

   ⛔ figma-to-scss.js 강제 / figma-validate.js PASS 없이 다음 섹션 금지
```

## Branch 1 Phase 6 — Raw-vs-Computed 재조정 + Phase 6.5

```
   Raw-vs-computed 재조정:
     - tree.json 각 노드의 `raw` 필드(itemSpacing, padding*, fontSize, lineHeightPx,
       letterSpacing, strokeWeight, cornerRadius 등 Figma 원본 수치)를
       브라우저 `getComputedStyle`과 비교한다.
     - 허용 오차 초과 시 P1 issue (gap/padding 0.5px, fontSize 0.25px, lineHeight 0.5px).
     - Figma MCP/변환기가 삼킨 값이 여기서 드러난다.
```

```
⤵ Phase 6.5 (hasEmitDesignMd == true 시)
   → resolved tokens (Color/Typography/Spacing) + design-review(audit) 산출물을
     DESIGN.md (Stitch 9 섹션) 으로 정제해 프로젝트 루트에 저장
   → 첫 줄: `<!-- design-md-version: 1 -->`
   → `vibe.design lint` 자동 통과 확인
```

## Branch 2 Phase 0 — Setup (Lite)

```
1. URL 수집 — Branch 1 Phase 0와 동일 (urlArgs 있으면 전달, 없으면 인터랙티브)

2. Load skill `figma` — Phase 0 Setup
   → 스택만 감지. 디렉토리 생성.
   ⛔ component-index.json 인덱싱 SKIP
   ⛔ project-tokens.json 스캔 SKIP
   (재사용 매칭을 강제하지 않으므로 인덱스 불필요)
```

## Branch 2 Phase 4 — Standalone 모드 세부

```
   ⛔ 재사용 매칭 SKIP — 새 컴포넌트 자유 생성
   ✅ 새 토큰 자유 생성 (피처 스코프 네이밍: $feature-color-xxx)
   ✅ figma-to-scss.js / figma-validate.js는 그대로 강제

   ❌ design-refine(normalize) 호출 금지 (이 Branch는 토큰 alignment 대상이 아님)
```

## Branch 2 Phase 6 — 시각 검증 + a11y 세부

```
   Raw-vs-computed 재조정: Branch 1과 동일 — tree.json `raw` ↔ getComputedStyle 비교.
```

```
⤵ Phase 6.5 (hasEmitDesignMd == true 시)
   → resolved tokens + design-review(audit) 산출물을
     DESIGN.md (Stitch 9 섹션) 으로 정제해 프로젝트 루트에 저장
   → 첫 줄: `<!-- design-md-version: 1 -->`
```
