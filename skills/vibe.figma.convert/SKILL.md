---
name: vibe.figma.convert
description: Figma 트리 → 구조적 코드 생성 + 스크린샷 검증
triggers: []
tier: standard
---

# vibe.figma.convert — 트리 기반 구조적 코드 생성

**Figma 트리 데이터를 기계적으로 HTML+CSS에 매핑한다. 추정하지 않는다.**
**Claude는 시맨틱 판단(태그 선택, 컴포넌트 분리, 인터랙션)만 담당한다.**

```
❌ 스크린샷을 보고 CSS 추정 (범용 LLM의 약점)
❌ Figma 레이어를 무분별하게 div soup로 변환
✅ Figma Auto Layout → CSS Flexbox 1:1 매핑 (기계적)
✅ Figma CSS 속성 → SCSS 직접 변환 (추정 없음)
✅ Claude → 시맨틱 태그 선택 + 컴포넌트 설계 + 인터랙션
✅ 스크린샷 → 생성이 아닌 검증용
```

---

## 0. 재사용 확인 (코드 작성 전)

```
component-index (/tmp/{feature}/component-index.json) 에서 매칭되는 컴포넌트가 있으면:

  ✅ import하여 사용 (새로 만들지 않음)
  ✅ props로 커스터마이즈 (variant, size 등)
  ✅ 래퍼 클래스로 위치/크기만 조정
  ❌ 기존 컴포넌트 내부 수정
  ❌ 90% 유사한데 새로 만들기

매칭 안 되면 → 섹션 1 프로세스로 새로 생성
```

---

## 1. 트리 기반 코드 생성 프로세스

```
입력:
  - tree.json (노드 트리 + CSS 속성 — 코드 생성의 PRIMARY 소스)
  - /tmp/{feature}/images/ (다운로드된 이미지 에셋)
  - 섹션 스크린샷 (검증용 — 생성에 사용하지 않음)
  - designWidth (스토리보드 CONFIG: 모바일 720px, PC 2560px)
  - minWidth (최소 지원: 340px)

출력:
  - 컴포넌트 파일 (Vue SFC / React TSX)
  - SCSS 파일 (layout/ + components/ + _tokens.scss)
```

### 1-1. 노드 → HTML 매핑 규칙 (기계적)

```
⛔ 코드 작성 전: 이미지 vs HTML 판별 테이블을 먼저 작성한다 (BLOCKING).
   섹션의 모든 1~2depth 노드를 순회하여 각각의 처리 방법을 결정.
   판별 없이 코드를 작성하면 안 된다.

   판별 규칙 (순서대로 적용, 하나라도 YES → HTML):
   Q1. 이 노드의 자식 트리에 TEXT 노드가 있는가?
       YES → HTML로 구현 (이미지에 텍스트를 넣지 않는다)
       ※ "가격 1,000", "보상 교환하기", "이벤트 기간" 등이 있으면 무조건 HTML
   Q2. 같은 부모 아래 동일 구조 INSTANCE가 2개 이상인가?
       YES → HTML 반복 구조 (v-for/.map) — 내부 아이콘/썸네일만 <img>
       ※ 카드 4개 그리드를 이미지 1장으로 렌더링하면 절대 안 됨
   Q3. 클릭/인터랙션이 필요한가? (btn, CTA, link, tab)
       YES → HTML <button>/<a>
   Q4. 동적으로 변경되는 데이터인가? (가격, 수량, 기간, 상태)
       YES → HTML 텍스트
   모두 NO → 이미지 렌더링 가능 (벡터 글자, 래스터 에셋, 합성 BG 등)

각 노드에 대해 아래 규칙을 순서대로 적용:

1. 배경 레이어 (BG 프레임 — 가장 먼저 처리):
   BG 프레임 (name에 "BG"/"bg" 또는 부모와 동일 크기)

     ❌ 절대 금지 패턴 (이렇게 쓰면 안 됨):
        <img src="hero-bg.webp" class="bg-img" />
        <div class="bg"><img src="bg.webp" /></div>
        position: absolute; inset: 0; → 이미지 배치

     ✅ 유일하게 허용되는 패턴:
        부모 요소의 SCSS에 background-image로 처리:
          .heroSection {
            background-image: url('/images/{feature}/hero-bg.webp');
            background-size: cover;
            background-position: center top;
          }
        HTML에는 BG 관련 요소를 아무것도 넣지 않음.

2. 타입별 기본 매핑:
   TEXT 노드     → <span> (Claude가 <h1>~<h6>, <p>, <button> 등으로 승격)
   IMAGE fill    → <img src="다운로드된 경로" /> (판별 통과한 순수 에셋만)
   VECTOR/GROUP  → 크기가 작으면(≤64px) 아이콘 후보 → <img> (렌더링 이미지)
                   크기가 크면 장식 요소 → <div> + background
   FRAME/INSTANCE:
     Auto Layout 있음 → <div> + flex (direction/gap/padding 직접 매핑)
     Auto Layout 없음 → <div> + position:relative (자식은 absolute)
     children 없음    → 빈 div 또는 스킵

3. 반복 패턴 감지:
   같은 부모 아래 동일 타입 + 유사 구조(children 수 동일) INSTANCE 2개 이상
     → v-for (Vue) 또는 .map() (React)
     → 첫 번째 노드를 기준으로 템플릿 생성
     → 카드 내부의 이미지 에셋(아이콘, 썸네일)만 <img>
     → 카드 레이아웃, 텍스트, 버튼, 가격은 HTML로 구현

     ❌ 잘못된 예: <img src="exchange-section1.webp" /> (카드 4개가 한 이미지)
     ✅ 올바른 예:
        <div v-for="card in weeklyCards" :key="card.id" class="card">
          <img :src="card.icon" :alt="card.name" class="card__icon" />
          <span class="card__name">{{ card.name }}</span>
          <span class="card__price">{{ card.price }}</span>
          <button class="card__btn">보상 교환하기</button>
        </div>

4. 스킵 대상:
   크기 0px 노드
   visible=false 노드 (트리에 포함되지 않으므로 해당 없음)
   VECTOR 장식선 (width 또는 height ≤ 2px)
```

### 1-2. CSS 속성 직접 매핑 (추정 없음)

```
tree.json의 css 객체를 SCSS로 직접 변환한다. 추정하지 않는다.

레이아웃 (layout/ 파일):
  node.css.display         → display
  node.css.flexDirection   → flex-direction
  node.css.justifyContent  → justify-content
  node.css.alignItems      → align-items
  node.css.gap             → gap (→ vw 변환)
  node.css.padding         → padding (→ vw 변환)
  node.css.width           → width (→ vw 또는 % 변환)
  node.css.height          → height (→ vw 변환, 또는 auto)
  node.css.overflow        → overflow
  node.css.position        → position

비주얼 (components/ 파일):
  node.css.backgroundColor → background-color
  node.css.color           → color
  node.css.fontFamily      → font-family
  node.css.fontSize        → font-size (→ clamp 변환)
  node.css.fontWeight      → font-weight
  node.css.lineHeight      → line-height
  node.css.letterSpacing   → letter-spacing (→ vw 변환)
  node.css.textAlign       → text-align
  node.css.borderRadius    → border-radius (→ vw 변환)
  node.css.border          → border (width → vw 변환)
  node.css.boxShadow       → box-shadow (px → vw 변환)
  node.css.opacity         → opacity
  node.css.mixBlendMode    → mix-blend-mode
  node.css.filter          → filter (px → vw 변환)
  node.css.backdropFilter  → backdrop-filter (px → vw 변환)

반응형 단위 변환 (scaleFactor 사용하지 않음):
  스토리보드 CONFIG에서 확보:
    designWidth: 디자인 너비 (예: 720px 모바일, 2560px PC)
    minWidth: 최소 지원 너비 (예: 340px)
    breakpoint: PC/모바일 분계 (예: 1025px)

  UI 요소 (width, height, padding, gap, border-radius, shadow 등):
    → vw 비례: vw값 = (Figma px / designWidth) × 100
    → 예: gap: 24px / 720 × 100 = 3.33vw
    → width: 부모 대비 %도 가능 (620/720 = 86%)

  폰트 (font-size):
    → clamp(최소, vw, 최대): 가독성 최소값 보장
    → vw값 = (Figma px / designWidth) × 100
    → 최소값 = 역할(role)에 따라 결정 (Claude 시맨틱 판단)
    → 최대값 = Figma 원본 px

    | 역할 | 최소 | 판단 기준 |
    |------|------|----------|
    | h1~h2 제목 | 16px | name에 "title", 가장 큰 fontSize |
    | h3~h4 소제목 | 14px | 중간 크기 fontSize |
    | 본문 p | 12px | TEXT 노드, 긴 텍스트 |
    | 캡션/라벨 | 10px | 작은 fontSize, 짧은 텍스트 |
    | 버튼 | 12px | name에 "btn" |

    예시:
      디자인 24px, 본문 → font-size: clamp(12px, 3.33vw, 24px);
      디자인 48px, 제목 → font-size: clamp(16px, 6.67vw, 48px);
      디자인 16px, 캡션 → font-size: clamp(10px, 2.22vw, 16px);

  변환하지 않는 속성:
    color, opacity, font-weight, font-family, z-index,
    line-height(단위 없을 때), text-align, mix-blend-mode

값이 없으면:
  → 해당 속성 생략 (추정 금지)
  → tree.json에 없는 속성은 CSS에 쓰지 않는다
```

### 1-3. Claude의 시맨틱 판단 (유일한 추정 영역)

```
기계적 매핑 후 Claude가 판단하는 것:

1. HTML 태그 승격:
   <span> "MISSION 02"  → <span> (장식 배지)
   <span> "플레이 타임 달성" → <h2> (섹션 제목)
   <span> "참여 대상 : PC..."  → <p> (설명 텍스트)
   <span> "보상 받기"  → <button> 내부 텍스트

2. 컴포넌트 분리:
   tree.json 1depth 자식 = 섹션 컴포넌트 후보
   INSTANCE 타입 반복 = 공유 컴포넌트 후보
   → 컴포넌트 경계, 파일명, props interface 설계

3. 인터랙션 판단:
   name에 "btn", "CTA", "link" 포함 → 클릭 이벤트
   name에 "tab", "toggle" 포함 → 상태 전환
   → @click 핸들러, 상태 변수, 조건부 렌더링

4. 접근성:
   배경/장식 이미지 → alt="" aria-hidden="true"
   콘텐츠 이미지 → TEXT 노드에서 가장 가까운 텍스트를 alt로
   인터랙티브 요소 → role, aria-label

5. 노드 생략 판단:
   BG 그룹 내 장식 요소가 너무 많으면 (10개+)
   → 배경 이미지 1장 + 핵심 장식 2~3개만 유지
   → 나머지는 성능상 생략 가능 (스크린샷으로 검증)
```

---

## 2. 외부 SCSS 파일 구조

### _base.scss (필수 — 래퍼 컨테이너)

```scss
// 모바일 퍼스트: vw 단위가 PC에서 거대해지는 것을 방지
// designWidth(720px)를 max-width로 제한

.{feature} {
  width: 100%;
  max-width: 720px;    // designWidth — PC에서 모바일 레이아웃 유지
  margin: 0 auto;      // 중앙 정렬
  overflow-x: hidden;

  // PC 브레이크포인트에서 max-width 확장 (PC 디자인이 있을 때)
  @media (min-width: 1025px) {
    max-width: 100%;   // PC 디자인이 있으면 전체 너비
  }
}
```

이 파일이 없으면 vw 단위가 PC 뷰포트에서 비례 확대되어 레이아웃이 깨진다.

### layout vs components 구분

```
layout/  → position, display, flex/grid, width, height, padding, margin,
           gap, overflow, z-index, inset
components/ → font-size, font-weight, color, line-height, letter-spacing,
              text-align, border, border-radius, box-shadow, opacity,
              background-color, background-image, mix-blend-mode, filter
```

### layout 예시 (트리 기반 — vw 반응형)

```scss
// tree.json 데이터:
// Hero: { width:720, height:1280 }
// Title: { display:flex, flexDirection:column, alignItems:center, gap:24px, width:620, height:230 }
// Period: { display:flex, flexDirection:column, gap:10px, padding:"22px 14px", width:600, height:220 }
// designWidth = 720px → vw = (px / 720) × 100

@use '../tokens' as t;

.heroSection {
  position: relative;
  width: 100%;
  height: 177.78vw;           // 1280 / 720 × 100
  overflow: hidden;           // tree: overflow:hidden
}

.heroTitle {
  display: flex;              // tree: display:flex
  flex-direction: column;     // tree: flexDirection:column
  align-items: center;        // tree: alignItems:center
  gap: 3.33vw;                // tree: 24 / 720 × 100
  width: 86.11%;              // tree: 620 / 720 (부모 대비 %)
}

.heroPeriod {
  display: flex;              // tree: display:flex
  flex-direction: column;     // tree: flexDirection:column
  gap: 1.39vw;                // tree: 10 / 720 × 100
  padding: 3.06vw 1.94vw;    // tree: "22px 14px" / 720 × 100
  width: 83.33%;              // tree: 600 / 720
}
```

### components 예시 (트리 기반 — clamp 폰트)

```scss
// tree.json 데이터:
// TEXT "참여 대상": { fontSize:24px, fontWeight:600, color:#ffffff, fontFamily:Pretendard }
// BTN_Share: { borderRadius:500px, backgroundColor:rgba(13,40,61,0.5), border:"1px solid #ffffff" }
// designWidth = 720px, minWidth = 340px

@use '../tokens' as t;

.heroTarget {
  // 본문 역할 → 최소 12px
  font-size: clamp(12px, 3.33vw, 24px);  // tree: 24 / 720 × 100 = 3.33vw
  font-weight: 600;           // tree: fontWeight:600
  color: #ffffff;             // tree: color:#ffffff
  font-family: t.$font-pretendard;
  text-align: center;         // tree: textAlign:center
}

.heroShareBtn {
  border-radius: 69.44vw;     // tree: 500 / 720 × 100 (원형 유지)
  background-color: rgba(13, 40, 61, 0.5);  // tree 그대로
  border: 0.14vw solid #ffffff; // tree: 1 / 720 × 100
  width: 10vw;                // tree: 72 / 720 × 100
  height: 10vw;               // 정사각형 유지
  display: flex;              // tree: display:flex
  justify-content: center;    // tree: justifyContent:center
  align-items: center;        // tree: alignItems:center
}
```

### _tokens.scss (기존 토큰 참조 + 트리에서 추출)

```scss
// ─── 기존 토큰 참조 (프로젝트에 이미 있는 경우) ───
@use '../../styles/variables' as v;

// ─── 매핑 (기존 토큰 → 피처 시맨틱 별칭) ────────
$color-bg-primary: v.$color-navy;
$color-text-primary: v.$color-white;

// ─── 새 토큰 (tree.json에서 추출, 기존에 없는 값만) ───
$color-accent-gold: #ffd700;

// ─── 폰트 ─────────────────────────────────────
$font-pretendard: 'Pretendard', sans-serif;

// ─── 간격 (tree.json의 빈번한 gap/padding 값) ──
$space-xs: 5px;    // tree에서 빈도 높은 값
$space-sm: 7px;
$space-md: 11px;
$space-lg: 16px;

$bp-desktop: 1024px;
```

---

## 3. 컴포넌트 작성

### Vue / Nuxt 예시 (트리 기반)

```vue
<!--
  tree.json 구조:
  Hero (INSTANCE 720x1280)
  ├── BG (FRAME — 배경 레이어)
  ├── Title (FRAME — flex-column, gap:24px)
  │   ├── Title (RECTANGLE — imageRef → title.webp)
  │   └── Sub Title (VECTOR — imageRef → subtitle.webp)
  ├── Period (FRAME — flex-column, gap:10px, padding)
  │   └── Period (FRAME — flex-column, gap:22px)
  │       ├── Period_Left (FRAME — flex-column, gap:4px)
  │       │   ├── TEXT "이벤트 기간 (이벤트 참여 및 미션 수행)"
  │       │   └── TEXT "2025.12.22 11:00 ~ 2026.01.18 11:00 [KST]"
  │       └── Period_Right (FRAME — flex-column, gap:4px)
  │           ├── TEXT "교환/응모 종료일"
  │           └── TEXT "2026.01.25. 11:00 [KST]"
  └── BTN_Share (FRAME — flex, borderRadius:500px)
-->
<template>
  <section class="heroSection">
    <!-- BG: CSS background-image로 처리 (img 태그 아님!) -->
    <!-- .heroSection { background-image: url('/images/{feature}/hero-bg.webp'); background-size: cover; } -->

    <!-- Title: flex-column, gap:24px → 직접 매핑 -->
    <div class="heroTitle">
      <img src="/images/{feature}/title.webp"
           alt="추운 겨울, 따뜻한 보상이 펑펑"
           class="heroTitleImg" />
      <img src="/images/{feature}/subtitle.webp"
           alt="겨울을 녹일 보상, 지금 PC방에서 획득하세요!"
           class="heroSubtitleImg" />
    </div>

    <!-- Period: flex-column, gap:10px, padding → 직접 매핑 -->
    <div class="heroPeriod">
      <div class="heroPeriodInner">
        <!-- Period_Left: flex-column, gap:4px -->
        <div class="heroPeriodGroup">
          <!-- TEXT 노드에서 characters 직접 삽입 -->
          <span class="heroPeriodLabel">이벤트 기간 (이벤트 참여 및 미션 수행)</span>
          <span class="heroPeriodValue">{{ eventPeriod.start }} ~ {{ eventPeriod.end }} [{{ eventPeriod.timezone }}]</span>
        </div>
        <!-- Period_Right: 동일 구조 -->
        <div class="heroPeriodGroup">
          <span class="heroPeriodLabel">교환/응모 종료일</span>
          <span class="heroPeriodValue">2026.01.25. 11:00 [KST]</span>
        </div>
      </div>
    </div>

    <!-- BTN_Share: flex, borderRadius:500px → 버튼으로 승격 -->
    <button class="heroShareBtn" @click="handleShare">
      <img src="/images/{feature}/share-icon.webp" alt="공유하기" class="heroShareIcon" />
    </button>
  </section>
</template>

<script setup lang="ts">
/**
 * 히어로 섹션
 * tree.json: Hero (INSTANCE 720x1280)
 *
 * [기능 정의]
 * - 키비주얼 + 이벤트 기간 정보 + 공유 버튼
 *
 * [인터랙션]
 * ① 공유 버튼 클릭 → 공유 다이얼로그
 */

interface EventPeriod {
  start: string
  end: string
  timezone: string
}

defineProps<{
  eventPeriod: EventPeriod
}>()

const emit = defineEmits<{ share: [] }>()

function handleShare(): void {
  emit('share')
}
</script>
<!-- 스타일: styles/{feature}/layout/_hero.scss + components/_hero.scss -->
```

### 스택별 변환 규칙

| Vue/Nuxt | React/Next.js |
|----------|---------------|
| `class="..."` | `className={styles.xxx}` (CSS Module) |
| `v-if="condition"` | `{condition && <X/>}` |
| `v-for="i in items" :key="i.id"` | `{items.map(i => <X key={i.id}/>)}` |
| `@click="handler"` | `onClick={handler}` |
| `<img src="/images/..."` | `<Image src="/images/..."` |

---

## 4. 이미지 처리 (트리 기반 판별)

```
트리 노드의 속성으로 이미지 유형을 판별한다:

배경 이미지:
  조건: BG 프레임 (name에 BG/bg 또는 부모와 크기 동일)
  ❌ <img> 태그 금지
  ✅ CSS background-image로만 처리:
     부모 { background-image: url('...'); background-size: cover; }

콘텐츠 이미지:
  조건: imageRef 있음 + 독립적 크기 + TEXT 형제 없음
  매핑: width/height → vw 변환
  태그: <img alt="가장 가까운 TEXT 노드의 characters" />

장식 이미지:
  조건: opacity < 1 또는 mixBlendMode 있음 또는 filter:blur 있음
  매핑: tree의 opacity/mixBlendMode/filter 직접 적용
  태그: <img alt="" aria-hidden="true" />

아이콘:
  조건: VECTOR/GROUP + 크기 ≤ 64px
  매핑: width/height → vw 변환
  태그: <img alt="기능 설명" /> 또는 인라인 SVG
```

---

## 5. 반응형 추가 (데스크탑 URL)

```
두 번째 URL의 tree.json을 확보한 후:

모바일 tree vs 데스크탑 tree 비교:
  동일한 name의 노드를 매칭
  CSS 속성 차이만 @media 오버라이드로 추가

같은 값 → 유지
다른 px 값 → @include pc { width: {desktop값 × pcScaleFactor}px; }
다른 레이아웃 → @include pc { flex-direction: row; }
다른 이미지 → @include pc { content: url(/images/{feature}/desktop-xxx.webp); }

기존 모바일 코드 삭제 금지.
```

---

## 6. Semantic HTML 규칙

```
Claude가 태그를 승격할 때의 규칙:

- 최상위 래퍼: <section>
- 섹션 제목 (name에 "title", 가장 큰 fontSize): <h2>
- 설명 텍스트: <p>
- 클릭 가능 (name에 "btn", "CTA", "link"): <button> 또는 <a>
- 반복 리스트: <ul>/<ol> + <li>
- 네비게이션: <nav>
- 제목 순서: <h1>~<h6> (순차, 건너뛰기 금지)
- 장식 이미지: alt="" + aria-hidden="true"
- 콘텐츠 이미지: alt="설명적 텍스트"
```

---

## 7. 생성 후 자가 검증

```
코드 작성 완료 후, Phase 4 (브라우저 검증) 전에:

1. 클래스명 일관성:
   template의 모든 class가 SCSS에 정의됨 → OK
   SCSS에 정의된 클래스가 template에 없음 → 경고 (미사용)
   template에 사용된 클래스가 SCSS에 없음 → P1 (스타일 미적용)

2. 이미지 경로:
   모든 src="/images/..." 경로가 static/ 에 실제 존재 → OK
   존재하지 않는 경로 → P1

3. 트리 매핑 완전성:
   tree.json의 Auto Layout 노드 → SCSS에 flex 속성 존재 → OK
   Auto Layout인데 SCSS에 flex 없음 → P1 (레이아웃 깨짐)
```
