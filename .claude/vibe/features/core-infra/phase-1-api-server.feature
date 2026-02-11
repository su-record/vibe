# Feature: core-infra - Phase 1: API Server (SSE + WebSocket)

**SPEC**: `.claude/vibe/specs/core-infra/phase-1-api-server.md`
**Master Feature**: `.claude/vibe/features/core-infra/_index.feature`

## User Story (Phase Scope)
**As a** Visee 외부 UI 개발자
**I want** WebSocket과 SSE로 VIBE 에이전트와 실시간 통신
**So that** Electron/PWA에서 tool call 진행 상황과 응답을 실시간으로 표시

## Scenarios

### Scenario 1: WebSocket 연결 및 인증
```gherkin
Scenario: WebSocket 연결 성공
  Given WebServer가 7860 포트에서 실행 중
  When 클라이언트가 유효한 Bearer token으로 WebSocket upgrade 요청
  Then WebSocket 연결이 성공한다
  And 서버가 { type: "connected", clientId: "..." } 메시지를 전송한다
```
**Verification**: SPEC AC #1

### Scenario 2: WebSocket 인증 실패
```gherkin
Scenario: WebSocket 인증 실패
  Given WebServer가 실행 중
  When 클라이언트가 잘못된 token으로 WebSocket upgrade 요청
  Then 서버가 401 응답을 반환한다
  And WebSocket 연결이 거부된다
```
**Verification**: SPEC AC #7

### Scenario 3: SSE 스트리밍 연결
```gherkin
Scenario: SSE 스트림 수신
  Given WebServer가 실행 중이고 인증된 클라이언트
  When GET /api/stream 요청
  Then Content-Type이 text/event-stream
  And 15초마다 keep-alive 코멘트 수신
```
**Verification**: SPEC AC #3, #5

### Scenario 4: Job 생성 및 실시간 진행
```gherkin
Scenario: Job 생성 후 SSE로 진행 상황 수신
  Given SSE /api/stream에 연결된 클라이언트
  When POST /api/job { request: "프로젝트 분석해줘" }
  Then job:created 이벤트 수신
  And tool call마다 job:progress 이벤트 수신
  And 최종 응답은 job:complete 이벤트로 수신
```
**Verification**: SPEC AC #10

### Scenario 5: Rate limit 초과
```gherkin
Scenario: Rate limit 초과 시 429 응답
  Given 인증된 클라이언트가 API 호출 중
  When 1분 내 100회 초과 요청
  Then 429 Too Many Requests 응답
  And Retry-After 헤더 포함
```
**Verification**: SPEC AC #9

### Scenario 6: Agent export
```gherkin
Scenario: AgentLoop을 외부에서 import
  Given @su-record/core 패키지 설치
  When import { AgentLoop } from '@su-record/core/agent'
  Then AgentLoop 클래스를 사용할 수 있다
```
**Verification**: SPEC AC #11

### Scenario 7: WebSocket ping/pong
```gherkin
Scenario: Idle 연결 heartbeat
  Given WebSocket 연결 상태
  When 30초 간격으로 ping 전송
  Then 클라이언트가 pong 응답
  And 300초 무응답 시 연결 종료
```
**Verification**: SPEC AC #6

### Scenario 8: SSE 특정 Job 스트리밍
```gherkin
Scenario: SSE로 특정 Job의 이벤트만 수신
  Given SSE /api/stream/:jobId에 연결된 클라이언트
  When 해당 jobId의 AgentLoop 처리 중
  Then 해당 job의 progress/chunk/complete 이벤트만 수신
  And 다른 job의 이벤트는 수신하지 않음
```
**Verification**: SPEC AC #4

### Scenario 9: WebSocket 최대 연결 초과
```gherkin
Scenario: 최대 동시 연결 초과 시 503 응답
  Given 이미 50개의 WebSocket 연결이 활성 상태
  When 51번째 클라이언트가 WebSocket upgrade 요청
  Then 503 Service Unavailable 응답
  And Retry-After 헤더 포함
```
**Verification**: SPEC Constraints (max connections)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1: WS 연결 성공 | ⬜ |
| 2 | AC-7: 인증 실패 401/403 | ⬜ |
| 3 | AC-3, AC-5: SSE 연결 + keep-alive | ⬜ |
| 4 | AC-10: AgentLoop progress → SSE/WS | ⬜ |
| 5 | AC-9: Rate limit 429 | ⬜ |
| 6 | AC-11: Agent export | ⬜ |
| 7 | AC-6: Idle 연결 종료 | ⬜ |
| 8 | AC-4: SSE jobId 스트리밍 | ⬜ |
| 9 | Constraints: 최대 연결 초과 503 | ⬜ |
