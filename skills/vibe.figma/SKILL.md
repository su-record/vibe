---
name: vibe.figma
description: Figma design to code — 스토리보드(기능) + 디자인(비주얼) → 프로덕션 코드
triggers: []
tier: standard
---

# vibe.figma — Figma Design to Code

## 금지 사항

```
❌ CSS로 이미지 재현 (삼각형/원/gradient로 나무/눈사람/배경 그리기)
❌ 이미지 다운로드 없이 코드 생성 진행
❌ placeholder / 빈 template / 빈 src="" 남기기
❌ CSS 값을 추정 (참조 코드의 Tailwind 클래스에 정확한 값이 있음)
❌ 브라우저 기본 스타일(검은색 16px)로 보이는 텍스트
❌ 핵심 에셋만 다운로드 (const img... 전부 다운로드)
❌ 컴포넌트 파일 안에 <style> 블록 / 인라인 style=""
✅ 외부 SCSS 파일에만 스타일 작성
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
   - styles/{feature}/ (layout/, components/ 하위)
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
getTree(fileKey, nodeId, depth=2) → 프레임 목록

Bash:
  node -e "
    import { getTree } from './dist/infra/lib/figma/index.js';
    const tree = await getTree({ fileKey: '{fileKey}', nodeId: '{nodeId}', depth: 2 });
    console.log(JSON.stringify(tree));
  "

프레임 분류 (name 패턴 기반):
  SPEC   — "기능 정의서", "정책" → depth 높여서 텍스트 추출
  CONFIG — "해상도", "브라우저" → 스케일 팩터 계산
  SHARED — "공통", "GNB", "Footer", "Popup" → 공통 컴포넌트 파악
  PAGE   — "화면설계", "메인 -" → 섹션 목록 + 인터랙션 스펙

핵심 프레임 선별 (전부 읽지 않음):
  1순위: SPEC (기능 정의서) — 1개
  2순위: CONFIG (해상도) — 1개
  3순위: PAGE 중 메인 섹션만 (3.1, 3.2, 3.3, 3.4, 3.5, 3.6)
         하위 케이스(3.1.1, 3.2.1 등)는 건너뜀 — Phase 2에서 필요 시 참조
  4순위: SHARED (공통 요소, Popup) — 필요 시

높이 1500px 이상 프레임:
  → getScreenshot으로 시각 파악
  → 또는 depth 높여서 하위 분할 조회
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

## Phase 2: Design

Phase 1 컴포넌트에 **이미지 + 스타일**을 입힌다.
모바일 퍼스트. base = 최소 뷰포트, @media (min-width:)로 확장.

사용자에게 질문한다:
- question: "베이스 디자인(모바일) Figma URL을 입력해주세요."
- options 제공 금지 — 자유 텍스트 입력만 허용

→ 2-1 → 2-2 섹션 루프 실행.

완료 후 다시 질문:
- question: "다음 브레이크포인트 디자인 URL을 입력해주세요. (없으면 '없음')"
→ URL 입력 시: 2-3 반응형 추가 후 다시 질문
→ "없음" 응답 시: Phase 3으로

### 2-1. SCSS Setup + 등록 (첫 섹션 전)

```
SCSS 파일 기본 내용 Write:
  styles/{feature}/index.scss      ← @import 진입점
  styles/{feature}/_tokens.scss    ← 빈 파일 (섹션마다 채움)
  styles/{feature}/_mixins.scss    ← breakpoint mixin
  styles/{feature}/_base.scss      ← 루트 클래스 (.winterPcbang 등)
  styles/{feature}/layout/         ← 디렉토리
  styles/{feature}/components/     ← 디렉토리

스타일 등록 (BLOCKING — 미등록 시 섹션 루프 진행 금지):
  Grep "{feature}/index.scss" → 이미 등록되어 있으면 건너뜀.

  ■ 신규 프로젝트 (--new):
    루트 페이지 파일에서 직접 로드:
    pages/{feature}.vue → <style lang="scss" src="~/assets/scss/{feature}/index.scss" />
    app/{feature}/page.tsx → import '~/styles/{feature}/index.scss'

  ■ 기존 프로젝트 (업데이트):
    Grep "\.scss\|\.css" in nuxt.config.*/next.config.*/vite.config.*/main.ts
    → 기존 방식과 동일하게 등록

  검증: Grep "{feature}/index.scss" in 프로젝트 전체 → 0건이면 실패
```

### 2-2. 섹션 루프

**각 섹션을 순서대로, 한 섹션을 완전히 완료한 후 다음으로.**

#### a. 노드 트리 + CSS 추출

```
Figma REST API로 노드 트리와 CSS 속성을 직접 추출한다.
MCP 플러그인(get_design_context/get_metadata)은 사용하지 않는다.

Bash:
  node -e "
    import { getTree } from './dist/infra/lib/figma/index.js';
    const tree = await getTree({ fileKey: '{fileKey}', nodeId: '{섹션.nodeId}', depth: 10 });
    console.log(JSON.stringify(tree));
  "

반환 (JSON):
  {
    nodeId, name, type, size: {width, height},
    css: { display, flexDirection, gap, fontSize, color, ... },
    text: "텍스트 내용" (TEXT 노드),
    imageRef: "abc123" (이미지 fill),
    children: [...]
  }

CSS는 Figma 노드 속성에서 직접 추출 — Tailwind 역변환 불필요:
  fills → background-color     effects → box-shadow, filter
  strokes → border             style → font-family, font-size, color
  layoutMode → display:flex     itemSpacing → gap
  padding* → padding            cornerRadius → border-radius

인스턴스 내부 자식도 depth로 전부 조회 가능 (MCP 한계 해결).
```

#### b. 이미지 다운로드 (BLOCKING)

```
트리에서 imageRef가 있는 노드를 수집 → Figma API로 다운로드.

Bash:
  node -e "
    import { getTree, getImages, collectImageRefs } from './dist/infra/lib/figma/index.js';
    const tree = await getTree({ fileKey: '{fileKey}', nodeId: '{섹션.nodeId}', depth: 10 });
    const refs = collectImageRefs(tree);
    const result = await getImages({
      fileKey: '{fileKey}', imageRefs: refs, outDir: 'images/{feature}/'
    });
    console.log(JSON.stringify(result));
  "

검증: result.total = refs.size (누락 0)
전부 완료해야 c 단계로 진행.
```

#### c. 클래스 매핑 테이블 생성

```
SCSS 작성 전에 반드시 매핑 테이블을 먼저 출력한다.
이 테이블 없이 SCSS를 작성하지 않는다.

1. Phase 1 컴포넌트의 클래스 목록을 Read로 수집
2. 트리의 name + css 속성을 분석
3. 매핑 테이블 출력:

  ┌─────────────────────┬──────────────────┬────────────────────────────────────┐
  │ Phase 1 클래스       │ 트리 노드 name   │ 추출된 CSS 값                      │
  ├─────────────────────┼──────────────────┼────────────────────────────────────┤
  │ .kidSection         │ KID (root)       │ flex, column, gap:32px, pad:48px   │
  │ .kidBg              │ BG               │ absolute, 720x800                  │
  │ .kidLoginBtn        │ Btn_Login        │ flex, border, shadow, 640x148      │
  │ .kidLoginBtnText    │ (TEXT 노드)       │ fontSize:36px, color:#fff, w:700   │
  │ .kidDivider         │ Divider          │ 640x1                              │
  │ .kidSteamLink       │ steam_account    │ fontSize:24px, w:600               │
  │ .kidSteamNote       │ (하위 TEXT)       │ fontSize:20px, color:#dadce3       │
  └─────────────────────┴──────────────────┴────────────────────────────────────┘

매핑 기준:
  name 일치 → 직접 매핑
  name 없음 → 트리 위치/text 내용으로 판단
  Phase 1에 없는 요소 → 클래스 신규 추가 (template에도 반영)
  트리에 없는 클래스 → 스타일 없이 유지
```

#### d. SCSS 작성

```
매핑 테이블의 각 행에 대해, 트리의 css 속성을 SCSS로 작성.
CSS 값은 트리에서 이미 추출되어 있으므로 변환 불필요 — 그대로 사용.

scaleFactor 적용:
  px 값 → × scaleFactor (font-size, padding, margin, gap, width, height, border-radius)
  적용 안 함 → color, opacity, font-weight, z-index, line-height(단위 없음), % 값

출력 파일:
  styles/{feature}/layout/_{section}.scss
    → position, display, flex, width, height, padding, overflow, z-index, background-image
  styles/{feature}/components/_{section}.scss
    → font-size, font-weight, color, line-height, letter-spacing, text-align,
      border, border-radius, box-shadow, opacity
  styles/{feature}/_tokens.scss
    → 새로 발견된 색상/폰트/스페이싱 토큰 추가

BG 레이어 패턴 (트리에서 position:absolute + 이미지 fill):
  .{section}Bg   → position: absolute; inset: 0; z-index: 0;
  .{section}Content → position: relative; z-index: 1;

index.scss에 새 섹션 @import 추가.
```

#### e. template 업데이트

```
Phase 1 컴포넌트의 template을 트리 구조 기반으로 리팩토링.
script(JSDoc, 인터페이스, 목 데이터, 핸들러)는 보존.

1. 트리의 HTML 구조를 프로젝트 스택으로 변환:
   FRAME → <div>, TEXT → <p>/<span>, VECTOR/RECTANGLE with imageRef → <img>

2. 이미지 경로를 imageMap으로 교체:
   imageRef "abc123" → src="/images/{feature}/abc123.png"

3. BG 레이어 구조 적용:
   .{section}Bg div (배경) + .{section}Content div (콘텐츠)

4. Phase 1 기능 요소 재배치:
   v-for, @click, v-if, $emit 등을 새 구조의 적절한 위치에 배치

5. 접근성:
   장식 이미지 (BG 내) → alt="" aria-hidden="true"
   콘텐츠 이미지 → alt="설명적 텍스트"

컴포넌트에 <style> 블록 없음. 스타일은 전부 외부 SCSS.
```

#### f. 섹션 검증

```
Grep 체크:
  □ 'src=""' in 컴포넌트 파일 → 0건
  □ "<style" in 컴포넌트 파일 → 0건

Read 체크:
  □ 외부 SCSS 파일에 font-size, color 존재 (브라우저 기본 스타일 방지)
  □ 이미지 파일 수 = imageRef 수 (누락 0)

실패 → 수정 → 재검증
```

### 2-3. 반응형 (두 번째 URL부터)

```
두 번째 이후 URL: 기존 스타일 유지 + @media 추가만.

같은 값 → 유지
다른 px 값 → @media (min-width: $bp-desktop) 오버라이드
다른 레이아웃 → @media 블록 추가
다른 배경 이미지 → @media 이미지 분기
기존 코드/스타일 삭제 금지
```

---

## Phase 3: Verification

```
Grep 체크:
  □ "<style" in components/{feature}/ → 0건
  □ 'src=""' in components/{feature}/ → 0건
  □ Glob: images/{feature}/ → 이미지 파일 존재

시각 검증:
  각 섹션 스크린샷:
    node -e "import { getScreenshot } from './dist/infra/lib/figma/index.js';
      await getScreenshot({ fileKey: '{fileKey}', nodeId: '{nodeId}', outPath: '/tmp/{section}.png' });"
  → dev 서버/preview와 비교
  P1 (필수): 이미지 누락, 레이아웃 구조 다름, 텍스트 스타일 미적용
  P2 (권장): 미세 간격, 미세 색상 차이
  → P1 수정 → 재검증 (P1=0 될 때까지)
```
