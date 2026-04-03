---
name: vibe-figma-frame
tier: standard
description: "디자인 URL → 프레임별 개별 추출 → 스타일/이미지/코드 반영 → 검증 루프. Step B/C 공통."
triggers: []
---

# Design Frame (프레임별 정밀 추출 + 코드 반영)

디자인 URL 하나를 받아서 **프레임별로 쪼개서 추출**하고, Step A에서 만든 컴포넌트에 스타일/이미지를 채움.
어떤 뷰포트든 동일한 프로세스. 두 번째 호출 시 반응형 레이어만 추가.

> **실행 지시: 분석만 하지 말 것.**
> - 이미지: WebFetch로 다운로드 → 파일 저장
> - 스타일: Write 도구로 SCSS/CSS 파일 생성
> - 코드: Edit 도구로 Step A 컴포넌트의 template/style 채움
> - 토큰: Edit 도구로 _tokens 파일에 추출한 값 추가

## HARD RULES (위반 시 Step B 미완성)

```
1. CSS ART 금지 (가장 중요)
   디자인의 이미지 에셋을 CSS/SVG/HTML로 재현하지 않는다.
   원본이 3D 렌더 눈사람이면 → 원 2개로 그리지 말고 이미지를 다운로드한다.
   원본이 사진 소나무이면 → CSS 삼각형으로 그리지 말고 이미지를 다운로드한다.
   원본이 파티클 효과이면 → CSS dots로 대체하지 말고 이미지를 다운로드한다.

   절대 하면 안 되는 것:
     ❌ CSS border/border-radius로 도형 그리기 (원, 삼각형, 별)
     ❌ CSS gradient로 이미지 배경 대체
     ❌ CSS ::before/::after로 장식 요소 재현
     ❌ SVG path로 일러스트 재현
     ❌ emoji/unicode로 아이콘 대체
     ❌ div + CSS로 캐릭터/오브젝트 재현

   해야 하는 것:
     ✅ get_design_context에서 에셋 URL 추출 → 다운로드 → <img> 또는 background-image
     ✅ 에셋 URL이 없으면 → 하위 노드 탐색 → get_screenshot으로 이미지 확보
     ✅ 모든 시각 요소는 실제 이미지 파일이어야 한다

2. PLACEHOLDER 금지
   코드에 "placeholder", "Key Visual Image", 빈 dashed box,
   alt="placeholder", src="" 등이 남아있으면 → Step B 미완성.

3. 이미지 없는 섹션은 완료가 아니다
   스크린샷에 이미지(배경/캐릭터/일러스트/아이콘)가 보이는 섹션에서
   생성 코드에 실제 이미지 파일이 없으면 → 해당 섹션 미완성.
   다음 섹션으로 넘어가지 않고 현재 섹션의 이미지를 확보할 때까지 머문다.

4. 단색/gradient 배경으로 대체 금지
   원본에 이미지 배경이 있는데 생성 코드가 CSS gradient/단색으로 대체하면 → P1.
   이미지를 반드시 다운로드하여 background-image로 적용해야 한다.

5. 이미지 추출 실패 = 전체 실패
   인벤토리의 이미지 중 하나라도 확보 못하면 Step B를 완료로 마킹하지 않는다.
   대체 추출 경로(하위 노드 탐색 → 개별 스크린샷 → 크롭)를 전부 시도한 후,
   그래도 실패하면 사용자에게 해당 이미지를 직접 제공해달라고 요청한다.

5. 텍스트 스타일 미적용 = 미완성
   스크린샷에서 읽은 모든 텍스트 스타일을 코드에 반영해야 한다:
     - font-size (스케일 팩터 적용)
     - font-weight
     - color
     - line-height
     - letter-spacing (있으면)
     - text-align
   제목, 본문, 버튼 텍스트, 설명 등 스크린샷에 보이는 모든 텍스트 요소에 적용.
   스타일이 적용되지 않은 텍스트 요소가 있으면 → P1.
   브라우저 기본 스타일(검은색 16px)로 보이는 텍스트가 있으면 → 미완성.

6. 스타일은 반드시 외부 파일에 작성
   컴포넌트 파일(.vue/.tsx) 안에 <style> 블록이나 인라인 스타일을 작성하지 않는다.
   모든 스타일은 외부 파일에 작성:
     --new 모드: styles/{feature}/layout/_섹션.scss, components/_요소.scss
     기본 모드: 프로젝트 기존 스타일 패턴에 따름

   작성 후 검증:
     Grep: "<style" in components/{feature}/ → 0건
     Grep: "style=" in components/{feature}/ → 0건 (동적 바인딩 제외)
   위반 시 → 해당 스타일을 외부 파일로 이동 후 재검증.
```

## 입력

- 디자인 Figma URL (전체 페이지)
- Step A에서 생성된 컴포넌트 파일들
- 호출 횟수 (첫 번째 = base, 두 번째 이후 = responsive 추가)

## B-1. 디자인 URL 입력

AskUserQuestion (options 사용 금지, 자유 텍스트만):

```
첫 번째 호출:
  question: "디자인 Figma URL을 입력해주세요."
  → 응답 대기 → URL 저장 → B-2~B-5 실행

검증 완료 후:
  question: "추가 디자인 URL이 있나요? (없으면 '없음')"
  → URL 입력 → responsive 모드로 B-2~B-5 재실행
  → "없음" → Step D(공통화)로 진행

모바일/PC 순서를 강제하지 않음. 어떤 뷰포트든 먼저 입력 가능.
첫 번째 URL = base 스타일, 추가 URL = 반응형 레이어 추가.
```

## B-2. 전체 → 섹션 프레임 매핑

```
1. get_metadata(fileKey, nodeId) → 전체 페이지 하위 프레임 목록

2. 프레임 이름으로 Step A 컴포넌트와 매핑:
   - 프레임 이름 키워드 매칭
   - 매칭 안 되면 순서(위→아래)로 Step A 섹션과 1:1 대응
   - 그래도 안 되면 get_screenshot으로 비주얼 비교

3. 매핑 결과 출력:
   "디자인 프레임 N개 → 컴포넌트 N개 매핑 완료"
   매핑 안 된 프레임이 있으면 사용자에게 확인
```

## B-3. 섹션별 개별 추출

**각 매핑된 섹션에 대해 순서대로:**

### 3-1. 참조 코드에서 스타일 값 + 에셋 추출

```
get_design_context(fileKey, designFrame.nodeId)
→ 참조 코드 (React+Tailwind) + 에셋 URL

참조 코드에서 추출하는 것 (Figma 토큰 = 정확한 값):
  ✅ 색상: hex 값 (text-[#1B3A1D], bg-[#0A1628] 등)
  ✅ 폰트: font-size(px), font-weight, line-height, font-family
  ✅ 간격: padding, margin, gap (px)
  ✅ 장식: border-radius, box-shadow, opacity
  ✅ 에셋 URL: https://figma.com/api/mcp/asset/...

이 값들은 디자이너가 Figma UI에서 보는 것과 동일한 토큰 값.
스크린샷에서 추정하지 않고 이 값을 그대로 사용한다.
px 값에만 스케일 팩터(R-3)를 적용.

⚠️ HTML 구조는 레이어가 비정형이면 부정확할 수 있음.
  → 구조는 3-2 스크린샷에서 판단.
```

### 3-2. 스크린샷으로 구조 + 이미지 인벤토리

```
get_screenshot(fileKey, designFrame.nodeId)
→ 원본 디자인 이미지 확보

스크린샷에서 판단하는 것 (구조):
  → 레이아웃 구조 (섹션 경계, flex/grid 방향, 요소 배치 순서)
  → 이미지 배치 분류 (Background/Content/Overlay, R-4 참조)
  → z-index 관계 (겹침 구조, 오버레이 유무)
  → 참조 코드에 없는 시각 요소 발견 → 추가 구현 대상
```

**이미지 인벤토리 작성 (필수):**

```
스크린샷을 보고 해당 섹션에 보이는 모든 이미지를 목록화:

  imageInventory = [
    { name: "hero-bg", type: "background", description: "눈 테마 풀스크린 배경" },
    { name: "hero-character", type: "overlay", description: "캐릭터 일러스트 우하단" },
    { name: "hero-vehicle", type: "content", description: "차량 이미지 중앙" },
    { name: "hero-logo", type: "content", description: "이벤트 로고 상단" },
  ]

→ 이 인벤토리가 B-3.3 다운로드의 체크리스트가 됨
→ B-5 검증에서 인벤토리 vs 코드의 이미지를 1:1 대조
→ 인벤토리에 있는데 코드에 없으면 = P1
```

### 3-3. 이미지 에셋 다운로드 (BLOCKING — 코드 반영 전 필수)

> **인벤토리의 모든 이미지가 로컬에 존재해야 다음 단계로 넘어갈 수 있다.**

```
Step a: 참조 코드에서 에셋 URL 추출
  → 모든 https://www.figma.com/api/mcp/asset/ URL 수집
  → 각 URL을 imageInventory 항목과 매칭

Step b: 인벤토리 vs 에셋 URL 대조
  → 인벤토리에 있는데 에셋 URL이 없는 이미지 = 누락 후보
  → 누락 후보에 대해 대체 추출 실행 (Step e)

Step c: 매칭된 에셋 다운로드
  Bash: curl -L "{url}" -o static/images/{feature}/{name}.webp
  파일명: 인벤토리 name 기반 kebab-case

Step d: 다운로드 검증
  → 파일 존재 + 0byte 아닌지 확인
  → 누락/실패 시 재다운로드

Step e: 대체 추출 (참조 코드에 에셋 URL이 없는 이미지)
  레이어가 비정형("Frame 633372")이면 참조 코드에 이미지가 누락될 수 있음.
  이 경우 다음 순서로 시도:

  1. 하위 노드 탐색:
     get_metadata로 섹션 하위 프레임 목록 확보
     → 이미지로 의심되는 하위 nodeId에 대해 get_design_context 재호출
     → 에셋 URL 확보되면 다운로드

  2. 하위 노드 개별 스크린샷:
     이미지로 의심되는 하위 nodeId에 대해 get_screenshot
     → 해당 스크린샷 자체를 이미지 에셋으로 저장
     → 배경 이미지: 스크린샷을 background-image로 사용
     → 콘텐츠 이미지: 스크린샷을 <img>로 사용

  3. 섹션 전체 스크린샷 크롭:
     위 방법이 다 실패하면, 섹션 스크린샷에서 해당 영역을 잘라서 사용
     → 최후 수단이지만 이미지 누락보다는 낫다

Step f: 최종 인벤토리 체크
  인벤토리 항목 수 = 다운로드된 파일 수
  하나라도 빠지면 → Step e 재시도
  모든 이미지가 로컬에 있어야 → 3-4로 진행
```

### 3-4. 이미지 코드 패턴 적용

이미지 분류 결과에 따라 코드 생성:

**Background Image → Multi-Layer 패턴 (vibe-figma-rules R-4 참조)**

**Content Image:**
```tsx
// React / Next.js — Image 컴포넌트 우선
<Image src="/images/{feature}/product.webp" alt="설명" width={600} height={400} />

// Vue / Nuxt — NuxtImg 우선
<NuxtImg src="/images/{feature}/product.webp" alt="설명" width="600" height="400" loading="lazy" />
```

**반응형 Content Image:**
```html
<picture>
  <source media="(min-width: {breakpoint}px)" srcset="/images/{feature}/hero-pc.webp" />
  <img src="/images/{feature}/hero-mobile.webp" alt="설명" loading="eager" />
</picture>
```

**반응형 Background Image:**
```css
.heroBg { background-image: url('/images/{feature}/hero-mobile.webp'); }
@media (min-width: {breakpoint}px) {
  .heroBg { background-image: url('/images/{feature}/hero-pc.webp'); }
}
```

### 3-5. 글로벌 스타일 파일 구조 생성 (BLOCKING — 컴포넌트 수정 전 필수)

> **이 단계를 건너뛰면 Step B 미완성. 컴포넌트를 수정하기 전에 스타일 파일을 먼저 만든다.**

첫 번째 섹션 처리 시 전체 구조를 Write로 생성. 이후 섹션에서는 해당 파일에 Edit으로 추가.

```
styles/{feature}/
  index.scss                         ← [1] 진입점 (모든 파일 import)
  _tokens.scss                       ← [2] 토큰 (색상, 폰트, 간격 변수)
  _mixins.scss                       ← [3] mixin (breakpoint, fluid 함수)
  _base.scss                         ← [4] 공통 (reset, font-face, 전역 규칙)
  layout/
    _page.scss                       ← [5] 페이지 전체 레이아웃
    _{section}.scss                   ← [6] 각 섹션별 배치/구조/배경
  components/
    _{element}.scss                   ← [7] 재사용 UI 요소 (card, button, badge 등)
```

#### [1] index.scss — Write로 생성

```scss
// Foundation
@use 'tokens';
@use 'mixins';
@use 'base';

// Layout
@use 'layout/page';
@use 'layout/hero';
@use 'layout/daily-checkin';
// ... Step A의 모든 섹션

// Components
@use 'components/card';
@use 'components/button';
// ... 반복 패턴에서 추출된 재사용 요소
```

#### [2] _tokens.scss — 참조 코드에서 추출한 값으로 Write

```scss
@use 'sass:math';

// ── Colors (참조 코드 hex 그대로) ──
$figma-bg-primary: #0A1628;
$figma-bg-section: #1A2B4A;
$figma-text-heading: #1B3A1D;
$figma-text-body: #333333;
$figma-text-light: #FFFFFF;
$figma-accent: #FFD700;

// ── Typography (참조 코드 px × scaleFactor) ──
$figma-text-hero: 36px;       // Figma 48px × 0.75
$figma-text-sub: 18px;        // Figma 24px × 0.75
$figma-text-body: 14px;       // Figma 18px × 0.75
$figma-text-caption: 12px;    // Figma 16px × 0.75
$figma-font-family: 'Noto Sans KR', sans-serif;

// ── Spacing (참조 코드 px × scaleFactor) ──
$figma-space-section: 60px;   // Figma 80px × 0.75
$figma-space-content: 24px;   // Figma 32px × 0.75
$figma-space-element: 12px;   // Figma 16px × 0.75

// ── Decorations ──
$figma-radius-card: 12px;
$figma-shadow-card: 0 4px 12px rgba(0,0,0,0.15);

// ── Breakpoints ──
$figma-bp: 1024px;
$figma-bp-mobile-min: 360px;
$figma-bp-pc-target: 1920px;
```

#### [3] _mixins.scss — Write로 생성

```scss
@use 'tokens' as t;

@mixin figma-pc { @media (min-width: t.$figma-bp) { @content; } }

@function figma-fluid($mobile, $desktop) {
  // clamp 계산 (vibe-figma-rules R-3)
}
```

#### [4] _base.scss — Write로 생성

```scss
@use 'tokens' as t;

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: t.$figma-font-family; }
img { max-width: 100%; height: auto; }
```

#### [6] layout/_{section}.scss — 섹션별 Write

```scss
@use '../tokens' as t;
@use '../mixins' as m;

// 참조 코드의 레이아웃 관련 값 + 스크린샷의 구조를 적용
.heroSection {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  padding: t.$figma-space-section 0;
}

// Multi-Layer 배경 (이미지가 있는 섹션)
.heroBg {
  position: absolute; inset: 0; z-index: 0;
  background-image: url('/images/{feature}/hero-bg.webp');
  background-size: cover;
  background-position: center;
}
.heroBgOverlay {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
}
.heroContent {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: center;
  padding: 0 t.$figma-space-content;
}
```

#### [7] components/_{element}.scss — 텍스트 + UI 요소

```scss
@use '../tokens' as t;

// 참조 코드의 Figma 토큰 값을 그대로 사용
.heroTitle {
  font-size: t.$figma-text-hero;
  font-weight: 900;
  color: t.$figma-text-heading;
  line-height: 1.2;
  text-align: center;
}

.heroDescription {
  font-size: t.$figma-text-sub;
  font-weight: 400;
  color: t.$figma-text-body;
  line-height: 1.6;
  text-align: center;
}

.heroCta {
  font-size: t.$figma-text-body;
  font-weight: 700;
  color: t.$figma-text-light;
  background: t.$figma-accent;
  border-radius: t.$figma-radius-card;
  padding: t.$figma-space-element t.$figma-space-content;
}
```

### 3-6. 생성 확인 (BLOCKING)

```
스타일 파일 생성 후 반드시 확인:

  Glob: styles/{feature}/index.scss        → 존재
  Glob: styles/{feature}/_tokens.scss      → 존재
  Glob: styles/{feature}/_mixins.scss      → 존재
  Glob: styles/{feature}/_base.scss        → 존재
  Glob: styles/{feature}/layout/*.scss     → 섹션 수만큼 존재
  Glob: styles/{feature}/components/*.scss → 1개 이상 존재

  Grep: "font-size" in styles/{feature}/   → 0건이면 P1 (텍스트 스타일 미작성)
  Grep: "color:" in styles/{feature}/      → 0건이면 P1
  Grep: "background-image" in styles/{feature}/ → 배경 이미지 섹션 수만큼

하나라도 실패 → Write/Edit으로 보완 → 재확인
파일이 모두 존재하고 내용이 있어야 → 3-7로 진행
```

### 3-7. 컴포넌트 파일에 반영 (Edit 도구)

```
컴포넌트 파일에는 template + script만 수정한다.
모든 스타일은 3-5에서 생성한 외부 파일에만 존재.

a. template 수정:
   - placeholder → 실제 마크업으로 교체
   - 클래스명 추가 (layout/*.scss, components/*.scss의 셀렉터와 매칭)
   - 이미지 태그에 로컬 경로 설정
   - Multi-Layer 구조 적용 (.{section}Bg + .{section}Content)

b. Step A 코드 보존:
   - 기능 주석/핸들러/인터페이스 유지
   - 목 데이터/이벤트 바인딩 유지

c. 스타일 import 설정:
   - 루트 페이지 또는 설정 파일에서 styles/{feature}/index.scss import
   - Nuxt: nuxt.config의 css 배열에 추가
   - Next.js: _app 또는 layout에서 import

d. 컴포넌트 안에 스타일 작성 금지:
   - <style> 블록 금지
   - style="" 인라인 금지 (동적 바인딩 제외)
   - 스타일이 필요하면 → 외부 파일에 추가 → 클래스명으로 연결
```

## B-4. 뷰포트 모드에 따른 스타일 적용

### 첫 번째 URL (base)

```
- 모든 스타일을 base로 작성 (반응형 미고려)
- 토큰 파일에 추출한 값 저장
- 이미지 다운로드 + 로컬 경로 매핑
```

### 추가 URL (responsive)

```
기존 코드를 수정하지 않고 반응형 레이어만 추가:

1. 프레임 width로 뷰포트 자동 판별
2. 값이 다른 속성 → clamp() fluid 토큰 (계산: vibe-figma-rules R-3)
3. 레이아웃 구조가 다른 부분 → @media (min-width: {breakpoint}px)
4. 뷰포트별 배경 이미지 → @media 분기
5. 추가 이미지 에셋 다운로드 (base와 동일하면 스킵)
6. 기존 base 코드/주석/핸들러는 절대 삭제하지 않음
```

## B-5. 검증 루프

공통 프로세스: **vibe-figma-rules R-6** (6-1 ~ 6-7) 전체 적용.

### Step B 검증 흐름

```
for each section in mappings:

  1. 원본 확보: B-3.1에서 이미 get_screenshot한 섹션 이미지
  2. 생성 결과 확보: /vibe.utils --preview 또는 dev 서버 스크린샷 (R-6.2)
  3. 섹션별 비교: 레이아웃, 배경, 색상, 타이포, 간격, 이미지 (R-6.3~4)
  4. Diff Report 출력 (R-6.5)
  5. P1 → 해당 섹션 수정 → 재비교 (R-6.6)
```

### Step B 추가 검증 항목

```
1. 이미지 인벤토리 대조:
   for each item in imageInventory:
     □ 로컬 파일 존재 (Glob)
     □ 0byte 아님 (ls -la)
     □ 코드에서 참조됨 (Grep: 파일명으로 검색)
     □ 올바른 패턴 적용됨:
       - background → .{section}Bg { background-image: url(...) }
       - content → <img src="..." /> 또는 <Image />
       - overlay → .{section}Character { background-image: url(...) }
   하나라도 실패 → P1 → 수정 → 재검증

2. 텍스트 스타일 검증:
   for each section:
     □ 외부 스타일 파일 존재 (Glob: styles/{feature}/**/*.scss)
     □ 스크린샷의 텍스트 요소 수 ≈ font-size 선언 수
       Grep: "font-size" in styles/{feature}/
     □ 브라우저 기본 스타일로 보이는 텍스트 0건
       → 모든 텍스트에 font-size, color, font-weight 지정 확인
     □ color 값이 적용됨 (원본 스크린샷 색상과 매칭)
   미적용 텍스트 발견 → P1

3. 스타일 분리 검증:
   □ Grep: "<style" in components/{feature}/**/*.vue → 0건
   □ Grep: "<style" in components/{feature}/**/*.tsx → 0건
   □ Grep: 'style="' in components/{feature}/ → 0건 (v-bind:style 동적 바인딩 제외)
   위반 → 외부 파일로 이동 → 재검증

4. Figma 임시 URL + placeholder 잔존 체크:
   □ Grep: "figma.com/api/mcp/asset" → 0건
   □ Grep: "placeholder" (대소문자 무시) → 0건
   □ Grep: "Key Visual" → 0건

5. 배경 이미지 Multi-Layer 검증:
   스크린샷에 배경 이미지가 보이는 섹션:
     □ .{section}Bg 클래스 존재 (Grep)
     □ .{section}Content 클래스 존재 (z-index 최상위)
     □ 배경 위 텍스트 가독성 확보 (오버레이 유무)
   누락 → P1

6. (responsive) 뷰포트별:
   □ 뷰포트별 다른 배경 이미지 → @media 분기 있는지
   □ 이전 뷰포트 스타일/이미지 깨지지 않았는지
```

## 참조 스킬

코드 생성 시 다음 스킬의 규칙을 적용:
- `vibe-figma-rules` — 공통 규칙 (R-1~R-7)
- `vibe-figma-style` — 토큰/스타일 아키텍처
- `vibe-figma-codegen` — 마크업/코드 생성 규칙
