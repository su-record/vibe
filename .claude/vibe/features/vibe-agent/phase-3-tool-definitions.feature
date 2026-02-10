# Feature: vibe-agent - Phase 3: Function Calling Tool Definitions

**SPEC**: `.claude/vibe/specs/vibe-agent/phase-3-tool-definitions.md`
**Master Feature**: `.claude/vibe/features/vibe-agent/_index.feature`

## User Story (Phase Scope)
**As a** 헤드 모델
**I want** 명확하게 정의된 tool을 function calling으로 호출
**So that** 개발, 검색, 분석, 음성 등 모든 작업을 수행할 수 있다

## Scenarios

### Scenario 1: claude_code Tool 실행
```gherkin
Scenario: Execute development task via claude_code
  Given claude_code tool이 등록된 상태
  When { task: "src/utils.ts에 formatDate 함수 추가" } 인자로 호출하면
  Then Claude Code CLI가 실행된다
  And 실행 결과 텍스트가 반환된다
```
**Verification**: SPEC AC #1

### Scenario 2: gemini_stt Tool 실행
```gherkin
Scenario: Transcribe voice via gemini_stt
  Given gemini_stt tool이 등록된 상태
  When { audioFileId: "abc123" } 인자로 호출하면
  Then Gemini STT API로 음성이 텍스트로 변환된다
  And 변환된 텍스트가 반환된다
```
**Verification**: SPEC AC #2

### Scenario 3: google_search Tool 실행
```gherkin
Scenario: Search web via google_search
  Given google_search tool이 등록된 상태
  When { query: "TypeScript 5.5 new features", maxResults: 5 } 인자로 호출하면
  Then 최대 5개 검색 결과가 반환된다
  And 각 결과에 title, url, snippet이 포함된다
```
**Verification**: SPEC AC #3

### Scenario 4: kimi_analyze Tool - 4가지 분석 유형
```gherkin
Scenario: Analyze code with different analysis types
  Given kimi_analyze tool이 등록된 상태
  When analysisType "code-review"로 호출하면
  Then 코드 리뷰 결과가 반환된다
  When analysisType "security"로 호출하면
  Then 보안 분석 결과가 반환된다
```
**Verification**: SPEC AC #4

### Scenario 5: web_browse SSRF 방지
```gherkin
Scenario: web_browse blocks private IP addresses
  Given web_browse tool이 등록된 상태
  When { url: "http://192.168.1.1/admin" } 인자로 호출하면
  Then "Private IP access blocked" 에러가 반환된다
  And 실제 HTTP 요청은 발생하지 않는다
```
**Verification**: SPEC AC #5

### Scenario 6: send_telegram Tool 실행
```gherkin
Scenario: Send message via send_telegram
  Given send_telegram tool이 등록된 상태
  When { chatId: "12345", text: "테스트 메시지" } 인자로 호출하면
  Then Telegram API로 메시지가 전송된다
```
**Verification**: SPEC AC #6

### Scenario 7: memory Tool 실행
```gherkin
Scenario: Save and recall memory
  Given save_memory, recall_memory tool이 등록된 상태
  When save_memory({ key: "decision", value: "Zod 사용" })를 호출하면
  Then 메모리가 저장된다
  When recall_memory({ key: "decision" })를 호출하면
  Then "Zod 사용" 값이 반환된다
```
**Verification**: SPEC AC #7

### Scenario 8: 잘못된 Tool Argument 검증
```gherkin
Scenario: Reject invalid tool arguments
  Given google_search tool이 등록된 상태
  When { query: 123 } (타입 오류) 인자로 호출하면
  Then Zod validation error가 반환된다
  And tool은 실행되지 않는다
```
**Verification**: SPEC AC #8

### Scenario 9: Tool 결과 크기 제한
```gherkin
Scenario: Auto-summarize large tool results
  Given web_browse tool이 등록된 상태
  When 10KB 초과 결과를 반환하는 URL을 요청하면
  Then 결과가 10KB 이내로 자동 요약된다
```
**Verification**: SPEC AC #9

### Scenario 10: 전체 Tool 일괄 등록
```gherkin
Scenario: Register all tools at once
  Given 빈 ToolRegistry가 있을 때
  When registerAllTools(registry)를 호출하면
  Then 모든 tool (claude_code, gemini_stt, google_search, kimi_analyze, web_browse, send_telegram, save_memory, recall_memory)이 등록된다
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
