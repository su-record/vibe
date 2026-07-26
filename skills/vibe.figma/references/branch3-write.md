# Branch 3 — WRITE (plan.md → Figma)

> Loaded by vibe.figma SKILL.md when Branch Routing selects Branch 3 (--create / --create-storyboard / --create-design). createMode 매트릭스와 Step A–F 본문.

**시나리오**: plan.md의 UI 서술(Look & Feel, 레이아웃, 반응형)을 Figma 파일에 디자인으로 생성.

**입력**:
- 라우팅에서 받은 `mdArg` (필수, .md 경로)
- 라우팅에서 받은 `createMode` ∈ {full, storyboard, design}
- target Figma file URL/key (Step B에서 질문)

**출력**: 지정된 Figma 파일 내 새 페이지/프레임/섹션

> **Phase 명명 주의**: Branch 3은 `figma` 스킬의 Phase 0~6과 충돌을 피하기 위해 **Step A~F**로 표기한다.
> **2단계 생성 원칙**: `createMode == full`이면 본 디자인 직진 금지. 반드시 **와이어프레임(Step D) → 사용자 검토 → 본 디자인(Step E)** 순서.

### createMode별 실행 매트릭스

> Read `references/step-algorithms.md` for the full per-Step createMode matrix (A–F × full/storyboard/design) and the `design` mode Step E branching summary.

### Step A — plan.md 파싱 + 디자인 컨텍스트

> Read `references/step-algorithms.md` for the full plan.md required-section extraction list, missing-section rejection message, feature-name rule, and design-context priority resolution.

```
   - hasTeach == true 인 경우에만 Load skill `vibe.design-teach`로 인터랙티브 보강

3. Load skill `vibe.ui-ux-pro-max`
   → plan.md의 분위기/타이포/컬러 키워드로 가이드 매칭
   → 컬러 팔레트, 폰트 페어링, UX 가이드 후보 생성
```

### Step B — Figma 타겟 파일 + State 로드 + Plugin 규칙

> Read `references/step-algorithms.md` for the user-input prompt, fileKey extraction, and state-file path detail.

```
4. Load skill `figma:figma-use` (MANDATORY prerequisite)
   → use_figma 호출 규칙 (color 0-1, 폰트 로드, layoutSizing 순서 등)

5. Load skill `figma:figma-generate-design`
   → 디자인 시스템 컴포넌트 발견 + 섹션별 조립 워크플로
```

> Read `references/state-schema.md` for the full state JSON schema, wireHash/designHash rationale, and reuse/reject algorithm.

### Step C — 디자인 시스템 발견

```
⛔ createMode == "storyboard" 인 경우 이 Step 전체 SKIP
   (와이어는 컴포넌트/변수 정보가 필요 없음)

Load skill `figma:figma-generate-design` — Step 2: Discover Design System
```

> Read `references/step-algorithms.md` for the full 2a/2b/2c discovery sub-steps and unmatched-token prompt.

### Step D — 와이어프레임 생성 (incremental + idempotent)

**목적**: plan.md 8번(레이아웃)만으로 회색 박스 + 텍스트 placeholder의 골격을 그린다. 컬러/타이포/컴포넌트 인스턴스는 **금지**.

```
⛔ createMode == "design" 인 경우 이 Step 전체 SKIP
   (디자인만 모드는 Step E로 직진 — 와이어 단계 통째로 생략)

Load skill `figma:figma-generate-design` — Step 3 패턴 재사용 (와이어 모드)

   Step D 종료 직전:
     state.updatedAt = now
     Write /tmp/{feature}/figma-create-state.json
```

> Read `references/step-algorithms.md` for the full per-section wire generation algorithm (신규/캐시/구조변경 케이스), incremental-call rule, and responsive handling.

#### 🚪 사용자 검토 게이트 (Step D ↔ Step E 사이)

```
⛔ createMode != "full" 인 경우 이 게이트 SKIP
   - storyboard 모드: Step E가 없어서 게이트 의미 없음 → 곧바로 Step F로
   - design 모드: Step D가 없어서 게이트 의미 없음 → Step E 먼저 실행

1. mcp__plugin_figma_figma__get_screenshot 으로 와이어 프레임들 캡처
```

> Read `references/step-algorithms.md` for the full user review-gate message template and ralph/ultrawork auto-continue behavior.

### Step E — 본 디자인 적용 (incremental + idempotent)

**목적**: plan.md 7번+8번+9번 기반으로 컴포넌트 인스턴스/색/타이포/실제 텍스트를 그린다. 모드에 따라 wireNodeId 재사용 여부가 달라진다.

```
⛔ createMode == "storyboard" 인 경우 이 Step 전체 SKIP
   (와이어만 모드는 Step E 없이 Step F로)

Load skill `figma:figma-generate-design` — Step 3+: Assemble Sections (디자인 모드)

   Step E 종료 직전:
     state.planHash = sha256(plan.md 전체)
     state.updatedAt = now
     Write /tmp/{feature}/figma-create-state.json
```

> Read `references/step-algorithms.md` for the full 분기 A (full 모드) / 분기 B (design 모드) pseudocode and common rules (incremental use_figma calls, wireNodeId preservation).

### Step F — 시각 검증 + 최종 사용자 확인

```
1. mcp__plugin_figma_figma__get_screenshot 으로 생성된 프레임 캡처
   - createMode == "storyboard" → wireNodeId들 캡처
   - createMode == "design"     → designNodeId들 캡처
   - createMode == "full"        → designNodeId들 캡처
```

> Read `references/step-algorithms.md` for the full per-mode LLM self-check list and final user-facing summary template.

```
⛔ Step F 완료 전까지 "완료 요약" 출력 금지.
⛔ 코드 파일 생성 절대 금지 (이 Branch는 WRITE-to-Figma 전용).
```

---

