# Refactor Team

안전한 멀티파일 리팩터링을 위한 팀. Characterization test로 현재 동작을 잠그고 변경 후 회귀를 검증한다.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| architect (리더) | 리팩터링 범위 설정, 단계별 계획, 리스크 평가 | Opus |
| refactor-cleaner | 데드코드 탐지, 미사용 export/파일/의존성 분석 | Sonnet |
| implementer | architect 계획에 따라 리팩터링 실행 (파일 단위) | Sonnet |
| tester | Characterization test 작성 + 회귀 테스트 실행 | Haiku |

## 활성화 조건

- `/vibe.run refactor` 수동 트리거
- complexity-reviewer가 동일 모듈에서 P2 이슈 5개 이상 발견 시 제안

## 워크플로우

```
architect: 대상 모듈 분석, 리팩터링 범위 + 리스크 평가
    |
refactor-cleaner: knip/depcheck/ts-prune → 데드코드 스캔 결과
    |
tester: characterization test 작성 (현재 동작 잠금, 변경 전)
    |
architect: 스캔 결과 + 테스트 커버리지 검토 → 단계별 리팩터링 계획
    |
implementer: 파일 단위 리팩터링 실행
    │   각 파일마다:
    │   ├──→ tester: characterization test 실행
    │   │       ├─ PASS → 다음 파일
    │   │       └─ FAIL → implementer 롤백 → architect 재계획
    |
architect: 최종 검증, before/after 메트릭 비교, 요약 작성
```

## spawn 패턴

```text
TeamCreate(team_name="refactor-{module}", description="Safe refactoring team for {module}")

Task(team_name="refactor-{module}", name="architect", subagent_type="architect",
  prompt="리팩터링 팀 리더. 대상 모듈을 분석하고 안전한 리팩터링 계획을 수립하세요.
  대상: {target_path}
  목표: {refactor_goal}
  역할: 범위 설정, 리스크 평가, 단계별 계획. refactor-cleaner에게 스캔을 요청하세요.
  tester가 characterization test를 작성할 때까지 구현을 시작하지 마세요.
  각 단계 후 tester 결과를 확인하고 다음 단계를 승인하세요.")

Task(team_name="refactor-{module}", name="refactor-cleaner", subagent_type="refactor-cleaner",
  prompt="리팩터링 팀 분석 담당. 대상: {target_path}
  역할: knip/depcheck/ts-prune으로 데드코드, 미사용 export, 불필요 의존성 탐지.
  스캔 결과를 architect에게 SendMessage로 전달하세요.
  DELETION_LOG.md에 삭제 대상을 기록하세요.")

Task(team_name="refactor-{module}", name="implementer", subagent_type="implementer",
  mode="bypassPermissions",
  prompt="리팩터링 팀 구현 담당. 대상: {target_path}
  역할: architect의 계획에 따라 파일 단위로 리팩터링 실행.
  각 파일 수정 후 tester에게 SendMessage로 테스트 요청하세요.
  테스트 실패 시 즉시 롤백하고 architect에게 알리세요.")

Task(team_name="refactor-{module}", name="tester", subagent_type="tester",
  mode="bypassPermissions",
  prompt="리팩터링 팀 테스트 담당. 대상: {target_path}
  역할: 1) 리팩터링 전 characterization test 작성 (현재 동작 잠금).
  2) 각 파일 수정 후 회귀 테스트 실행.
  실패 시 implementer에게 SendMessage로 즉시 알리세요.
  architect에게 테스트 커버리지 현황을 보고하세요.")
```

## 팀원 간 통신

```text
architect → refactor-cleaner: "src/services/ 모듈 스캔 요청. 미사용 export와 데드코드를 찾아주세요"
refactor-cleaner → architect: "미사용 export 12개, 데드파일 3개, 미사용 의존성 2개 발견"
architect → tester: "src/services/auth.ts의 현재 동작을 characterization test로 잠그세요"
tester → architect: "auth.ts 커버리지 94%. 리팩터링 진행 가능합니다"
architect → implementer: "Step 1: auth.ts에서 미사용 export 4개 제거. 계획 참조하세요"
implementer → tester: "auth.ts 수정 완료. 회귀 테스트 요청합니다"
tester → implementer: "1건 실패: validateToken() 시그니처 변경으로 호출부 깨짐"
implementer → architect: "호출부 수정 필요. 영향 범위: 3파일"
architect → broadcast: "리팩터링 완료. 복잡도 42→28, 데드코드 15개 제거, 테스트 전체 통과"
```

## ⛔ 하지 않는 것

- characterization test 없이 리팩터링 시작
- 테스트 실패 상태에서 다음 파일 진행
- architect 승인 없이 범위 확대
- 기능 추가/변경 (구조 개선만)
- refactor-cleaner가 코드 수정 (탐지/리포트만)
