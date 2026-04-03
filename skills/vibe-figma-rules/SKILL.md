---
name: vibe-figma-rules
description: Figma to Code 공통 규칙 — Model Routing, 스택 감지, 브레이크포인트, 이미지 분류, 컴포넌트 통합
triggers: []
tier: standard
---

# Skill: vibe-figma-rules — 공통 규칙 (Single Source of Truth)

모든 vibe-figma-* 스킬이 참조하는 공통 규칙 정의.
중복 방지를 위해 **이 파일에만 정의**하고, 다른 스킬에서는 "vibe-figma-rules R-N 참조"로 사용.

---

## R-0. 설계 철학

> **비정형 레이어에서도 원본 디자인 수준의 완성도를 달성한다.**

실무 Figma 파일의 현실:
```
"Frame 633372"           ← 의미 없는 자동 이름
  "Frame 633371"         ← 중첩된 의미 없는 프레임
    "Frame 633370"       ← AI가 구조를 파악할 수 없음
```

레이어명이 "Frame 47", "Group 12"이고, Auto Layout 없이 절대 배치된 프레임이 대부분.
그러나 `get_design_context`는 레이어가 비정형이어도 **스타일 토큰 값(색상, 폰트, 간격)과
에셋 URL은 정확하게 반환**한다. 이 값들은 디자이너가 Figma UI에서 보는 것과 동일한 값이다.

### 역할 분담

```
스크린샷이 답하는 것 (구조):
  — WHAT goes WHERE: 레이아웃 구조, 섹션 경계, 이미지 배치, z-index, 겹침 관계
  — 어떤 요소가 배경인지 콘텐츠인지, 어디에 오버레이가 있는지
  — 참조 코드의 구조가 스크린샷과 다르면 → 스크린샷이 맞다

참조 코드가 답하는 것 (정확한 값):
  — EXACT VALUES: hex 색상, font-size(px), font-weight, line-height,
    padding, gap, margin, border-radius, shadow, 에셋 URL
  — 이 값들은 Figma 디자인 토큰에서 직접 추출된 것이므로 정확하다
  — 스크린샷에서 추정할 필요 없이 참조 코드의 값을 그대로 사용한다
  — 단, px 값에는 스케일 팩터를 적용해야 한다 (R-3)

스크린샷이 검증하는 것 (최종 확인):
  — 생성 코드의 렌더링 결과가 원본 스크린샷과 시각적으로 일치하는지
  — Match Score 95%+, P1=0이 완료 기준
```

### 핵심 원칙

```
1. 참조 코드의 스타일 값을 반드시 사용한다
   — get_design_context가 반환하는 색상/폰트/간격 값은 Figma 토큰에서 온 정확한 값
   — 스크린샷에서 색상을 추정하거나 폰트 크기를 눈대중으로 읽지 않는다
   — 참조 코드의 값 + 스케일 팩터 적용 = 코드에 쓸 값

2. 스크린샷으로 구조를 결정한다
   — 레이어 구조("Frame 633372")가 무의미해도 스크린샷에서 섹션 경계를 파악
   — 참조 코드의 HTML 구조가 스크린샷과 다르면 → 스크린샷 기준으로 재구성
   — 이미지 배치(배경/콘텐츠/오버레이)도 스크린샷에서 판단

3. 스크린샷으로 누락을 잡는다
   — 참조 코드에 없는 시각 요소가 스크린샷에 보이면 → 추가 구현
   — 이미지 인벤토리는 스크린샷에서 작성 (참조 코드에 없는 이미지도 잡기 위해)

4. 검증은 항상 시각적 비교로
   — 완료 기준: 원본 스크린샷 vs 생성 코드의 Match Score 95%+, P1=0
   — 코드의 "정확성"이 아니라 "보이는 결과"가 기준이다
```

### MCP 도구별 역할

```
get_design_context → 정확한 스타일 값 + 에셋 URL (코드 작성의 데이터 소스)
get_screenshot     → 구조 파악 + 누락 검출 + 최종 시각 검증 (구조의 진실)
get_metadata       → 프레임 목록 + nodeId 확보 (탐색 용도)
```

---

## R-1. Model Routing

| Step | Claude | GPT (Codex) | 이유 |
|------|--------|-------------|------|
| Step A (스토리보드 + 구조) | **Haiku → Sonnet** | — | MCP 추출 → 구조 설계 |
| Step B (디자인 추출) | **Haiku** | — | MCP + 이미지 다운로드 |
| Step B (코드 생성) | **Sonnet** | **gpt-5.3-codex-spark** (병렬) | 섹션별 컴포넌트 생성 |
| Step B (검증) | **Sonnet** | — | 이미지 비교 + auto-fix |
| Step C (추가 뷰포트) | **Haiku → Sonnet** | — | 반응형 레이어 추가 |
| Step D (공통화 + 검증) | **Sonnet** | — | 리팩토링 + 최종 검증 |
| Post (코드 리뷰) | — | **gpt-5.3-codex** | 전체 코드 품질 검증 |

### GPT 모델 선택 기준

| 모델 | config key | 용도 |
|------|-----------|------|
| `gpt-5.4` | `models.gpt` | 아키텍처 판단, 복잡한 추론 |
| `gpt-5.3-codex` | `models.gptCodex` | 코드 리뷰, 분석 (정확도 우선) |
| `gpt-5.3-codex-spark` | `models.gptCodexSpark` | 코드 생성 (속도 우선) |

`~/.vibe/config.json`의 `models`에서 오버라이드 가능.

---

## R-2. 프로젝트 스택 감지

### 2-1. Detect Stack

1. Read `.claude/vibe/config.json` → `stacks` 필드
2. config 없으면 프로젝트 파일에서 감지:

| 감지 대상 | 파일 패턴 |
|-----------|----------|
| React | `package.json` → `react` in deps |
| Vue | `package.json` → `vue` in deps |
| Next.js | `next.config.*` |
| Nuxt | `nuxt.config.*` |
| Svelte | `svelte.config.*` |
| Tailwind | `tailwind.config.*` |
| CSS Modules | `*.module.css` 패턴 |
| SCSS | `*.scss` 또는 `sass` in deps |
| CSS-in-JS | `styled-components` / `@emotion` in deps |

### 2-2. 디렉토리 감지

| 용도 | Next.js | Nuxt | React | Vue |
|------|---------|------|-------|-----|
| 페이지 | `pages/` or `app/` | `pages/` | `src/pages/` or `src/views/` | `src/views/` |
| 컴포넌트 | `components/` or `src/components/` | `components/` | `src/components/` | `src/components/` |
| 스타일 | SCSS: `assets/scss/` or `src/styles/`, CSS: `src/styles/`, Tailwind: `tailwind.config.*` |

### 2-3. Design Context 로드

순서대로 읽음 (나중 소스가 우선):

1. **`.claude/vibe/design-context.json`** — 브랜드, 접근성, 디바이스 제약
2. **`.claude/vibe/design-system/{project}/MASTER.md`** — 토큰 정의

**결정 규칙**: Figma 토큰 ≈ 기존 MASTER.md 토큰 (색상 ΔE < 5 또는 간격 ±2px) → 기존 토큰 사용, 중복 생성 금지.

---

## R-3. 브레이크포인트 + 스케일 팩터

### 소스 우선순위

| 순위 | 소스 | 방법 |
|------|------|------|
| 1 | **스토리보드** | Step A에서 추출한 `storyboardSpec.breakpoints` |
| 2 | **`~/.vibe/config.json`** | `figma.breakpoints` (CLI로 커스터마이즈) |
| 3 | **프로젝트 CSS/Tailwind** | `tailwind.config.*` → `theme.screens`, 또는 `@media` 패턴 |
| 4 | **기본값** | 아래 테이블 |

### 기본 브레이크포인트

```
breakpoint:      1024px    ← PC↔Mobile 경계 (@media min-width)
pcTarget:        1920px    ← PC 메인 타겟
mobilePortrait:   480px    ← Mobile portrait max
mobileMinimum:    360px    ← Mobile 최소 지원
designPc:        2560px    ← Figma PC 아트보드 (디자인 2x 스케일)
designMobile:     720px    ← Figma Mobile 아트보드 (디자인 2x 스케일)
```

### 스케일 팩터 계산

```
PC:     scaleFactor.pc     = pcTarget / designPc         (기본: 1920/2560 = 0.75)
Mobile: scaleFactor.mobile = mobilePortrait / designMobile (기본: 480/720 = 0.667)

적용: 코드 값 = Figma 추출 값 × scaleFactor
  - 색상 hex → 스케일 불필요
  - 타이포 (font-size, line-height) → 스케일 적용
  - 간격 (padding, gap, margin) → 스케일 적용
```

### clamp() 계산 공식

```
Step 1: Figma 값 → 타겟 값
  targetMobile = figmaMobileValue × scaleFactor.mobile
  targetPc     = figmaPcValue × scaleFactor.pc

Step 2: clamp() 생성
  minVw = mobileMinimum (360px)
  maxVw = pcTarget (1920px)
  slope = (targetPc - targetMobile) / (maxVw - minVw)
  intercept = targetMobile - slope × minVw
  → clamp({targetMobile/16}rem, {intercept/16}rem + {slope×100}vw, {targetPc/16}rem)
```

### CLI 커스터마이즈

```bash
vibe figma breakpoints                        # 현재 값 확인
vibe figma breakpoints --set breakpoint=768   # PC↔Mobile 경계 변경
```

---

## R-4. 이미지 분류 + Multi-Layer 패턴

### 분류 기준

| 판별 조건 | 분류 | 코드 패턴 |
|----------|------|----------|
| 프레임 배경이고 위에 텍스트/UI 겹침 | **Background** | `background-image` + `background-size` |
| 독립 레이어, 겹치는 요소 없음 | **Content** | `<img>` 또는 `<picture>` |
| 이름에 `icon`/`logo`/`avatar` | **Inline Asset** | `<img>` (작은 크기) |
| `scaleMode: "TILE"` 반복 패턴 | **Pattern** | `background-repeat` |
| 전체 덮음 + opacity < 1 또는 blendMode | **Overlay** | `background-image` + overlay |

### Multi-Layer 패턴 (배경 이미지 섹션 필수 구조)

```
.{section}Section          ← 레이아웃 (position: relative, overflow: hidden)
  .{section}Bg             ← 배경 이미지 — z-index: 0
  .{section}BgOverlay      ← 오버레이 (선택) — z-index: 1
  .{section}Character      ← 캐릭터/일러스트 (선택) — z-index: 2
  .{section}Content        ← 텍스트/버튼/UI — z-index: 최상위
```

```css
.{section}Section { position: relative; overflow: hidden; }
.{section}Bg {
  position: absolute; inset: 0; z-index: 0;
  background-image: url('/images/{feature}/{name}.webp');
  background-size: cover; background-position: center;
}
.{section}BgOverlay {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
}
.{section}Content { position: relative; z-index: 2; }
```

### 배경 이미지 클래스 분리 원칙

| 유형 | 클래스 예시 | 분리 이유 |
|------|-----------|----------|
| 섹션 전면 배경 | `.heroBg` | 시즌/이벤트별 이미지 교체 |
| 오버레이 | `.heroBgOverlay` | 투명도/그라데이션 독립 조절 |
| 패턴/텍스처 | `.sectionPattern` | repeat/size 별도 제어 |
| 캐릭터/일러스트 | `.heroCharacter` | 콜라보별 교체, position 조절 |
| 그라데이션 | `.sectionGradient` | 테마별 색상 변경 |

### 반응형 배경 이미지

```css
.heroBg { background-image: url('/images/hero-mobile.webp'); }
@media (min-width: var(--breakpoint)) {
  .heroBg { background-image: url('/images/hero-pc.webp'); }
}
```

### 이미지 공통 규칙

| 규칙 | 설명 |
|------|------|
| format | `.webp` 우선 (fallback: `.png`/`.jpg`) |
| alt | 레이어 이름에서 파생, 장식은 `alt=""` + `aria-hidden="true"` |
| width/height | 항상 명시 (CLS 방지), 스케일 팩터 적용 |
| loading | 뷰포트 상단 → `eager`, 나머지 → `lazy` |
| object-fit | `cover` (배경), `contain` (로고/아이콘), `fill` 금지 |

---

## R-5. 컴포넌트 통합 규칙 (80% Rule)

### 유사도 판단

```
구조 80%+ 동일 (색상/크기/텍스트만 다름)
  → 하나의 컴포넌트 + variant prop으로 통합

구조 자체가 다름 (요소 추가/제거, 레이아웃 방향 변경)
  → 별도 컴포넌트 유지
```

### 스택별 variant 구현

| Stack | 방법 |
|-------|------|
| React / Next.js | `variant` prop + 조건부 className |
| Vue / Nuxt | `variant` prop + `<slot>` |
| Svelte | `variant` prop + `<slot>` |
| React Native | `variant` prop + StyleSheet 조건 |

### Fragment / 래퍼 제거

스타일이나 이벤트가 없는 래핑 요소 → 프레임워크 제공 투명 래퍼 사용:

| Stack | 투명 래퍼 |
|-------|----------|
| React / Next.js | `<>...</>` |
| Vue / Nuxt | `<template>` (컴포넌트 루트 이외) |
| Svelte | `{#if}`, `{#each}` 블록 |

---

## R-6. 검증 루프 공통 규칙

모든 Step에서 사용하는 스크린샷 기반 검증 프로세스.

### 6-1. 원본 스크린샷 확보

```
Step A에서 get_screenshot으로 확보한 섹션별 원본 이미지를 기준으로 사용.
없으면 해당 섹션의 nodeId로 get_screenshot 재호출.

원본 = Figma 디자인 스크린샷 (디자이너 의도)
```

### 6-2. 생성 코드 렌더링 확보

```
방법 (우선순위):
  1. /vibe.utils --preview → 브라우저 렌더링 스크린샷 자동 생성
  2. dev 서버 실행 중이면 → 해당 페이지 스크린샷 (Playwright/Puppeteer)
  3. 둘 다 불가능하면 → 생성된 코드를 직접 읽고 시각적 결과를 추론

⚠️ 방법 3(코드 읽기 추론)은 최후 수단.
   가능한 한 실제 렌더링 결과를 확보해야 정확한 비교 가능.
```

### 6-3. 섹션별 비교 (전체 페이지가 아닌 섹션 단위)

```
각 섹션 컴포넌트를 개별로 비교:
  원본: Figma 섹션 스크린샷 (get_screenshot per section)
  생성: 렌더링된 섹션 스크린샷 (또는 코드 추론)

섹션별로 비교해야 하는 이유:
  - 전체 페이지 비교는 스크롤 길이 차이로 오차가 큼
  - 섹션 단위가 수정 범위를 좁힐 수 있음
  - P1 발견 시 해당 섹션만 수정 → 재비교
```

### 6-4. 비교 항목 + P1/P2 분류

| 비교 항목 | P1 (필수 수정) | P2 (권장 수정) |
|----------|---------------|---------------|
| **이미지 인벤토리** | 인벤토리에 있는 이미지가 코드에 없음 | — |
| **배경 이미지** | 누락, Multi-Layer 미적용, 경로 깨짐 | 크기/위치 미세 차이 |
| **이미지 다운로드** | 파일 미존재, 0byte, Figma URL 잔존 | — |
| **레이아웃** | 요소 배치 방향 다름, 섹션 순서 다름 | 미세 정렬 차이 |
| **색상** | 배경/텍스트색 완전히 다름 | 미세한 톤 차이 (ΔE < 10) |
| **타이포** | 제목/본문 크기 비율 다름, 굵기 다름 | ±2px 차이 |
| **간격** | 섹션 간 간격 크게 다름, 요소 겹침 | ±4px 차이 |
| **누락 요소** | 스크린샷에 보이는 요소가 코드에 없음 | — |
| **오버레이** | 배경 위 텍스트 가독성 확보 안 됨 | 투명도 미세 차이 |

### 6-5. Diff Report 출력

```markdown
## Visual Diff Report — {섹션명}

원본: Figma {섹션} 스크린샷
생성: 렌더링 결과 (또는 코드 추론)

### Match Score: {N}%

| # | 항목 | 원본 | 생성 코드 | 심각도 |
|---|------|------|----------|--------|
| 1 | 배경 이미지 | 눈 테마 + 그라데이션 | 누락 | P1 |
| 2 | 제목 font-size | ~36px (스케일 후) | 24px | P1 |
| 3 | 카드 border-radius | ~12px | 8px | P2 |
```

### 6-6. Auto-Fix Loop

```
P1이 있으면:
  1. 해당 섹션의 컴포넌트/스타일 파일 수정
  2. 수정 후 렌더링 재확보 (가능하면)
  3. 원본 스크린샷과 재비교
  4. P1=0 될 때까지 반복 — 횟수 제한 없음

같은 P1이 반복될 때:
  - 이전과 동일한 수정을 반복하지 않는다
  - 접근 방식을 바꿔서 시도한다 (다른 CSS 속성, 다른 레이아웃 전략)
  - 접근을 바꿔도 해결 안 되면 → 사용자에게 해당 항목을 보여주고 방향 확인
  - 사용자 확인 후에도 루프는 계속된다 — P1=0이 될 때까지 멈추지 않음
```

### 6-7. 완료 조건

```
✅ 모든 섹션 Match Score 95%+
✅ P1 = 0 (전 섹션)
✅ 모든 이미지 에셋 표시 + Figma 임시 URL 잔존 0건
✅ (반응형) 각 뷰포트 독립 검증 통과
✅ placeholder 0건 — "placeholder", "Key Visual Image", 빈 dashed box,
   alt="placeholder", src="" 등이 코드에 남아있으면 미완성
✅ 단색/gradient 대체 0건 — 원본에 이미지 배경인 곳이 CSS 단색으로 처리되면 미완성
✅ 텍스트 스타일 전수 적용 — 브라우저 기본 스타일(검은색 16px)로 보이는 텍스트 0건
✅ 스타일 외부 파일 — 컴포넌트 내 <style> 블록 0건, 인라인 style="" 0건
```

---

## R-7. 섹션별 분석 프로세스

### Step 1: get_design_context (스타일 값 + 에셋)

```
get_design_context(fileKey, 섹션 nodeId)
→ 참조 코드 반환 (React+Tailwind 형태)

참조 코드에서 추출하는 것 (정확한 값 — Figma 토큰에서 직접 추출됨):
  ✅ 색상: hex 값 (text-[#1B3A1D], bg-[#0A1628] 등)
  ✅ 폰트: font-size(px), font-weight, line-height, font-family
  ✅ 간격: padding, margin, gap (px)
  ✅ 장식: border-radius, box-shadow, opacity
  ✅ 에셋 URL: const xxxImage = 'https://figma.com/api/mcp/asset/...'

이 값들은 디자이너가 Figma UI 우측 패널에서 보는 것과 동일.
스크린샷에서 추정할 필요 없이 이 값을 그대로 사용한다.
단, px 값에는 스케일 팩터를 적용한다 (R-3).
```

### Step 2: get_screenshot (구조 + 이미지 인벤토리)

```
get_screenshot(fileKey, 섹션 nodeId)
→ 원본 디자인 이미지 확보

스크린샷에서 판단하는 것 (구조 — 참조 코드가 틀릴 수 있는 영역):
  ✅ 레이아웃 구조: 섹션 경계, flex/grid 방향, 요소 배치 순서
  ✅ 이미지 배치: 배경/콘텐츠/오버레이 분류, z-index 관계
  ✅ 이미지 인벤토리: 보이는 모든 이미지 목록 (참조 코드에 없는 것도 잡음)
  ✅ 겹침 구조: 텍스트-배경 관계, 오버레이 유무
  ✅ 누락 검출: 참조 코드에 없는 시각 요소 발견
```

### Step 3: 코드 생성

```
a. 참조 코드의 스타일 값을 그대로 사용하여 외부 스타일 파일 작성:
   - 색상 hex → 토큰 변수로 정의
   - font-size × scaleFactor → 토큰 변수로 정의
   - 간격 × scaleFactor → 토큰 변수로 정의

b. 스크린샷의 구조로 HTML/template 결정:
   - 레이아웃 방향, 요소 순서
   - Multi-Layer 배경 구조 (배경 이미지가 있으면)
   - 참조 코드의 구조가 스크린샷과 다르면 → 스크린샷 기준

c. 에셋 URL → 다운로드 → 로컬 경로로 교체

d. 스크린샷에 보이지만 참조 코드에 없는 요소 → 추가 구현
```

### 참조 코드의 구조가 틀릴 때

```
레이어가 "Frame 633372"면 참조 코드의 HTML 구조가 부정확할 수 있다.
이때:
  - 스타일 값(색상, 폰트, 간격)은 여전히 정확 → 그대로 사용
  - HTML 구조(어떤 요소가 어디에)만 스크린샷 기준으로 재배치
  - 에셋 URL도 여전히 유효 → 그대로 다운로드
```
