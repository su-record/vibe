# language: ko
@sonolbot-v2 @phase-2
Feature: 작업 중 메시지 큐잉 + AgentLoop 주입
  ModelARouter에 메시지 큐를 추가하고 AgentLoop 실행 중 도착한 새 메시지를
  현재 실행에 주입한다. 소놀봇의 check_new_messages_during_work() 패턴을 적용한다.

  Background:
    Given ModelARouter가 초기화되어 있다
    And AgentLoop이 GPT head 모델로 동작한다

  # Phase 2-1: ModelARouter 메시지 큐
  @message-queue
  Scenario: AgentLoop 실행 중 새 메시지 큐잉
    Given chatId "chat-1"에서 AgentLoop이 실행 중이다
    When 동일 chatId에서 새 메시지가 도착하면
    Then pendingMessages에 push한다
    And 사용자에게 "새 요청 확인" 알림을 전송한다

  @message-queue
  Scenario: AgentLoop 미실행 시 즉시 처리
    Given chatId "chat-2"에서 AgentLoop이 실행 중이 아니다
    When 새 메시지가 도착하면
    Then processingChats에 chatId를 추가한다
    And AgentLoop.process()를 즉시 호출한다
    And process 완료 후 processingChats에서 chatId를 제거한다

  @message-queue @limit
  Scenario: chatId당 큐 최대 10개 제한
    Given chatId "chat-1"의 pendingMessages에 10개가 적재되어 있다
    When 11번째 메시지가 도착하면
    Then 가장 오래된 메시지를 제거하고 새 메시지를 추가한다

  @message-queue @ttl
  Scenario: 큐 메시지 TTL 5분 만료
    Given pendingMessages에 5분 이상 된 메시지가 있다
    When drainPendingMessages()를 호출하면
    Then TTL 만료된 메시지는 제외한다

  # Phase 2-2: AgentLoop pending drain
  @injection
  Scenario: iteration 시작 시 pending 메시지 주입
    Given AgentLoop.process()에 drainPendingFn이 전달되었다
    And pendingMessages에 메시지가 1개 있다
    When runLoop의 다음 iteration이 시작되면
    Then drainPendingFn()을 호출하여 pending 메시지를 가져온다
    And conversation에 "[사용자 추가 요청]" 구분자와 함께 user 메시지로 주입한다

  @injection @limit
  Scenario: process당 최대 3회 injection 제한
    Given 이미 3회 injection이 수행되었다
    When 다음 iteration에서 pending이 있어도
    Then injection을 수행하지 않는다
    And pending 메시지는 큐에 남긴다

  @injection @backward-compat
  Scenario: drainPendingFn 없이 기존 동작 유지
    Given AgentLoop.process()에 drainPendingFn이 전달되지 않았다
    When runLoop가 실행되면
    Then injection 없이 기존 flow를 유지한다
    And MAX_ITERATIONS(10) 제한도 그대로 적용된다

  @injection
  Scenario: injection이 iteration을 소비하지 않음
    Given MAX_ITERATIONS가 10이다
    When injection이 발생해도
    Then iteration 카운트가 증가하지 않는다

  # Phase 2-3: 연결 + 후속 처리
  @drain
  Scenario: process 완료 후 남은 pending 자동 재처리
    Given process()가 완료되었다
    And pendingMessages에 남은 메시지가 있다
    When finally 블록이 실행되면
    Then 남은 pending으로 새 process()를 자동 시작한다

  @drain
  Scenario: handleMessage에서 drainPendingFn 전달
    When handleMessage()에서 process()를 호출할 때
    Then drainPendingMessages(chatId)를 drainPendingFn으로 전달한다

  @drain @media
  Scenario: pending 메시지의 파일 첨부 처리
    Given pending 메시지에 FileAttachment가 포함되어 있다
    When injection 전에
    Then MediaPreprocessor로 먼저 처리한다
