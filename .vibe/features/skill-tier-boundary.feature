Feature: Skill Tier Boundary
  코딩 루프와 무관한 스킬 19개를 skills-extra/ 로 옮겨 저장소 트리·플러그인 트리·개수 주장에서
  코어 33개가 보이게 한다. 배치는 상수 SSOT 와 테스트가 대조한다.
  SPEC: .vibe/specs/skill-tier-boundary.md

  Scenario: 디렉토리 배치가 티어 상수와 일치한다
    # → D1, D2
    Given skills/ 와 skills-extra/ 에 SKILL.md 디렉토리가 있다
    When 두 디렉토리 집합을 GLOBAL_SKILLS ∪ STACK 전개 · EXTRA_SKILLS 와 비교한다
    Then 각각 정확히 일치하고 교집합이 없다

  Scenario: educational-content 가 education capability 로 옮겨간다
    # → D3
    Given constants.ts 를 읽는다
    When GLOBAL_SKILLS_STANDARD · CAPABILITY_SKILLS · AVAILABLE_CAPABILITIES 를 확인한다
    Then STANDARD 에는 없고 CAPABILITY_SKILLS.education 과 AVAILABLE_CAPABILITIES 에 있다

  Scenario: 로컬 설치가 두 루트에서 복사한다
    # → D4
    Given 임시 프로젝트와 스택 typescript-react, capability education 이다
    When installLocalSkills 를 호출한다
    Then .claude/skills 에 vibe.figma 와 vibe.educational-content 가 둘 다 있다

  Scenario: upgrade 가 extras 루트와 비교해 내려온 전역 스킬을 정리한다
    # → D5, D6
    Given ~/.claude/skills 에 미수정 vibe.educational-content 가 설치돼 있다
    When 두 루트의 배송 이름으로 demotion 을 구하고 cleanupOptionalSkills 를 부른다
    Then vibe.educational-content 가 removed 로 기록된다

  Scenario: 플러그인 트리에는 코어만 굽는다
    # → D7
    Given package.json files 에 skills-extra/ 가 있다
    When npm run build:plugin 을 실행한다
    Then plugins/vibe/skills-extra 가 없고 plugins/vibe/skills 는 skills/ 와 개수가 같다

  Scenario: npm 패키지에는 extras 가 실린다
    # → D8
    Given package.json files 에 skills-extra/ 가 있다
    When npm pack --dry-run 을 실행한다
    Then skills-extra/ 파일이 목록에 있다

  Scenario: 개수 주장이 코어를 앞세우고 검사된다
    # → D9
    Given README.md · README.en.md · package.json 이 갱신됐다
    When npm run validate:counts 를 실행한다
    Then 코어 33 / extras 19 주장 5종이 전부 일치해 exit 0 이다

  Scenario: 카탈로그가 Extras 절을 낸다
    # → D10
    Given gen-skill-docs 가 두 루트를 읽는다
    When npm run gen:skill-docs 를 실행한다
    Then SKILL-CATALOG.md 에 Extras 절과 Core: 33 · Extras: 19 가 있다

  Scenario: 무결성 검사가 extras 를 놓치지 않는다
    # → D11
    Given wiring-integrity 가 두 루트를 훑는다
    When F2 가 읽은 SKILL.md 경로 집합을 본다
    Then skills/ 와 skills-extra/ 각각에서 최소 1개가 있다

  Scenario: 릴리스 게이트가 전부 통과한다
    # → D12
    Given 모든 변경이 커밋 가능한 상태다
    When 빌드·vitest·게이트 12종을 실행한다
    Then 전부 exit 0 이다
