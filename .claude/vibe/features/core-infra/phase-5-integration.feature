# Feature: core-infra - Phase 5: Integration & Multi-Channel

**SPEC**: `.claude/vibe/specs/core-infra/phase-5-integration.md`
**Master Feature**: `.claude/vibe/features/core-infra/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 시스템
**I want** 모든 채널이 통합되어 동작
**So that** 어떤 채널에서든 동일한 에이전트 기능을 사용할 수 있다

## Scenarios

### Scenario 1: 멀티채널 메시지 라우팅
```gherkin
Scenario: 채널 무관 메시지 처리
  Given Telegram, Slack, Web 채널이 활성화
  When 각 채널에서 동일한 메시지 수신
  Then 모든 메시지가 AgentLoop로 전달
  And 각 채널 포맷에 맞게 응답
```
**Verification**: SPEC AC #1

### Scenario 2: 채널 부분 실패
```gherkin
Scenario: 하나의 채널 실패 시 다른 채널 정상
  Given Telegram과 Slack이 활성화
  When 브로드캐스트 메시지 전송 중 Slack이 실패
  Then Telegram에는 정상 전송
  And Slack 실패 로그 기록
```
**Verification**: SPEC AC #2

### Scenario 3: 선택적 채널 활성화
```gherkin
Scenario: 설정에 따른 채널 활성화
  Given VIBE_TELEGRAM_ENABLED=true, VIBE_SLACK_ENABLED=false
  When daemon 시작
  Then Telegram만 활성화
  And Slack은 초기화하지 않음
```
**Verification**: SPEC AC #3

### Scenario 4: Graceful shutdown
```gherkin
Scenario: 모든 채널 안전 종료
  Given 3개 채널이 활성화 상태
  When SIGTERM 수신
  Then 모든 채널의 stop() 호출
  And 모든 연결 정상 종료 후 프로세스 종료
```
**Verification**: SPEC AC #5

### Scenario 5: 통합 테스트 통과
```gherkin
Scenario: 전체 테스트 스위트 통과
  Given Phase 1~4 모든 코드 구현 완료
  When npx vitest run 실행
  Then 모든 테스트 통과
  And TypeScript 컴파일 에러 없음
```
**Verification**: SPEC AC #12, #13

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1: 멀티채널 라우팅 | ⬜ |
| 2 | AC-2: 부분 실패 처리 | ⬜ |
| 3 | AC-3: 선택적 활성화 | ⬜ |
| 4 | AC-5: graceful shutdown | ⬜ |
| 5 | AC-12, AC-13: 테스트/컴파일 | ⬜ |
