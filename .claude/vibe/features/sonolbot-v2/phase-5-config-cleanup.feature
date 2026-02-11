# language: ko
@sonolbot-v2 @phase-5
Feature: 설정 통합 + 레거시 정리
  Phase 1-4에서 추가된 상수/설정을 constants.ts와 config.json으로 통합하고,
  레거시 코드를 정리한다.

  Background:
    Given Phase 1-4가 모두 완료되었다
    And constants.ts에 CONCURRENCY 객체가 존재한다

  # Phase 5-1: constants.ts 통합
  @constants
  Scenario: Phase 1-4 상수를 constants.ts에 통합
    When constants.ts를 업데이트하면
    Then PROGRESS_MIN_INTERVAL_MS가 3000으로 추가된다
    And MAX_PENDING_MESSAGES가 10으로 추가된다
    And PENDING_MESSAGE_TTL_MS가 300000으로 추가된다
    And MAX_INJECTION_PER_PROCESS가 3으로 추가된다
    And ACTIVITY_TIMEOUT_MS가 600000으로 추가된다
    And STALE_CHECK_INTERVAL_MS가 60000으로 추가된다
    And LOCK_WAIT_TIMEOUT_MS가 30000으로 추가된다
    And DEFAULT_EXTERNAL_FORMAT이 "text"로 추가된다

  @constants
  Scenario: 기존 constants.ts 값 변경 없음
    When Phase 1-4 상수를 추가해도
    Then 기존 CONCURRENCY 객체의 값은 변경되지 않는다

  # Phase 5-2: config.json 스키마
  @config
  Scenario: RouterConfig에 responseStyle 추가
    When RouterConfig를 확장하면
    Then responseStyle.format이 optional "text"이다
    And responseStyle.useEmoji가 optional true이다
    And responseStyle.allowMarkdownForCode가 optional true이다

  @config
  Scenario: RouterConfig에 messaging 추가
    When RouterConfig를 확장하면
    Then messaging.progressMinIntervalMs가 optional 3000이다
    And messaging.activityTimeoutMs가 optional 600000이다

  @config @backward-compat
  Scenario: 새 config 없이 기본값으로 동작
    Given config.json에 responseStyle과 messaging이 없다
    When 애플리케이션이 시작되면
    Then constants.ts의 기본값으로 fallback한다
    And 기존 동작과 동일하게 작동한다

  @config
  Scenario: Phase 1-4 하드코딩 값을 config/constants 참조로 교체
    When Phase 1-4 코드의 하드코딩 값을 교체하면
    Then config 값이 있으면 config를 사용한다
    And config 값이 없으면 constants 기본값을 사용한다

  # Phase 5-3: 레거시 정리
  @legacy
  Scenario: telegram-bridge.ts 삭제
    Given telegram-bridge.ts가 레거시 파일이다
    And telegram-assistant-bridge.ts가 현재 아키텍처의 bridge이다
    When telegram-bridge.ts를 삭제하면
    Then 파일이 존재하지 않는다
    And import 참조가 없다

  @legacy
  Scenario: CLI에서 telegram-bridge 참조 제거
    Given src/cli/index.ts에 telegram-bridge 참조가 있을 수 있다
    When 참조를 확인하고 제거하면
    Then telegram-bridge 관련 import가 없다
    And 컴파일 에러가 없다

  # Phase 5-4: 통합 검증
  @verification
  Scenario: TypeScript 컴파일 성공
    When npx tsc --noEmit를 실행하면
    Then 컴파일 에러가 0개이다

  @verification
  Scenario: 빌드 성공
    When npm run build를 실행하면
    Then 빌드가 성공한다

  @verification
  Scenario: 기존 테스트 통과
    When pnpm test를 실행하면
    Then 기존 테스트가 모두 통과한다
