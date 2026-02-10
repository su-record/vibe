# Feature: vibe-agent - Phase 1: Head Model Selection & Tool Registry

**SPEC**: `.claude/vibe/specs/vibe-agent/phase-1-head-model.md`
**Master Feature**: `.claude/vibe/features/vibe-agent/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 에이전트 시스템
**I want** 최적의 헤드 모델을 자동 선택하고 Tool을 관리
**So that** function calling 기반 에이전트의 기반 인프라가 준비된다

## Scenarios

### Scenario 1: GPT OAuth 인증 시 GPT-5.3-Codex 선택
```gherkin
Scenario: GPT OAuth authenticated - select GPT-5.3-Codex
  Given GPT OAuth 인증이 완료된 상태
  When HeadModelSelector.selectHead()를 호출하면
  Then GPT-5.3-Codex가 헤드 모델로 선택된다
  And provider는 "gpt"이다
  And model은 "gpt-5.3-codex"이다
```
**Verification**: SPEC AC #1

### Scenario 2: GPT 미인증 시 Claude Opus fallback
```gherkin
Scenario: GPT not authenticated - fallback to Claude Opus
  Given GPT OAuth 인증이 없는 상태
  When HeadModelSelector.selectHead()를 호출하면
  Then Claude Opus가 헤드 모델로 선택된다
  And provider는 "claude"이다
```
**Verification**: SPEC AC #2

### Scenario 3: GPT Circuit Breaker 동작
```gherkin
Scenario: GPT circuit breaker triggers after 3 failures
  Given GPT OAuth 인증이 완료된 상태
  And GPT API가 3회 연속 실패한 상태
  When HeadModelSelector.selectHead()를 호출하면
  Then Claude Opus로 자동 전환된다
  And 5분 후 GPT 재시도가 활성화된다
```
**Verification**: SPEC AC #3

### Scenario 4: Tool 등록 및 조회
```gherkin
Scenario: Register and retrieve tool from registry
  Given 빈 ToolRegistry가 있을 때
  When "google_search" tool을 Zod 스키마와 함께 등록하면
  Then registry.get("google_search")로 tool을 조회할 수 있다
  And registry.list()에 해당 tool이 포함된다
```
**Verification**: SPEC AC #4

### Scenario 5: Zod → OpenAI JSON Schema 변환
```gherkin
Scenario: Convert Zod schema to OpenAI function calling format
  Given Zod 스키마로 정의된 tool이 있을 때
  When registry.toOpenAIFormat()을 호출하면
  Then { type: "function", function: { name, description, parameters } } 형식으로 변환된다
  And parameters는 유효한 JSON Schema이다
```
**Verification**: SPEC AC #5

### Scenario 6: Zod → Anthropic input_schema 변환
```gherkin
Scenario: Convert Zod schema to Anthropic tool use format
  Given Zod 스키마로 정의된 tool이 있을 때
  When registry.toAnthropicFormat()을 호출하면
  Then { name, description, input_schema } 형식으로 변환된다
```
**Verification**: SPEC AC #6

### Scenario 7: Tool argument 런타임 검증
```gherkin
Scenario: Validate tool arguments at runtime
  Given "google_search" tool이 등록된 상태
  When 잘못된 argument { query: 123 }로 validate()를 호출하면
  Then Zod validation error가 반환된다
  And 유효한 argument { query: "test" }는 통과한다
```
**Verification**: SPEC AC #8

### Scenario 8: HeadModel로 tools 포함 chat 요청 (Edge Case)
```gherkin
Scenario: Chat with tools - model returns tool_call
  Given GPT HeadModelProvider가 초기화된 상태
  And 3개 tool이 등록된 상태
  When "서울 날씨 알려줘" 메시지로 chat()을 호출하면
  Then 응답에 tool_calls가 포함된다
  And tool_calls[0].name은 등록된 tool 중 하나이다
```
**Verification**: SPEC AC #7

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-3 | ⬜ |
| 4 | AC-4 | ⬜ |
| 5 | AC-5 | ⬜ |
| 6 | AC-6 | ⬜ |
| 7 | AC-8 | ⬜ |
| 8 | AC-7 | ⬜ |
