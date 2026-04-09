# Security Team

보안 민감 코드 변경 시 전문 보안 검증 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| security-reviewer (리더) | OWASP Top 10 검증, 보안 이슈 우선순위 결정 | Sonnet |
| data-integrity-reviewer | 데이터 무결성, 트랜잭션 관리, 입력 검증 | Sonnet |
| security-advisory-agent | 사용 라이브러리 CVE 확인, 보안 패치 확인 | Haiku |
| tester | 보안 테스트 케이스 작성, 침투 테스트 시나리오 검증 | Haiku |

## 활성화 조건

- auth, payment, user-data, crypto 관련 파일 변경 감지 시
- 또는 수동으로 `security` 키워드 지정 시

## 워크플로우

```
[입력: 보안 민감 변경 파일 목록]
    |
    ├──→ security-reviewer: OWASP Top 10 검증 + 합의 주도
    ├──→ data-integrity-reviewer: 데이터 흐름 + 입력 검증
    ├──→ security-advisory-agent: CVE 스캔 + 의존성 검사
    └──→ tester: 보안 테스트 케이스 작성
         |
    [SendMessage 교차 보고]
         |
    security-reviewer: P1 발견 → merge 차단
```

## spawn 패턴

```text
TeamCreate(team_name="security-{feature}", description="Security audit team for {feature}")

Task(team_name="security-{feature}", name="security-reviewer", subagent_type="security-reviewer",
  mode="bypassPermissions",
  prompt="Security team leader. Comprehensive security audit for {feature}.
  Files: {changed_files}
  Role: OWASP Top 10 check. XSS, CSRF, SQL injection, auth bypass.
  Coordinate with data-integrity-reviewer for data flow analysis.
  Any P1 finding blocks merge — notify team immediately.")

Task(team_name="security-{feature}", name="data-integrity-reviewer", subagent_type="data-integrity-reviewer",
  mode="bypassPermissions",
  prompt="Security team data specialist. Verify data integrity for {feature}.
  Files: {changed_files}
  Role: Check transaction management, input validation, data sanitization.
  Report findings to security-reviewer.")

Task(team_name="security-{feature}", name="security-advisory-agent", subagent_type="security-advisory-agent",
  prompt="Security team advisory specialist. Check dependencies for {feature}.
  Role: Scan for known CVEs in project dependencies. Check security advisories.
  Report critical findings to security-reviewer.")

Task(team_name="security-{feature}", name="tester", subagent_type="tester",
  mode="bypassPermissions",
  prompt="Security team test specialist. Write security-focused tests for {feature}.
  Files: {changed_files}
  Role: Write tests for auth bypass, injection, permission escalation.
  Report test results to security-reviewer.")
```

## 팀원 간 통신

```text
security-reviewer → data-integrity-reviewer: "POST /users에서 입력 검증 확인 요청. SQL injection 가능성"
data-integrity-reviewer → security-reviewer: "입력 검증 없음 확인. parameterized query도 미사용. P1"
security-advisory-agent → security-reviewer: "jsonwebtoken@8.x에 CVE-2024-xxxxx. jose로 마이그레이션 필요"
tester → security-reviewer: "auth bypass 테스트: admin 엔드포인트에 일반 토큰으로 접근 성공. P1"
security-reviewer → broadcast: "P1 3건 발견. merge 차단. 수정 후 재검증 필요"
```

## ⛔ 하지 않는 것

- 코드 직접 수정 (보안 검증 + 리포트만)
- P3 이슈에 시간 소비 (P1/P2 집중)
- 합의 없이 merge 승인
