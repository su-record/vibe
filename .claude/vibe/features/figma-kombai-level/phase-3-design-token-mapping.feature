# Feature: figma-kombai-level - Phase 3: 디자인 토큰 매핑

**SPEC**: `.claude/vibe/specs/figma-kombai-level/phase-3-design-token-mapping.md`
**Master Feature**: `.claude/vibe/features/figma-kombai-level/_index.feature`

## User Story (Phase Scope)
**As a** vibe.figma 사용자
**I want** Figma 디자인 값이 프로젝트 기존 토큰과 자동 매핑됨
**So that** 기존 디자인 시스템과 일관된 코드가 생성되고 토큰 중복이 제거됨

## Scenarios

### Scenario 1: SCSS 토큰 스캔
```gherkin
Scenario: 기존 SCSS 변수가 스캔됨
  Given 프로젝트에 styles/_variables.scss가 존재
  And $color-primary: #3b82f6 가 정의됨
  When vibe.figma Phase 0에서 토큰 스캔이 실행됨
  Then project-tokens.colors에 {name: '$color-primary', value: '#3b82f6'} 포함
```
**Verification**: SPEC AC #1

### Scenario 2: Tailwind 토큰 스캔
```gherkin
Scenario: Tailwind config의 커스텀 색상이 스캔됨
  Given tailwind.config.ts에 theme.extend.colors.primary: '#3b82f6' 정의
  When vibe.figma Phase 0에서 토큰 스캔이 실행됨
  Then project-tokens.colors에 {name: 'primary', value: '#3b82f6', type: 'tailwind'} 포함
```
**Verification**: SPEC AC #1

### Scenario 3: 기존 토큰 우선 매칭
```gherkin
Scenario: Figma 색상이 기존 토큰과 매칭됨
  Given project-tokens에 $color-primary: #3b82f6 등록됨
  And Figma tree.json에서 #3b82f6 색상이 추출됨
  When Phase 3-0 토큰 매핑이 실행됨
  Then _tokens.scss에서 @use로 기존 변수 참조
  And 새 토큰 $color-xxx: #3b82f6 를 생성하지 않음
```
**Verification**: SPEC AC #3

### Scenario 4: 매칭 안 되면 새 토큰 생성
```gherkin
Scenario: 기존에 없는 값은 새 토큰으로 생성
  Given project-tokens에 #ffd700 색상이 없음
  And Figma에서 #ffd700 색상이 추출됨
  When Phase 3-0 토큰 매핑이 실행됨
  Then _tokens.scss에 $color-accent-gold: #ffd700 새 토큰 생성
```
**Verification**: SPEC AC #3

### Scenario 5: 기존 토큰 파일 수정 금지
```gherkin
Scenario: 기존 _variables.scss를 수정하지 않음
  Given styles/_variables.scss에 기존 토큰이 정의됨
  When vibe.figma 전체 파이프라인이 실행됨
  Then styles/_variables.scss는 수정되지 않음
  And _tokens.scss에서 @use로 참조만 함
```
**Verification**: SPEC AC #6

### Scenario 6: 매핑 결과 보고
```gherkin
Scenario: 토큰 매핑 결과가 요약 보고됨
  Given Figma에서 18개 토큰이 추출됨
  And 그 중 12개가 기존 토큰과 매칭됨
  When Phase 3-0 토큰 매핑이 완료됨
  Then "토큰 매핑: 12/18 매칭 (67%), 6개 새 토큰 생성" 형태로 보고됨
```
**Verification**: SPEC AC #5

### Scenario 7: Tailwind 프로젝트 토큰 처리
```gherkin
Scenario: Tailwind 프로젝트에서는 유틸리티 클래스 우선
  Given 프로젝트가 Tailwind 기반
  And Figma에서 #3b82f6 색상이 추출됨
  And Tailwind config에 blue-500: #3b82f6 매핑됨
  When Phase 3 코드 생성이 실행됨
  Then SCSS 토큰 대신 bg-blue-500 클래스를 사용
```
**Verification**: SPEC AC #7

### Scenario 8: 토큰 파일 파싱 실패 시 스킵
```gherkin
Scenario: 토큰 파일 파싱 실패 시 해당 파일만 스킵
  Given styles/_variables.scss에 구문 에러가 있음
  When Phase 0 토큰 스캔이 실행됨
  Then 해당 파일은 스킵되고 경고 로그가 출력됨
  And 나머지 토큰 파일은 정상 스캔됨
  And 전체 프로세스가 중단되지 않음
```
**Verification**: SPEC Constraints (파싱 실패 시 스킵)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1: 4가지 토큰 소스 스캔 | ✅ |
| 2 | AC-1: Tailwind 스캔 | ✅ |
| 3 | AC-3: 기존 토큰 우선 매칭 | ✅ |
| 4 | AC-3: 매칭 안 되면 새 생성 | ✅ |
| 5 | AC-6: 기존 파일 수정 금지 | ✅ |
| 6 | AC-5: 매핑 결과 보고 | ✅ |
| 7 | AC-7: Tailwind 처리 방식 | ✅ |
| 8 | Constraints: 파싱 실패 에러 핸들링 | ✅ |
