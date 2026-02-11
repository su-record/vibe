# Feature: core-infra - Phase 3: Slack Channel

**SPEC**: `.claude/vibe/specs/core-infra/phase-3-slack.md`
**Master Feature**: `.claude/vibe/features/core-infra/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자 (Slack 워크스페이스 멤버)
**I want** Slack에서 VIBE 에이전트에게 메시지를 보내고 응답 받기
**So that** 업무 중 별도 앱 전환 없이 에이전트를 활용할 수 있다

## Scenarios

### Scenario 1: Socket Mode 연결
```gherkin
Scenario: Slack Socket Mode 연결 성공
  Given SLACK_BOT_TOKEN과 SLACK_APP_TOKEN이 설정됨
  When SlackBot.start() 호출
  Then Socket Mode WebSocket 연결 성공
  And 상태가 'enabled'로 변경
```
**Verification**: SPEC AC #1

### Scenario 2: 채널 메시지 수신 및 처리
```gherkin
Scenario: 허용된 채널에서 메시지 수신
  Given SlackBot이 연결 상태
  And #general 채널이 allowedChannelIds에 포함
  When #general에서 "코드 리뷰해줘" 메시지 수신
  Then ExternalMessage로 변환되어 AgentLoop에 전달
  And AgentLoop 응답이 #general에 전송
```
**Verification**: SPEC AC #2, #3

### Scenario 3: @mention 감지
```gherkin
Scenario: @vibe mention으로 호출
  Given SlackBot이 연결 상태
  When "@vibe 이 코드의 버그를 찾아줘" 메시지 수신
  Then app_mention 이벤트로 처리
  And AgentLoop에 요청 전달
```
**Verification**: SPEC AC #3

### Scenario 4: Thread 대화 추적
```gherkin
Scenario: Thread에서 연속 대화
  Given 이전 메시지에 thread_ts가 있음
  When 같은 thread에서 후속 메시지 수신
  Then 동일 대화 컨텍스트로 처리
  And 응답도 같은 thread에 전송
```
**Verification**: SPEC AC #4

### Scenario 5: 메시지 포맷 변환
```gherkin
Scenario: Markdown → Slack mrkdwn 변환
  Given AgentLoop이 Markdown 응답 생성
  When "**bold** `code` [link](url)" 응답
  Then "*bold* `code` <url|link>"으로 변환되어 전송
```
**Verification**: SPEC AC #5

### Scenario 6: 긴 메시지 분할
```gherkin
Scenario: 4000자 초과 메시지 분할
  Given AgentLoop이 6000자 응답 생성
  When Slack에 전송
  Then 2개 메시지로 분할 (4000자 + 2000자)
  And 순서대로 전송
```
**Verification**: SPEC AC #6

### Scenario 7: Bot 자체 메시지 무시
```gherkin
Scenario: 무한루프 방지
  Given SlackBot이 메시지를 전송
  When 해당 메시지가 이벤트로 수신
  Then bot_id 확인 후 무시
  And AgentLoop에 전달하지 않음
```
**Verification**: SPEC AC #11

### Scenario 8: 비허용 채널 거부
```gherkin
Scenario: 비허용 채널 메시지 무시
  Given #random이 allowedChannelIds에 미포함
  When #random에서 메시지 수신
  Then 메시지 무시 (로그만 기록)
```
**Verification**: SPEC AC #12

### Scenario 9: 파일 첨부 수신 및 처리
```gherkin
Scenario: 사용자가 파일을 첨부하여 전송
  Given SlackBot이 연결 상태
  When 사용자가 screenshot.png (2MB) 파일을 첨부하여 "이 에러 화면 분석해줘" 전송
  Then files.info API로 파일 URL 취득
  And 파일 다운로드 (≤10MB 확인)
  And MediaPreprocessor로 전처리 후 AgentLoop에 전달
```
**Verification**: SPEC AC #7

### Scenario 10: send_slack tool 호출
```gherkin
Scenario: AgentLoop에서 send_slack tool로 Slack 메시지 전송
  Given AgentLoop이 Slack 채널 컨텍스트에서 실행 중
  When send_slack { message: "분석 완료!", channel: "C12345" } tool 호출
  Then AsyncLocalStorage에서 channelId 바인딩 확인
  And chat.postMessage API로 메시지 전송
```
**Verification**: SPEC AC #8, #9

### Scenario 11: Socket Mode 재연결
```gherkin
Scenario: WebSocket 연결 끊김 시 자동 재연결
  Given SlackBot Socket Mode 연결 상태
  When WebSocket 연결이 끊김
  Then 지수 백오프로 재연결 시도 (1s, 2s, 4s, 8s, 16s)
  And 최대 5회 시도
  And 5회 실패 시 에러 로그 기록
```
**Verification**: SPEC AC #10

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1: Socket Mode 연결 | ⬜ |
| 2 | AC-2, AC-3: 메시지 수신/처리 | ⬜ |
| 3 | AC-3: @mention | ⬜ |
| 4 | AC-4: Thread 추적 | ⬜ |
| 5 | AC-5: 포맷 변환 | ⬜ |
| 6 | AC-6: 메시지 분할 | ⬜ |
| 7 | AC-11: Bot 메시지 무시 | ⬜ |
| 8 | AC-12: 비허용 채널 거부 | ⬜ |
| 9 | AC-7: 파일 첨부 수신 | ⬜ |
| 10 | AC-8, AC-9: send_slack tool | ⬜ |
| 11 | AC-10: 재연결 | ⬜ |
