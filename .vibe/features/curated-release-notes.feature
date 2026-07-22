Feature: Curated Release Notes
  태그 릴리즈가 SPEC과 git history를 근거로 상세한 사용자 관점 본문을 발행한다.
  # Last verified: 2026-07-20T19:53:43Z — 5/5 scenarios, RTM 100%

  # ### Scenario 1: SPEC 기반 Highlights를 생성한다
  # **Verification**: REQ-release-notes-001, REQ-release-notes-002
  Scenario: SPEC 기반 Highlights를 생성한다
    Given 직전 semantic tag 이후 execution packet SPEC이 추가됐다
    When 현재 태그의 릴리즈 노트를 생성한다
    Then SPEC Overview와 REQ 설명이 Highlights에 포함된다
    And log 태그는 비교 기준으로 선택되지 않는다

  # ### Scenario 2: 커밋을 사용자 관점 섹션으로 분류한다
  # **Verification**: REQ-release-notes-003
  Scenario: 커밋을 사용자 관점 섹션으로 분류한다
    Given feat, fix, docs, refactor, chore와 breaking 커밋이 있다
    When 릴리즈 노트를 생성한다
    Then 각 커밋은 대응 섹션에 한 번만 나타난다
    And merge와 버전 전용 커밋은 제외된다

  # ### Scenario 3: 태그 워크플로가 생성된 본문을 발행한다
  # **Verification**: REQ-release-notes-004
  Scenario: 태그 워크플로가 생성된 본문을 발행한다
    Given v* 태그가 push됐다
    When release workflow가 실행된다
    Then 전체 git history로 릴리즈 노트 파일을 생성한다
    And GitHub Release는 해당 파일을 본문으로 사용한다

  # ### Scenario 4: 기존 v3.2.1 릴리즈를 보강한다
  # **Verification**: REQ-release-notes-005
  Scenario: 기존 v3.2.1 릴리즈를 보강한다
    Given 현재 릴리즈 본문이 PR 제목 두 줄뿐이다
    When 상세 릴리즈 노트를 적용한다
    Then Highlights, Added, Fixed, Verification이 공개 본문에 존재한다

  # ### Scenario 5: 저장소 품질 게이트를 유지한다
  # **Verification**: REQ-release-notes-006
  Scenario: 저장소 품질 게이트를 유지한다
    Given 릴리즈 자동화가 변경됐다
    When build와 전체 테스트를 실행한다
    Then 모든 결정론적 게이트가 통과한다
