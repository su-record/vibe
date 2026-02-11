# Feature: openclaw-integration — Phase 4: Agent Infrastructure

**SPEC**: `.claude/core/specs/openclaw-integration/phase-4-agents.md`
**Master Feature**: `.claude/core/features/openclaw-integration/_index.feature`

## User Story (Phase Scope)
**As a** Vibe 사용자
**I want** 에이전트 실행 자동 통보(Announce)와 디스크 영속 레지스트리
**So that** 에이전트 실행 상황을 실시간으로 파악하고, 세션 재시작 후에도 이전 실행 이력을 복구할 수 있다

## Scenarios

### Scenario 1: Agent Start Announcement
```gherkin
Scenario: 에이전트 시작 시 이벤트 발생
  Given BackgroundManager에서 새 task가 launch됨
  When executeTask()가 호출되면
  Then agentAnnouncer에서 'agent-start' 이벤트가 발생하고
  And taskId, agentName, model, prompt(200자) 정보가 포함된다
```
**Verification**: SPEC AC #1

### Scenario 2: Agent Complete Announcement
```gherkin
Scenario: 에이전트 완료 시 이벤트 발생
  Given task가 성공적으로 완료됨
  When 결과가 반환되면
  Then agentAnnouncer에서 'agent-complete' 이벤트가 발생하고
  And success=true, duration, resultSummary(500자) 정보가 포함된다
```
**Verification**: SPEC AC #2

### Scenario 3: Agent Error Announcement
```gherkin
Scenario: 에이전트 실패 시 이벤트 발생
  Given task 실행 중 에러 발생
  When 에러가 catch되면
  Then agentAnnouncer에서 'agent-error' 이벤트가 발생하고
  And error 메시지, retryable 여부, duration이 포함된다
```
**Verification**: SPEC AC #3

### Scenario 4: Agent Stats Aggregation
```gherkin
Scenario: 정확한 통계 집계
  Given 5개 task가 완료됨 (3 성공, 2 실패)
  When agentAnnouncer.getStats()를 호출하면
  Then totalCompleted=3, totalFailed=2, byModel/byAgent별 정확한 집계가 반환된다
```
**Verification**: SPEC AC #4

### Scenario 5: History FIFO Limit
```gherkin
Scenario: History 100개 초과 시 FIFO 삭제
  Given 이미 100개의 완료 이벤트가 history에 있음
  When 101번째 이벤트가 추가되면
  Then 가장 오래된 1개가 삭제되고 총 100개가 유지된다
```
**Verification**: SPEC AC #5

### Scenario 6: Agent Registry DB Creation
```gherkin
Scenario: Registry DB 자동 생성
  Given projectPath가 설정된 상태
  When AgentRegistry가 초기화되면
  Then {projectPath}/.claude/vibe/agents/registry.db 파일이 생성되고
  And agent_executions 테이블이 존재한다
```
**Verification**: SPEC AC #6

### Scenario 7: Execution Record Lifecycle
```gherkin
Scenario: 실행 레코드 전체 생명주기
  Given AgentRegistry가 초기화된 상태
  When recordStart()로 실행을 기록하고
  And recordComplete()로 완료를 기록하면
  Then DB에 status='completed', duration, result가 저장된다
```
**Verification**: SPEC AC #7

### Scenario 8: Orphan Detection After Restart
```gherkin
Scenario: 프로세스 재시작 후 미완료 task 감지
  Given 이전 세션에서 running 상태로 남은 task가 있음
  When 새 세션에서 getIncompleteExecutions()를 호출하면
  Then 이전 running task 목록이 반환된다
```
**Verification**: SPEC AC #8

### Scenario 9: Mark Orphaned Tasks
```gherkin
Scenario: 1시간 이상 running task를 orphaned로 표시
  Given 2시간 전에 시작된 running task가 있음
  When markOrphaned(3600000)을 호출하면
  Then 해당 task가 status='failed'로 변경된다
```
**Verification**: SPEC AC #9

### Scenario 10: Registry Cleanup
```gherkin
Scenario: 24시간 이상된 완료 레코드 삭제
  Given 48시간 전에 완료된 레코드가 있음
  When cleanup(86400000)을 호출하면
  Then 해당 레코드가 DB에서 삭제된다
```
**Verification**: SPEC AC #10

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ✅ |
| 2 | AC-2 | ✅ |
| 3 | AC-3 | ✅ |
| 4 | AC-4 | ✅ |
| 5 | AC-5 | ✅ |
| 6 | AC-6 | ✅ |
| 7 | AC-7 | ✅ |
| 8 | AC-8 | ✅ |
| 9 | AC-9 | ✅ |
| 10 | AC-10 | ✅ |
