# Feature: telegram-agent - Phase 3: 비동기 작업 + 완료 알림 + 세션 컨텍스트

**SPEC**: `.claude/vibe/specs/telegram-agent/phase-3-task-notifier.md`
**Master Feature**: `.claude/vibe/features/telegram-agent/_index.feature`

## User Story (Phase Scope)
**As a** 텔레그램 사용자
**I want** 개발 작업을 요청하면 비동기로 처리되고 완료 시 알림을 받으며
**So that** 작업이 진행되는 동안 다른 메시지를 보내거나 다른 일을 할 수 있다

## Scenarios

### Scenario 1: 작업 시작 즉시 알림
```gherkin
Scenario: 비동기 작업 시작 시 즉시 알림 전송
  Given 사용자가 "~/workspace/app에서 로그인 구현해줘"라고 요청함
  When launchAndNotify()를 호출하면
  Then "작업 시작: 로그인 구현" 메시지가 즉시 텔레그램으로 전송됨
  And taskId가 반환됨
```
**Verification**: SPEC AC #1

### Scenario 2: 작업 완료 알림
```gherkin
Scenario: 비동기 작업 완료 시 결과 알림
  Given 개발 작업이 BackgroundManager에서 실행 중
  When 작업이 성공적으로 완료되면
  Then "작업 완료!" 메시지가 텔레그램으로 전송됨
  And 결과 요약, 사용된 도구, 소요 시간이 포함됨
```
**Verification**: SPEC AC #2

### Scenario 3: 작업 실패 알림
```gherkin
Scenario: 비동기 작업 실패 시 에러 알림
  Given 개발 작업이 BackgroundManager에서 실행 중
  When 작업이 에러로 실패하면
  Then "작업 실패" 메시지가 텔레그램으로 전송됨
  And 에러 메시지가 포함됨
```
**Verification**: SPEC AC #3

### Scenario 4: 진행 중 작업 목록 조회
```gherkin
Scenario: 활성 작업 목록 조회
  Given chatId "12345"에서 2개 작업이 진행 중
  When getActiveTasks("12345")를 호출하면
  Then 2개의 TaskInfo가 반환됨
  And 각 항목에 taskId, 설명, 시작 시간, 경과 시간이 포함됨
```
**Verification**: SPEC AC #4

### Scenario 5: 작업 취소
```gherkin
Scenario: 진행 중인 작업 취소
  Given chatId "12345"에서 taskId "task-abc"가 실행 중
  When cancelTask("12345", "task-abc")를 호출하면
  Then BackgroundManager.cancel()이 호출됨
  And "작업이 취소되었습니다" 메시지가 전송됨
```
**Verification**: SPEC AC #5

### Scenario 6: 다른 사용자 작업 취소 거부
```gherkin
Scenario: 다른 chatId의 작업 취소 시도 거부
  Given chatId "12345"에서 taskId "task-abc"가 실행 중
  When cancelTask("99999", "task-abc")를 호출하면
  Then false가 반환됨
  And 작업은 계속 실행됨
```
**Verification**: SPEC AC #6

### Scenario 7: 동시 작업 제한
```gherkin
Scenario: per-chatId 3개 초과 작업 시 거부
  Given chatId "12345"에서 이미 3개 작업이 실행 중
  When 4번째 작업을 요청하면
  Then "동시 작업 제한(3개)에 도달했습니다" 메시지가 반환됨
  And 새 작업은 시작되지 않음
```
**Verification**: SPEC AC #7

### Scenario 8: 긴 결과 분할 전송
```gherkin
Scenario: 4096자 초과 결과 분할 전송
  Given 작업 결과가 5000자임
  When 완료 알림을 전송하면
  Then 결과가 4000자까지 포함됨
  And "... (결과가 길어 일부만 표시)" 안내가 추가됨
```
**Verification**: SPEC AC #8

### Scenario 9: 세션 컨텍스트 검색
```gherkin
Scenario: 이전 대화 컨텍스트 검색
  Given chatId "12345"에서 이전에 "React 프로젝트" 관련 대화가 저장됨
  When getContext("12345", "React 설정")를 호출하면
  Then 관련된 이전 컨텍스트가 반환됨
  And sessionId가 "telegram-12345"임
```
**Verification**: SPEC AC #9

### Scenario 10: 작업 결과 Evidence 저장
```gherkin
Scenario: 작업 결과를 SessionRAG Evidence로 저장
  Given 개발 작업이 성공적으로 완료됨
  When saveTaskResult()를 호출하면
  Then Evidence 엔티티가 생성됨
  And type이 "build"이고 status가 "pass"임
  And metrics에 duration과 toolsUsed가 포함됨
```
**Verification**: SPEC AC #10

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (시작 알림) | ⬜ |
| 2 | AC-2 (완료 알림) | ⬜ |
| 3 | AC-3 (실패 알림) | ⬜ |
| 4 | AC-4 (목록 조회) | ⬜ |
| 5 | AC-5 (취소) | ⬜ |
| 6 | AC-6 (권한 검증) | ⬜ |
| 7 | AC-7 (동시 제한) | ⬜ |
| 8 | AC-8 (분할 전송) | ⬜ |
| 9 | AC-9 (컨텍스트 검색) | ⬜ |
| 10 | AC-10 (Evidence 저장) | ⬜ |
