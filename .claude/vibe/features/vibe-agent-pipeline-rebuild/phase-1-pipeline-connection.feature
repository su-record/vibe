# Feature: vibe-agent-pipeline-rebuild - Phase 1: Pipeline Connection

**SPEC**: `.claude/vibe/specs/vibe-agent-pipeline-rebuild/phase-1-pipeline-connection.md`
**Master Feature**: `.claude/vibe/features/vibe-agent-pipeline-rebuild/_index.feature`

## User Story (Phase Scope)
**As a** Vibe 데몬 운영자
**I want** SessionPool이 AgentLoop를 실제로 호출하여 AI 응답을 생성하길 원한다
**So that** 외부 채널 메시지가 STUB 대신 실제 AI 처리를 거쳐 응답된다

## Scenarios

### Scenario 1: 외부 메시지 → AI 응답 (Happy Path)
```gherkin
Scenario: 외부 채널 메시지가 AgentLoop를 통해 AI 응답을 반환한다
  Given 데몬이 시작되어 SessionPool이 초기화되었다
  And HeadModelSelector가 GPT 5.3 Codex를 primary로 설정되었다
  And 12개 도구가 JSON Schema 정의로 등록되었다
  When Telegram에서 "프로젝트 구조를 분석해줘" 메시지가 수신된다
  Then SessionPool.executeRequest()가 AgentLoop.process()를 호출한다
  And GPT가 적절한 도구를 선택하여 실행한다
  And AI 응답이 Telegram으로 전송된다
```
**Verification**: SPEC AC #1

### Scenario 2: JSON Schema 도구 정의 작동
```gherkin
Scenario: Zod 없이 JSON Schema로 정의된 도구가 GPT function calling에서 작동한다
  Given send_telegram 도구가 JSON Schema로 정의되었다
  And parameters: { type: "object", properties: { message: { type: "string" } }, required: ["message"] }
  When GPT가 send_telegram 도구 호출을 결정한다
  Then 도구의 handler가 올바른 arguments로 호출된다
  And 결과가 GPT에게 tool result로 반환된다
```
**Verification**: SPEC AC #2

### Scenario 3: ToolRegistry 제거 확인
```gherkin
Scenario: ToolRegistry가 완전히 제거되고 빌드가 성공한다
  Given ToolRegistry.ts 파일이 삭제되었다
  And 모든 import 참조가 제거되었다
  When npx tsc --noEmit을 실행한다
  Then 타입 에러 없이 통과한다
  And npm run build가 성공한다
```
**Verification**: SPEC AC #3

### Scenario 4: Circuit Breaker Fallback
```gherkin
Scenario: GPT 장애 시 Claude로 자동 전환된다
  Given HeadModelSelector의 GPT provider가 circuit breaker open 상태이다
  When 외부 메시지가 수신된다
  Then Claude provider로 자동 fallback되어 응답을 생성한다
  And circuit breaker 상태가 half-open으로 전환된다 (5분 후)
```
**Verification**: SPEC AC #4

### Scenario 5: 채널별 AsyncLocalStorage 격리
```gherkin
Scenario: Telegram과 Slack 메시지가 동시에 처리될 때 컨텍스트가 격리된다
  Given Telegram chatId "123"에서 메시지가 수신된다
  And 동시에 Slack channelId "C456"에서 메시지가 수신된다
  When 두 메시지가 AgentLoop에서 처리된다
  Then Telegram 핸들러는 chatId "123"에만 접근 가능하다
  And Slack 핸들러는 channelId "C456"에만 접근 가능하다
  And 교차 접근이 불가능하다
```
**Verification**: SPEC AC #5

### Scenario 6: 동시 요청 직렬화
```gherkin
Scenario: 같은 세션의 동시 요청이 순차적으로 처리된다
  Given 세션 "session-1"이 활성 상태이다
  When "요청 A"와 "요청 B"가 동시에 도착한다
  Then "요청 A"가 먼저 처리 완료된다
  And "요청 B"가 그 다음 처리된다
  And 두 요청의 응답이 각각 올바르게 반환된다
```
**Verification**: SPEC AC #6

### Scenario 7: HeadModel 전체 실패 처리
```gherkin
Scenario: 모든 HeadModel provider가 실패하면 사용자에게 에러 메시지를 반환한다
  Given HeadModelSelector의 GPT provider가 circuit breaker open 상태이다
  And Claude provider도 일시적 장애 상태이다
  When 외부 메시지가 수신된다
  Then AgentLoop이 최대 10회 반복 내에 처리를 중단한다
  And "AI 서비스에 일시적으로 연결할 수 없습니다" 에러 메시지가 반환된다
  And 세션 상태가 정상으로 유지된다 (재시도 가능)
```
**Verification**: SPEC AC #1 (에러 경로)

### Scenario 8: AgentLoop 처리 시간 제한
```gherkin
Scenario: AgentLoop 단일 요청 처리가 60초를 초과하면 타임아웃된다
  Given AgentLoop의 최대 처리 시간이 60초로 설정되었다
  When HeadModel 응답이 60초 이상 지연된다
  Then AgentLoop이 타임아웃으로 처리를 중단한다
  And "요청 처리 시간이 초과되었습니다" 메시지가 반환된다
```
**Verification**: SPEC AC #1 (성능 요구사항)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ✅ |
| 2 | AC-2 | ✅ |
| 3 | AC-3 | ✅ |
| 4 | AC-4 | ✅ |
| 5 | AC-5 | ✅ |
| 6 | AC-6 | ✅ |
| 7 | AC-1 (error) | ✅ |
| 8 | AC-1 (perf) | ✅ |
