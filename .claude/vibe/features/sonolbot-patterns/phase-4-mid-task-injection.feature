# Feature: sonolbot-patterns - Phase 4: Mid-Task Instruction Injection

**SPEC**: `.claude/vibe/specs/sonolbot-patterns/phase-4-mid-task-injection.md`
**Master Feature**: `.claude/vibe/features/sonolbot-patterns/_index.feature`

## User Story (Phase Scope)

**As a** 에이전트 작업 도중 추가 요청이 있는 사용자
**I want** 새 메시지를 보내면 현재 진행 중인 작업에 반영
**So that** 작업 완료를 기다리지 않고 즉시 보완/수정 지시를 할 수 있음

## Scenarios

### Scenario 1: 작업 중 메시지가 pendingInstructions에 적재

```gherkin
Scenario: 세션 처리 중 새 메시지가 pending 큐에 저장됨
  Given sessionId="sess1"이 현재 처리 중이고
  When 사용자가 새 메시지를 전송하면
  Then 메시지가 pendingInstructions["sess1"]에 push되고
  And 기존 처리 플로우가 중단되지 않음
```
**Verification**: SPEC AC #1

### Scenario 2: AgentLoop에서 pending 메시지 주입

```gherkin
Scenario: AgentLoop 다음 iteration에서 pending 메시지가 conversation에 주입됨
  Given AgentLoop가 iteration 3을 시작할 때
  And pendingInstructions에 메시지 1개가 있으면
  When drainPendingInstructions()를 호출하면
  Then pending 메시지가 비워지고
  And conversation에 user 메시지로 추가됨
```
**Verification**: SPEC AC #2

### Scenario 3: 주입 메시지 형식

```gherkin
Scenario: 주입 시 [새로운 지시사항] 형식으로 표시됨
  Given pendingInstructions에 "파일 크기도 확인해줘" 메시지가 있을 때
  When AgentLoop이 이를 주입하면
  Then conversation에 다음 형식으로 추가됨:
    """
    ⚠️ [새로운 지시사항]
    파일 크기도 확인해줘

    현재 작업에 이 요청을 반영하세요.
    """
```
**Verification**: SPEC AC #3

### Scenario 4: 세션당 최대 3회 injection 제한

```gherkin
Scenario: 3회 injection 후 추가 메시지는 주입되지 않음
  Given sessionId="sess1"에서 이미 3회 injection이 실행되었고
  And pendingInstructions에 새 메시지가 있을 때
  When AgentLoop이 다음 iteration을 시작하면
  Then injection이 실행되지 않고
  And 메시지는 다음 세션에서 처리됨
```
**Verification**: SPEC AC #4

### Scenario 5: 사용자 알림 전송

```gherkin
Scenario: pending 메시지 적재 시 사용자에게 확인 알림 전송
  Given sessionId="sess1"이 처리 중이고
  When 사용자가 새 메시지 2개를 연속 전송하면
  Then 사용자에게 "✅ 새로운 요청 2개 확인, 진행 중인 작업에 반영하겠습니다" 알림이 전송됨
```
**Verification**: SPEC AC #5

### Scenario 6: TypeScript 컴파일

```gherkin
Scenario: 모든 변경 후 TypeScript 컴파일 성공
  Given Phase 4의 모든 코드 변경이 완료되었을 때
  When npx tsc --noEmit을 실행하면
  Then 컴파일 에러가 0건임
```
**Verification**: SPEC AC #6

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (pendingInstructions 적재) | ⬜ |
| 2 | AC-2 (conversation 주입) | ⬜ |
| 3 | AC-3 ([새로운 지시사항] 형식) | ⬜ |
| 4 | AC-4 (3회 제한) | ⬜ |
| 5 | AC-5 (사용자 알림) | ⬜ |
| 6 | AC-6 (TypeScript 컴파일) | ⬜ |
