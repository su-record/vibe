# Feature: design-integration — Phase 2: Design References

**SPEC**: `.claude/vibe/specs/design-integration/phase-2-design-references.md`
**Master Feature**: `.claude/vibe/features/design-integration/_index.feature`

## User Story (Phase Scope)
**As a** 프론트엔드 개발자
**I want** typography, color, spatial, motion 등 도메인별 deep reference 가이드를 참조
**So that** 디자인 결정의 "왜"를 이해하고 올바른 구현 방법을 따를 수 있다

## Scenarios

### Scenario 1: typography reference로 타입 시스템 설계
```gherkin
Scenario: Use typography reference for type hierarchy
  Given skills/ui-ux-pro-max/reference/typography.md가 존재한다
  When 개발자가 타이포그래피 계층 구조를 설계한다
  Then modular scale 계산법(ratio 1.25-1.5)을 참조할 수 있다
  And 폰트 페어링 원칙(contrast, x-height 일치)을 따를 수 있다
  And 최소 본문 크기(16px)와 줄 간격(1.5-1.75) 가이드를 확인할 수 있다
```
**Verification**: SPEC AC #3

### Scenario 2: color-and-contrast reference로 색상 선택
```gherkin
Scenario: Use color reference for palette creation
  Given skills/ui-ux-pro-max/reference/color-and-contrast.md가 존재한다
  When 개발자가 색상 팔레트를 생성한다
  Then OKLCH 색공간 사용법을 참조할 수 있다
  And 60-30-10 rule을 따를 수 있다
  And dark mode 구현 가이드(단순 반전 금지)를 확인할 수 있다
```
**Verification**: SPEC AC #4

### Scenario 3: motion-design reference로 애니메이션 추가
```gherkin
Scenario: Use motion reference for animation timing
  Given skills/ui-ux-pro-max/reference/motion-design.md가 존재한다
  When 개발자가 UI 애니메이션을 구현한다
  Then duration rules(micro 100-150ms, medium 200-300ms)를 참조할 수 있다
  And prefers-reduced-motion 대응 패턴을 확인할 수 있다
  And GPU 가속 대상(transform, opacity만)을 확인할 수 있다
```
**Verification**: SPEC AC #6

### Scenario 4: interaction-design reference로 상태 구현
```gherkin
Scenario: Use interaction reference for component states
  Given skills/ui-ux-pro-max/reference/interaction-design.md가 존재한다
  When 개발자가 버튼 컴포넌트를 구현한다
  Then 8가지 상태(default, hover, focus, active, disabled, loading, error, success)를 참조할 수 있다
  And focus ring 패턴(:focus-visible)을 확인할 수 있다
```
**Verification**: SPEC AC #7

### Scenario 5: ux-writing reference로 에러 메시지 작성
```gherkin
Scenario: Use UX writing reference for error messages
  Given skills/ui-ux-pro-max/reference/ux-writing.md가 존재한다
  When 개발자가 폼 검증 에러 메시지를 작성한다
  Then 에러 메시지 공식(무엇이+왜+해결법)을 참조할 수 있다
  And 확인 대화상자 라벨 가이드(동사 사용)를 확인할 수 있다
```
**Verification**: SPEC AC #9

### Scenario 6: ui-ux-pro-max에서 reference 안내
```gherkin
Scenario: SKILL.md includes reference guide table
  Given skills/ui-ux-pro-max/SKILL.md가 업데이트되었다
  When 개발자가 ui-ux-pro-max skill을 참조한다
  Then "Deep Reference Guides" 섹션에서 7개 reference 파일 링크를 확인할 수 있다
```
**Verification**: SPEC AC #10

### Scenario 7: Reference 파일 단어 수 검증
```gherkin
Scenario: Each reference is within word count range
  Given 7개 reference 파일이 모두 생성되었다
  When 각 파일의 단어 수를 측정한다
  Then 모든 파일이 1500-2500단어 범위에 있다
  And 7개 파일 합계가 15000단어 이하이다
```
**Verification**: SPEC AC #2

### Scenario 8: DO/DON'T 패턴 포함 검증
```gherkin
Scenario: Each reference includes DO/DON'T patterns
  Given 7개 reference 파일이 모두 생성되었다
  When 각 파일의 내용을 확인한다
  Then 각 파일에 3-5개의 DO/DON'T 패턴이 포함되어 있다
```
**Verification**: SPEC AC #11

### Scenario 9: spatial-design reference로 레이아웃 설계
```gherkin
Scenario: Use spatial-design reference for layout spacing
  Given skills/ui-ux-pro-max/reference/spatial-design.md가 존재한다
  When 개발자가 페이지 레이아웃 간격을 설계한다
  Then 4pt 기반 spacing system(4, 8, 12, 16, 24, 32, 48, 64, 96)을 참조할 수 있다
  And container queries 활용법을 확인할 수 있다
  And Gestalt proximity 원칙 가이드를 따를 수 있다
```
**Verification**: SPEC AC #5

### Scenario 10: responsive-design reference로 반응형 구현
```gherkin
Scenario: Use responsive-design reference for breakpoints
  Given skills/ui-ux-pro-max/reference/responsive-design.md가 존재한다
  When 개발자가 반응형 레이아웃을 구현한다
  Then mobile-first min-width 미디어 쿼리 패턴을 참조할 수 있다
  And content-driven breakpoints 설정법을 확인할 수 있다
  And safe areas(env(safe-area-inset-*))와 fluid typography(clamp()) 패턴을 따를 수 있다
```
**Verification**: SPEC AC #8

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-3 (typography modular scale + pairing) | ✅ |
| 2 | AC-4 (color OKLCH + 60-30-10 + dark mode) | ✅ |
| 3 | AC-6 (motion duration + reduced-motion) | ✅ |
| 4 | AC-7 (interaction 8 states + focus ring) | ✅ |
| 5 | AC-9 (ux-writing error formula + translation) | ✅ |
| 6 | AC-10 (SKILL.md Deep Reference Guides) | ✅ |
| 7 | AC-2 (1500-2500 word count) | ✅ |
| 8 | AC-11 (DO/DON'T patterns) | ✅ |
| 9 | AC-5 (spatial-design 4pt + containers) | ✅ |
| 10 | AC-8 (responsive mobile-first + breakpoints) | ✅ |

**Last verified**: 2026-03-31
**Quality score**: 95/100
