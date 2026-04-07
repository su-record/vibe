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

부모와 동일 크기(±5%) + imageRef + 형제 중 첫 위치:
  → `position: absolute; inset: 0; z-index: 0; object-fit: cover`
  → 부모에 `position: relative; overflow: hidden` 추가

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

## Scale Factor 적용

**적용 (px 값):**
  font-size, padding, margin, gap, width, height, border-radius,
  border-width, box-shadow px, filter px, letter-spacing

**미적용:**
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

- [ ] template 클래스 ↔ SCSS 클래스 1:1 일치
- [ ] 모든 img src가 static/에 실제 존재
- [ ] Auto Layout 노드 → SCSS에 flex 속성 존재
- [ ] tree.json에 없는 CSS 값이 SCSS에 없음
