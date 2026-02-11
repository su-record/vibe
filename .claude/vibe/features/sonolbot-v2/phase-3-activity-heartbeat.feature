# language: ko
@sonolbot-v2 @phase-3
Feature: Activity Heartbeat + Lock Safety
  장시간 작업 시 비정상 종료 감지 + 동시 실행 방지를 구현한다.
  소놀봇의 working.json + update_working_activity() + 3단계 안전 패턴을 적용한다.

  Background:
    Given Phase 1의 progress 이벤트가 연결되어 있다
    And ModelARouter의 processingChats가 확장되어 있다

  # Phase 3-1: Activity Heartbeat
  @heartbeat
  Scenario: processingChats에 activity 정보 포함
    Given processingChats가 Map<string, { startedAt, lastActivity }>이다
    When 새 process가 시작되면
    Then startedAt과 lastActivity를 Date.now()로 설정한다

  @heartbeat
  Scenario: progress 이벤트 시 lastActivity 갱신
    Given chatId "chat-1"이 processingChats에 있다
    When onProgress 이벤트가 수신되면
    Then lastActivity를 Date.now()로 갱신한다

  @heartbeat @stale
  Scenario: 10분 무활동 시 stale 정리
    Given chatId "chat-1"의 lastActivity가 11분 전이다
    When stale 감지 타이머(60초 주기)가 실행되면
    Then processingChats에서 해당 chatId를 제거한다
    And 사용자에게 stale 알림을 전송한다
    And 에러 로깅만 하고 프로세스를 종료하지 않는다

  @heartbeat @stale
  Scenario: stale 후 pending 메시지 자동 재처리
    Given stale로 정리된 chatId에 pending 메시지가 있다
    When stale 정리 후
    Then 남은 pending 메시지로 새 process를 자동 시작한다

  @heartbeat
  Scenario: bridge 종료 시 타이머 정리
    When bridge가 종료되면
    Then stale 감지 setInterval을 clearInterval한다

  # Phase 3-2: DevSessionManager async mutex
  @mutex
  Scenario: withLock으로 동시 호출 직렬화
    Given DevSessionManager.withLock(key, fn)이 구현되어 있다
    When 동일 key에 대해 2개의 fn이 동시 호출되면
    Then 첫 번째 fn이 완료될 때까지 두 번째 fn이 대기한다
    And 순서대로 실행된다

  @mutex @timeout
  Scenario: lock 대기 30초 timeout
    Given 첫 번째 fn이 35초 이상 실행 중이다
    When 두 번째 fn이 30초 대기 후
    Then timeout 에러를 발생시킨다
    And 강제로 lock을 해제한다

  @mutex
  Scenario: getSession 내부에서 withLock 사용
    When DevSessionManager.getSession()이 호출되면
    Then withLock으로 감싸서 실행한다
    And 동시 getSession 호출이 직렬화된다

  @mutex
  Scenario: 기존 세션 관리 설정 유지
    When withLock이 적용되어도
    Then max concurrent 3 설정이 유지된다
    And idle timeout 2h 설정이 유지된다

  # Phase 3-3: ClaudeCodeBridge running 보호
  @bridge-safety
  Scenario: 중복 start() 방지
    Given ClaudeCodeBridge.running이 true이다
    When start()가 다시 호출되면
    Then 기존 실행 중인 Promise를 반환한다
    And 새 프로세스를 시작하지 않는다

  @bridge-safety
  Scenario: 비정상 종료 시 running = false 보장
    Given ClaudeCodeBridge가 실행 중이다
    When 프로세스가 비정상 종료되면
    Then finally 블록에서 running = false를 설정한다
    And 다음 start() 호출이 정상 동작한다
