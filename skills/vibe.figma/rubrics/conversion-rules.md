# Tree → Code Conversion Rules

## Core Principle

모든 CSS 값은 tree.json에서 직접 매핑한다. 추정하지 않는다.

## Node → HTML Mapping (Do This First)

각 노드를 순서대로 분류:

| 노드 조건 | HTML 매핑 |
|-----------|----------|
| FRAME + Auto Layout | `<div>` + flex (direction/gap/padding 직접) |
| FRAME + no Auto Layout | `<div>` + position:relative (자식 absolute) |
| TEXT | `<span>` → Claude가 `<h2>/<p>/<button>` 승격 |
| RECTANGLE/VECTOR + imageRef | `<img src="다운로드된 파일">` |
| VECTOR/GROUP ≤ 64px | 아이콘 → `<img>` (렌더링 이미지) |
| INSTANCE 반복 3+ | v-for (Vue) 또는 .map() (React) |
| 크기 0px | 스킵 |
| VECTOR 장식선 (w/h ≤ 2px) | 스킵 |

## 배경 레이어 판별

BG 프레임 (name에 "BG"/"bg" 또는 부모와 동일 크기 ±5%):
  ❌ <img> 태그로 배경 처리 금지
  ❌ position:absolute + inset:0 으로 이미지 배치 금지
  ✅ 부모 요소에 CSS background-image로만 처리:
     background-image: url('/images/{feature}/{section}-bg.webp');
     background-size: cover;
     background-position: center top;
  ✅ BG 프레임은 HTML에 아무것도 렌더링하지 않음 (CSS만)

## 이미지 vs HTML 판별 (각 노드마다 확인)

```
노드를 이미지로 처리하기 전에 반드시 확인:

Q1. 이 노드에 TEXT 자식이 있는가?
  YES → HTML로 구현 (텍스트는 이미지에 넣지 않는다)
  NO → Q2로

Q2. 이 노드가 INSTANCE 반복 패턴의 일부인가?
  YES → HTML 반복 구조 (v-for/.map()) — 내부 이미지 에셋만 개별 추출
  NO → Q3로

Q3. 이 노드에 클릭/인터랙션이 필요한가? (btn, CTA, link, tab)
  YES → HTML <button>/<a> — 이미지 금지
  NO → Q4로

Q4. 이 노드의 콘텐츠가 동적 데이터인가? (가격, 수량, 기간, 상태)
  YES → HTML 텍스트 — 이미지 금지
  NO → 이미지 렌더링 가능

위 체크에서 하나라도 YES → HTML로 구현
모두 NO → 이미지(벡터 글자, BG, 래스터, 복잡 그래픽)로 렌더링

실제 테스트에서 발생한 잘못된 패턴:

  ❌ <img src="hero-bg.webp" class="bg-img" />           → BG를 img 태그로
  ❌ <img src="exchange-section1.webp" />                 → 카드 4개를 이미지 1장으로
  ❌ <img src="daily-step2-list.webp" />                  → 보상 목록을 통째 이미지로
  ❌ <img src="hero-period-bg-mo.webp" class="period-bg"> → Period BG를 img로

  ✅ .heroSection { background-image: url('hero-bg.webp'); background-size: cover; }
  ✅ <div v-for="card in cards" :key="card.id">
       <img :src="card.icon" /> <span>{{ card.price }}</span>
       <button>보상 교환하기</button>
     </div>
```

## CSS 직접 매핑 규칙

tree.json의 css 객체를 SCSS에 1:1 매핑한다:

### layout/ 파일에 넣는 속성
```
display, flex-direction, justify-content, align-items,
gap, padding, width, height, position, overflow, z-index, inset
```

### components/ 파일에 넣는 속성
```
background-color, color, font-family, font-size, font-weight,
line-height, letter-spacing, text-align, border, border-radius,
box-shadow, opacity, mix-blend-mode, filter, backdrop-filter
```

## 반응형 단위 변환 (scaleFactor 사용하지 않음)

스토리보드 CONFIG에서 designWidth, minWidth 확보.

⛔ **커스텀 함수 생성 금지:**
  ❌ @function wp-fluid(...) { ... }
  ❌ @mixin wp-bg-layer { ... }
  ❌ 자체 추상화 (aspect-ratio, clamp 남용)
  ✅ vw 변환은 인라인 계산값을 직접 기입

**UI 요소 → vw 비례:**
  vw값 = (Figma px / designWidth) × 100
  적용: width, height, padding, gap, margin, border-radius,
        border-width, box-shadow px, filter px, letter-spacing

**폰트 → clamp(최소, vw, 최대):**
  vw값 = (Figma px / designWidth) × 100
  최소값 = 역할에 따라 결정:
    h1~h2: 16px, h3~h4: 14px, 본문: 12px, 캡션: 10px, 버튼: 12px
  최대값 = Figma 원본 px

**변환하지 않는 속성:**
  color, opacity, font-weight, font-family, z-index,
  line-height(단위 없을 때), text-align, mix-blend-mode,
  rotate, % 값

## 장식 레이어 최적화

BG 그룹 내 장식 요소가 10개 이상:
  → 배경 이미지 1장 + 핵심 장식 2~3개만 유지
  → 나머지 생략 (Phase 4 스크린샷 검증에서 확인)

## Class Naming

BEM 패턴: `.sectionName__childName`
  - 부모: `.heroSection`
  - 자식: `.heroSection__bg`, `.heroSection__title`, `.heroSection__shareBtn`
  - template에서 사용한 모든 클래스가 SCSS에 정의되어야 함

## 자가 검증 (코드 작성 후)

⛔ 하나라도 실패 → 코드 재작성 (다음 섹션 진행 금지)

- [ ] ⛔ BG 프레임이 <img> 태그로 처리되지 않았는가? (CSS background-image만 허용)
- [ ] ⛔ TEXT 자식이 있는 프레임이 통째 이미지로 처리되지 않았는가?
- [ ] ⛔ INSTANCE 반복 패턴(카드/아이템)이 이미지 1장으로 처리되지 않았는가?
- [ ] ⛔ SCSS에 @function 또는 @mixin 자체 정의가 없는가? (기존 토큰 @use만 허용)
- [ ] ⛔ aspect-ratio 등 tree.json에 없는 CSS 속성이 없는가?
- [ ] ⛔ 이미지 파일명이 kebab-case인가? (해시 파일명 금지)
- [ ] ⛔ 디자인 텍스트(그래디언트/스트로크 효과)가 이미지로 처리되었는가?
- [ ] template 클래스 ↔ SCSS 클래스 1:1 일치
- [ ] 모든 img src가 static/에 실제 존재
- [ ] Auto Layout 노드 → SCSS에 flex 속성 존재
- [ ] tree.json에 없는 CSS 값이 SCSS에 없음
