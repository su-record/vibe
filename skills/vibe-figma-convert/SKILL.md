---
name: vibe-figma-convert
description: 참조 코드(React+Tailwind) → 프로젝트 코드 + 외부 스타일 파일
triggers: []
tier: standard
---

# vibe-figma-convert — 코드 변환

`get_design_context` 참조 코드를 프로젝트 스택 코드 + 외부 SCSS 파일로 변환.

---

## 1. 외부 스타일 파일 생성

### 변환 예시

```
참조 코드 (React+Tailwind):
  <div className="h-[1280px] relative w-[720px]">                    ← 섹션 컨테이너
    <div className="absolute h-[1280px] overflow-clip w-[720px]">    ← BG 레이어
      <img src={img21} className="absolute inset-0 object-cover size-full" />
    </div>
    <div className="absolute flex flex-col items-center top-[130px]"> ← Content
      <div className="h-[174px] w-[620px]">                          ← Title 이미지
        <img src={imgTitle} className="absolute inset-0 object-cover size-full" />
      </div>
      <p className="text-[24px] text-white leading-[1.4] text-center"> ← 텍스트
        참여 대상 : PC 유저 (Steam, Kakao)
      </p>
    </div>
  </div>
```

```
변환 → styles/{feature}/layout/_hero.scss:

@use '../tokens' as t;

.heroSection {
  position: relative;
  height: 960px;              // 1280 × 0.75
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
  padding-top: 98px;          // 130 × 0.75
}
```

```
변환 → styles/{feature}/components/_hero.scss:

@use '../tokens' as t;

.heroTitle {
  width: 465px;               // 620 × 0.75
  height: 131px;              // 174 × 0.75
  img { width: 100%; height: 100%; object-fit: cover; }
}

.heroParticipation {
  font-size: t.$text-sub;     // 24px × 0.75 = 18px
  color: t.$color-white;
  line-height: 1.4;
  text-align: center;
  white-space: nowrap;
}
```

### layout vs components 구분

```
layout/  → position, display, flex/grid, width, height, padding, margin,
           gap, overflow, z-index, background-image, inset
components/ → font-size, font-weight, color, line-height, letter-spacing,
              text-align, border, border-radius, box-shadow, opacity
```

### _tokens.scss 업데이트

```
섹션을 처리할 때마다 새로운 고유값을 토큰에 추가:

// Colors
$color-white: #FFFFFF;
$color-bg-dark: #0A1628;
$color-heading: #1B3A1D;
$color-text-body: #333333;
$color-period-label: #003879;
$color-grayscale-950: #171716;

// Typography (Figma px × scaleFactor)
$text-hero: 36px;            // 48 × 0.75
$text-sub: 18px;             // 24 × 0.75
$text-body: 16px;            // 21 × 0.75
$text-period: 21px;          // 28 × 0.75

// Font families
$font-pretendard: 'Pretendard', sans-serif;
$font-roboto-condensed: 'Roboto Condensed', sans-serif;

// Spacing
$space-section: 98px;        // 130 × 0.75
$space-content: 18px;        // 24 × 0.75

// Breakpoints
$bp-pc: 1024px;
```

---

## 2. 컴포넌트 파일 변환

### Vue / Nuxt

```vue
<template>
  <section class="heroSection">
    <!-- BG Layer -->
    <div class="heroBg">
      <img src="/images/{feature}/bg.webp" alt="" aria-hidden="true" />
    </div>

    <!-- Content Layer -->
    <div class="heroContent">
      <div class="heroTitle">
        <img src="/images/{feature}/title.webp" alt="추운 겨울, 따뜻한 보상이 펑펑" />
      </div>
      <div class="heroSubTitle">
        <img src="/images/{feature}/sub-title.webp" alt="겨울을 녹일 보상, 지금 PC방에서 획득하세요!" />
      </div>

      <!-- Period Info (참조 코드 data-name="Period") -->
      <div class="heroPeriod">
        <p class="heroPeriodTarget">참여 대상 : PC 유저 (Steam, Kakao)</p>
        <div class="heroPeriodDetails">
          <div class="heroPeriodItem">
            <p class="heroPeriodLabel">이벤트 기간</p>
            <p class="heroPeriodValue">{{ eventPeriod }}</p>
          </div>
          <div class="heroPeriodItem">
            <p class="heroPeriodLabel">교환/응모 종료일</p>
            <p class="heroPeriodValue">{{ exchangeDeadline }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Button (참조 코드 data-name="BTN_Share") -->
    <button class="heroShareBtn" @click="handleShare">
      <img src="/images/{feature}/share.webp" alt="공유하기" />
    </button>
  </section>
</template>

<script setup lang="ts">
/**
 * Hero 섹션 — 키비주얼 + 이벤트 기간 정보
 *
 * [인터랙션] 공유 버튼 클릭 → 공유하기 팝업
 * [상태] 로그인 전/후
 */

defineProps<{
  eventPeriod: string
  exchangeDeadline: string
}>()

const emit = defineEmits<{
  share: []
}>()

function handleShare(): void {
  emit('share')
}
</script>
<!-- 스타일: styles/{feature}/layout/_hero.scss + components/_hero.scss -->
```

### JSX 변환 규칙 (React+Tailwind → Vue/Nuxt)

| React JSX | Vue SFC |
|-----------|---------|
| `className="..."` | `class="..."` |
| `{condition && <X/>}` | `<X v-if="condition" />` |
| `{items.map(i => <X key={i.id}/>)}` | `<X v-for="i in items" :key="i.id" />` |
| `onClick={handler}` | `@click="handler"` |
| `src={변수}` | `src="/images/{feature}/파일.webp"` (imageMap으로 교체) |
| `style={{ maskImage: ... }}` | `:style="{ maskImage: ... }"` |
| `<img alt="" />` (장식) | `<img alt="" aria-hidden="true" />` |

### JSX 변환 규칙 (React+Tailwind → React/Next.js)

| React+Tailwind | React/Next.js + SCSS |
|----------------|---------------------|
| `className="text-[48px] font-black"` | `className={styles.heroTitle}` |
| `<img src={변수}` | `<Image src="/images/{feature}/파일.webp"` |
| Tailwind 클래스 | CSS Module 또는 외부 SCSS 클래스 |

---

## 3. 이미지 배치 패턴

### 배경 이미지 (참조 코드에서 absolute + inset-0 + object-cover)

```
참조 코드에 이 패턴이 있으면 → 배경 이미지:
  <div className="absolute ...">
    <img src={imgXxx} className="absolute inset-0 object-cover size-full" />
  </div>

→ Multi-Layer 변환:
  .{section}Bg → position: absolute; inset: 0; z-index: 0;
  .{section}Content → position: relative; z-index: 10;
```

### 콘텐츠 이미지 (참조 코드에서 독립적 img)

```
→ <img src="/images/{feature}/파일.webp" alt="설명" width={스케일적용} height={스케일적용} />
```

### 장식 이미지 (참조 코드에서 mix-blend, opacity, blur)

```
→ <img ... alt="" aria-hidden="true" /> (접근성: 장식은 비표시)
→ CSS: mix-blend-mode, opacity, filter: blur() 등 참조 코드 값 그대로
```

---

## 4. 반응형 추가 (데스크탑 URL)

```
같은 섹션에 대해 데스크탑 참조 코드 추출 후:

같은 값 → 유지
다른 px 값:
  @include pc {
    .heroSection { height: 1440px; }  // 데스크탑 스케일
  }
  또는 clamp(모바일, calc, 데스크탑) 사용

다른 배경 이미지:
  .heroBg img { content: url('/images/{feature}/hero-mobile.webp'); }
  @include pc {
    .heroBg img { content: url('/images/{feature}/hero-pc.webp'); }
  }

다른 레이아웃:
  .heroContent { flex-direction: column; }
  @include pc { .heroContent { flex-direction: row; } }

기존 모바일 코드 삭제 금지. @media 또는 mixin으로 추가만.
```

---

## 5. Semantic HTML 최소 규칙

```
- 섹션 래퍼: <section>
- 제목: <h1>~<h6> (순차, 건너뛰기 금지)
- 텍스트: <p>
- 버튼: <button> (@click 있으면)
- 링크: <a> (href 있으면)
- 리스트: <ul>/<ol> + <li> (반복 패턴)
- 장식 이미지: alt="" + aria-hidden="true"
- 콘텐츠 이미지: alt="설명적 텍스트"
```
