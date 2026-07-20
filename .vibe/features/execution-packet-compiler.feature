Feature: Execution Packet Compiler
  승인된 SPEC을 하네스별 실행 패킷으로 안전하게 컴파일한다.

  Scenario: Canonical SPEC을 Codex execution packet으로 컴파일한다
    Given 승인된 SPEC에 REQ, 제약, Done Criteria와 Evidence Required가 있다
    When codex 프로파일로 execution packet을 컴파일한다
    Then packet은 원본 해시와 source pointer를 포함한다
    And 선택된 모든 결정론 계약을 손실 없이 포함한다

  Scenario: Claude Code 프로파일도 동일한 핵심 계약을 보존한다
    Given 동일한 승인 SPEC이 있다
    When codex와 claude-code 프로파일로 각각 컴파일한다
    Then 프로파일별 실행 메타데이터는 다를 수 있다
    But REQ, 제약, Done Criteria와 Evidence Required 집합은 동일하다

  Scenario: 압축 과정의 계약 손실을 차단한다
    Given criterion의 Evidence Required가 없거나 알 수 없는 REQ를 참조한다
    When preservation audit을 실행한다
    Then 구조화된 오류 코드와 누락된 source pointer를 반환한다
    And packet을 생성하지 않는다

  Scenario: context budget 초과를 명시적으로 처리한다
    Given 컴파일 결과가 대상 프로파일의 context budget을 초과한다
    When packet을 컴파일한다
    Then REQ 경계에서 deterministic split하거나 구조화된 초과 오류를 반환한다
    And 문자열을 조용히 절단하지 않는다

  Scenario: stale packet 실행을 거부한다
    Given packet의 canonical SPEC 해시가 현재 SPEC과 다르다
    When vibe.run이 실행 입력을 고정한다
    Then stale packet을 사용하지 않는다
    And 재컴파일 필요 상태를 명시한다
