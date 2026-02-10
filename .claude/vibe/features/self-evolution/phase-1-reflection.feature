# Feature: self-evolution — Phase 1: Self-Reflection

**SPEC**: `.claude/vibe/specs/self-evolution/phase-1-reflection.md`
**Master Feature**: `.claude/vibe/features/self-evolution/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** 세션 중 학습한 내용이 자동으로 기록되길
**So that** 다음 세션에서 이전 맥락과 배운 것을 바로 활용할 수 있음

## Scenarios

### Scenario 1: Minor Reflection (컨텍스트 압력)
```gherkin
Scenario: 컨텍스트 70% 도달 시 minor reflection 자동 저장
  Given 현재 세션에서 활성 Goals과 Decisions이 존재하고
  And 컨텍스트 사용량이 70%에 도달했을 때
  When context-save hook이 트리거되면
  Then reflections 테이블에 type='minor', trigger='context_pressure' 레코드가 저장되고
  And insights에 현재 세션의 주요 결정사항이 포함됨
```
**Verification**: SPEC AC #3

### Scenario 2: Major Reflection (세션 종료)
```gherkin
Scenario: 세션 종료 시 major reflection 자동 저장
  Given 세션 동안 여러 Goals를 완료했고
  And 컨텍스트 사용량이 95%에 도달했을 때
  When session-reflection hook이 트리거되면
  Then reflections 테이블에 type='major', trigger='session_end' 레코드가 저장되고
  And 완료된 목표, 실패한 시도, 발견된 패턴이 모두 포함됨
```
**Verification**: SPEC AC #4

### Scenario 3: 수동 Reflection
```gherkin
Scenario: 사용자가 수동으로 reflection 트리거
  Given 사용자가 core_reflect_now 도구를 호출하면
  When reflection 프로세스가 실행되면
  Then 현재 세션의 상태가 reflections 테이블에 저장되고
  And trigger='manual'로 기록됨
```
**Verification**: SPEC AC #5

### Scenario 4: Reflection 검색
```gherkin
Scenario: 이전 reflection 검색
  Given reflections 테이블에 여러 reflection이 저장되어 있을 때
  When 사용자가 core_search_reflections("auth pattern")을 호출하면
  Then FTS5 기반으로 관련 reflection이 점수순으로 반환됨
```
**Verification**: SPEC AC #6

### Scenario 5: 세션 시작 시 자동 주입
```gherkin
Scenario: 새 세션 시작 시 high-value reflections 자동 로드
  Given 이전 세션에서 score > 0.7인 reflection이 존재할 때
  When start_session이 호출되면
  Then 세션 컨텍스트에 최근 high-value reflections가 자동 포함됨
```
**Verification**: SPEC AC #7

### Scenario 6: ReflectionStore 테이블 생성
```gherkin
Scenario: 기존 memories.db에 reflections 테이블 추가
  Given memories.db가 존재할 때
  When ReflectionStore가 초기화되면
  Then reflections 테이블과 reflections_fts 테이블이 생성됨
  And 기존 memories 테이블에 영향 없음
```
**Verification**: SPEC AC #1

### Scenario 7: Reflection 저장 실패 시 세션 유지
```gherkin
Scenario: SQLite 쓰기 실패 시에도 세션이 중단되지 않음
  Given 컨텍스트 사용량이 70%에 도달했고
  And SQLite DB가 잠금 상태(busy)일 때
  When context-save hook이 reflection 저장을 시도하면
  Then reflection 저장은 실패하되 에러가 stderr에 로그되고
  And 기존 context-save 동작은 정상 완료됨
```
**Verification**: SPEC Constraints — Error Handling

### Scenario 8: 잘못된 JSON 데이터 처리
```gherkin
Scenario: Zod 검증 실패 시 빈 배열로 대체 후 저장
  Given reflection의 insights 필드에 잘못된 JSON이 포함되었을 때
  When ReflectionStore.save()가 호출되면
  Then Zod 검증 실패한 필드는 빈 배열([])로 대체되어 저장되고
  And 나머지 정상 필드는 유지됨
```
**Verification**: SPEC Constraints — Error Handling

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-3 (minor reflection) | ✅ |
| 2 | AC-4 (major reflection) | ✅ |
| 3 | AC-5 (manual reflection) | ✅ |
| 4 | AC-6 (search) | ✅ |
| 5 | AC-7 (auto inject) | ✅ |
| 6 | AC-1 (table creation) | ✅ |
| 7 | Error Handling (DB failure) | ✅ |
| 8 | Error Handling (invalid JSON) | ✅ |
