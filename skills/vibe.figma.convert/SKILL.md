---
name: vibe.figma.convert
description: Figma 트리 → 구조적 코드 생성 + 스크린샷 검증
triggers: []
tier: standard
---

# vibe.figma.convert — 트리 기반 구조적 코드 생성

**tree.json을 기계적으로 HTML+CSS에 매핑한다. 추정하지 않는다.**
**Claude는 시맨틱 판단(태그 선택, 컴포넌트 분리, 인터랙션)만 담당한다.**

---

## 0. 재사용 확인 (코드 작성 전)

```
component-index.json에서 매칭되는 컴포넌트가 있으면:
  ✅ import하여 사용 (새로 만들지 않음)
  ✅ props로 커스터마이즈
  ❌ 기존 컴포넌트 내부 수정
  ❌ 90% 유사한데 새로 만들기
```

---

## 1. 이미지 vs HTML 판별 (BLOCKING)

```
⛔ 코드 작성 전: 판별 테이블을 먼저 작성한다.

판별 규칙 (하나라도 YES → HTML):
  Q1. TEXT 자식 있는가? → HTML
  Q2. INSTANCE 반복 패턴인가? → HTML v-for (내부 에셋만 <img>)
  Q3. 인터랙티브 요소인가? (btn, CTA) → HTML <button>
  Q4. 동적 데이터인가? (가격, 수량, 기간) → HTML 텍스트
  모두 NO → 이미지 렌더링 가능

⛔ 디자인 텍스트 판별 (Q1 예외 — 이미지로 처리해야 하는 텍스트):
  다음 조건 중 하나라도 충족 → 이미지 렌더링 (HTML 텍스트 금지):
  D1. TEXT 노드의 fills가 2개 이상 (그래디언트 + 솔리드 중첩)
  D2. TEXT 노드에 effects가 있음 (DROP_SHADOW, stroke 등)
  D3. TEXT 노드의 fills에 GRADIENT 타입이 있음
  D4. 부모 GROUP/FRAME 아래 VECTOR 3개 이상 (벡터 글자)
  D5. TEXT 노드의 fontFamily가 프로젝트 웹폰트에 없음

  → content/{section}-{name}.webp 로 노드 렌더링
  → <img src="..." alt="텍스트 내용"> 으로 HTML 배치
  → CSS text로 구현 시도 금지 (시각 품질 보장 불가)

BG 프레임:
  ❌ <img> 태그 금지
  ✅ 부모 SCSS에 background-image만:
     .section { background-image: url('bg.webp'); background-size: cover; }
```

---

## 2. 노드 → HTML 매핑 (기계적)

```
FRAME + Auto Layout → <div> + flex (direction/gap/padding 직접 매핑)
FRAME + no Auto Layout → <div> + position:relative (자식 absolute)
TEXT → <span> (Claude가 h2/p/button 승격)
IMAGE fill (판별 통과) → <img>
VECTOR/GROUP ≤64px → 아이콘 <img>
INSTANCE 반복 2+ → v-for / .map()
크기 0px, VECTOR ≤2px → 스킵
```

---

## 3. CSS 속성 직접 매핑

```
⛔ 불변 규칙: tree.json에 없는 CSS 속성을 만들지 않는다.
⛔ 커스텀 함수/믹스인 생성 금지: wp-fluid(), wp-bg-layer 등 자체 추상화 금지.
⛔ aspect-ratio, container query 등 tree.json에 없는 CSS 속성 사용 금지.
✅ tree.json의 css 객체 → SCSS에 1:1 직접 매핑만 허용.
✅ 유일한 변환: px → vw (공식대로 기계적으로).

레이아웃 (layout/ 파일):
  display, flex-direction, justify-content, align-items, gap,
  flex-grow, padding, width, height, overflow, position, top, left, transform

비주얼 (components/ 파일):
  background-color, background-image, background-blend-mode, color,
  font-family, font-size, font-weight, line-height, letter-spacing,
  text-align, text-transform, text-overflow,
  border-radius, border, outline, box-sizing, box-shadow,
  opacity, mix-blend-mode, filter, backdrop-filter

값이 없으면 → 해당 속성 생략 (추정 금지)

❌ 금지 패턴:
  aspect-ratio: 720 / 1280;          → ❌ (tree.json엔 width+height)
  @function wp-fluid(...) { ... }    → ❌ (자체 함수)
  @include wp-bg-layer;              → ❌ (자체 믹스인)
  clamp(12px, 2.5vw, 18px);          → ❌ (tree.json에 없는 값 추정)

✅ 올바른 패턴:
  width: 100vw; height: 177.78vw;    → ✅ (720px/720×100, 1280px/720×100)
  background-image: url('hero-bg.webp'); background-size: cover;  → ✅
  font-size: 5.56vw;                 → ✅ (40px/720×100)
```

### 반응형 단위 변환

```
vw 변환 (기계적 공식만 사용):
  width, height, padding, gap, border-radius, box-shadow, top, left, border-width
  vw값 = (Figma px / designWidth) × 100
  ⛔ clamp, min(), max() 등은 font-size에만 허용

폰트 → clamp(최소, vw, 최대):
  | 역할 | 최소 | 판단 기준 |
  |------|------|----------|
  | h1~h2 | 16px | name에 "title" |
  | h3~h4 | 14px | 중간 크기 |
  | 본문 | 12px | 긴 텍스트 |
  | 캡션 | 10px | 작은 fontSize |
  | 버튼 | 12px | name에 "btn" |
  최대값 = Figma 원본 px 그대로

변환하지 않는 속성:
  color, opacity, font-weight, font-family, z-index, text-align,
  mix-blend-mode, transform(rotate), background-blend-mode,
  flex-grow, box-sizing, grayscale/saturate, background-image(gradient)

layoutSizing 처리:
  HUG → width/height 생략 (auto)
  FILL → 부모 direction 확인:
    같은 방향 FILL → flex: 1 0 0
    교차축 FILL → align-self: stretch
  FIXED → vw 변환

imageScaleMode:
  FILL → background-size: cover
  FIT  → background-size: contain
  CROP → background-size: cover; background-position: center
  TILE → background-size: auto; background-repeat: repeat
```

---

## 4. Claude 시맨틱 판단 (유일한 추정 영역)

```
1. HTML 태그 승격:
   <span> → <h2> (섹션 제목), <p> (설명), <button> (클릭 가능)

2. 컴포넌트 분리:
   1depth 자식 = 섹션 컴포넌트, INSTANCE 반복 = 공유 컴포넌트

3. 인터랙션: @click 핸들러, 상태 변수, 조건부 렌더링

4. 접근성:
   배경/장식 → alt="" aria-hidden="true"
   콘텐츠 → alt="설명"
   인터랙티브 → role, aria-label

5. Semantic HTML:
   최상위 <section>, 제목 순서 h1~h6, 리스트 <ul>/<ol>
```

---

## 5. SCSS 파일 구조

```
layout/     → position, display, flex, width, height, padding, gap, overflow, z-index
components/ → font, color, border, shadow, opacity, background

_base.scss:
  .{feature} { width: 100%; max-width: 720px; margin: 0 auto; overflow-x: hidden; }

_tokens.scss:
  기존 토큰 참조 (@use) → 매핑 안 되면 새 토큰 생성
  피처 스코프 네이밍 ($feature-color-xxx)
```

---

## 6. 반응형 (MO↔PC)

```
remapped.json의 pcDiff를 사용하여 @media 오버라이드 추가.
MO 기본 코드 삭제 금지.

.section {
  // MO 기본 (vw = px / 720 × 100)
  height: 177.78vw;

  @media (min-width: #{$bp-desktop}) {
    // PC 차이만 (vw = px / 2560 × 100)
    height: 32.66vw;
  }
}

diff 처리:
  같은 값 → MO만 유지
  다른 px → @media { PC vw }
  다른 레이아웃 → @media { flex-direction: row }
  다른 이미지 → @media { background-image: url(pc-xxx.webp) }
  layoutSizing diff → @media { flex/width 변경 }
```

---

## 7. 자가 검증

```
⛔ 하나라도 실패 → 해당 섹션 코드 재작성 (다음 섹션 진행 금지)

1. 클래스명: template 모든 class가 SCSS에 정의 → OK
2. 이미지 경로: src가 실제 파일 존재 → OK
3. 트리 매핑: Auto Layout 노드 → SCSS에 flex 있음 → OK
4. ⛔ 추상화 금지: SCSS에 @function, @mixin 자체 정의가 없음 → OK
   (프로젝트 기존 토큰 @use는 허용, 새 함수/믹스인 생성은 금지)
5. ⛔ 속성 매핑: SCSS의 모든 속성이 tree.json css 객체에 근거 → OK
   (aspect-ratio, container, custom property 등 tree.json에 없는 속성 → FAIL)
6. ⛔ 이미지 파일명: kebab-case 네이밍 → OK
   (해시 파일명 68ad470b.webp 등 → FAIL)
```
