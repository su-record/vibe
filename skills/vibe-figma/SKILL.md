---
name: vibe-figma
description: Figma design to code — 스토리보드(기능) + 디자인(비주얼) → 프로덕션 코드
triggers: []
tier: standard
---

# vibe-figma — Figma Design to Code

## 금지 사항

```
❌ CSS로 이미지 재현 (삼각형/원/gradient로 나무/눈사람/배경 그리기)
❌ 이미지 다운로드 없이 코드 생성 진행
❌ 컴포넌트 파일 안에 <style> 블록 / 인라인 style=""
❌ placeholder / 빈 template / 빈 src="" 남기기
❌ CSS 값을 추정 (참조 코드에 정확한 값이 있음)
❌ 브라우저 기본 스타일(검은색 16px)로 보이는 텍스트
```

## 전체 플로우

```
/vibe.figma
  → Phase 0: Setup (스택 감지, 디렉토리 생성)
  → Phase 1: Storyboard (선택 — 기능/인터랙션/상태 추출)
  → Phase 2: Design (핵심 — 섹션별 이미지 다운로드 + CSS 추출 + 코드 생성)
  → Phase 3: Responsive (선택 — 데스크탑 디자인 추가)
  → Phase 4: Verification (Grep 체크 + 스크린샷 비교)
```

---

## Phase 0: Setup

```
1. 프로젝트 스택 감지:
   - package.json → react/vue/svelte
   - next.config.* / nuxt.config.* → 프레임워크
   - *.scss / sass in deps → SCSS
   - tailwind.config.* → Tailwind

2. 기존 스타일 디렉토리 감지:
   - assets/scss/ or src/styles/ or styles/

3. 피처명 결정:
   - Figma 파일명에서 추출 → kebab-case
   - 예: "PUBG 겨울 PC방 이벤트" → winter-pcbang

4. 디렉토리 생성:
   - components/{feature}/
   - styles/{feature}/ (layout/, components/ 하위)
   - public/images/{feature}/ (또는 static/images/{feature}/)
```

---

## Phase 1: Storyboard (선택)

```
AskUserQuestion: "스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"

"없음" → Phase 2로 건너뜀

URL 입력 시:
  1. get_metadata(fileKey, nodeId) → 프레임 목록
  2. 프레임 분류:
     SPEC — 기능 정의서 → get_design_context로 텍스트 추출
     CONFIG — 해상도/브레이크포인트 → 스케일 팩터 계산
     SHARED — GNB/Footer/Popup → 공통 컴포넌트 파악
     PAGE — 화면설계 → 섹션 목록 + 인터랙션 스펙

  3. 출력 (코드 생성 없음, 데이터만):
     storyboardContext = {
       sections: { hero: "키비주얼, 공유버튼", daily: "출석미션, 토큰지급", ... },
       interactions: { "출석하기 클릭": "API호출 → 토큰지급", ... },
       states: { daily: ["default", "checked", "claimed"], ... },
       breakpoints: { designMobile: 720, designPc: 2560, ... }  // CONFIG에서 추출
     }
```

### 스케일 팩터

```
스토리보드 CONFIG 또는 기본값에서:
  모바일: scaleFactor = 480 / 720 = 0.667 (또는 targetMobile / designMobile)
  PC:     scaleFactor = 1920 / 2560 = 0.75 (또는 targetPc / designPc)

적용 대상: font-size, padding, margin, gap, border-radius, width, height
적용 안 함: color, opacity, font-weight, z-index, line-height(단위 없을 때)
```

---

## Phase 2: Design (핵심)

```
AskUserQuestion: "모바일 디자인 Figma URL을 입력해주세요."

URL에서 fileKey, nodeId 추출
get_metadata(fileKey, nodeId) → 섹션 프레임 목록

예: [Hero(641:78151), KID(641:78152), Daily(641:78153),
     PlayTime(641:78156), Exchange(641:78157), Prize(641:78158), Caution(641:78159)]
```

### 2-1. 스타일 파일 구조 생성 (첫 섹션 전)

```
Write로 생성:
  styles/{feature}/index.scss      ← @use 진입점
  styles/{feature}/_tokens.scss    ← 빈 파일 (섹션 처리하며 채움)
  styles/{feature}/_mixins.scss    ← breakpoint mixin
  styles/{feature}/_base.scss      ← reset, font-face
  styles/{feature}/layout/         ← 디렉토리
  styles/{feature}/components/     ← 디렉토리
```

### 2-2. 섹션별 루프

**각 섹션에 대해 순서대로, 한 섹션을 완전히 완료한 후 다음으로:**

#### a. get_design_context 호출

```
get_design_context(fileKey, 섹션.nodeId)

반환되는 것:
  - const img변수명 = 'https://figma.com/api/mcp/asset/...' (이미지 에셋 URL들)
  - React+Tailwind JSX 코드 (HTML 구조 + CSS 값)
  - 스크린샷 (원본 디자인 이미지)
  - data-name 속성 (레이어 이름: "BG", "Title", "Period" 등)

이 참조 코드가 모든 작업의 기반.
```

#### b. 이미지 전부 다운로드 (BLOCKING)

```
vibe-figma-extract 스킬 참조.

참조 코드에서 모든 에셋 URL 추출 → 다운로드 → 검증.
이미지가 모두 로컬에 있어야 c 단계로 진행.
하나라도 실패하면 코드 생성하지 않음.
```

#### c. 참조 코드 → 외부 스타일 파일

```
vibe-figma-convert 스킬 참조.

참조 코드의 Tailwind 클래스에서 CSS 값 추출:
  text-[48px] → font-size: 36px (48 × 0.75)
  text-[#1B3A1D] → color: #1B3A1D
  bg-[#0A1628] → background-color: #0A1628
  pt-[120px] → padding-top: 90px (120 × 0.75)

Write/Edit:
  styles/{feature}/layout/_{section}.scss   ← 배치/구조/배경이미지
  styles/{feature}/components/_{section}.scss ← 텍스트/버튼/카드 스타일
  styles/{feature}/_tokens.scss             ← 새 토큰 추가
```

#### d. 참조 코드 → 컴포넌트 파일

```
vibe-figma-convert 스킬 참조.

참조 코드의 JSX를 프로젝트 스택으로 변환:
  - React className → Vue class / Svelte class
  - <img src={변수} → <img src="/images/{feature}/다운로드파일.webp"
  - 조건부 렌더링, 이벤트 핸들러를 프레임워크 문법으로

스토리보드 context가 있으면:
  - JSDoc 주석으로 기능/인터랙션/상태 추가
  - 인터랙션에 맞는 이벤트 핸들러 stub
  - 목 데이터 (기능 정의서에서 추출)

컴포넌트에 <style> 블록 없음. 스타일은 전부 외부 파일.
```

#### e. 섹션 검증

```
Grep으로 확인:
  □ "figma.com/api" in 생성 파일 → 0건
  □ "<style" in 컴포넌트 파일 → 0건
  □ "placeholder" in 컴포넌트 파일 → 0건
  □ 'src=""' in 컴포넌트 파일 → 0건

Read로 확인:
  □ 컴포넌트 template에 실제 HTML 태그 존재 (빈 template 아님)
  □ 외부 스타일 파일에 font-size, color, background-image 존재

Glob로 확인:
  □ 이미지 파일 존재 (public/images/{feature}/*.webp)

실패 시 → 해당 항목 수정 → 재검증
```

---

## Phase 3: Responsive (선택)

```
AskUserQuestion: "데스크탑 디자인 URL이 있나요? (없으면 '없음')"

URL 입력 시 → Phase 2와 동일한 섹션별 루프 실행.
단, 기존 코드에 반응형만 추가:
  - 같은 값 → 유지
  - 다른 px 값 → clamp(모바일스케일, calc, 데스크탑스케일)
  - 다른 레이아웃 → @media (min-width: $breakpoint) 추가
  - 다른 배경 이미지 → @media 분기
  - 기존 코드 삭제 금지
```

---

## Phase 4: Final Verification

```
자동 Grep 체크:
  □ Grep: "figma.com/api" in 모든 생성 파일 → 0건
  □ Grep: "<style" in components/{feature}/ → 0건
  □ Grep: 'style="' in components/{feature}/ → 0건
  □ Grep: "placeholder" in components/{feature}/ → 0건
  □ Grep: 'src=""' in components/{feature}/ → 0건
  □ Glob: images/{feature}/*.webp → 이미지 파일 존재

시각 검증:
  각 섹션에 대해:
    get_screenshot(섹션 nodeId) → 원본
    /vibe.utils --preview 또는 dev 서버 → 생성 결과
    → 비교, P1/P2 분류

  P1 (필수 수정): 이미지 누락, 레이아웃 구조 다름, 텍스트 스타일 미적용
  P2 (권장 수정): 미세 간격 차이, 미세 색상 차이

  P1 → 수정 → 재검증 (P1=0 될 때까지, 제한 없음)

완료 후:
  Design Quality Pipeline 안내:
    /design-normalize → /design-audit (quick)
    + /design-critique → /design-polish (thorough)
```
