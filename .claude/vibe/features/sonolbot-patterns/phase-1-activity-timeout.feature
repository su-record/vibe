# Feature: sonolbot-patterns - Phase 1: Activity-Based Timeout + Dual-Layer Lock

**SPEC**: `.claude/vibe/specs/sonolbot-patterns/phase-1-activity-timeout.md`
**Master Feature**: `.claude/vibe/features/sonolbot-patterns/_index.feature`

## User Story (Phase Scope)

**As a** Vibe 에이전트 운영자
**I want** 에이전트의 마지막 활동 기준으로 stale 감지
**So that** 실제로 작업 중인 에이전트는 유지하고, 멈춘 에이전트만 자동 복구함

## Scenarios

### Scenario 1: Activity 갱신으로 stale 방지

```gherkin
Scenario: 활발히 작업 중인 에이전트는 stale로 판정되지 않음
  Given BackgroundManager에 태스크가 실행 중이고
  And 태스크의 lastActivity가 현재 시각 기준 1분 이내이면
  When processQueue가 running 태스크를 순회할 때
  Then 해당 태스크의 stale은 false를 유지하고
  And cancel이 호출되지 않음
```
**Verification**: SPEC AC #2 (매 progress 이벤트마다 lastActivity 갱신됨)

### Scenario 2: 3분 무활동 시 stale 감지 + 자동 cancel

```gherkin
Scenario: 3분간 활동 없는 태스크가 stale로 마킹되고 cancel됨
  Given BackgroundManager에 태스크가 실행 중이고
  And 태스크의 lastActivity가 현재 시각 기준 180초 이상 지났을 때
  When processQueue가 running 태스크를 순회하면
  Then 해당 태스크의 stale이 true로 변경되고
  And handle.cancel()이 호출되고
  And 해당 태스크가 retry 큐에 재등록됨
```
**Verification**: SPEC AC #3 (3분 무활동 시 stale=true 마킹 후 cancel+retry 실행)

### Scenario 3: Hard deadline(TASK_TIMEOUT)은 activity와 무관

```gherkin
Scenario: 활동이 있어도 TASK_TIMEOUT(5분) 초과 시 강제 종료
  Given BackgroundManager에 태스크가 실행 중이고
  And lastActivity가 계속 갱신되고 있지만
  And 태스크 시작 후 300초(5분)가 경과했을 때
  When TASK_TIMEOUT 체크가 실행되면
  Then 해당 태스크가 hard deadline에 의해 cancel됨
  And stale 여부와 무관하게 종료됨
```
**Verification**: SPEC AC #4 (TASK_TIMEOUT(5분) hard deadline 유지)

### Scenario 4: TaskInfo에 activity 필드 존재

```gherkin
Scenario: 새 태스크 생성 시 lastActivity와 stale 필드가 초기화됨
  Given 새로운 태스크가 BackgroundManager에 등록될 때
  When TaskInfo가 생성되면
  Then lastActivity는 현재 Date.now()로 설정되고
  And stale은 false로 설정됨
```
**Verification**: SPEC AC #1 (TaskInfo에 lastActivity, stale 필드 존재)

### Scenario 5: poll() 응답에 activity 정보 포함

```gherkin
Scenario: poll() 호출 시 lastActivity와 stale 정보가 반환됨
  Given BackgroundManager에 running 태스크가 있을 때
  When poll()을 호출하면
  Then 반환값에 lastActivity 필드가 포함되고
  And stale 필드가 포함됨
```
**Verification**: SPEC AC #5 (poll() 응답에 lastActivity, stale 필드 포함)

### Scenario 6: 기존 retry 로직 정상 동작

```gherkin
Scenario: stale cancel 후 retry가 MAX_RETRIES까지 실행됨
  Given 태스크가 stale로 cancel된 후
  When retry가 실행될 때
  Then 기존 MAX_RETRIES(3) 제한이 적용되고
  And 지수 백오프 간격으로 재시도됨
  And 3회 초과 시 최종 실패로 처리됨
```
**Verification**: SPEC AC #6 (기존 retry 로직(MAX_RETRIES=3) 정상 동작)

### Scenario 7: TypeScript 컴파일

```gherkin
Scenario: 모든 변경 후 TypeScript 컴파일 성공
  Given Phase 1의 모든 코드 변경이 완료되었을 때
  When npx tsc --noEmit을 실행하면
  Then 컴파일 에러가 0건임
```
**Verification**: SPEC AC #7 (TypeScript 컴파일 성공)

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-2 (lastActivity 갱신) | ⬜ |
| 2 | AC-3 (3분 무활동 stale + cancel) | ⬜ |
| 3 | AC-4 (TASK_TIMEOUT hard deadline) | ⬜ |
| 4 | AC-1 (TaskInfo 필드 존재) | ⬜ |
| 5 | AC-5 (poll() 응답) | ⬜ |
| 6 | AC-6 (retry 로직) | ⬜ |
| 7 | AC-7 (TypeScript 컴파일) | ⬜ |
