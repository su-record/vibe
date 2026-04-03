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
❌ placeholder / 빈 template / 빈 src="" 남기기
❌ CSS 값을 추정 (참조 코드에 정확한 값이 있음)
❌ 브라우저 기본 스타일(검은색 16px)로 보이는 텍스트
❌ 핵심 에셋만 다운로드 (참조 코드의 모든 에셋을 빠짐없이 다운로드)
```

### 스타일 배치 규칙 (모드별)

```
일반 모드:
  ❌ 컴포넌트 파일 안에 <style> 블록 / 인라인 style=""
  ✅ 외부 SCSS 파일에만 스타일 작성

직역 모드:
  ✅ <style scoped> 블록 허용 (Tailwind→CSS 1:1 변환)
  ✅ 인라인 :style="" 허용 (maskImage 등 동적 값)
  ❌ 외부 SCSS 파일에 추상화된 스타일 작성 (원본 좌표 손실)
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
   - public/images/{feature}/ (또는 static/images/{feature}/)
   - styles/{feature}/ (layout/, components/ 하위) — Phase 2에서 일반 모드 섹션이 있을 때만
```

---

## Phase 1: Storyboard

사용자에게 질문한다:
- question: "스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"
- options 제공 금지 — 자유 텍스트 입력만 허용

"없음" 응답 시 → Phase 2로 건너뜀

### 1-1. 스토리보드 분석

```
URL에서 fileKey, nodeId 추출
get_metadata(fileKey, nodeId) → 프레임 목록

⚠️ 메타데이터가 클 수 있음 (실전: 291K chars → 파일 저장됨)
  → 파일 저장 시 Python/Bash로 파싱하여 프레임 목록 추출

프레임 분류 (이름 패턴 기반, get_design_context 호출 전에 분류):
  SPEC   — "기능 정의서", "정책" → get_design_context로 텍스트 추출
  CONFIG — "해상도", "브라우저" → get_design_context로 스케일 팩터 계산
  SHARED — "공통", "GNB", "Footer", "Popup" → 공통 컴포넌트 파악
  PAGE   — "화면설계", "메인 -" → 섹션 목록 + 인터랙션 스펙

핵심 프레임 선별 (전부 읽지 않음):
  1순위: SPEC (기능 정의서) — 1개
  2순위: CONFIG (해상도) — 1개
  3순위: PAGE 중 메인 섹션만 (3.1, 3.2, 3.3, 3.4, 3.5, 3.6)
         하위 케이스(3.1.1, 3.2.1 등)는 건너뜀 — Phase 2에서 필요 시 참조
  4순위: SHARED (공통 요소, Popup) — 필요 시

높이 1500px 이상 프레임:
  → get_design_context 대신 get_screenshot으로 시각 파악
  → 또는 get_metadata로 하위 분할 후 호출
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

모바일 퍼스트 강제. CSS base = 최소 뷰포트, @media (min-width:)로 확장.

사용자에게 질문한다:
- question: "베이스 디자인(모바일) Figma URL을 입력해주세요."
- options 제공 금지 — 자유 텍스트 입력만 허용

→ base 스타일로 처리 (2-1, 2-2 실행).

처리 완료 후 다시 질문한다:
- question: "다음 브레이크포인트 디자인 URL을 입력해주세요. (없으면 '없음')"
- options 제공 금지

→ URL 입력 시: @media (min-width:) 레이어 추가 후 다시 질문
→ "없음" 응답 시: Phase 3으로

브레이크포인트는 프레임 width에서 자동 산출.
예: 720px → 480px(스케일), 2560px → 1920px(스케일) → @media (min-width: 1024px)

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

### 2-2. 비정형 레이어 감지 (섹션별)

```
각 섹션의 get_design_context 응답을 받을 때마다 개별 판정.
한 페이지 내에서 섹션마다 모드가 다를 수 있음.

비정형 지표 (하나라도 해당 → 해당 섹션 직역 모드):
  □ 에셋 URL 15개 이상
  □ 소수점 좌표 사용 (left-[117.13px], top-[373.65px])
  □ mix-blend-mode 사용 (mix-blend-lighten, mix-blend-multiply, mix-blend-hue)
  □ rotate/scale 변환 사용 (rotate-[149.7deg], -scale-y-100)
  □ mask-image 사용
  □ blur 필터 사용 (blur-[3.5px])
  □ 2560px 이상 원본 해상도에서 트리밍된 BG 구조

정형 지표 (전부 해당 → 해당 섹션 일반 모드):
  □ flex/grid 기반 정형 레이아웃
  □ 에셋 URL 10개 미만
  □ absolute 좌표 없거나 정수값만
  □ mix-blend/rotate/mask/blur 미사용

섹션별 판정 결과 테이블 출력:
  ┌──────────┬──────────┐
  │   섹션   │   모드   │
  ├──────────┼──────────┤
  │ Hero     │ 직역     │
  │ KID      │ 직역     │
  │ Daily    │ 직역     │
  │ Caution  │ 일반     │
  │ ...      │ ...      │
  └──────────┴──────────┘

혼합 섹션 (배경=비정형, 콘텐츠=정형):
  → 직역 모드 적용 (비정형이 하나라도 있으면 직역)
  → 콘텐츠 영역의 반복 패턴(v-for 등)은 직역 내에서 유지
```

### 2-3. 큰 섹션 분할

```
get_design_context 타임아웃 방지:

섹션 높이가 1500px 이상이면 (모바일/PC 무관):
  사전 분할: get_design_context 호출 전에 먼저 분할
  1. get_metadata(섹션 nodeId)로 하위 노드 목록 확보
  2. 하위 노드별로 get_design_context 호출 (분할)
  3. 결과를 합쳐서 하나의 섹션으로 처리

타임아웃 발생 시 (분할 없이 호출한 경우):
  1회 재시도 (excludeScreenshot: true)
  → 실패 시 즉시 분할 전략으로 전환 (3회 반복 금지)
  → 분할도 불가하면 get_screenshot + 스크린샷 기반 구현
     (이 경우 CSS 값은 스크린샷에서 추정 — 품질 하락 감수)

실전 데이터 (PUBG 겨울 PC방 기준):
  정상 응답: ~900px 이하 (KID 238px, Caution 880px, Anchor 652px)
  타임아웃: 2000px+ (Daily 2372~3604, PlayTime 2000~2613, Exchange 2832~4342)
  파일 저장: Hero 1280px (92K~130K chars — 에셋 40개로 크기 큼)
```

### 2-4. 섹션별 루프

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

참조 코드에서 모든 에셋 URL을 빠짐없이 추출 → 다운로드 → 검증.
"핵심 에셋만" 금지. const img... 로 시작하는 모든 URL을 다운로드.
이미지가 모두 로컬에 있어야 c 단계로 진행.
하나라도 실패하면 코드 생성하지 않음.
```

#### c. 코드 변환 (모드별 분기)

```
■ 직역 모드 (비정형 레이어):
  vibe-figma-convert 스킬의 "직역 모드" 참조.

  참조 코드의 JSX 구조 + Tailwind 클래스를 1:1로 변환:
    - React JSX → Vue/Nuxt template (className→class 등)
    - Tailwind 클래스 → <style scoped> 내 CSS 클래스 (값 그대로 유지)
    - src={변수} → 로컬 이미지 경로
    - style={{ maskImage: ... }} → :style="{ maskImage: ... }"
    - 소수점 좌표, rotate, mix-blend-mode 전부 보존
    - scaleFactor 적용: px 값만 스케일링, 나머지(색상, opacity, blend) 유지
  
  외부 SCSS 파일 생성하지 않음.
  컴포넌트에 <style scoped> 블록으로 스타일 포함.

■ 일반 모드 (정형 레이어):
  vibe-figma-convert 스킬의 기존 방식 참조.

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
■ 직역 모드:
  Phase 1 컴포넌트의 template을 참조 코드의 HTML 구조로 교체.
  script(JSDoc, 인터페이스, 목 데이터, 핸들러)는 보존.
  
  변환 핵심:
    - 참조 코드의 div/img 구조를 거의 그대로 유지
    - 모든 이미지 경로를 로컬 경로로 교체
    - Phase 1의 기능 요소(v-for, @click, v-if)를 적절한 위치에 재배치
    - <style scoped>에 Tailwind→CSS 변환 결과 포함
    - 장식 이미지에 alt="" aria-hidden="true"

■ 일반 모드:
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
공통 체크:
  □ Grep: "figma.com/api" in 생성 파일 → 0건
  □ Grep: "placeholder" in 컴포넌트 파일 → 0건
  □ Grep: 'src=""' in 컴포넌트 파일 → 0건
  □ Glob: images/{feature}/*.webp → 이미지 파일 존재
  □ Read: 컴포넌트 template에 실제 HTML 태그 존재 (빈 template 아님)

일반 모드 추가 체크:
  □ Grep: "<style" in 컴포넌트 파일 → 0건
  □ Grep: 'style="' in 컴포넌트 파일 → 0건
  □ Read: 외부 스타일 파일에 font-size, color, background-image 존재

직역 모드 추가 체크:
  □ Read: <style scoped> 블록에 position, transform, mix-blend-mode 존재
  □ 에셋 수 = 다운로드된 이미지 수 (누락 0)

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
