# Dev Team

에이전트들이 팀을 이루어 서로 소통하며 구현하는 풀 구현 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| architect (리더) | 설계 결정, 구현 방향 조율, SPEC 준수 검증, 팀 합의 주도 | Opus |
| implementer | 핵심 비즈니스 로직 구현, architect 설계를 따라 코드 작성 | Sonnet |
| tester | 구현 완료 즉시 테스트 작성, 실패 시 implementer에 피드백 | Haiku |
| security-reviewer | 실시간 보안 취약점 검증, 블로킹 이슈 식별 | Sonnet |

## 활성화 조건

- ULTRAWORK 모드 + 3개 이상 시나리오
- 또는 복잡도 점수 20+ (High)

## 워크플로우

```
architect: SPEC Phase 분석 → 구현 계획 수립 → TaskList에 작업 등록
    |
    ├──→ implementer: TaskList에서 claim → 코드 작성
    │       ├──→ tester: 컴포넌트 완료 즉시 테스트 (점진적)
    │       │       └── 실패 시 → implementer에 피드백
    │       └──← security-reviewer: 실시간 보안 검증
    │               └── 블로킹 이슈 → implementer 즉시 수정
    |
architect: 모든 시나리오 통과 확인 → 팀 종료
```

## spawn 패턴

```text
TeamCreate(team_name="dev-{feature}", description="Implementation team for {feature} Phase {N}")

Task(team_name="dev-{feature}", name="architect", subagent_type="architect",
  prompt="구현 팀 리더. Phase {N}의 SPEC을 분석하고 구현 계획을 수립하세요.
  SPEC: {spec_content}
  Feature Scenarios: {scenarios}
  역할: 설계 결정, 구현 방향 조율, 팀원 간 충돌 해결, SPEC 준수 검증.
  TaskList에 구현 작업을 등록하세요. implementer에게 설계를 SendMessage로 전달하세요.
  모든 시나리오가 통과할 때까지 팀을 조율하세요.")

Task(team_name="dev-{feature}", name="implementer", subagent_type="implementer",
  mode="bypassPermissions",
  prompt="구현 팀 코드 담당. SPEC: {spec_content}
  역할: architect의 설계를 따라 프로덕션 코드 작성.
  architect에게서 설계를 받으면 구현을 시작하세요.
  컴포넌트 구현 완료 시 tester에게 SendMessage로 테스트 요청하세요.
  security-reviewer의 블로킹 이슈는 즉시 수정하세요.
  TaskList에서 구현 작업을 claim하세요.")

Task(team_name="dev-{feature}", name="tester", subagent_type="tester",
  mode="bypassPermissions",
  prompt="구현 팀 테스트 담당. SPEC: {spec_content}
  역할: implementer가 완료한 컴포넌트부터 즉시 테스트 작성.
  구현 전체를 기다리지 말고 컴포넌트 단위로 점진적 테스트하세요.
  테스트 실패 시 implementer에게 SendMessage로 피드백하세요.
  edge case 발견 시 architect에게 설계 검토를 요청하세요.
  TaskList에서 테스트 작업을 claim하세요.")

Task(team_name="dev-{feature}", name="security-reviewer", subagent_type="security-reviewer",
  mode="bypassPermissions",
  prompt="구현 팀 보안 담당. SPEC: {spec_content}
  역할: 구현 코드의 보안 취약점 실시간 검증.
  보안 이슈는 BLOCKING — implementer에게 SendMessage로 즉시 수정 요청하세요.
  심각한 설계 결함 발견 시 architect에게 SendMessage로 알리세요.
  TaskList에서 보안 검증 작업을 claim하세요.")
```

## 팀원 간 통신

```text
architect → implementer: "Repository 패턴으로 데이터 접근 계층 분리해서 구현해주세요. 인터페이스는 TaskList에 등록했습니다"
implementer → tester: "LoginService 구현 완료. 정상/실패/잠금 시나리오 테스트 요청합니다"
security-reviewer → implementer: "SQL injection 위험: raw query 사용 감지. parameterized query로 즉시 수정 필요"
tester → architect: "edge case 3건 실패 (빈 입력, 특수문자, 동시 요청). 설계 검토 요청합니다"
architect → broadcast: "Phase {N} 모든 시나리오 통과 확인. 구현 완료합니다"
```

## ⛔ 하지 않는 것

- SPEC 범위 밖의 기능 추가
- architect 승인 없이 설계 변경
- 테스트 실패 상태에서 다음 컴포넌트 진행
- security-reviewer 블로킹 이슈 무시
