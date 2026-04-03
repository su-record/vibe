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
  → Phase 1: Storyboard (선택 — 레이아웃+컴포넌트 구성 + 기능 주석)
  → Phase 2: Design (최소 뷰포트 퍼스트 → 브레이크포인트별 반복)
  → Phase 3: Verification (Grep 체크 + 스크린샷 비교)
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

## Phase 1: Storyboard

```
AskUserQuestion: "스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"

"없음" → Phase 2로 건너뜀 (디자인 URL만으로 진행)
```

### 1-1. 스토리보드 분석

```
URL에서 fileKey, nodeId 추출
get_metadata(fileKey, nodeId) → 프레임 목록

프레임 분류:
  SPEC — 기능 정의서 → get_design_context로 텍스트 추출
  CONFIG — 해상도/브레이크포인트 → 스케일 팩터 계산
  SHARED — GNB/Footer/Popup → 공통 컴포넌트 파악
  PAGE — 화면설계 → 섹션 목록 + 인터랙션 스펙
```

### 1-2. 레이아웃 + 컴포넌트 구성 (코드 생성)

```
스토리보드에서 파악한 섹션 구조로 실제 파일을 생성한다.

1. 루트 페이지 파일 생성 (Write):
   pages/{feature}.vue (또는 app/{feature}/page.tsx)
   → 모든 섹션 컴포넌트 import + 순서대로 배치
   → 팝업/모달 조건부 렌더링

2. 섹션 컴포넌트 파일 생성 (Write):
   components/{feature}/HeroSection.vue
   components/{feature}/DailyCheckInSection.vue
   components/{feature}/PlayTimeMissionSection.vue
   ...PAGE 프레임 수만큼

   각 컴포넌트에 반드시 포함:

   <template>:
     - 섹션 제목 <h2> (스토리보드에서 추출한 실제 텍스트)
     - 설명 텍스트 <p>
     - 리스트 렌더링 (v-for + 목 데이터)
     - 버튼/CTA (실제 라벨 + @click 핸들러)
     - 조건부 렌더링 (상태에 따른 v-if)
     → 빈 template 금지. 브라우저에서 텍스트가 보여야 함.

   <script setup>:
     - JSDoc 주석으로 기능 요구사항 작성:
       /**
        * 일일 출석 미션 섹션
        *
        * [기능 정의]
        * - 매일 출석 시 스노우 토큰 즉시 지급
        * - 누적 3/5/7일 달성 시 추가 보상
        *
        * [인터랙션]
        * ① 출석하기 클릭 → API호출 → 토큰지급 표시
        * ② 누적 보상 클릭 → 보상 수령
        *
        * [상태] default, checked, reward-claimed
        */
     - TypeScript 인터페이스
     - 목 데이터 (빈 배열 금지, 3~7개 아이템)
     - 이벤트 핸들러 stub (body는 // TODO:)

   <style> 블록 없음 — 스타일은 Phase 2에서 외부 파일로.

3. 공통 컴포넌트 (SHARED에서 파악):
   → 프로젝트에 이미 있으면 import 재사용
   → 없으면 새로 생성 (GNB, Footer, Popup)

4. 스타일 디렉토리 구조 생성 (빈 파일):
   styles/{feature}/index.scss
   styles/{feature}/_tokens.scss
   styles/{feature}/_mixins.scss
   styles/{feature}/_base.scss
   styles/{feature}/layout/
   styles/{feature}/components/
```

### 1-3. 검증

```
Phase 1 완료 조건:
  □ 브라우저에서 열면 각 섹션의 텍스트/리스트/버튼이 보인다
  □ 클릭하면 핸들러가 실행된다
  □ 모든 컴포넌트에 [기능 정의] + [인터랙션] + [상태] JSDoc
  □ 빈 배열 0개, 빈 template 0개, <style> 블록 0개
  □ 빌드 성공

빈 화면 = Phase 1 미완성. Phase 2로 넘어가지 않는다.
스타일/이미지는 없어도 됨 — Phase 2에서 채움.
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

Phase 1에서 컴포넌트가 이미 존재 (레이아웃 + 기능 주석 + 목 데이터).
Phase 2에서는 이 컴포넌트에 **디자인(이미지 + 스타일)**을 입힌다.

```
모바일 퍼스트 강제. CSS base = 최소 뷰포트, @media (min-width:)로 확장.

1. AskUserQuestion: "가장 작은 뷰포트의 디자인 Figma URL을 입력해주세요."
   → base 스타일로 처리.

2. 처리 완료 후:
   AskUserQuestion: "다음 브레이크포인트 디자인 URL을 입력해주세요. (없으면 '없음')"
   → URL 입력 → @media (min-width:) 레이어 추가
   → 처리 완료 후 다시: "다음 브레이크포인트 디자인 URL을 입력해주세요. (없으면 '없음')"
   → ...
   → "없음" → Phase 3으로

브레이크포인트는 프레임 width에서 자동 산출.
예: 720px → 480px(스케일), 2560px → 1920px(스케일) → @media (min-width: 1024px)
```

### 2-1. 스타일 파일 내용 작성 (첫 섹션 전)

```
Phase 1에서 빈 파일로 만든 스타일 구조에 기본 내용 Write:
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

#### d. Phase 1 컴포넌트 template 리팩토링

```
vibe-figma-convert 스킬 참조.

Phase 1에서 만든 컴포넌트의 template을 참조 코드 기반으로 리팩토링.
script(JSDoc 주석, 인터페이스, 목 데이터, 핸들러)는 보존.

template 변경 사항:
  - 참조 코드의 HTML 구조를 프로젝트 스택으로 변환
  - 이미지 경로를 다운로드된 로컬 경로로 설정
  - 배경 이미지 섹션은 Multi-Layer 구조 (.{section}Bg + .{section}Content)
  - 클래스명을 외부 스타일 파일의 셀렉터와 매칭
  - Phase 1의 기능 요소(v-for, @click, v-if)를 새 구조에 재배치

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

### 2-3. 두 번째 URL부터: 반응형 레이어 추가

```
두 번째 이후 URL 처리 시, 이미 스타일이 존재하므로:
  기존 스타일은 유지하고 반응형만 추가.

  같은 값 → 유지
  다른 px 값 → clamp() 또는 @media 오버라이드
  다른 레이아웃 → @media (min-width: $breakpoint) 추가
  다른 배경 이미지 → @media 이미지 분기
  기존 코드/스타일 삭제 금지
```

---

## Phase 3: Verification

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
