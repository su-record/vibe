# language: ko
@sonolbot-v2 @phase-1
Feature: 실시간 진행률 Telegram 전송
  AgentLoop의 기존 AgentProgressEvent를 Telegram 실시간 메시지 편집으로 연결한다.
  소놀봇의 진행률 보고(10% -> 40% -> 70% -> 완료) UX를 구현한다.

  Background:
    Given TelegramBot이 polling 모드로 실행 중이다
    And telegram-assistant-bridge.ts가 AgentLoop를 초기화했다

  # Phase 1-1: TelegramBot.editMessage()
  @telegram-api
  Scenario: TelegramBot에 editMessage 메서드 추가
    Given TelegramBot 인스턴스가 존재한다
    When editMessage(chatId, messageId, text, parseMode)를 호출하면
    Then Telegram API POST /bot{token}/editMessageText를 호출한다
    And API 실패 시 에러를 로깅만 하고 throw하지 않는다

  @telegram-api
  Scenario: sendResponse가 message_id를 반환
    Given sendResponse()가 호출되면
    When Telegram API 응답에 result.message_id가 있으면
    Then Promise<number | undefined>로 message_id를 반환한다
    And 기존 호출부의 하위 호환성이 유지된다

  # Phase 1-2: ProgressReporter 서비스
  @progress-reporter
  Scenario: job:created 이벤트 처리
    Given ProgressReporter 인스턴스가 chatId와 연결되어 있다
    When AgentProgressEvent type이 "job:created"이면
    Then TelegramBot.sendResponse()로 새 메시지를 전송한다
    And 메시지 내용은 "작업을 시작합니다"이다
    And 반환된 message_id를 내부 상태에 저장한다

  @progress-reporter
  Scenario: job:progress (tool_start) 이벤트 처리
    Given ProgressReporter에 이전 message_id가 저장되어 있다
    When AgentProgressEvent type이 "job:progress"이고 subType이 "tool_start"이면
    Then stepCount를 증가시킨다
    And TelegramBot.editMessage()로 "{stepCount}단계: {toolName} 실행 중..." 메시지를 편집한다

  @progress-reporter
  Scenario: job:progress (tool_end) 이벤트 처리
    Given 이전 tool_start 이벤트가 처리되었다
    When AgentProgressEvent type이 "job:progress"이고 subType이 "tool_end"이면
    Then TelegramBot.editMessage()로 "{stepCount}단계 완료" 메시지를 편집한다

  @progress-reporter
  Scenario: job:complete 이벤트 처리
    Given 작업이 정상 완료되었다
    When AgentProgressEvent type이 "job:complete"이면
    Then TelegramBot.editMessage()로 "완료!" 메시지를 편집한다

  @progress-reporter
  Scenario: job:error 이벤트 처리
    When AgentProgressEvent type이 "job:error"이면
    Then TelegramBot.editMessage()로 "오류 발생" 메시지를 편집한다

  @progress-reporter @rate-limit
  Scenario: 편집 최소 간격 3초 준수
    Given 마지막 메시지 편집이 1초 전에 발생했다
    When 새 progress 이벤트가 도착하면
    Then 편집을 건너뛴다
    And 3초 경과 후 다음 이벤트에서 편집한다

  @progress-reporter
  Scenario: job:chunk 이벤트 무시
    When AgentProgressEvent type이 "job:chunk"이면
    Then 아무 동작도 하지 않는다

  # Phase 1-3: Bridge 연결
  @bridge
  Scenario: telegram-assistant-bridge에서 ProgressReporter 연결
    Given telegram-assistant-bridge.ts에서 AgentLoop을 초기화한다
    When ProgressReporter 인스턴스를 생성하면
    Then agentLoop.setOnProgress(reporter.handleProgressEvent)를 호출한다
    And progress 이벤트가 Telegram으로 전달된다

  # Phase 1-4: MediaPreprocessor 사진 확인
  @media
  Scenario: 사진 파일 처리 시 확인 메시지
    Given 사용자가 사진을 전송했다
    When processPhotoFile()이 시작되면
    Then "이미지 분석 중..." 메시지를 전송한다
    And 분석 완료 후 "이미지 분석 완료!" 메시지를 전송한다
