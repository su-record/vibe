# Migration Team

프레임워크/라이브러리 마이그레이션 전문 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| architect (리더) | 마이그레이션 전략 설계, 호환성 분석, 단계별 계획 | Opus |
| implementer | 코드 변환 실행, API 변경 적용 | Sonnet |
| tester | 마이그레이션 후 회귀 테스트, 호환성 검증 | Haiku |
| build-error-resolver | 빌드 에러 즉시 해결, 타입 에러 수정 | Sonnet |

## 활성화 조건

- package.json 주요 의존성 버전 변경 감지 시
- 또는 수동으로 `migration` 키워드 지정 시

## 워크플로우

```
architect: breaking changes 분석 → 단계별 마이그레이션 계획
    |
    ├──→ implementer: 파일 그룹 단위로 코드 변환
    │       ├──→ build-error-resolver: 빌드 에러 즉시 수정
    │       └──→ tester: 각 단계 후 회귀 테스트
    │               ├─ PASS → 다음 파일 그룹
    │               └─ FAIL → implementer에 피드백
    |
architect: 전체 검증 → 마이그레이션 완료 보고
```

## spawn 패턴

```text
TeamCreate(team_name="migration-{feature}", description="Migration team for {feature}")

Task(team_name="migration-{feature}", name="architect", subagent_type="architect",
  prompt="Migration team leader. Plan migration strategy for {feature}.
  From: {current_version}
  To: {target_version}
  Role: Analyze breaking changes. Create step-by-step migration plan.
  Assign file groups to implementer. Monitor build-error-resolver for blockers.")

Task(team_name="migration-{feature}", name="implementer", subagent_type="implementer",
  mode="bypassPermissions",
  prompt="Migration team implementer. Execute code migration for {feature}.
  Role: Apply migration changes per architect plan. Work file-by-file.
  Notify tester after each file group. Report blockers to architect.")

Task(team_name="migration-{feature}", name="tester", subagent_type="tester",
  mode="bypassPermissions",
  prompt="Migration team tester. Verify migration correctness for {feature}.
  Role: Run existing tests after each migration step. Add new tests for changed APIs.
  Report regressions to implementer and architect.")

Task(team_name="migration-{feature}", name="build-error-resolver", subagent_type="build-error-resolver",
  mode="bypassPermissions",
  prompt="Migration team build fixer. Resolve build errors during {feature} migration.
  Role: Monitor build output. Apply minimal-diff type fixes for migration errors.
  Notify implementer of patterns requiring broader changes.")
```

## 팀원 간 통신

```text
architect → implementer: "Step 1: React 18→19 — useEffect cleanup 패턴 변경. src/hooks/ 먼저 처리하세요"
implementer → tester: "src/hooks/ 마이그레이션 완료. 회귀 테스트 요청합니다"
build-error-resolver → implementer: "Type error pattern: React.FC deprecated. 12개 파일에서 동일 패턴"
tester → architect: "3건 실패: useLayoutEffect 경고. SSR 호환성 문제"
architect → broadcast: "마이그레이션 완료. 변경 파일 47개, 회귀 0건"
```

## ⛔ 하지 않는 것

- 마이그레이션과 무관한 리팩터링
- architect 계획 없이 임의 변경
- build-error-resolver가 5% 이상 파일 변경 (최소 diff만)
