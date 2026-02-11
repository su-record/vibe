# Feature: telegram-agent - Phase 1: Claude CLI JSON 모드 핸들러

**SPEC**: `.claude/vibe/specs/telegram-agent/phase-1-claude-agent.md`
**Master Feature**: `.claude/vibe/features/telegram-agent/_index.feature`

## User Story (Phase Scope)
**As a** 텔레그램 봇 시스템
**I want** Claude CLI를 JSON 모드로 실행하여 구조화된 응답을 받고
**So that** 도구 사용 정보, 실행 시간 등 상세 결과를 추적할 수 있다

## Scenarios

### Scenario 1: 기본 프롬프트 실행
```gherkin
Scenario: Claude CLI JSON 모드로 프롬프트 실행
  Given Claude CLI가 시스템에 설치되어 있음
  When spawnClaudeAgent({ prompt: "Hello" })를 호출하면
  Then Claude CLI가 --output-format json으로 실행됨
  And JSON 응답에서 assistant 텍스트가 추출됨
  And ClaudeAgentResult.text에 응답 내용이 포함됨
  And ClaudeAgentResult.success가 true임
```
**Verification**: SPEC AC #1

### Scenario 2: JSON 라인 파싱
```gherkin
Scenario: stdout의 JSON 라인을 파싱하여 텍스트와 도구 정보 추출
  Given Claude CLI가 JSON 모드로 응답 중
  When stdout에 type:assistant와 type:result JSON 라인이 출력되면
  Then assistant 메시지의 텍스트가 누적됨
  And result의 tool_uses 배열이 추출됨
  And ClaudeAgentResult.toolsUsed에 도구 이름 목록이 포함됨
```
**Verification**: SPEC AC #2

### Scenario 3: Workspace 지정 실행
```gherkin
Scenario: 특정 디렉토리에서 Claude CLI 실행
  Given workspace 옵션이 "~/workspace/my-app"으로 지정됨
  When spawnClaudeAgent({ prompt: "ls", workspace: "~/workspace/my-app" })를 호출하면
  Then Claude CLI에 -w 플래그가 포함됨
  And 해당 디렉토리에서 Claude CLI가 실행됨
```
**Verification**: SPEC AC #3

### Scenario 4: 타임아웃 처리
```gherkin
Scenario: Claude CLI 응답 시간 초과 시 프로세스 정리
  Given timeout이 5000ms로 설정됨
  When Claude CLI가 5초 이상 응답하지 않으면
  Then SIGTERM이 프로세스에 전송됨
  And 3초 후에도 종료되지 않으면 SIGKILL이 전송됨
  And ClaudeAgentResult.success가 false임
  And ClaudeAgentResult.text에 타임아웃 메시지가 포함됨
```
**Verification**: SPEC AC #4

### Scenario 5: 시스템 프롬프트 주입
```gherkin
Scenario: 봇 역할을 시스템 프롬프트로 주입
  Given systemPrompt 옵션이 지정됨
  When spawnClaudeAgent()를 호출하면
  Then Claude CLI에 --system-prompt 플래그가 포함됨
  And 시스템 프롬프트 내용이 Claude에게 전달됨
```
**Verification**: SPEC AC #5

### Scenario 6: 명령어 주입 방지
```gherkin
Scenario: shell:false로 명령어 주입 차단
  Given 사용자 프롬프트에 "; rm -rf /"가 포함됨
  When spawnClaudeAgent()를 호출하면
  Then spawn이 shell:false로 실행됨
  And 프롬프트 전체가 -p 플래그의 단일 값으로 전달됨
  And 셸 메타문자가 해석되지 않음
```
**Verification**: SPEC AC #6

### Scenario 7: 시스템 프롬프트 빌드
```gherkin
Scenario: 8가지 역할을 포함한 시스템 프롬프트 생성
  When buildSystemPrompt({})를 호출하면
  Then 반환된 문자열에 "개발 작업" 역할이 포함됨
  And "웹 리서치" 역할이 포함됨
  And "시스템 모니터링" 역할이 포함됨
  And "메모/지식" 역할이 포함됨
```
**Verification**: SPEC AC #7

### Scenario 8: 텔레그램 응답 규칙 포함
```gherkin
Scenario: 시스템 프롬프트에 텔레그램 제한 규칙 포함
  When buildSystemPrompt({})를 호출하면
  Then 반환된 문자열에 "4096" 또는 "4000" 글자 제한 언급이 포함됨
  And "간결하게" 또는 "짧게" 응답 지침이 포함됨
```
**Verification**: SPEC AC #8

### Scenario 9: 빌드 성공
```gherkin
Scenario: TypeScript 빌드 성공
  When npm run build를 실행하면
  Then 빌드 에러 없이 완료됨
  And dist/bridge/claude-agent.js가 생성됨
  And dist/bridge/system-prompt.js가 생성됨
```
**Verification**: SPEC AC #9

### Scenario 10: findClaude 통합
```gherkin
Scenario: findClaude 로직이 claude-agent.ts로 통합됨
  Given telegram-bridge.ts에서 findClaude()가 제거됨
  When claude-agent.ts의 findClaudePath()를 호출하면
  Then Claude CLI 경로가 반환됨
  And 크로스플랫폼 경로 탐색이 동작함
```
**Verification**: SPEC AC #10

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (JSON 모드 실행) | ⬜ |
| 2 | AC-2 (JSON 파싱) | ⬜ |
| 3 | AC-3 (workspace 지정) | ⬜ |
| 4 | AC-4 (타임아웃) | ⬜ |
| 5 | AC-5 (시스템 프롬프트) | ⬜ |
| 6 | AC-6 (명령어 주입 방지) | ⬜ |
| 7 | AC-7 (프롬프트 빌드) | ⬜ |
| 8 | AC-8 (텔레그램 규칙) | ⬜ |
| 9 | AC-9 (빌드) | ⬜ |
| 10 | AC-10 (findClaude 통합) | ⬜ |
