# Feature: vibe-agent - Phase 4: Async Job System

**SPEC**: `.claude/vibe/specs/vibe-agent/phase-4-async-jobs.md`
**Master Feature**: `.claude/vibe/features/vibe-agent/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** 장시간 작업을 요청하면 즉시 확인 후 진행 상황을 자동으로 받기
**So that** 작업 완료를 기다리지 않고도 진행 상황을 파악할 수 있다

## Scenarios

### Scenario 1: Job 생성 및 즉시 응답
```gherkin
Scenario: Create job and respond immediately
  Given "로그인 기능 만들어줘" 요청을 받으면
  When 장시간 작업으로 판단되면
  Then 즉시 "작업을 시작합니다" 메시지가 전송된다
  And jobId가 생성되어 반환된다
  And 작업이 백그라운드에서 시작된다
```
**Verification**: SPEC AC #1

### Scenario 2: Job 상태 SQLite 영속화
```gherkin
Scenario: Job state persisted to SQLite
  Given Job이 생성된 상태
  When 프로세스가 재시작되면
  Then SQLite에서 Job 상태를 복구할 수 있다
  And status, progress, result가 유지된다
```
**Verification**: SPEC AC #2

### Scenario 3: Telegram 진행률 업데이트
```gherkin
Scenario: Progress reported via Telegram editMessageText
  Given Job이 실행 중인 상태
  When Phase 1/3 완료되면
  Then Telegram editMessageText로 기존 메시지가 업데이트된다
  And "Phase 1/3: 타입 정의 완료" 메시지가 표시된다
```
**Verification**: SPEC AC #3

### Scenario 4: 진행률 Rate Limiting
```gherkin
Scenario: Progress updates rate limited to 3 seconds
  Given Job이 실행 중인 상태
  When 1초 간격으로 5번 updateProgress()가 호출되면
  Then 실제 Telegram 메시지 업데이트는 최대 2회만 발생한다
```
**Verification**: SPEC AC #4

### Scenario 5: Job 완료 요약
```gherkin
Scenario: Job completion with summary
  Given Job이 실행 중인 상태
  When 작업이 완료되면
  Then "작업 완료" 메시지와 요약이 전송된다
  And Job status가 "completed"로 변경된다
```
**Verification**: SPEC AC #5

### Scenario 6: Job 취소
```gherkin
Scenario: Cancel running job
  Given Job이 실행 중인 상태
  When 사용자가 "작업 취소" 요청을 보내면
  Then AbortController로 실행이 중단된다
  And "작업이 취소되었습니다" 메시지가 전송된다
  And Job status가 "cancelled"로 변경된다
```
**Verification**: SPEC AC #6

### Scenario 7: 동시 실행 제한
```gherkin
Scenario: Concurrent job limit
  Given 3개 Job이 실행 중인 상태
  When 4번째 Job을 생성하면
  Then 대기열에 추가된다
  And "현재 3개 작업 진행 중. 대기열에 추가되었습니다" 메시지가 전송된다
```
**Verification**: SPEC AC #7

### Scenario 8: Job Timeout
```gherkin
Scenario: Job timeout after 10 minutes
  Given Job이 실행 중인 상태
  When 10분이 경과하면
  Then Job이 자동 중단된다
  And "작업 시간 초과" 메시지가 전송된다
  And Job status가 "failed"로 변경된다
```
**Verification**: SPEC AC #8

### Scenario 9: claude_code 자동 Job 전환
```gherkin
Scenario: Long-running claude_code auto-converts to job
  Given claude_code tool 호출 시
  When 예상 소요 시간이 30초 이상이면
  Then 자동으로 Job으로 전환된다
  And 즉시 응답 후 백그라운드 실행된다
```
**Verification**: SPEC AC #9

### Scenario 10: SQLite DB 연결 실패 처리
```gherkin
Scenario: SQLite DB connection failure - graceful error
  Given SQLite DB 연결이 실패한 상태
  When Job 생성을 시도하면
  Then "작업 시스템에 일시적인 문제가 발생했습니다" 에러가 반환된다
  And 사용자에게 에러 메시지가 전송된다
```
**Verification**: SPEC AC #10

### Scenario 11: editMessageText 실패 시 fallback
```gherkin
Scenario: editMessageText failure - fallback to new message
  Given Job이 실행 중이고 진행률 메시지가 전송된 상태
  When editMessageText API가 실패하면
  Then 새 메시지로 진행률이 전송된다
```
**Verification**: SPEC AC #11

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-3 | ⬜ |
| 4 | AC-4 | ⬜ |
| 5 | AC-5 | ⬜ |
| 6 | AC-6 | ⬜ |
| 7 | AC-7 | ⬜ |
| 8 | AC-8 | ⬜ |
| 9 | AC-9 | ⬜ |
| 10 | AC-10 | ⬜ |
| 11 | AC-11 | ⬜ |
