# language: ko
@sonolbot-v2 @phase-4
Feature: 외부 채널 응답 스타일 전환
  외부 채널(Telegram/Slack/Web) 응답을 가독성 + 이모지 중심으로 전환한다.
  12flow-write 원칙 적용: 역피라미드, 색상 코드, 대화체.

  Background:
    Given AgentLoop이 GPT head 모델로 응답을 생성한다
    And TelegramBot이 응답을 사용자에게 전송한다

  # Phase 4-1: SystemPrompt 스타일 가이드
  @style-guide
  Scenario: 외부 채널용 스타일 가이드 적용
    Given SystemPromptConfig.channel이 "telegram"이다
    When buildSystemPrompt()가 호출되면
    Then 외부 채널용 스타일 가이드가 system prompt에 포함된다
    And 마크다운 문법 최소 사용을 지시한다
    And 이모지로 시각적 구분을 지시한다
    And 짧은 문장 + 줄바꿈을 지시한다

  @style-guide
  Scenario: 색상 코드 이모지 지시
    Given 외부 채널용 스타일 가이드가 적용되었다
    Then 중요 항목에 빨간 원을 사용하도록 지시한다
    And 참고 항목에 노란 원을 사용하도록 지시한다
    And 완료 항목에 초록 원을 사용하도록 지시한다

  @style-guide
  Scenario: CLI 채널에서 스타일 가이드 미적용
    Given SystemPromptConfig.channel이 설정되지 않았다
    When buildSystemPrompt()가 호출되면
    Then 외부 채널용 스타일 가이드가 포함되지 않는다
    And 기존 markdown 형식이 유지된다

  # Phase 4-2: AgentLoop format 동적 전환
  @format
  Scenario: 외부 채널 기본 format은 text
    Given AgentLoopConfig.responseFormat이 "text"이다
    When 응답을 생성하면
    Then format이 "text"로 설정된다

  @format
  Scenario: CLI 채널 기본 format은 markdown
    Given AgentLoopConfig.responseFormat이 설정되지 않았다
    When 응답을 생성하면
    Then format이 "markdown"으로 설정된다

  @format @code-block
  Scenario: 코드 블록 포함 시 자동 markdown 전환
    Given responseFormat이 "text"이다
    When 응답 content에 코드 블록(```)이 포함되어 있으면
    Then 해당 메시지만 format을 "markdown"으로 전환한다

  @format @code-block
  Scenario: 코드 블록 미포함 시 text 유지
    Given responseFormat이 "text"이다
    When 응답 content에 코드 블록이 없으면
    Then format이 "text"를 유지한다

  # Phase 4-3: TelegramBot parse_mode 분기
  @parse-mode
  Scenario: format text일 때 parse_mode 생략
    Given ExternalResponse.format이 "text"이다
    When TelegramBot.sendResponse()가 호출되면
    Then Telegram API에 parse_mode를 전송하지 않는다

  @parse-mode
  Scenario: format markdown일 때 parse_mode Markdown
    Given ExternalResponse.format이 "markdown"이다
    When TelegramBot.sendResponse()가 호출되면
    Then parse_mode를 "Markdown"으로 설정한다

  @parse-mode
  Scenario: format html일 때 parse_mode HTML
    Given ExternalResponse.format이 "html"이다
    When TelegramBot.sendResponse()가 호출되면
    Then parse_mode를 "HTML"으로 설정한다

  # Phase 4-4: Bridge 채널 정보 전달
  @bridge-config
  Scenario: telegram-assistant-bridge에서 채널 정보 설정
    When telegram-assistant-bridge.ts에서 AgentLoop을 초기화하면
    Then systemPromptConfig.channel을 "telegram"으로 설정한다
    And responseFormat을 "text"로 설정한다
