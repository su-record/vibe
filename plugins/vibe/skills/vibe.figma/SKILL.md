---
name: vibe.figma
description: Figma 디자인을 코드로 옮기거나 구현 계획을 Figma에 반영할 때 — READ(Figma→Code)와 WRITE(plan→Figma)를 라우팅한다.
argument-hint: "[<figma-url>... | <plan.md>] [--new] [--create | --create-storyboard | --create-design] [--teach]"
user-invocable: true
---

# /vibe.figma

Figma와 코드 사이의 **양방향 라우터**. 인자 조합으로 분기를 결정하고, 분기에 맞는 스킬을 순차 로드한다.

## Usage

```
# Branch 1: READ — 컨벤션 준수
/vibe.figma                                          # 인터랙티브 (URL 줄바꿈으로 입력)
/vibe.figma <design-url>                             # 디자인 1개
/vibe.figma <storyboard-url> <mo-url> <pc-url>       # 스토리보드 + MO + PC 한 번에
/vibe.figma <mo-url> <pc-url>                        # MO + PC만

# Branch 2: READ — 독립 페이지 (컨벤션 무시)
/vibe.figma --new
/vibe.figma --new <mo-url> <pc-url>

# Branch 3: WRITE — plan.md → Figma 디자인 생성
/vibe.figma <plan.md> --create                       # full (와이어 + 본 디자인)
/vibe.figma <plan.md> --create-storyboard            # 와이어만 (Step E 생략)
/vibe.figma <plan.md> --create-design                # 본 디자인만 (Step D 생략)

# 공통
/vibe.figma --teach                                  # 어느 branch든 design-teach를 인터랙티브로 강제
```

> **URL 분류는 자동 처리됩니다** — fileKey가 다른 URL은 스토리보드 vs 디자인으로, ROOT 노드 name의 "MO"/"PC"로 디바이스를 구분합니다. 사용자는 URL 종류를 신경 쓰지 않고 한 번에 던지면 됩니다.

## Branch Routing (필수: 첫 단계에서 결정)

다음 알고리즘을 **그대로** 실행한다. 추정 금지.

```
Step 1) 플래그 수집
  hasCreate           = args에 "--create" 포함 (정확히 일치, 아래 두 플래그와 별개)
  hasCreateStoryboard = args에 "--create-storyboard" 포함
  hasCreateDesign     = args에 "--create-design" 포함
  hasNew              = args에 "--new" 포함
  hasTeach            = args에 "--teach" 포함
  hasNewState         = args에 "--new-state" 포함 (Branch 3 전용: state 파일 무시하고 새로 그림)
  hasEmitDesignMd     = args에 "--emit-design-md" 포함 (Branch 1/2 전용: READ 완료 후 DESIGN.md 출력)
  hasReadDesignMd     = 프로젝트 루트에 DESIGN.md 존재 (Branch 3 전용: WRITE 시 톤·팔레트 우선 입력)

Step 2) 위치 인자 분류
  positional  = 모든 비-플래그 인자
  mdArg       = positional 중 .md 로 끝나는 첫 번째 항목 (없으면 null)
  urlArgs     = positional 중 "figma.com/" 포함 항목 (배열, 0개 이상 가능)

Step 3) Create 모드 결정
  createFlags = [hasCreate, hasCreateStoryboard, hasCreateDesign].filter(x => x).length

  createFlags == 0 → createMode = null      (Branch 3 아님)
  createFlags == 1:
    hasCreate            → createMode = "full"
    hasCreateStoryboard  → createMode = "storyboard"
    hasCreateDesign      → createMode = "design"
  createFlags >= 2 → ❌ "--create / --create-storyboard / --create-design 중 하나만 사용 가능합니다."

  isBranch3 = (createMode != null)

Step 4) 모순 검증 (즉시 reject — 진행 금지)
  isBranch3 AND hasNew                  → ❌ "--create-* 와 --new는 함께 사용할 수 없습니다."
  isBranch3 AND mdArg == null           → ❌ "--create-* 는 plan.md 경로가 필요합니다.
                                              예: /vibe.figma .vibe/plans/foo.md --create"
  isBranch3 AND urlArgs.length > 0      → ❌ "--create-* 모드에서는 figma URL을 위치 인자로 받지 않습니다.
                                              target 파일은 Step B에서 질문합니다."
  NOT isBranch3 AND mdArg != null       → ⚠ "plan.md를 받았지만 --create-* 플래그가 없습니다.
                                              Branch 3을 의도하셨나요? 어느 모드를 원하시나요?
                                                1) --create            (full: 와이어 + 본 디자인)
                                                2) --create-storyboard (와이어만)
                                                3) --create-design     (본 디자인만)
                                                4) abort"

Step 5) Branch 결정
  isBranch3   → Branch 3 (WRITE) — createMode 사용
  hasNew      → Branch 2 (READ, 독립)
  default     → Branch 1 (READ, 컨벤션)

Step 6) Branch 컨텍스트에 다음을 binding:
  {urlArgs, hasTeach, hasNewState, mdArg, createMode}
  - Branch 1/2는 urlArgs / hasTeach 를 사용 (URL 여러 개를 한 번에 스킬에 전달)
  - Branch 3은 mdArg / createMode / hasTeach / hasNewState 를 사용

결정 후, 해당 Branch 섹션의 Phase 순서대로 스킬을 로드/실행한다.
다른 Branch의 Phase는 절대 섞지 않는다.
```

## Context Reset

**이 커맨드 실행 시 이전 대화 무시.**
스토리보드/plan.md 스펙 > Figma 데이터 > 프로젝트 컨벤션 순으로 우선.

> **Timer**: Query the system clock at START and record it as `{start_time}`.

---

## URL/입력 규칙 (모든 Branch 공통)

```
사용자 입력을 요청할 때 절대 선택지를 제공하지 말고 자유 텍스트로 질문한다.
각 질문의 응답을 받은 후에만 다음으로 진행.
```

---

## Branch 본문 (라우팅 결정 후 해당 파일만 로드)

**결정된 Branch의 reference 하나만 읽는다.** 세 Branch를 동시에 로드하지 않는다 —
이 스킬이 호출당 컨텍스트를 가장 많이 쓰던 원인이었다.

| Branch | 조건 | 시나리오 | 본문 |
|---|---|---|---|
| **1** READ + 컨벤션 | 기본 (플래그 없음) | 기존 프로젝트에 새 UI/페이지 추가. 기존 토큰·컴포넌트·스타일 컨벤션을 따름 | `references/branch1-read-convention.md` |
| **2** READ + 독립 | `--new` | 컨벤션을 무시한 독립 페이지 (랜딩·프로모션 등) | `references/branch2-read-standalone.md` |
| **3** WRITE | `--create` / `--create-storyboard` / `--create-design` | plan.md → Figma 디자인 생성 (createMode 매트릭스, Step A–F) | `references/branch3-write.md` |

Branch 1/2 Phase 의 상세 elaboration: `references/branch-phases.md`
Branch 3 의 state 스키마와 알고리즘: `references/state-schema.md` · `references/step-algorithms.md`

## Branch 간 절대 금지 사항

```
❌ Branch 1 도중 figma:figma-use / figma:figma-generate-design 호출 금지 (READ 모드)
❌ Branch 2 도중 design-refine(normalize) 호출 금지 (독립 모드)
❌ Branch 3 도중 figma 스킬의 Extract/Convert Mode · figma-refine.js 호출 금지 (WRITE 모드)
❌ Branch 결정 후 다른 Branch의 Phase로 점프 금지
```

## Core Principles

```
The Figma tree is the source of truth for code. Screenshots are for verification only.

✅ Figma Auto Layout → CSS Flexbox 1:1 mechanical mapping
✅ Figma CSS properties → SCSS direct conversion (no guessing)
✅ The active harness handles semantic decisions only: tag selection, component splitting, interactions
```

## Immutable Rules

```
1. Do NOT render content as images (frames with TEXT children, INSTANCEs, buttons/prices,
   whole sections). Image rendering only for BG, vector-text GROUPs, verification screenshots.
2. BG must use CSS background-image only. <img> tag is forbidden.
3. No new screenshot calls during Phase 4. Use only Phase 2 materials —
   no matter how complex, implement with HTML+CSS.
```

## 공통 구현 (READ Branch 공통 Phase 0–6)

Extract/Convert Mode 의 실제 구현 — 작업 디렉토리, BLOCKING 명령어, 컴파일 게이트, 시각 검증 루프:
`references/core-implementation.md`

```
Working directory: /tmp/{feature}/{mo,pc}-main/{tree.json, bg/, content/, sections/}
  + remapped.json ← Phase 4 의 유일한 입력
Code output: 프로젝트에 직접 — components/{feature}/, styles/{feature}/
```

## Done Criteria

- [ ] Branch Routing 알고리즘이 실행됐고 결정된 Branch 가 명시됐다
- [ ] 결정된 Branch 의 reference 하나만 로드됐다 (다른 Branch Phase 혼입 없음)
- [ ] READ Branch: Phase 5 컴파일 게이트 통과 후 Phase 6 시각 검증 P1=0
- [ ] WRITE Branch: Step F 시각 검증 + 사용자 최종 확인 완료
- [ ] 이미지 렌더링 금지 규칙(Immutable Rule 1–2) 위반 0건
