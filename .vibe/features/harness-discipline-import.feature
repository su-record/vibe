Feature: harness-discipline-import — dsh 규율 3종 이식
  선언된 저장소 규약을 사람이 지키는 것에서 명령이 판정하는 것으로 옮긴다.
  SPEC: .vibe/specs/harness-discipline-import.md

  # --- (1) SPEC lifecycle 규율 ---

  Scenario: 닫힌 집합 밖 Status 를 거부한다
    # → D3
    Given SPEC 헤더의 Status 가 "COMPLETE" 다
    When validate:spec-lifecycle 를 실행한다
    Then 비정상 종료하고 허용된 5개 값을 출력한다

  Scenario: Class 누락을 거부한다
    # → D3
    Given SPEC 헤더에 Class 줄이 없다
    When validate:spec-lifecycle 를 실행한다
    Then 비정상 종료하고 닫힌 6개 Class 를 출력한다

  Scenario: VERIFIED SPEC 의 죽은 Anchor 를 잡는다
    # → D3
    Given Status 가 VERIFIED 이고 Class 가 feature 인 SPEC 의 Anchors 에 삭제된 경로가 있다
    When validate:spec-lifecycle 를 실행한다
    Then 비정상 종료하고 존재하지 않는 경로를 지목한다

  Scenario: process Class 는 Anchors 를 요구받지 않는다
    # → D2
    Given Status 가 VERIFIED 이고 Class 가 process 인 SPEC 에 Anchors 절이 없다
    When validate:spec-lifecycle 를 실행한다
    Then 정상 종료한다

  Scenario: 저장소의 모든 SPEC 이 규약을 만족한다
    # → D2
    Given 29개 SPEC 파일이 백필된 상태다
    When validate:spec-lifecycle 를 실행한다
    Then 정상 종료하고 검사한 파일 수를 보고한다

  # --- (2) 프리픽스 캐시 표면 ---

  Scenario: 문서에 없는 실물 표면을 잡는다
    # → D4
    Given hooks.json 의 SessionStart 훅이 prefix-cache-surface.md 에 없다
    When validate:cache-surface 를 실행한다
    Then 비정상 종료하고 누락된 훅 이름을 출력한다

  Scenario: 실물 없는 문서 항목을 잡는다
    # → D4
    Given prefix-cache-surface.md 가 존재하지 않는 에이전트를 나열한다
    When validate:cache-surface 를 실행한다
    Then 비정상 종료하고 그 항목을 지목한다

  # --- (3) CLAUDE.md → AGENTS.md 결정론 생성 ---

  Scenario: AGENTS.md 가 CLAUDE.md 와 일치한다
    # → D5
    Given CLAUDE.md 와 규칙 파일이 현재 상태다
    When gen:agents-md:check 를 실행한다
    Then 정상 종료한다

  Scenario: CLAUDE.md 만 수정하면 드리프트로 잡힌다
    # → D5
    Given CLAUDE.md 의 한 줄이 바뀌고 AGENTS.md 는 그대로다
    When gen:agents-md:check 를 실행한다
    Then 비정상 종료하고 재생성 명령을 안내한다

  Scenario: 대상을 잃은 override 규칙을 잡는다
    # → D5
    Given agents-md-rules.json 의 override 하나가 CLAUDE.md 에서 매치되지 않는다
    When gen:agents-md:check 를 실행한다
    Then 비정상 종료하고 그 규칙을 지목한다

  Scenario: 실재하던 번역 드리프트 2건이 사라진다
    # → D6
    Given 생성된 AGENTS.md 가 저장소에 반영됐다
    When 번역 대상 토큰을 grep 한다
    Then "pnpm lint:ratchet" 는 1건 이상이고 "$vibe lint:ratchet" 는 0건이며 Doctrine 절의 디스패처 표기는 "$vibe" 다

  # --- 배선 ---

  Scenario: 세 게이트가 CI 와 로컬 통합 게이트에 배선된다
    # → D7, D8
    Given .github/workflows/test.yml 과 package.json 이 갱신된 상태다
    When test job 의 드리프트 가드 블록과 verify:all 을 확인한다
    Then 세 게이트가 모두 존재하고 npm run verify:all 이 정상 종료한다
