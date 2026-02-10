# Feature: agent-autonomy — Phase 3: Owner Confirmation & Governance

**SPEC**: `.claude/vibe/specs/agent-autonomy/phase-3-owner-governance.md`
**Master Feature**: `.claude/vibe/features/agent-autonomy/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** HIGH 위험 행위 시 Telegram/Slack/Web으로 확인 알림을 받고 승인/거부할 수 있길
**So that** 위험한 행위가 내 확인 없이 실행되지 않고, 원격에서도 관리 가능함

## Scenarios

### Scenario 1: 확인 요청 생성
```gherkin
Scenario: HIGH 위험 행위 감지 시 확인 요청 생성
  Given SecuritySentinel이 HIGH 위험을 감지하고
  When ConfirmationManager.requestConfirmation()이 호출되면
  Then confirmations 테이블에 status='pending' 레코드가 생성되고
  And expiresAt이 현재 시간 + 300초로 설정됨
```
**Verification**: SPEC AC #1

### Scenario 2: 잘못된 상태 전환 차단
```gherkin
Scenario: approved에서 pending으로 전환 시도 시 에러
  Given status='approved'인 확인이 존재하고
  When resolve(id, 'pending')을 시도하면
  Then InvalidTransitionError가 throw됨
```
**Verification**: SPEC AC #2

### Scenario 3: 확인 → 알림 → 응답 전체 흐름
```gherkin
Scenario: 확인 요청 → Telegram 알림 → 승인 → 실행
  Given HIGH 위험 행위가 감지되고
  And Telegram 채널이 설정되었을 때
  When ConfirmationManager.requestConfirmation()이 호출되면
  Then Telegram으로 Approve/Reject 인라인 키보드 메시지가 전송되고
  And 오너가 Approve를 누르면
  Then status가 'approved'로 변경되고
  And 원래 행위가 실행 허가됨
```
**Verification**: SPEC AC #3

### Scenario 4: 타임아웃 자동 만료
```gherkin
Scenario: 300초 경과 시 자동 expired 처리
  Given pending 상태의 확인이 300초 전에 생성되었고
  When ConfirmationManager.checkExpired()가 실행되면
  Then status가 'expired'로 변경되고
  And 원래 행위가 차단됨
```
**Verification**: SPEC AC #4

### Scenario 5: 알림 채널 Fallback
```gherkin
Scenario: Telegram 실패 시 Slack으로 fallback
  Given sentinel.notificationChannels=['telegram', 'slack']이고
  And Telegram 전송이 실패했을 때
  When NotificationDispatcher.notify()가 호출되면
  Then Slack으로 알림이 전송됨
```
**Verification**: SPEC AC #5

### Scenario 6: 모든 채널 실패 시 차단
```gherkin
Scenario: 모든 알림 채널 실패 시 행위 차단
  Given sentinel.notificationChannels의 모든 채널이 실패하고
  When NotificationDispatcher.notify()가 호출되면
  Then 확인이 expired로 마킹되고
  And 원래 행위가 차단됨 (fail-closed)
```
**Verification**: SPEC AC #6

### Scenario 7: Idempotency Key
```gherkin
Scenario: 동일 idempotencyKey로 중복 확인 요청 방지
  Given idempotencyKey='key-001'로 확인이 이미 생성되었고
  When 동일 idempotencyKey로 다시 생성 시도하면
  Then 새 레코드가 생성되지 않고
  And 기존 확인이 반환됨
```
**Verification**: SPEC AC #7

### Scenario 8: 동시 응답 Race Condition 방지
```gherkin
Scenario: 동시에 approve와 reject 응답이 도착
  Given pending 상태의 확인이 존재하고
  When 거의 동시에 approve와 reject가 호출되면
  Then SQLite 트랜잭션으로 하나만 성공하고
  And 나머지는 InvalidTransitionError 발생
```
**Verification**: SPEC AC #8

### Scenario 9: Slack Block Kit 알림 포맷
```gherkin
Scenario: Slack으로 올바른 Block Kit 메시지 전송
  Given Slack 채널이 설정되었고
  When 확인 요청 알림이 Slack으로 전송되면
  Then Block Kit 형식으로 Action(Approve/Reject 버튼), Risk Level, Summary가 표시됨
```
**Verification**: SPEC AC #5 (Slack 경로)

### Scenario 10: Web API 확인 응답
```gherkin
Scenario: POST /api/confirmations/:id로 승인
  Given pending 상태의 확인 id='conf-001'이 존재하고
  When POST /api/confirmations/conf-001 { approved: true }가 호출되면
  Then status가 'approved'로 변경되고
  And WebSocket으로 상태 변경 이벤트가 브로드캐스트됨
```
**Verification**: SPEC AC #3 (Web 경로)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (confirmation create) | ⬜ |
| 2 | AC-2 (invalid transition) | ⬜ |
| 3 | AC-3 (full flow) | ⬜ |
| 4 | AC-4 (timeout expired) | ⬜ |
| 5 | AC-5 (channel fallback) | ⬜ |
| 6 | AC-6 (fail-closed) | ⬜ |
| 7 | AC-7 (idempotency) | ⬜ |
| 8 | AC-8 (race condition) | ⬜ |
| 9 | AC-5 (Slack format) | ⬜ |
| 10 | AC-3 (Web API) | ⬜ |
