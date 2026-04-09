# Lite Team

Dev Team의 축소 버전. 일반 모드에서도 팀 협업을 제공하는 3인 구현 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| architect (리더) | 설계 결정, 시나리오 분석, 구현 방향 조율 | Sonnet |
| implementer | 핵심 비즈니스 로직 구현 | Sonnet |
| tester | 구현 완료 즉시 테스트 작성, 실패 시 피드백 | Haiku |

## 활성화 조건

- 일반 모드 + 3개 이상 시나리오
- 복잡도 점수 8-19 (Medium)
- 단순 구현(1-2 파일, 시나리오 2개 이하)에서는 기존 병렬 모드 유지

## 워크플로우

```
architect: SPEC Phase 분석 → 구현 계획 → TaskList 등록
    |
    ├──→ implementer: claim → 코드 작성
    │       └──→ tester: 완료 즉시 테스트
    │               └── 실패 → implementer 피드백
    |
architect: 시나리오 통과 확인 → 팀 종료
```

## spawn 패턴

```text
TeamCreate(team_name="lite-{feature}", description="Lite implementation team for {feature} Phase {N}")

Task(team_name="lite-{feature}", name="architect", subagent_type="architect",
  prompt="Lite 팀 리더. Phase {N}의 SPEC을 분석하고 구현 계획을 수립하세요.
  SPEC: {spec_content}
  Feature Scenarios: {scenarios}
  역할: 설계 결정, 구현 방향 조율. TaskList에 작업을 등록하세요.
  implementer에게 설계를 SendMessage로 전달하세요.")

Task(team_name="lite-{feature}", name="implementer", subagent_type="implementer",
  mode="bypassPermissions",
  prompt="Lite 팀 코드 담당. SPEC: {spec_content}
  역할: architect의 설계를 따라 프로덕션 코드 작성.
  완료 시 tester에게 SendMessage로 테스트 요청하세요.")

Task(team_name="lite-{feature}", name="tester", subagent_type="tester",
  mode="bypassPermissions",
  prompt="Lite 팀 테스트 담당. SPEC: {spec_content}
  역할: implementer가 완료한 컴포넌트부터 즉시 테스트 작성.
  테스트 실패 시 implementer에게 SendMessage로 피드백하세요.")
```

## 팀원 간 통신

```text
architect → implementer: "API 엔드포인트 3개를 이 순서로 구현해주세요. 설계는 TaskList에 등록했습니다"
implementer → tester: "UserController 구현 완료. CRUD 시나리오 테스트 요청합니다"
tester → implementer: "PUT /users/:id 에서 빈 body 시 500 에러. 입력 검증 추가 필요"
architect → broadcast: "모든 시나리오 통과. 팀 종료합니다"
```

## ⛔ 하지 않는 것

- 보안 심층 리뷰 (Dev Team Full 사용)
- architect 승인 없이 설계 변경
- 테스트 실패 상태에서 다음 작업 진행
