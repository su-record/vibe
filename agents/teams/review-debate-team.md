# Review Debate Team

개별 리뷰어의 발견을 팀으로 토론하여 우선순위를 검증하고 오탐을 제거하는 교차 검증 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| security-reviewer (리더) | P1/P2 이슈 종합, 보안 이슈 최종 판정, 합의 주도 | Sonnet |
| architecture-reviewer | 구조적 영향 평가, 숨겨진 결합도 식별 | Sonnet |
| performance-reviewer | 성능 영향 평가, 부하 시나리오 검증 | Sonnet |
| simplicity-reviewer | 과잉 설계 지적, 더 단순한 대안 제시, 오탐 식별 | Sonnet |

## 활성화 조건

- P1 또는 P2 이슈 2개 이상 발견 시 자동 활성화
- Agent Teams 환경변수 활성화 상태
- P1/P2 이슈 1개 이하 → 스킵

## 사용 스킬

- `/vibe.review` (Phase 4.5: Review Debate)
- `vibe-spec-review` skill (Step 3.5: SPEC Debate)
- `/vibe.run` (Review Team: 구현 후 리뷰)

## 워크플로우

```
[입력: P1/P2 이슈 목록]
    |
    ├──→ security-reviewer: 보안 이슈 판정 + 합의 주도
    ├──→ architecture-reviewer: 구조적 영향 평가
    ├──→ performance-reviewer: 성능 영향 평가
    └──→ simplicity-reviewer: 오탐 식별, 단순 대안 제시
         |
    [SendMessage 교차 검증]
         |
    security-reviewer: 팀 합의 종합 → 최종 P1/P2 목록
```

## spawn 패턴

### Code Review 컨텍스트 (vibe.review, vibe.run)

```text
TeamCreate(team_name="review-debate-{feature}", description="Review debate for {feature}")

Task(team_name="review-debate-{feature}", name="security-reviewer", subagent_type="security-reviewer",
  mode="bypassPermissions",
  prompt="리뷰 토론 팀 리더. Phase 2에서 발견된 P1/P2 이슈를 팀과 함께 검증하세요.
  Phase 2 결과: {phase2_findings}
  역할: 보안 이슈 최종 판정, 팀원 간 우선순위 충돌 해결, 최종 합의 요약 작성.
  TaskList를 확인하고 이슈를 claim하세요. 각 이슈에 대해 팀원에게 SendMessage로 검증을 요청하세요.
  모든 이슈 검증 완료 후 최종 합의 결과를 작성하세요.")

Task(team_name="review-debate-{feature}", name="architecture-reviewer", subagent_type="architecture-reviewer",
  mode="bypassPermissions",
  prompt="리뷰 토론 팀 아키텍처 담당. Phase 2 결과: {phase2_findings}
  역할: 각 이슈의 구조적 영향 평가, 숨겨진 결합도/의존성 식별.
  아키텍처 관점에서 우선순위 변경이 필요하면 security-reviewer에게 SendMessage로 알리세요.
  TaskList에서 아키텍처 관련 이슈를 claim하세요.")

Task(team_name="review-debate-{feature}", name="performance-reviewer", subagent_type="performance-reviewer",
  mode="bypassPermissions",
  prompt="리뷰 토론 팀 성능 담당. Phase 2 결과: {phase2_findings}
  역할: 성능 영향 평가, 부하 시 cascading failure 가능성 검증.
  성능 관점에서 P2→P1 승격이 필요하면 security-reviewer에게 SendMessage로 알리세요.
  TaskList에서 성능 관련 이슈를 claim하세요.")

Task(team_name="review-debate-{feature}", name="simplicity-reviewer", subagent_type="simplicity-reviewer",
  mode="bypassPermissions",
  prompt="리뷰 토론 팀 복잡도 담당. Phase 2 결과: {phase2_findings}
  역할: 과잉 진단(오탐) 식별, 더 단순한 수정 방안 제시.
  오탐이나 P1→P2 강등이 필요하면 security-reviewer에게 SendMessage로 알리세요.
  TaskList에서 복잡도/단순화 관련 이슈를 claim하세요.")
```

### SPEC Review 컨텍스트 (vibe-spec-review)

spawn 패턴은 동일하되, prompt의 입력이 다름:

```text
TeamCreate(team_name="spec-debate-{feature}", description="SPEC review debate for {feature}")

# prompt 차이점:
# - "Phase 2 결과: {phase2_findings}" 대신 "SPEC: {spec_content}, 발견된 이슈: {p1_p2_issues}"
# - 코드가 아닌 SPEC 문서를 대상으로 검증
# - 나머지 팀 구성/통신 패턴은 동일
```

## 팀원 간 통신

```text
architecture-reviewer → security-reviewer: "Unbounded query는 부하 시 cascading failure 가능. P2→P1 승격 제안"
simplicity-reviewer → security-reviewer: "CSRF on read-only endpoint는 side effect 없음. P1→P2 강등 제안"
performance-reviewer → architecture-reviewer: "N+1 query가 현재 데이터 규모에서는 영향 없으나 확장 시 문제. 의견?"
security-reviewer → broadcast: "최종 합의: SQL Injection P1 유지, Unbounded query P1 승격, CSRF P2 강등, Circular dep 오탐 제거"
```

## 토론 결과 형식

```
🤝 REVIEW DEBATE RESULTS

Team Consensus (4 reviewers):

✅ Validated P1 (unanimous):
  1. [SECURITY] SQL Injection — 4/4 agree critical

⬆️ Upgraded P2→P1 (debate result):
  2. [PERF] Unbounded query — cascading failure risk under load

⬇️ Downgraded P1→P2:
  3. [SECURITY] CSRF — read-only endpoint, no side effect

❌ Removed (false positive):
  4. [ARCH] Circular dep — actually a valid cross-reference
```

## ⛔ 하지 않는 것

- 코드 직접 수정 (리포트만 작성)
- 이슈 수정 방법 구현
- P3 이슈 토론 (P1/P2만)
- 합의 없이 단독 판정
