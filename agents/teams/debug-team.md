# Debug Team

빌드/테스트 실패 시 아키텍트 진단 → 구현자 수정 → 테스터 검증 사이클.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| architect (리더) | 근본 원인 진단, 수정 방향 설계, 아키텍처 레벨 문제 식별 | Opus |
| implementer | architect 진단에 따라 최소 diff 수정 적용 | Sonnet |
| tester | 수정 후 즉시 테스트 실행, 회귀 검증 | Haiku |

## 활성화 조건

- 동일 빌드/테스트 실패 3회 이상
- UltraQA `architecture_question` 상태 진입 시

## 워크플로우

```
[입력: 에러 출력 + 실패 파일 + 이전 시도 이력]
    |
architect: 근본 원인 분석 (증상이 아닌 원인)
    |
    └──→ implementer: 최소 diff 수정
            └──→ tester: 테스트 실행
                    ├─ PASS → 완료
                    └─ FAIL → architect 재진단 (3회 실패 → 사용자 에스컬레이션)
```

## spawn 패턴

```text
TeamCreate(team_name="debug-{feature}", description="Debug team for {feature} build/test failure")

Task(team_name="debug-{feature}", name="architect", subagent_type="architect",
  prompt="Debug team leader. Diagnose root cause of build/test failure.
  Error: {error_output}
  Failed files: {failed_files}
  Previous attempts: {attempt_history}
  Role: Analyze error, identify root cause (not symptoms). Design minimal fix.
  Send diagnosis to implementer via SendMessage. If same failure 3x, escalate to user.")

Task(team_name="debug-{feature}", name="implementer", subagent_type="implementer",
  mode="bypassPermissions",
  prompt="Debug team fixer. Apply minimal-diff fixes based on architect diagnosis.
  Role: Wait for architect diagnosis. Apply ONLY the specific fix recommended.
  Do NOT refactor surrounding code. Notify tester when fix is applied.")

Task(team_name="debug-{feature}", name="tester", subagent_type="tester",
  mode="bypassPermissions",
  prompt="Debug team verifier. Run tests after each fix to verify resolution.
  Role: Wait for implementer fix notification. Run failing tests.
  Report results to architect. If still failing, provide detailed error output.")
```

## 팀원 간 통신

```text
architect → implementer: "근본 원인: circular import in module A→B→A. B의 import를 lazy로 변경하세요"
implementer → tester: "수정 완료. 기존 실패 테스트 재실행 요청합니다"
tester → architect: "여전히 실패. 새로운 에러: TypeError at line 42"
architect → broadcast: "3회 실패. 사용자 에스컬레이션이 필요합니다"
```

## ⛔ 하지 않는 것

- 주변 코드 리팩터링 (최소 diff만)
- 증상 치료 (근본 원인 해결만)
- 4회 이상 자동 재시도 (3회 실패 → 사용자 에스컬레이션)
