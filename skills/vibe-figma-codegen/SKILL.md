---
name: vibe-figma-codegen
description: Code generation — markup quality, stack rules, responsive, verification
triggers: []
tier: standard
---

# Skill: vibe-figma-codegen — 코드 생성 규칙

마크업 품질, 스택별 코드 생성, 반응형, 검증.
이미지 패턴은 **vibe-figma-rules R-4** + **vibe-figma-frame B-3.4** 참조.

---

## C-1. Semantic HTML (필수)

모든 요소는 가장 구체적인 semantic 태그를 사용. `<div>`는 최후 수단.

| 시각 요소 | 올바른 태그 | 잘못된 태그 |
|----------|-----------|-----------|
| 페이지 섹션 | `<section>`, `<article>`, `<aside>` | `<div>` |
| 네비게이션 | `<nav>` | `<div class="nav">` |
| 헤더/푸터 | `<header>`, `<footer>` | `<div class="header">` |
| 제목 계층 | `<h1>`→`<h6>` (순차, 건너뛰기 금지) | `<div class="title">` |
| 텍스트 | `<p>` | `<div>` or `<span>` |
| 리스트 | `<ul>`/`<ol>` + `<li>` | `<div>` 반복 |
| 액션 버튼 | `<button>` | `<div onClick>` |
| 링크 | `<a href>` | `<span onClick>` |
| 폼 필드 | `<input>` + `<label>` | `<div contenteditable>` |
| 이미지 | `<img alt="설명">` | content 이미지에 `background-image` |
| 시간 | `<time datetime>` | `<span>` |

## C-2. Accessibility Checklist

```
- [ ] 모든 인터랙티브 요소 키보드 접근 가능
- [ ] <button> = 액션, <a> = 네비게이션 (역할 혼용 금지)
- [ ] <img> alt 설명적 (장식은 alt="" + aria-hidden)
- [ ] <input> ↔ <label> 연결
- [ ] 색상 대비 >= 4.5:1 (텍스트), >= 3:1 (큰 텍스트, UI 컨트롤)
- [ ] 포커스 인디케이터 표시
- [ ] 아이콘 전용 버튼에 aria-label
- [ ] 제목 계층 순차적
```

## C-3. 래퍼 제거 + 컴포넌트 통합

래퍼 제거 및 80% Rule은 **vibe-figma-rules R-5** 참조.

### 컴포넌트 구조 제한

```
Max nesting depth: 3 levels
Max component length: 50 lines
Max props: 5 per component
```

### 분리 트리거

| 신호 | 조치 |
|------|------|
| 컴포넌트 > 50줄 | 서브 컴포넌트로 분리 |
| 시각 패턴 2회+ 반복 | 공유 컴포넌트 추출 |
| 유사도 80%+ | 단일 컴포넌트 + variant prop (R-5) |
| 명확한 시각 경계 (카드, 모달, 폼) | 자체 컴포넌트 + 스타일 파일 |

## C-4. 스토리보드 스펙 + Design Context 적용

```
storyboardSpec → 코드:
  interactions → CSS :hover/:active/:focus + JS 핸들러
  animations → transition, @keyframes (타이밍/이징 스펙대로)
  states → 조건부 렌더링 + 상태별 UI
  colorGuide / typographyGuide → 토큰 검증

design-context.json → 코드:
  accessibility = "AAA" → aria-describedby, prefers-reduced-motion
  devices = ["mobile"] → 모바일 전용, touch target >= 44px
  aesthetic.style = "minimal" → 적은 그림자, 얇은 보더
  aesthetic.style = "bold" → 강한 그림자, 두꺼운 보더
  brand.personality → 브랜드 고유 패턴 보존
```

## C-5. 스택별 코드 생성 규칙

### React / Next.js + TypeScript

```
- 함수형 컴포넌트, 명시적 return type
- Props interface 정의, named exports
- <></> Fragment
- CSS Modules 또는 Tailwind
- Next.js: 'use client' 필요 시만, Image/Link 컴포넌트 사용
```

### Vue 3 / Nuxt

```
- <script setup lang="ts"> composition API
- defineProps + TypeScript interface
- <template>로 invisible 그룹핑
- <style scoped> or <style module>
- <Teleport> for 모달/오버레이
- Nuxt: <NuxtLink>, <NuxtImg> 사용
```

### Svelte

```
- <script lang="ts">
- export let + 타입
- {#if}/{#each}/{#await} 블록
- <slot>, transition: directive
```

### SCSS (공통)

```
- @use 'figma-tokens' as figma — 네임스페이스 import
- @include figma.figma-pc { } — @media 직접 사용 금지
- figma-fluid($mobile, $desktop) — 수동 clamp() 금지
- Nesting max 3 levels
- & for BEM-like modifiers
```

## C-6. 반응형 코드 생성

### 원칙: Fluid First, Breakpoint Second

```
1. Typography & Spacing → clamp() fluid 토큰 (브레이크포인트 불필요)
2. 레이아웃 방향 변경 → @media at breakpoint
3. 가시성 토글 → @media display toggle
4. 컴포넌트 교체 → 조건부 렌더링 또는 CSS
```

### Anti-Patterns (금지)

| 잘못됨 | 올바름 |
|--------|--------|
| 모바일/데스크탑 별도 컴포넌트 파일 | 단일 컴포넌트 + 반응형 CSS |
| font-size에 @media | clamp() fluid 토큰 |
| 하드코딩 `@media (min-width: 768px)` | 프로젝트 브레이크포인트 사용 |
| px 값 직접 사용 | 토큰 변수 사용 |
| window.innerWidth JS 체크 | CSS-only 반응형 |

## C-7. Correction Notes

코드 생성 후 출력:

```markdown
### Generation Mode
- Mode: default / --new / responsive
- Output directory: {path}

### Files Generated
| File | Type | Description |

### Responsive Summary (responsive mode only)
| Token | Mobile | Desktop | Strategy |

### Markup Quality
- Semantic tags: {list}
- Accessibility: {pass/fail}
```

## C-8. Refine Mode (`--refine`)

이전 생성 코드의 완성도가 부족할 때 사용. **새로 만들지 않고 기존 코드를 수정만.**

```
1. URL 재입력 (또는 "이전과 동일")
2. 기존 코드 스캔 (pages/, components/ 내 피처 폴더)
3. Figma 원본 재추출 (get_design_context + get_screenshot)
4. Side-by-side 비교 → Diff 기반 최소 수정
5. 검증 루프 (vibe-figma-rules R-6, P1=0 될 때까지)
```

### Refine 수정 범위

| 수정함 | 수정 안 함 |
|--------|-----------|
| 누락 에셋, 레이아웃/타이포/색상 불일치 | 파일 구조 변경 |
| 누락 컴포넌트, 인터랙션 누락 | 컴포넌트 분리/통합 |
| 반응형 누락, 이미지 경로 | 토큰 파일 재생성 |

## Important

```
- Never guess colors — 추출 값만 사용
- Never invent spacing — 토큰 스케일에 매핑
- Never hardcode values — 토큰 변수 참조
- Image is truth — 레이어 구조 혼란 시 이미지 우선
- No console.log, No div soup
- Component 50줄 초과 시 분리
```
