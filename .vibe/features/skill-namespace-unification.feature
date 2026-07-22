Feature: Skill Namespace Unification
  Vibe가 소유한 모든 내장 스킬을 단일 vibe namespace로 제공한다.

  Scenario: 모든 내장 스킬을 Vibe namespace로 식별한다
    Given 외부 discovery 설치 대상 스킬을 전수 검사한다
    When 설치 이름과 frontmatter name을 수집한다
    Then 모든 외부 이름은 vibe 또는 vibe.로 시작한다
    And 디렉터리명과 frontmatter name이 일치하며 중복이 없다

  Scenario: wrapper와 내부 본체를 충돌 없이 연결한다
    Given vibe.spec 공개 wrapper와 spec 내부 본체가 있다
    When 두 스킬을 통합한다
    Then vibe.spec 하나만 남는다
    And 별도 core 스킬은 외부에 노출되지 않는다

  Scenario: 설치 대상에 bare Vibe 이름을 남기지 않는다
    Given 전역, optional, stack, capability 설치 목록과 기존 설치 디렉터리가 있다
    When postinstall 또는 update가 실행된다
    Then Vibe 소유 설치 이름은 모두 namespace 규칙을 따른다
    And 소유권이 확인된 legacy bare 디렉터리만 제거된다

  Scenario: 카탈로그와 호출 검증이 dotted 이름을 보존한다
    Given 통합된 vibe.spec 체인 참조가 있다
    When 카탈로그와 invocation validator를 실행한다
    Then 전체 dotted 이름이 정확히 라우팅된다
    And Vibe-owned unrouted 항목은 없다

  Scenario: 공개 문서와 품질 게이트를 유지한다
    Given namespace migration이 완료됐다
    When 문서 계약, build, 전체 테스트와 검증 명령을 실행한다
    Then bare Vibe 직접 호출 예시는 없다
    And 모든 결정론적 게이트가 통과한다
