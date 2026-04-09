# Research Team

리서치 결과를 팀으로 교차 검증하여 정확성과 호환성을 보장하는 리서치 협업 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| best-practices (리더) | 패턴/안티패턴 종합, 팀원 간 충돌 해결, 최종 통합 요약 작성 | Haiku |
| security-advisory | 보안 관점에서 모든 권장사항 검증 | Haiku |
| codebase-patterns | 권장사항이 기존 코드 패턴과 호환되는지 검증 | Haiku |
| framework-docs | 최신 API/문서와 권장사항 대조 검증 | Haiku |

## 활성화 조건

- `/vibe.spec` Step 3 리서치 단계에서 자동 활성화
- Agent Teams 환경변수 활성화 상태

## 워크플로우

```
[입력: 10개 병렬 리서치 결과]
    |
    ├──→ best-practices: 패턴 종합 + 합의 주도
    ├──→ security-advisory: 보안 리스크 검증
    ├──→ codebase-patterns: 기존 코드 호환성 검증
    └──→ framework-docs: 최신 API 대조 검증
         |
    [SendMessage 교차 검증]
         |
    best-practices: 최종 통합 요약 → SPEC Context 반영
```

## spawn 패턴

```text
TeamCreate(team_name="research-{feature}", description="Research collaboration for {feature}")

Task(team_name="research-{feature}", name="best-practices", subagent_type="best-practices-agent",
  prompt="리서치 팀 리더. 10개 병렬 리서치 결과를 종합하세요.
  리서치 결과: {all_research_results}
  역할: 패턴/안티패턴 종합, 팀원 간 충돌 해결, 최종 통합 요약 작성.
  TaskList를 확인하고 작업을 claim하세요. 팀원에게 SendMessage로 검증을 요청하세요.
  모든 작업 완료 후 최종 요약을 작성하세요.")

Task(team_name="research-{feature}", name="security-advisory", subagent_type="security-advisory-agent",
  prompt="리서치 팀 보안 담당. 리서치 결과: {all_research_results}
  역할: 보안 관점에서 모든 권장사항 검증.
  보안 리스크 발견 시 best-practices에게 SendMessage로 알리세요.
  TaskList에서 보안 관련 작업을 claim하세요.")

Task(team_name="research-{feature}", name="codebase-patterns", subagent_type="codebase-patterns-agent",
  prompt="리서치 팀 코드베이스 담당. 리서치 결과: {all_research_results}
  역할: 권장사항이 기존 코드 패턴과 호환되는지 검증.
  비호환 발견 시 best-practices에게 SendMessage로 알리세요.
  TaskList에서 호환성 관련 작업을 claim하세요.")

Task(team_name="research-{feature}", name="framework-docs", subagent_type="framework-docs-agent",
  prompt="리서치 팀 문서 담당. 리서치 결과: {all_research_results}
  역할: 최신 API/문서와 권장사항 대조 검증.
  폐기/변경된 API 발견 시 best-practices에게 SendMessage로 알리세요.
  TaskList에서 문서 검증 관련 작업을 claim하세요.")
```

## Result Merge Rules

| Area | Merge Strategy |
|------|----------------|
| Best Practices | Deduplicate, keep most detailed |
| Security | ALL included (no dedup for safety) |
| Libraries | Consensus recommendations |

## 팀원 간 통신

```text
security-advisory → best-practices: "JWT 라이브러리 권장사항에 CVE-2024-xxxx 취약점. 대안 필요"
codebase-patterns → best-practices: "기존 코드가 class 패턴인데 함수형 권장은 비호환. 점진적 마이그레이션 제안"
framework-docs → best-practices: "React 19에서 useEffect 패턴 변경됨. 리서치 결과의 패턴은 구버전"
best-practices → broadcast: "최종 합의: JWT는 jose 라이브러리로 교체, 함수형 전환은 신규 파일만 적용"
```

## ⛔ 하지 않는 것

- 코드 작성/수정 (리서치 결과만 텍스트로 반환)
- 파일 생성 (SPEC에 반영은 메인 에이전트가 담당)
- 보안 이슈 중복 제거 (안전을 위해 ALL 포함)
