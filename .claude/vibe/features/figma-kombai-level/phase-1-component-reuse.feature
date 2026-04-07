# Feature: figma-kombai-level - Phase 1: 컴포넌트 재사용 인덱싱

**SPEC**: `.claude/vibe/specs/figma-kombai-level/phase-1-component-reuse.md`
**Master Feature**: `.claude/vibe/features/figma-kombai-level/_index.feature`

## User Story (Phase Scope)
**As a** vibe.figma 사용자
**I want** 기존 프로젝트 컴포넌트를 자동으로 인식하고 재사용
**So that** 중복 코드 없이 기존 자산을 활용한 일관된 결과물을 얻음

## Scenarios

### Scenario 1: Phase 0에서 컴포넌트 인덱싱
```gherkin
Scenario: 기존 컴포넌트의 props/slots/클래스가 인덱싱됨
  Given 프로젝트에 components/common/BaseButton.vue가 존재
  And BaseButton에 defineProps<{label: string, variant: string}>이 정의됨
  When vibe.figma Phase 0 Setup이 실행됨
  Then component-index에 BaseButton이 포함됨
  And props에 [label: string, variant: string]이 추출됨
  And slots, classes, description이 추출됨
```
**Verification**: SPEC AC #1

### Scenario 2: Hooks/Types/Constants 인덱싱
```gherkin
Scenario: composables/hooks/types도 인덱싱됨
  Given 프로젝트에 composables/useAuth.ts가 존재
  And types/User.ts에 export interface User가 정의됨
  When vibe.figma Phase 0 Setup이 실행됨
  Then component-index에 useAuth 함수와 User 타입이 포함됨
```
**Verification**: SPEC AC #2

### Scenario 3: Phase 3에서 기존 컴포넌트 매칭
```gherkin
Scenario: 스크린샷의 버튼이 기존 BaseButton으로 매칭됨
  Given component-index에 BaseButton(variant: 'primary'|'secondary')이 등록됨
  And 섹션 스크린샷에 Primary 스타일 버튼이 보임
  When Phase 3 섹션 조립이 실행됨
  Then BaseButton을 import하여 variant="primary" props로 사용
  And 새 버튼 컴포넌트를 생성하지 않음
```
**Verification**: SPEC AC #4

### Scenario 4: 매칭 안 되면 새로 생성
```gherkin
Scenario: 기존 컴포넌트와 일치하지 않으면 새로 생성
  Given component-index에 기존 컴포넌트가 등록됨
  And 스크린샷에 기존 컴포넌트와 다른 특수한 UI 요소가 보임
  When Phase 3 섹션 조립이 실행됨
  Then 새 컴포넌트를 생성 (기존 방식)
  And 강제 재사용하지 않음
```
**Verification**: SPEC AC #7

### Scenario 5: 재사용 시 스타일 충돌 방지
```gherkin
Scenario: 기존 컴포넌트 재사용 시 내부 스타일 수정하지 않음
  Given GNB 컴포넌트가 기존에 존재
  And Figma 디자인의 GNB 위치가 기존과 다름
  When Phase 3에서 GNB를 재사용함
  Then GNB 내부 스타일은 수정하지 않음
  And 래퍼 클래스로 위치만 오버라이드
```
**Verification**: SPEC AC #5

### Scenario 6: component-index 포맷 전달
```gherkin
Scenario: component-index가 정의된 포맷으로 Phase 3에 전달됨
  Given Phase 0에서 3개 컴포넌트가 인덱싱됨
  When component-index가 생성됨
  Then 각 항목에 name, path, props, slots, classes, description 필드가 포함됨
  And Phase 3에서 component-index를 참조할 수 있음
```
**Verification**: SPEC AC #3

### Scenario 7: convert 스킬 재사용 우선 규칙
```gherkin
Scenario: convert 스킬에서 코드 작성 전 재사용 확인
  Given component-index에 BaseButton이 등록됨
  And 생성할 코드에 버튼 요소가 포함됨
  When vibe.figma.convert 코드 생성이 실행됨
  Then 새 버튼 컴포넌트 작성 전 component-index 매칭을 먼저 수행
  And 매칭되면 import하여 사용
```
**Verification**: SPEC AC #6

### Scenario 8: 50개 초과 파일 인덱싱 제한
```gherkin
Scenario: 대규모 프로젝트에서 인덱싱 범위가 제한됨
  Given 프로젝트에 components/ 하위 파일이 80개 존재
  When Phase 0 인덱싱이 실행됨
  Then components/ 1depth 디렉토리만 스캔
  And 인덱싱이 2분 이내에 완료됨
```
**Verification**: SPEC Constraints (50개 초과 제한)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1: props/slots/클래스/용도 추출 | ⬜ |
| 2 | AC-2: hooks/types/constants 인덱싱 | ⬜ |
| 3 | AC-4: Phase 3 매칭 단계 | ⬜ |
| 4 | AC-7: 강제 재사용 금지 | ⬜ |
| 5 | AC-5: 스타일 충돌 방지 | ⬜ |
| 6 | AC-3: component-index 포맷 | ⬜ |
| 7 | AC-6: convert 재사용 우선 | ⬜ |
| 8 | Constraints: 대규모 프로젝트 제한 | ⬜ |
