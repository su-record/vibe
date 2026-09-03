Feature: Verify Gate Independence
  verifyPassed 가 훅 프로세스가 스스로 실행한 테스트의 exit code 로만 세워지고,
  테스트 명령이 없는 프로젝트는 self-report 등급으로 명시 기록된다.
  SPEC: .vibe/specs/verify-gate-independence.md

  Scenario: 훅이 auto-test 결과와 편집 이벤트를 기록한다
    # → D1
    Given vitest 가 있는 프로젝트에서 vibe.run 이 시작됐다
    When 모델이 테스트 파일이 있는 코드 파일을 편집한다
    Then hook-test-runs.jsonl 에 kind=edit 줄과 kind=auto-test 줄이 순서대로 추가된다

  Scenario: run 시작이 기록을 비운다
    # → D2
    Given hook-test-runs.jsonl 에 이전 run 의 줄이 있다
    When recordRunStart 가 호출된다
    Then 파일이 비어 있다

  Scenario: 독립 실행이 성공하면 independent 등급으로 통과한다
    # → D3, D10
    Given scripts.test 가 exit 0 인 프로젝트다
    When verify-ledger.js pass <runId> 를 실행한다
    Then verifyPassed=true, verifyBasis=independent 가 기록되고 evidence.json 이 1.1.0 스키마다

  Scenario: 모델 results 가 전부 0 이어도 독립 실행이 실패하면 거부된다
    # → D4, D5
    Given scripts.test 가 exit 1 인 프로젝트이고 results.json 이 [{"command":"npm test","exitCode":0}] 이다
    When verify-ledger.js pass <runId> results.json 을 실행한다
    Then verifyPassed 는 false 이고 stdout 에 독립 실행 실패 사유가 있다

  Scenario: 테스트 명령이 없는 프로젝트는 self-report 등급으로 통과한다
    # → D6
    Given package.json 도 vitest/jest 도 verifyGate.command 도 없는 프로젝트다
    When results.json 이 전부 0 인 상태로 pass 를 요청한다
    Then verifyPassed=true, verifyBasis=self-report 가 기록된다

  Scenario: 명령이 있는데 독립 실행을 건너뛰면 거부된다
    # → D7
    Given scripts.test 가 있는 프로젝트다
    When recordVerify(pass) 를 independentRun 없이 호출한다
    Then false 를 반환하고 사유에 independent 가 포함된다

  Scenario: stop 훅이 self-report 등급을 1회 경고한다
    # → D8
    Given verifyPassed=true, verifyBasis=self-report 인 ledger 다
    When Stop 훅이 두 번 실행된다
    Then 첫 번째만 stderr 에 self-report 경고가 나고 basisWarned=true 가 기록된다

  Scenario: verify 이후 편집이 있으면 auto-commit 이 막힌다
    # → D9
    Given verifyPassed=true 이고 verifyAt 이후에 kind=edit 줄이 추가됐다
    When auto-commit 이 실행된다
    Then 커밋 없이 SKIP 하고 사유에 편집된 파일 경로가 있다

  Scenario: 문서가 두 등급을 서술한다
    # → D11
    Given 변경된 CLAUDE.md, loop-contract.md, vibe.verify/vibe.run SKILL.md
    When 문구를 grep 한다
    Then "never by self-report" 는 없고 verifyBasis 는 네 파일 모두에 있다

  Scenario: 릴리스 게이트가 전부 통과한다
    # → D12
    Given 모든 변경이 커밋 가능한 상태다
    When 빌드·vitest·게이트 11종을 실행한다
    Then 전부 exit 0 이다
