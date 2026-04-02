---
name: vibe-figma-desktop
description: Step C — PC 디자인 추출, 반응형 스타일 적용, PC 이미지 다운로드 및 검증
triggers: []
tier: standard
---

# Skill: vibe-figma-desktop — Step C: PC 디자인 반영 (반응형)

## C-1. PC 디자인 URL 입력

AskUserQuestion (options 사용 금지):
```
question: "🖥️ PC 디자인 Figma URL을 입력해주세요. (없으면 '없음')"
→ ⏸️ 응답 대기
→ URL → pcUrl 저장 (responsive mode)
→ "없음" → single viewport mode (Step D로 직행)
```

## C-2. PC 디자인 추출 (MCP)

```
1. get_design_context(fileKey, nodeId) → 코드 + 스크린샷 + 에셋 URL
→ 모바일 스크린샷과 side-by-side 비교 → viewport diff table 생성
```

URL에서 fileKey, nodeId 추출:
```
https://www.figma.com/design/:fileKey/:fileName?node-id=:nodeId
→ nodeId: 하이픈을 콜론으로 ("1-109" → "1:109")
```

### Viewport Diff Table 생성

모바일과 PC 스크린샷을 side-by-side로 비교하여 diff table 작성:

```
| Element        | Mobile (375px)         | Desktop (1440px)       | Strategy          |
|---------------|------------------------|------------------------|-------------------|
| Nav           | hamburger + drawer     | horizontal bar         | component swap    |
| Hero title    | 24px                   | 48px                   | fluid: clamp()    |
| Card grid     | 1 column               | 3 columns              | grid auto-fit     |
| Sidebar       | hidden                 | visible                | display toggle    |
| Body text     | 14px                   | 16px                   | fluid: clamp()    |
| Padding       | 16px                   | 48px                   | fluid: clamp()    |
```

## C-3. PC 이미지 에셋 다운로드 (BLOCKING)

```
모바일과 동일 프로세스.
PC 전용 이미지가 있으면 추가 다운로드.
동일 이미지는 스킵 (중복 방지).
```

> **⛔ 이미지 다운로드 완료 전 코드 생성 진행 금지.**

```
1. get_design_context 응답에서 모든 이미지 URL 추출
2. WebFetch로 각 URL 다운로드 (이미 존재하는 파일명은 스킵)
3. 프로젝트 에셋 디렉토리에 저장
4. URL→로컬경로 매핑 테이블 업데이트
```

## C-4. PC 스타일 반영 + 반응형 리팩토링

```
기존 모바일 코드에 PC 대응 추가:
1. 공통 값 → clamp() fluid 토큰으로 변환
2. 레이아웃 구조 변경 → @media (min-width: {breakpoint}px) 추가
3. PC 전용 요소 → display toggle (.desktopOnly)
4. 모바일 전용 요소 → display toggle (.mobileOnly)
5. PC 전용 배경 이미지 → @media 분기
6. 기존 모바일 코드는 가능한 보존하고 반응형 레이어만 추가
```

### 반응형 원칙 (Fluid First, Breakpoint Second)

```
1. Typography & Spacing → clamp() fluid 토큰 (브레이크포인트 불필요)
2. 레이아웃 방향 변경 → @media at project breakpoint (flex-direction, grid-template)
3. 가시성 토글 → @media at project breakpoint (display: none/block)
4. 컴포넌트 스왑 → useMediaQuery 또는 CSS 조건부 렌더링
```

### clamp() 계산 공식

```
Step 1: Figma 값을 타겟 뷰포트로 스케일 변환
  targetPc     = figmaPcValue × (pcTarget / designPc)
  targetMobile = figmaMobileValue × (mobilePortrait / designMobile)

  예시 (기본값): Figma PC h1=96px, Figma Mobile h1=48px
    targetPc     = 96 × (1920 / 2560) = 72px
    targetMobile = 48 × (480 / 720)   = 32px

Step 2: clamp() 계산
  minVw = mobileMinimum (360)
  maxVw = pcTarget (1920)

  slope = (max - min) / (maxVw - minVw)
  intercept = min - slope * minVw
  → clamp({min/16}rem, {intercept/16}rem + {slope*100}vw, {max/16}rem)
```

### 반응형 배경 이미지 처리

```css
/* 배경 이미지 클래스 안에서만 반응형 처리 */
.heroBg {
  background-image: url('/assets/hero-mobile.webp');
  background-size: cover;
  background-position: center;
  position: absolute;
  inset: 0;
  z-index: 0;
}

@media (min-width: 1024px) {  /* {breakpoint}px */
  .heroBg {
    background-image: url('/assets/hero-pc.webp');
  }
}
```

### Model Routing (Step C)

| 작업 | 모델 |
|------|------|
| PC 추출 (MCP + 이미지 다운로드) | **Haiku** |
| PC 반응형 반영 (기존 코드에 반응형 레이어 추가) | **Sonnet** |
| PC 검증 (양쪽 뷰포트 비교) | **Sonnet** |

## C-5. PC 검증 루프

```
🔄 vibe-figma-rules Phase 9 검증 루프 실행:
  - Figma PC 스크린샷 vs 생성된 코드 (PC viewport) 비교
  - P1=0 될 때까지 수정 반복
  - 모바일 검증도 재확인 (PC 수정으로 모바일이 깨지지 않았는지)
```

Step C 완료 후 → Step D (vibe-figma-consolidate) 로 진행.
