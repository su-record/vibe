# Feature: agent-autonomy — Phase 1: Event Core & Audit Foundation

**SPEC**: `.claude/vibe/specs/agent-autonomy/phase-1-event-core.md`
**Master Feature**: `.claude/vibe/features/agent-autonomy/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** 모든 에이전트 행위가 이벤트로 캡처되고 불변 감사 로그에 기록되길
**So that** 자율 행위의 추적성과 감사 가능성이 보장됨

## Scenarios

### Scenario 1: EventBus 이벤트 발행/구독
```gherkin
Scenario: typed 이벤트를 발행하고 구독자가 수신
  Given EventBus 인스턴스가 생성되고
  And 'agent_action' 이벤트 리스너가 등록되었을 때
  When agent_action 이벤트가 발행되면
  Then 리스너가 Zod 검증된 이벤트를 수신하고
  And correlationId가 UUIDv7 형식으로 자동 주입됨
```
**Verification**: SPEC AC #1

### Scenario 2: Zod 스키마 검증
```gherkin
Scenario: 잘못된 이벤트 데이터가 거부됨
  Given EventBus에 agent_action 리스너가 등록되고
  When actionType 필드가 누락된 이벤트 발행을 시도하면
  Then ZodError가 throw되고
  And 이벤트가 리스너에 전달되지 않음
```
**Verification**: SPEC AC #2

### Scenario 3: Immutable Audit Log
```gherkin
Scenario: audit_events 테이블에 UPDATE/DELETE 시도 시 거부
  Given audit_events에 이벤트가 기록되어 있고
  When UPDATE 쿼리를 실행하면
  Then 'Audit logs are immutable' 에러가 발생하고
  And 원본 데이터가 변경되지 않음
```
**Verification**: SPEC AC #3

### Scenario 4: 감사 로그 필터링 조회
```gherkin
Scenario: agentId와 riskLevel로 감사 로그 필터링
  Given audit_events에 다양한 에이전트의 이벤트가 100건 기록되고
  When AuditStore.query({ agentId: 'implementer', riskLevel: 'HIGH' })를 호출하면
  Then implementer의 HIGH 위험 이벤트만 반환되고
  And 최신순으로 정렬되어 pagination 적용됨
```
**Verification**: SPEC AC #4

### Scenario 5: Correlation ID로 이벤트 체인 조회
```gherkin
Scenario: 하나의 correlationId로 연관 이벤트 체인 조회
  Given 동일 correlationId를 가진 agent_action → policy_check → action_executed 이벤트가 기록되고
  When AuditStore.getByCorrelation(correlationId)를 호출하면
  Then 3개의 연관 이벤트가 시간순으로 반환됨
```
**Verification**: SPEC AC #5

### Scenario 6: Transactional Outbox 정상 발행
```gherkin
Scenario: EventOutbox가 트랜잭션 내 이벤트를 enqueue 후 비동기 발행
  Given EventOutbox가 초기화되고
  When enqueue(event)가 트랜잭션 내에서 호출되면
  Then event_outbox 테이블에 pending 상태로 저장되고
  And processOutbox() 실행 시 EventBus로 발행 후 published로 변경됨
```
**Verification**: SPEC AC #6

### Scenario 7: Outbox 실패 재시도
```gherkin
Scenario: 발행 실패 시 3회 재시도 후 failed 마킹
  Given EventBus 리스너가 에러를 throw하도록 설정되고
  When processOutbox()가 3회 실행되면
  Then retryCount가 3으로 증가하고
  And status가 'failed'로 마킹됨
```
**Verification**: SPEC AC #7

### Scenario 8: 대량 이벤트 성능
```gherkin
Scenario: 1000개 이벤트 기록이 100ms 이내 완료
  Given AuditStore가 초기화되고
  When 1000개의 audit 이벤트를 배치로 기록하면
  Then 전체 기록이 100ms 이내에 완료됨
```
**Verification**: SPEC AC #8

### Scenario 9: 모듈 Export
```gherkin
Scenario: autonomy 모듈 import가 정상 동작
  Given src/lib/autonomy/index.ts가 존재하고
  When EventBus, AuditStore, EventOutbox를 import하면
  Then 모든 클래스가 정상 import됨
```
**Verification**: SPEC AC #9

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (EventBus + correlationId) | ⬜ |
| 2 | AC-2 (Zod validation) | ⬜ |
| 3 | AC-3 (immutable audit) | ⬜ |
| 4 | AC-4 (filter query) | ⬜ |
| 5 | AC-5 (correlation chain) | ⬜ |
| 6 | AC-6 (outbox enqueue) | ⬜ |
| 7 | AC-7 (outbox retry) | ⬜ |
| 8 | AC-8 (performance) | ⬜ |
| 9 | AC-9 (module export) | ⬜ |
