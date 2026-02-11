# language: ko
@sonolbot-v2
Feature: 텔레그램 에이전트 고도화
  소놀봇(mybot_ver2)에서 검증된 운영 패턴을 Vibe 텔레그램 에이전트 파이프라인에 도입한다.
  GPT head 모델 + Telegram 채널 중심으로 5개 Phase를 구현한다.

  Background:
    Given Vibe 텔레그램 에이전트가 GPT head 모델(HeadModelSelector)로 동작한다
    And telegram-assistant-bridge.ts가 ModelARouter + AgentLoop를 사용한다
    And TelegramBot이 polling 방식으로 메시지를 수신한다

  @phase-1
  Scenario: Phase 1 - 실시간 진행률 Telegram 전송
    When AgentLoop에서 AgentProgressEvent가 발생하면
    Then ProgressReporter가 Telegram 메시지를 편집하여 진행 상태를 표시한다
    And TelegramBot.editMessage()로 기존 메시지를 갱신한다
    And 최소 3초 간격으로 rate limit를 준수한다

  @phase-2
  Scenario: Phase 2 - 작업 중 새 메시지 큐잉 + AgentLoop 주입
    When AgentLoop 실행 중 새 메시지가 도착하면
    Then ModelARouter가 pendingMessages에 큐잉한다
    And 다음 iteration에서 conversation에 주입한다
    And process당 최대 3회 injection을 제한한다

  @phase-3
  Scenario: Phase 3 - Activity 기반 timeout + 이중 잠금
    Given Phase 1의 progress 이벤트가 연결되어 있다
    When 10분간 activity가 없으면
    Then stale 프로세스를 정리하고 사용자에게 알린다
    And DevSessionManager.withLock()으로 동시 호출을 직렬화한다

  @phase-4
  Scenario: Phase 4 - 외부 채널 응답 스타일 전환
    When 외부 채널(Telegram/Slack/Web)에서 응답하면
    Then 마크다운 대신 text + 이모지 형식으로 전환한다
    And 코드 블록 포함 시 자동으로 markdown 형식을 사용한다
    And CLI 채널은 기존 markdown을 유지한다

  @phase-5
  Scenario: Phase 5 - 설정 통합 + 레거시 정리
    Given Phase 1-4가 모두 완료되었다
    When 하드코딩된 상수를 constants.ts에 통합하면
    Then config.json 스키마로 런타임 설정이 가능하다
    And telegram-bridge.ts 레거시 파일이 삭제된다
    And 새 config 없이도 기본값으로 정상 동작한다
