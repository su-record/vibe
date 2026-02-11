# Feature: sonolbot-patterns - Phase 7: Response Text Style (12flow-write)

**SPEC**: `.claude/vibe/specs/sonolbot-patterns/phase-7-response-style.md`
**Master Feature**: `.claude/vibe/features/sonolbot-patterns/_index.feature`

## User Story (Phase Scope)

**As a** Telegram/Slack/Web 채널 사용자
**I want** 에이전트 응답이 마크다운 없이, 이모지와 대화체로 제공
**So that** 모바일 환경에서도 가독성 좋은 응답을 받을 수 있음

## Scenarios

### Scenario 1: 외부 채널 응답에 마크다운 없음

```gherkin
Scenario: 외부 채널 응답에서 마크다운 문법이 사용되지 않음
  Given 채널이 "telegram"이고
  And responseStyle.format이 "text"일 때
  When 에이전트가 응답을 생성하면
  Then 응답에 "**", "```", "##" 등의 마크다운 문법이 포함되지 않고
  And 순수 텍스트 + 이모지로 구성됨
```
**Verification**: SPEC AC #1

### Scenario 2: 이모지 자연스러운 사용

```gherkin
Scenario: 에이전트 응답에 이모지가 자연스럽게 사용됨
  Given SystemPrompt에 응답 스타일 가이드가 적용되었을 때
  When 에이전트가 응답을 생성하면
  Then 응답에 이모지가 시각적 구분자로 사용되고
  And 번호 매기기 대신 이모지 불릿이 사용됨
```
**Verification**: SPEC AC #2

### Scenario 3: 색상 코드 활용

```gherkin
Scenario: 🔴(중요/긴급), 🟡(참고), 🟢(완료) 색상 코드가 해당 맥락에서 사용됨
  Given SystemPrompt에 색상 코드 가이드가 포함되었을 때
  When 에이전트가 중요도별 정보를 응답하면
  Then 🔴이 중요/긴급 항목에 사용되고
  And 🟡이 참고 항목에 사용되고
  And 🟢이 완료 항목에 사용됨
```
**Verification**: SPEC AC #3

### Scenario 4: Telegram plain text 전송

```gherkin
Scenario: Telegram 응답이 plain text로 전송됨
  Given TelegramBot의 sendResponse()가 호출될 때
  And format이 'text'이면
  When Telegram API에 메시지를 전송하면
  Then parse_mode 파라미터가 생략되고
  And 메시지가 plain text로 전송됨
```
**Verification**: SPEC AC #4

### Scenario 5: CLI 채널은 markdown 유지

```gherkin
Scenario: CLI 채널에서는 기존 markdown 형식이 유지됨
  Given 채널이 "cli"이거나 내부 사용일 때
  When AgentLoop이 format을 결정하면
  Then format이 'markdown'으로 설정되고
  And 기존 코드 블록, 헤더 등 마크다운이 정상 출력됨
```
**Verification**: SPEC AC #5

### Scenario 6: config.json으로 설정 변경

```gherkin
Scenario: config.json의 responseStyle로 format, useEmoji, tone 변경 가능
  Given config.json에 다음 설정이 있을 때:
    """
    {
      "responseStyle": {
        "format": "markdown",
        "useEmoji": false,
        "tone": "formal"
      }
    }
    """
  When 에이전트가 외부 채널에서 응답할 때
  Then format이 "markdown"으로 적용되고
  And 이모지 사용이 비활성화됨
```
**Verification**: SPEC AC #6

### Scenario 7: TypeScript 컴파일

```gherkin
Scenario: 모든 변경 후 TypeScript 컴파일 성공
  Given Phase 7의 모든 코드 변경이 완료되었을 때
  When npx tsc --noEmit을 실행하면
  Then 컴파일 에러가 0건임
```
**Verification**: SPEC AC #7

## Edge Cases

### Scenario 8: Telegram markdown 모드 전환

```gherkin
Scenario: format='markdown' 설정 시 Telegram parse_mode가 'Markdown'으로 변경됨
  Given config.json responseStyle.format이 "markdown"이고
  And 채널이 "telegram"일 때
  When TelegramBot.sendResponse()가 호출되면
  Then parse_mode: 'Markdown'이 설정됨
```

### Scenario 9: Slack mrkdwn 건너뜀

```gherkin
Scenario: format='text'일 때 Slack mrkdwn 변환이 건너뜀
  Given format이 'text'이고
  And 채널이 "slack"일 때
  When SlackBot이 응답을 전송하면
  Then mrkdwn 변환 로직이 실행되지 않고
  And plain text로 전송됨
```

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (마크다운 없음) | ⬜ |
| 2 | AC-2 (이모지 사용) | ⬜ |
| 3 | AC-3 (색상 코드) | ⬜ |
| 4 | AC-4 (Telegram plain text) | ⬜ |
| 5 | AC-5 (CLI markdown 유지) | ⬜ |
| 6 | AC-6 (config 설정) | ⬜ |
| 7 | AC-7 (TypeScript 컴파일) | ⬜ |
| 8 | Edge (Telegram markdown) | ⬜ |
| 9 | Edge (Slack mrkdwn skip) | ⬜ |
