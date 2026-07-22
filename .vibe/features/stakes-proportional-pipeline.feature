Feature: Stakes-proportional pipeline execution
  vibe 파이프라인이 태스크 무게(stakes)를 분류해 실행 깊이를 비례시킨다.
  production 기본 동작은 불변이다.

  # REQ-stakes-001 / D1, D2
  Scenario: demo 태스크는 경량 프로파일로 실행된다
    Given 요구사항에 "데모용 일회성 사이트"가 포함되고 대상이 임시 폴더이다
    When /vibe 가 intent 를 분류한다
    Then stakes 는 demo 로 판정된다
    And 실행 계획에 max_iterations=1, 리뷰 1패스, 검증 스크립트 신규 생성 금지가 명시된다

  # REQ-stakes-002 / D3
  Scenario: stakes 불확실 시 SPEC 승인 게이트에 질문이 편승한다
    Given stakes 판정 신호가 상충한다
    When SPEC 승인 메시지를 제시한다
    Then 승인 선택지에 stakes 확인 질문 1개가 포함된다
    And 별도의 추가 확인 왕복은 발생하지 않는다

  # REQ-stakes-003 / D4
  Scenario: 신규 검증 코드가 신규 구현 코드를 초과하면 P2 경고
    Given 이번 feature 의 신규 검증 코드 바이트 합이 신규 구현 코드 바이트 합을 초과한다
    When JUDGE 가 게이트를 판정한다
    Then P2 경고가 기록된다
    And 게이트 통과 여부는 변하지 않는다

  # REQ-stakes-004 / D5
  Scenario: 경량 stakes 에서 리뷰어가 2종으로 축소된다
    Given stakes 가 demo 이고 변경 파일이 5개 이하이다
    When vibe.review 가 리뷰어를 기동한다
    Then correctness 와 security 2종만 기동된다

  # REQ-stakes-005 / D6
  Scenario: production stakes 는 기존 동작과 동일하다
    Given stakes 가 production 이거나 판정 신호가 없다
    When 파이프라인이 실행된다
    Then 기존 기본 리뷰어 셋과 수렴 루프가 그대로 적용된다
