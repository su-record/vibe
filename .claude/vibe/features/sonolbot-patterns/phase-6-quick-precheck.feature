# Feature: sonolbot-patterns - Phase 6: Quick Pre-Check

**SPEC**: `.claude/vibe/specs/sonolbot-patterns/phase-6-quick-precheck.md`
**Master Feature**: `.claude/vibe/features/sonolbot-patterns/_index.feature`

## User Story (Phase Scope)

**As a** Vibe 에이전트 운영자
**I want** 불필요한 에이전트 기동을 사전에 필터링
**So that** 빈 메시지, 중복 요청 등으로 인한 리소스 낭비를 방지함

## Scenarios

### Scenario 1: 빈 메시지 skip

```gherkin
Scenario: 텍스트, 파일, 위치 모두 없는 빈 메시지가 필터링됨
  Given 사용자가 빈 텍스트 메시지를 전송하고
  And files가 undefined이고
  And location이 undefined일 때
  When quickPreCheck()가 실행되면
  Then 반환값이 'skip'이고
  And SessionPool에 메시지가 전달되지 않음
```
**Verification**: SPEC AC #1

### Scenario 2: busy 시 pendingInstructions로 전달

```gherkin
Scenario: 세션 처리 중일 때 'busy' 반환 + pending 큐에 적재
  Given sessionId="sess1"이 현재 처리 중이고
  When 사용자가 새 메시지를 전송하면
  Then quickPreCheck()가 'busy'를 반환하고
  And 메시지가 Phase 4의 pendingInstructions에 적재됨
```
**Verification**: SPEC AC #2

### Scenario 3: 정상 메시지 process

```gherkin
Scenario: 유효한 메시지가 정상 처리 플로우로 진행됨
  Given 사용자가 "안녕하세요"라는 텍스트 메시지를 전송하고
  And 해당 세션이 유휴 상태일 때
  When quickPreCheck()가 실행되면
  Then 반환값이 'process'이고
  And 기존 SessionPool → AgentLoop 플로우가 정상 실행됨
```
**Verification**: SPEC AC #3

### Scenario 4: IPC health check 확장

```gherkin
Scenario: IPC health check에 hasPendingMessages, activeSessions 포함
  Given VibeDaemon이 실행 중이고
  And 2개 세션이 활성 상태이고
  And 1개 세션에 pending 메시지가 있을 때
  When IPC health check가 실행되면
  Then 응답에 hasPendingMessages: true가 포함되고
  And activeSessions: 2가 포함됨
```
**Verification**: SPEC AC #4

### Scenario 5: TypeScript 컴파일

```gherkin
Scenario: 모든 변경 후 TypeScript 컴파일 성공
  Given Phase 6의 모든 코드 변경이 완료되었을 때
  When npx tsc --noEmit을 실행하면
  Then 컴파일 에러가 0건임
```
**Verification**: SPEC AC #5

## Edge Cases

### Scenario 6: 파일만 있는 메시지 (텍스트 없음)

```gherkin
Scenario: 텍스트 없이 파일만 전송된 메시지는 skip되지 않음
  Given 사용자가 텍스트 없이 사진만 전송했을 때
  And files[0]이 존재하고
  When quickPreCheck()가 실행되면
  Then 반환값이 'process'임 (skip이 아님)
```

### Scenario 7: 위치만 있는 메시지 (텍스트 없음)

```gherkin
Scenario: 텍스트 없이 위치만 공유된 메시지는 skip되지 않음
  Given 사용자가 텍스트 없이 위치만 공유했을 때
  And location이 존재하고
  When quickPreCheck()가 실행되면
  Then 반환값이 'process'임 (skip이 아님)
```

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (빈 메시지 skip) | ⬜ |
| 2 | AC-2 (busy → pending) | ⬜ |
| 3 | AC-3 (정상 process) | ⬜ |
| 4 | AC-4 (IPC health check) | ⬜ |
| 5 | AC-5 (TypeScript 컴파일) | ⬜ |
| 6 | Edge (파일만 메시지) | ⬜ |
| 7 | Edge (위치만 메시지) | ⬜ |
