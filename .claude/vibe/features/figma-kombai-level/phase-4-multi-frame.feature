# Feature: figma-kombai-level - Phase 4: 멀티 프레임 컨텍스트

**SPEC**: `.claude/vibe/specs/figma-kombai-level/phase-4-multi-frame.md`
**Master Feature**: `.claude/vibe/features/figma-kombai-level/_index.feature`

## User Story (Phase Scope)
**As a** vibe.figma 사용자
**I want** 여러 Figma 프레임을 동시에 입력하여 공통 패턴이 자동 추출됨
**So that** 페이지 간 일관성이 보장되고 공유 컴포넌트 중복이 제거됨

## Scenarios

### Scenario 1: 멀티 URL 입력
```gherkin
Scenario: 여러 Figma URL을 줄바꿈으로 입력
  Given 사용자가 3개의 Figma URL을 줄바꿈으로 입력
  When Phase 2 재료 확보가 시작됨
  Then 3개 URL이 파싱되어 멀티 프레임 모드 활성화
  And 각 URL별 frame-1/, frame-2/, frame-3/ 디렉토리 생성
```
**Verification**: SPEC AC #1

### Scenario 2: 병렬 재료 확보
```gherkin
Scenario: 여러 프레임의 재료가 병렬로 확보됨
  Given 3개 Figma URL이 입력됨
  When Phase 2 재료 확보가 실행됨
  Then 3개 프레임의 스크린샷/트리/이미지가 병렬 추출됨
  And Figma API rate limit (500ms 간격)이 준수됨
```
**Verification**: SPEC AC #2, #8

### Scenario 3: 공통 컴포넌트 자동 식별
```gherkin
Scenario: 프레임 간 공통 GNB/Footer가 식별됨
  Given frame-1, frame-2, frame-3 재료가 확보됨
  And 3개 프레임 모두 상단에 동일한 GNB 영역 존재
  When Phase 2.5 공통 패턴 분석이 실행됨
  Then shared-components에 GNB(consistency: 100%)가 등록됨
  And GNB는 공유 컴포넌트로 1회만 생성 지시
```
**Verification**: SPEC AC #3

### Scenario 4: 공통 토큰 합집합 추출
```gherkin
Scenario: 모든 프레임의 토큰이 합집합으로 통합됨
  Given frame-1에 #0a1628, #ffffff 사용
  And frame-2에 #0a1628, #ffd700 사용
  When Phase 2.5 공통 토큰 추출이 실행됨
  Then 공유 _tokens.scss에 #0a1628, #ffffff, #ffd700 모두 포함
  And 프레임별 고유 값만 로컬 토큰으로 분리
```
**Verification**: SPEC AC #4

### Scenario 5: 공유→개별 순서 조립
```gherkin
Scenario: 공유 컴포넌트가 먼저 생성되고 개별 섹션이 뒤따름
  Given shared-components에 GNB, Footer가 등록됨
  When Phase 3 퍼즐 조립이 실행됨
  Then 1단계: components/shared/에 GNB, Footer 생성
  And 2단계: 각 프레임의 고유 섹션이 공유 컴포넌트를 import하여 조립
```
**Verification**: SPEC AC #5

### Scenario 6: 스타일 디렉토리 구조
```gherkin
Scenario: 공유/프레임별 스타일이 분리됨
  Given 멀티 프레임 모드로 3개 페이지 생성
  When Phase 3 스타일 작성이 완료됨
  Then styles/{feature}/_tokens.scss에 공유 토큰
  And styles/{feature}/shared/에 공유 컴포넌트 스타일
  And styles/{feature}/frame-N/에 프레임별 고유 스타일
```
**Verification**: SPEC AC #6

### Scenario 7: 단일 URL 역호환
```gherkin
Scenario: URL 1개일 때 기존 동작 그대로
  Given 사용자가 1개의 Figma URL만 입력
  When Phase 2 재료 확보가 시작됨
  Then 기존 방식대로 /tmp/{feature}/ 직접 저장 (frame-N/ 없음)
  And Phase 2.5 공통 분석 단계 건너뜀
```
**Verification**: SPEC AC #7

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1: 멀티 URL 입력 방식 | ⬜ |
| 2 | AC-2: 병렬 확보, AC-8: rate limit | ⬜ |
| 3 | AC-3: 공통 패턴 분석 3단계 | ⬜ |
| 4 | AC-4: 공통 토큰 합집합 | ⬜ |
| 5 | AC-5: 공유→개별 순서 | ⬜ |
| 6 | AC-6: 스타일 디렉토리 구조 | ⬜ |
| 7 | AC-7: 단일 URL 역호환 | ⬜ |
