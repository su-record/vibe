# Feature: sonolbot-patterns - Phase 8: Config Integration + Constants

**SPEC**: `.claude/vibe/specs/sonolbot-patterns/phase-8-config-integration.md`
**Master Feature**: `.claude/vibe/features/sonolbot-patterns/_index.feature`

## User Story (Phase Scope)

**As a** Vibe 프레임워크 개발자
**I want** 모든 Phase에서 추가된 상수와 설정을 한곳에 통합
**So that** 설정값을 일관되게 관리하고, 기본값으로 안전하게 동작함

## Scenarios

### Scenario 1: 모든 새 상수가 constants.ts에 존재

```gherkin
Scenario: Phase 1-7에서 추가된 상수가 CONCURRENCY 객체에 통합됨
  Given src/infra/orchestrator/constants.ts가 존재할 때
  When CONCURRENCY 객체를 확인하면
  Then ACTIVITY_TIMEOUT: 180_000이 존재하고 (Phase 1)
  And BATCH_WAIT_MS: 2_000이 존재하고 (Phase 3)
  And MAX_INJECTION_PER_SESSION: 3이 존재하고 (Phase 4)
  And CONVERSATION_HISTORY_HOURS: 24가 존재하고 (Phase 5)
  And CONVERSATION_HISTORY_MAX_CHARS: 8_000이 존재하고 (Phase 5)
  And CONVERSATION_CLEANUP_HOURS: 48이 존재함 (Phase 5)
```
**Verification**: SPEC AC #1

### Scenario 2: config.json에 responseStyle 섹션 추가 가능

```gherkin
Scenario: config.json에 responseStyle, messaging 섹션이 추가 가능함
  Given .claude/vibe/config.json이 로딩될 때
  When responseStyle 섹션이 존재하면
  Then format, useEmoji, tone 필드가 파싱되고
  When messaging 섹션이 존재하면
  Then batchWaitMs, maxInjectionPerSession, conversationHistoryHours 필드가 파싱됨
```
**Verification**: SPEC AC #2

### Scenario 3: 새 필드 없어도 기본값 동작

```gherkin
Scenario: config.json에 새 필드가 없어도 기본값으로 정상 동작
  Given config.json에 responseStyle, messaging 섹션이 없을 때
  When config를 로딩하면
  Then responseStyle 기본값: { format: "text", useEmoji: true, tone: "conversational" }이 적용되고
  And messaging 기본값: { batchWaitMs: 2000, maxInjectionPerSession: 3, conversationHistoryHours: 24 }가 적용됨
```
**Verification**: SPEC AC #3

### Scenario 4: TypeScript 컴파일 성공

```gherkin
Scenario: 모든 변경 후 TypeScript 컴파일 성공
  Given Phase 8의 모든 코드 변경이 완료되었을 때
  When npx tsc --noEmit을 실행하면
  Then 컴파일 에러가 0건임
```
**Verification**: SPEC AC #4

### Scenario 5: 기존 테스트 깨짐 없음

```gherkin
Scenario: 기존 테스트가 깨지지 않음
  Given Phase 8의 모든 코드 변경이 완료되었을 때
  When pnpm test를 실행하면
  Then better-sqlite3 관련 기존 실패를 제외하고
  And 새로운 테스트 실패가 0건임
```
**Verification**: SPEC AC #5

## Edge Cases

### Scenario 6: 기존 constants 값 변경 없음

```gherkin
Scenario: 기존 CONCURRENCY 상수(TASK_TIMEOUT, MAX_RETRIES 등)가 변경되지 않음
  Given constants.ts가 업데이트된 후
  When 기존 상수 값을 확인하면
  Then TASK_TIMEOUT이 300_000으로 유지되고
  And MAX_RETRIES가 3으로 유지되고
  And PIPELINE_TIMEOUT이 900_000으로 유지됨
```

### Scenario 7: config.json 기존 필드 유지

```gherkin
Scenario: config.json의 기존 필드(language, quality, stacks 등)가 변경되지 않음
  Given config.json이 업데이트된 후
  When 기존 필드를 확인하면
  Then language, quality, stacks, references, models 필드가 그대로 유지됨
```

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (상수 통합) | ⬜ |
| 2 | AC-2 (config 섹션) | ⬜ |
| 3 | AC-3 (기본값 동작) | ⬜ |
| 4 | AC-4 (TypeScript 컴파일) | ⬜ |
| 5 | AC-5 (기존 테스트) | ⬜ |
| 6 | Edge (기존 상수 유지) | ⬜ |
| 7 | Edge (기존 config 유지) | ⬜ |
