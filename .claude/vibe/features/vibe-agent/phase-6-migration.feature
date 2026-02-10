# Feature: vibe-agent - Phase 6: Migration & Testing

**SPEC**: `.claude/vibe/specs/vibe-agent/phase-6-migration.md`
**Master Feature**: `.claude/vibe/features/vibe-agent/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 시스템 관리자
**I want** 기존 시스템에서 새 에이전트로 안전하게 전환
**So that** 무중단으로 아키텍처를 마이그레이션할 수 있다

## Scenarios

### Scenario 1: Shadow Mode 병렬 실행
```gherkin
Scenario: Shadow mode runs both systems in parallel
  Given agentMode가 "shadow"로 설정된 상태
  When 메시지가 수신되면
  Then legacy 시스템과 agent 시스템 양쪽이 실행된다
  And 결과 차이가 로그에 기록된다
  And 사용자에게는 legacy 결과가 전달된다
```
**Verification**: SPEC AC #1

### Scenario 2: Agent Mode with Legacy Fallback
```gherkin
Scenario: Agent mode with legacy fallback on failure
  Given agentMode가 "agent"로 설정된 상태
  When agent 시스템이 에러를 발생시키면
  Then legacy 시스템으로 자동 fallback된다
  And fallback 이벤트가 로그에 기록된다
```
**Verification**: SPEC AC #2

### Scenario 3: Full Agent Mode
```gherkin
Scenario: Full agent mode - no legacy system
  Given agentMode가 "full"로 설정된 상태
  When 메시지가 수신되면
  Then 새 에이전트 시스템만 실행된다
  And legacy 시스템은 호출되지 않는다
```
**Verification**: SPEC AC #3

### Scenario 4: AgentLoop 통합 테스트
```gherkin
Scenario: AgentLoop integration tests pass
  Given AgentLoop 테스트 파일이 존재할 때
  When npm test를 실행하면
  Then 텍스트 응답, tool call, multi-turn, timeout 테스트가 통과한다
```
**Verification**: SPEC AC #4

### Scenario 5: HeadModelSelector 테스트
```gherkin
Scenario: HeadModelSelector tests pass
  Given HeadModelSelector 테스트 파일이 존재할 때
  When npm test를 실행하면
  Then GPT 선택, Claude fallback, circuit breaker 테스트가 통과한다
```
**Verification**: SPEC AC #5

### Scenario 6: ToolRegistry 테스트
```gherkin
Scenario: ToolRegistry tests pass
  Given ToolRegistry 테스트 파일이 존재할 때
  When npm test를 실행하면
  Then 등록/조회, format 변환, Zod 검증 테스트가 통과한다
```
**Verification**: SPEC AC #6

### Scenario 7: JobManager 테스트
```gherkin
Scenario: JobManager tests pass
  Given JobManager 테스트 파일이 존재할 때
  When npm test를 실행하면
  Then 생성/실행/완료/취소, 동시 실행, timeout 테스트가 통과한다
```
**Verification**: SPEC AC #7

### Scenario 8: Legacy 코드 정리 후 빌드
```gherkin
Scenario: Build succeeds after legacy cleanup
  Given agentMode가 "full"로 충분히 검증된 상태
  When IntentClassifier.ts, RouteRegistry.ts를 삭제하면
  Then npm run build가 성공한다
  And npm test가 통과한다
```
**Verification**: SPEC AC #8

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
