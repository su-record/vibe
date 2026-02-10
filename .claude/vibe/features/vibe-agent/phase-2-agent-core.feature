# Feature: vibe-agent - Phase 2: Agent Core Loop

**SPEC**: `.claude/vibe/specs/vibe-agent/phase-2-agent-core.md`
**Master Feature**: `.claude/vibe/features/vibe-agent/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** 메시지를 보내면 헤드 모델이 자율적으로 tool을 선택하고 실행
**So that** 코드 기반 라우터 없이도 모든 요청이 처리된다

## Scenarios

### Scenario 1: 단순 텍스트 응답
```gherkin
Scenario: Simple text message - direct response
  Given AgentLoop이 초기화된 상태
  When "안녕하세요" 텍스트 메시지를 전송하면
  Then HeadModel이 tool 호출 없이 텍스트로 응답한다
  And Telegram으로 응답이 전송된다
```
**Verification**: SPEC AC #1

### Scenario 2: Single Tool Call 실행
```gherkin
Scenario: Message triggers single tool call
  Given AgentLoop이 초기화되고 google_search tool이 등록된 상태
  When "오늘 날씨 알려줘" 메시지를 전송하면
  Then HeadModel이 google_search tool_call을 반환한다
  And ToolExecutor가 google_search를 실행한다
  And 실행 결과가 HeadModel에 반환된다
  And HeadModel이 최종 텍스트 응답을 생성한다
```
**Verification**: SPEC AC #2

### Scenario 3: Multi-turn Tool Call
```gherkin
Scenario: Multi-turn tool calls in sequence
  Given AgentLoop이 초기화된 상태
  When "로그인 코드를 분석하고 보안 이슈 알려줘" 메시지를 전송하면
  Then HeadModel이 kimi_analyze tool_call을 먼저 반환한다
  And 분석 결과로 HeadModel이 추가 판단 후 최종 응답을 생성한다
```
**Verification**: SPEC AC #3

### Scenario 4: Max Iterations 초과 방지
```gherkin
Scenario: Agent loop stops after 10 iterations
  Given AgentLoop max_iterations=10 설정
  When HeadModel이 계속 tool_call만 반환하는 상황이면
  Then 10회 반복 후 루프가 중단된다
  And 사용자에게 "처리 한도 초과" 메시지가 전송된다
```
**Verification**: SPEC AC #4

### Scenario 5: Tool Execution Timeout
```gherkin
Scenario: Tool execution exceeds 30s timeout
  Given claude_code tool이 등록된 상태
  When tool 실행이 30초를 초과하면
  Then AbortController로 실행이 중단된다
  And 사용자에게 timeout 에러 메시지가 전달된다
```
**Verification**: SPEC AC #5

### Scenario 6: 대화 이력 관리
```gherkin
Scenario: Conversation history managed per chatId
  Given chatId="12345"로 5개 메시지를 전송한 상태
  When 6번째 메시지를 전송하면
  Then 대화 이력에 6개 메시지가 포함된다
  And chatId="67890"의 이력과 분리되어 있다
```
**Verification**: SPEC AC #6

### Scenario 7: 세션 타임아웃
```gherkin
Scenario: Session expires after 30 minutes of inactivity
  Given chatId="12345"로 대화한 상태
  When 30분 동안 메시지가 없으면
  Then 세션 컨텍스트가 초기화된다
  And 다음 메시지는 새 대화로 시작된다
```
**Verification**: SPEC AC #7

### Scenario 8: Dedup 및 Voice Transcription 유지
```gherkin
Scenario: Existing dedup and voice features preserved
  Given 동일 update_id의 메시지가 2회 수신되면
  Then 첫 번째만 처리되고 두 번째는 무시된다
```
**Verification**: SPEC AC #8

### Scenario 9: HeadModel API 실패 처리
```gherkin
Scenario: HeadModel API failure - graceful error message
  Given AgentLoop이 초기화된 상태
  When HeadModel API 호출이 네트워크 에러로 실패하면
  Then "AI 모델 연결에 실패했습니다. 잠시 후 다시 시도해주세요." 메시지가 전송된다
  And AgentLoop이 graceful하게 종료된다
```
**Verification**: SPEC AC #9

### Scenario 10: 응답 시간 목표 충족
```gherkin
Scenario: Simple text response within 3 seconds
  Given AgentLoop이 초기화된 상태
  When "안녕하세요" 단순 메시지를 전송하면
  Then HeadModel 호출부터 응답 전송까지 3초 이내에 완료된다
```
**Verification**: SPEC AC #10

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
