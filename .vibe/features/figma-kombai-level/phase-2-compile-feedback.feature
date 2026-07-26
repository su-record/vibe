# Feature: figma-kombai-level - Phase 2: 컴파일 에러 피드백 루프

**SPEC**: `.claude/vibe/specs/figma-kombai-level/phase-2-compile-feedback.md`
**Master Feature**: `.claude/vibe/features/figma-kombai-level/_index.feature`

## User Story (Phase Scope)
**As a** vibe.figma 사용자
**I want** 코드 생성 후 컴파일 에러가 자동으로 감지되고 수정됨
**So that** 브라우저 검증 전에 빌드 가능한 코드가 보장됨

## Scenarios

### Scenario 1: TypeScript 컴파일 에러 자동 감지
```gherkin
Scenario: Phase 3 완료 후 tsc 에러가 감지됨
  Given Phase 3 퍼즐 조립이 완료됨
  And 생성된 코드에 타입 에러가 있음 (TS2322)
  When Phase 3.5 컴파일 게이트가 실행됨
  Then tsc --noEmit 결과에서 에러가 파싱됨
  And 파일 경로, 줄 번호, 에러 코드가 추출됨
```
**Verification**: SPEC AC #1, #3

### Scenario 2: 타입 에러 자동 수정
```gherkin
Scenario: 일반적 타입 에러가 자동으로 수정됨
  Given tsc에서 TS2304 (이름 없음) 에러가 감지됨
  When 자동 수정이 실행됨
  Then 누락된 import가 추가됨
  And 재실행 시 해당 에러가 사라짐
```
**Verification**: SPEC AC #3

### Scenario 3: 빌드 에러 감지 및 수정
```gherkin
Scenario: npm run build 에러가 감지되고 수정됨
  Given tsc는 통과했지만 빌드에서 SCSS 컴파일 에러 발생
  When Phase 3.5-2 빌드 체크가 실행됨
  Then SCSS 에러 메시지가 파싱됨
  And 변수명/import 오류가 수정됨
  And 재빌드 시 성공
```
**Verification**: SPEC AC #2

### Scenario 4: 3라운드 실패 시 사용자 보고
```gherkin
Scenario: 3라운드 내 수정 불가 시 사용자에게 보고
  Given 컴파일 에러가 자동 수정 범위를 벗어남
  When 3라운드 시도 후에도 에러가 남아있음
  Then 남은 에러 목록과 시도한 수정 내역이 보고됨
  And Phase 4로 진행하지 않음
```
**Verification**: SPEC AC #4, #7

### Scenario 5: Phase 4 시각 수정 후 컴파일 재검증
```gherkin
Scenario: 시각 수정이 타입 에러를 유발하면 즉시 수정
  Given Phase 4에서 CSS 수치를 수정함
  And 수정으로 인해 새로운 타입 에러가 발생
  When Phase 4-4 수정 루프에서 tsc 재검증 실행
  Then 타입 에러가 감지되고 즉시 수정됨
  And 시각 검증이 계속 진행됨
```
**Verification**: SPEC AC #5

### Scenario 6: dev 서버 시작 확인
```gherkin
Scenario: dev 서버가 정상 시작됨을 확인
  Given tsc와 build가 모두 통과
  When Phase 3.5-3 dev 서버 시작 확인이 실행됨
  Then npm run dev가 실행되고 localhost 접속이 확인됨
  And Phase 4 브라우저 검증으로 진행
```
**Verification**: SPEC AC #2

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1: Phase 3.5 추가, AC-3: 에러 유형별 전략 | ✅ |
| 2 | AC-3: 자동 수정 전략 | ✅ |
| 3 | AC-2: tsc→build→dev 3단계 | ✅ |
| 4 | AC-4: 3라운드 반복, AC-7: 게이트 원칙 | ✅ |
| 5 | AC-5: Phase 4 tsc 재검증 | ✅ |
| 6 | AC-2: dev 서버 확인 | ✅ |
