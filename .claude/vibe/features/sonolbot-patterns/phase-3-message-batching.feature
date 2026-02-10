# Feature: sonolbot-patterns - Phase 3: Multi-Message Batching

**SPEC**: `.claude/vibe/specs/sonolbot-patterns/phase-3-message-batching.md`
**Master Feature**: `.claude/vibe/features/sonolbot-patterns/_index.feature`

## User Story (Phase Scope)

**As a** Telegram/Slack 사용자
**I want** 여러 메시지를 연속 전송하면 하나로 합쳐서 처리
**So that** 나눠 보낸 요청이 하나의 일관된 작업으로 처리됨

## Scenarios

### Scenario 1: 2초 이내 연속 메시지 합산

```gherkin
Scenario: 2초 이내에 전송된 여러 메시지가 하나로 합산됨
  Given 사용자가 "이거 해줘"를 전송하고
  And 1초 후 "아 그리고 이것도"를 전송하고
  And 0.5초 후 사진을 첨부했을 때
  When 마지막 메시지 후 2초(BATCH_WAIT_MS)가 경과하면
  Then 3개 메시지가 하나로 합산되어 handler에 전달됨
```
**Verification**: SPEC AC #1

### Scenario 2: 합산 메시지 형식

```gherkin
Scenario: 합산 메시지에 [요청 N] 형식의 헤더가 포함됨
  Given 2개의 연속 메시지가 배치 버퍼에 있을 때
  When flushBatch()가 실행되면
  Then 합산 content에 "[요청 1] (timestamp)" 형식이 포함되고
  And "[요청 2] (timestamp)" 형식이 포함되고
  And 각 요청의 원본 content가 순서대로 포함됨
```
**Verification**: SPEC AC #2

### Scenario 3: 배치 메타데이터 설정

```gherkin
Scenario: 합산 메시지에 batchedFrom, allTimestamps가 설정됨
  Given 3개의 메시지(id: msg1, msg2, msg3)가 합산되었을 때
  When combineMessages()가 실행되면
  Then batchedFrom이 ["msg1", "msg2", "msg3"]이고
  And allTimestamps가 각 메시지의 timestamp 배열임
```
**Verification**: SPEC AC #3

### Scenario 4: 파일/위치 메타데이터 병합

```gherkin
Scenario: 여러 메시지의 파일과 위치가 올바르게 병합됨
  Given 메시지1에 사진이 첨부되고
  And 메시지2에 위치가 공유되고
  And 메시지3에 문서가 첨부되었을 때
  When combineMessages()가 실행되면
  Then 합산 메시지의 files[]에 사진과 문서가 모두 포함되고
  And location에 메시지2의 위치 정보가 포함됨
```
**Verification**: SPEC AC #4

### Scenario 5: 단일 메시지 2초 후 전달

```gherkin
Scenario: 단일 메시지는 2초 대기 후 그대로 전달됨
  Given 사용자가 메시지 1개만 전송했을 때
  When 2초(BATCH_WAIT_MS)가 경과하면
  Then 메시지가 combineMessages를 거치지만
  And 1개이므로 그대로 반환되고
  And batchedFrom, allTimestamps는 설정되지 않음
```
**Verification**: SPEC AC #5

### Scenario 6: stop() 시 버퍼 즉시 flush

```gherkin
Scenario: BaseInterface stop() 시 버퍼에 남은 메시지가 즉시 처리됨
  Given 배치 버퍼에 메시지가 2개 있고
  And batchTimer가 아직 만료되지 않았을 때
  When stop()이 호출되면
  Then 타이머가 clear되고
  And 버퍼의 메시지가 즉시 합산되어 handler에 전달됨
```
**Verification**: SPEC AC #6

### Scenario 7: TypeScript 컴파일

```gherkin
Scenario: 모든 변경 후 TypeScript 컴파일 성공
  Given Phase 3의 모든 코드 변경이 완료되었을 때
  When npx tsc --noEmit을 실행하면
  Then 컴파일 에러가 0건임
```
**Verification**: SPEC AC #7

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (연속 메시지 합산) | ⬜ |
| 2 | AC-2 ([요청 N] 형식) | ⬜ |
| 3 | AC-3 (batchedFrom, allTimestamps) | ⬜ |
| 4 | AC-4 (파일/위치 병합) | ⬜ |
| 5 | AC-5 (단일 메시지 전달) | ⬜ |
| 6 | AC-6 (stop() flush) | ⬜ |
| 7 | AC-7 (TypeScript 컴파일) | ⬜ |
