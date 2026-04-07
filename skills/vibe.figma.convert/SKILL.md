---
name: vibe.figma.convert
description: 스크린샷 + 재료함 → 프로젝트 코드 + 외부 스타일 파일
triggers: []
tier: standard
---

# vibe.figma.convert — 시각 기반 코드 생성

**스크린샷을 보고** 코드를 작성한다. Figma 데이터는 정확한 수치/에셋 재료로만 사용.

```
❌ Figma 트리를 HTML로 변환 (실패하는 방식)
✅ 스크린샷을 보고 → 시맨틱 HTML 설계 → 재료함에서 정확한 값 가져다 적용
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

매칭 안 되면 → 섹션 1 프로세스로 새로 생성 (기존 방식)
```

---

## 1. 코드 생성 프로세스

```
입력:
  - 섹션 스크린샷 (정답 사진)
  - 재료함: 이미지 목록, 색상 팔레트, 폰트 목록, 텍스트 콘텐츠, CSS 수치

출력:
  - 컴포넌트 파일 (Vue SFC / React TSX)
  - SCSS 파일 (layout/ + components/ + _tokens.scss)

프로세스:
  1. 스크린샷을 본다 → "무엇이 보이는가?" 판단
     - 전면 배경 위 콘텐츠? → 히어로 패턴
     - 카드 N개 반복? → 그리드 패턴
     - 탭 + 내용? → 탭 패턴
     - 리스트 + 버튼? → 인터랙티브 리스트 패턴

  2. 시맨틱 HTML 구조를 설계한다 (Figma 레이어 구조 무시)
     - 스크린샷에서 보이는 시각적 관계를 HTML로 표현
     - <section>, <h2>, <ul>, <button> 등 의미에 맞게

  3. 재료함에서 정확한 값을 가져온다
     - 이미지: /tmp/{feature}/images/ 에서 해당 파일
     - 색상: tree.json CSS의 정확한 hex/rgba
     - 폰트: 정확한 font-family, size, weight
     - 텍스트: TEXT 노드의 characters 값 그대로
     - 간격: 정확한 padding, gap, margin 값

  4. 코드를 작성한다
     - 컴포넌트: 스크린샷처럼 보이도록
     - SCSS: 재료함의 정확한 수치 (× scaleFactor)
     - 추정 금지 — 값이 없으면 tree.json에서 다시 찾는다
```

---

## 2. 외부 SCSS 파일 구조

### layout vs components 구분

```
layout/  → position, display, flex/grid, width, height, padding, margin,
           gap, overflow, z-index, background-image, inset
components/ → font-size, font-weight, color, line-height, letter-spacing,
              text-align, border, border-radius, box-shadow, opacity
```

### layout 예시 (스크린샷 기반으로 작성)

```scss
// 스크린샷에서 보이는 구조:
// - 전면 배경 이미지 위에 중앙 정렬된 콘텐츠
// 재료함에서 가져온 값: width=720, height=1280 (→ ×0.75)

@use '../tokens' as t;

.heroSection {
  position: relative;
  height: 960px;              // 재료: 1280 × 0.75
  width: 100%;
  overflow: clip;
}

.heroBg {
  position: absolute;
  inset: 0;
  z-index: 0;
  img { width: 100%; height: 100%; object-fit: cover; }
}

.heroContent {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 98px;          // 재료: 130 × 0.75
}
```

### components 예시

```scss
// 스크린샷에서 보이는 요소:
// - 큰 타이틀 이미지, 그 아래 흰색 텍스트
// 재료함: fontSize=24, color=#ffffff, width=620, height=174

@use '../tokens' as t;

.heroTitle {
  width: 465px;               // 재료: 620 × 0.75
  height: 131px;              // 재료: 174 × 0.75
  img { width: 100%; height: 100%; object-fit: cover; }
}

.heroText {
  font-size: t.$font-size-md;      // 재료: 24px × 0.667 = 16px
  color: t.$color-text-primary;    // 재료: #ffffff
  line-height: 1.4;
  text-align: center;
}
```

### _tokens.scss 구조 (기존 토큰 참조 + 새 토큰)

```scss
// ─── 기존 토큰 참조 (프로젝트에 이미 있는 경우) ───
// project-tokens.json 매칭 결과에 따라 @use로 참조
@use '../../styles/variables' as v;

// ─── 매핑 (기존 토큰 → 피처 시맨틱 별칭) ────────
$color-bg-primary: v.$color-navy;          // 기존 토큰 재사용
$color-text-primary: v.$color-white;       // 기존 토큰 재사용

// ─── 새 토큰 (매칭 안 된 값만 생성) ─────────────
// 기존 토큰이 없는 프로젝트에서는 아래처럼 전체 생성 (기존 방식)

// ─── Primitive (재료함의 원시 값) ────────────────
$color-white: #ffffff;
$color-black: #000000;
$color-navy-dark: #0a1628;
$color-navy-medium: #00264a;

$font-pretendard: 'Pretendard', sans-serif;

$font-size-xs: 11px;   // 재료: 16 × 0.667
$font-size-sm: 13px;   // 재료: 20 × 0.667
$font-size-md: 16px;   // 재료: 24 × 0.667
$font-size-lg: 19px;   // 재료: 28 × 0.667

$font-weight-regular: 400;
$font-weight-medium: 500;
$font-weight-bold: 700;

$space-xs: 5px;
$space-sm: 11px;
$space-md: 16px;
$space-lg: 21px;

// ─── Semantic (용도별) ────────────────────────
$color-text-primary: $color-white;
$color-text-secondary: #dadce3;
$color-bg-primary: $color-navy-dark;
$color-bg-section: $color-navy-medium;
$color-border-primary: #203f6c;
$bp-desktop: 1024px;

// 규칙:
//   - primitive: 재료함의 고유 값 (hex, 폰트명, px)
//   - semantic: primitive 참조로 용도별 이름
//   - 같은 값 중복 금지 — 기존 토큰 재사용
```

---

## 3. 컴포넌트 작성

### Vue / Nuxt 예시

```vue
<!-- 스크린샷 기반: 전면 배경 + 중앙 타이틀 + 기간 정보 + 공유 버튼 -->
<template>
  <section class="heroSection">
    <div class="heroBg">
      <img src="/images/{feature}/bg.webp" alt="" aria-hidden="true" />
    </div>

    <div class="heroContent">
      <div class="heroTitle">
        <img src="/images/{feature}/title.webp" alt="추운 겨울, 따뜻한 보상이 펑펑" />
      </div>

      <div class="heroPeriod">
        <p class="heroPeriodTarget">참여 대상 : PC 유저 (Steam, Kakao)</p>
        <div class="heroPeriodDetails">
          <div class="heroPeriodItem">
            <p class="heroPeriodLabel">이벤트 기간</p>
            <p class="heroPeriodValue">{{ eventPeriod }}</p>
          </div>
        </div>
      </div>
    </div>

    <button class="heroShareBtn" @click="handleShare">
      <img src="/images/{feature}/share.webp" alt="공유하기" />
    </button>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  eventPeriod: string
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

## 4. 이미지 배치 패턴 (스크린샷에서 판단)

```
스크린샷에서 판단하는 패턴:

배경 이미지 (화면 전체를 덮는 큰 이미지):
  → absolute + inset-0 + object-cover
  → .{section}Bg (z-index: 0) + .{section}Content (z-index: 10)

콘텐츠 이미지 (독립적 요소):
  → <img src="..." alt="설명" /> + 고정 width/height

장식 이미지 (분위기용, 반투명, 블러):
  → <img ... alt="" aria-hidden="true" />
  → mix-blend-mode, opacity 등 재료함 값 적용
```

---

## 5. 반응형 추가 (데스크탑 URL)

```
두 번째 URL의 재료를 확보한 후:

기존 모바일 코드 유지 + @media 오버라이드만 추가.

같은 값 → 유지
다른 px 값 → @include pc { ... } 오버라이드
다른 레이아웃 → @include pc { flex-direction: row; }
다른 배경 이미지 → @include pc { content: url(...) }

기존 코드 삭제 금지.
```

---

## 6. Semantic HTML 규칙

```
- 섹션 래퍼: <section>
- 제목: <h1>~<h6> (순차, 건너뛰기 금지)
- 텍스트: <p>
- 버튼: <button>
- 링크: <a>
- 리스트: <ul>/<ol> + <li> (반복 패턴)
- 장식 이미지: alt="" + aria-hidden="true"
- 콘텐츠 이미지: alt="설명적 텍스트"
```
