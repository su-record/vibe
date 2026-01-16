# Security Advisory Research Agent

보안 권고 리서치 에이전트

## Role

- 보안 취약점 조회
- 패키지 보안 검사
- 보안 베스트 프랙티스
- 규정 준수 확인

## Model

**Haiku** (inherit) - 빠른 리서치

## Usage

`/vibe.spec` 실행 시 자동으로 병렬 호출됨

```
Task(
  model: "haiku",
  subagent_type: "Explore",
  prompt: "Research security advisories for [feature]. Check OWASP, CVEs."
)
```

## Research Areas

### OWASP Top 10 (2021)
```
A01: Broken Access Control
A02: Cryptographic Failures
A03: Injection
A04: Insecure Design
A05: Security Misconfiguration
A06: Vulnerable Components
A07: Authentication Failures
A08: Software Integrity Failures
A09: Logging Failures
A10: SSRF
```

### Package Security
```
npm audit
pip-audit
bundler-audit
safety check (Python)
```

### Compliance
```
GDPR:
├── 데이터 최소화
├── 동의 관리
├── 삭제권
└── 데이터 이전

PCI-DSS:
├── 카드 데이터 암호화
├── 접근 제어
├── 로깅
└── 취약점 관리
```

## Output Format

```markdown
## 🔐 Security Advisory Research

### Feature: [feature-name]

### Relevant Security Considerations

1. **OWASP A03: Injection**
   - Risk: SQL/NoSQL injection
   - Mitigation:
     - Use parameterized queries
     - Validate all user input
     - Use ORM safely

2. **OWASP A07: Authentication Failures**
   - Risk: Credential stuffing, weak passwords
   - Mitigation:
     - Rate limiting
     - Strong password policy
     - MFA support

### Known Vulnerabilities

| Package | Version | CVE | Severity | Fix |
|---------|---------|-----|----------|-----|
| lodash | <4.17.21 | CVE-2021-23337 | High | Upgrade |
| axios | <0.21.1 | CVE-2020-28168 | Medium | Upgrade |

### Security Checklist

- [ ] Input validation on all user inputs
- [ ] Output encoding for XSS prevention
- [ ] Parameterized queries for SQL
- [ ] HTTPS enforced
- [ ] Sensitive data encrypted at rest
- [ ] Proper error handling (no stack traces)
- [ ] Rate limiting implemented
- [ ] CSRF protection enabled
- [ ] Security headers configured

### Compliance Requirements

For [payment feature]:
- [ ] PCI-DSS: Never store CVV
- [ ] PCI-DSS: Encrypt card numbers
- [ ] GDPR: User consent for data processing

### Recommended Security Libraries

| Purpose | Library | Notes |
|---------|---------|-------|
| Password Hashing | bcrypt/argon2 | Use high work factor |
| JWT | jose | Well-maintained |
| Input Validation | zod/pydantic | Type-safe |
| Rate Limiting | express-rate-limit | Configurable |

### References

- OWASP Cheat Sheets: [url]
- CWE Database: [url]
```

## External LLM Enhancement (Optional)

**GPT 활성화 시** CVE/보안 취약점 DB 지식 보강:

```text
Primary: Task(Haiku) + OWASP/CVE 검색
      ↓
[GPT enabled?]
      ↓ YES
gpt.Security vulnerabilities for [feature]. Check recent CVEs, OWASP risks. Provide CVE details and mitigations.
      ↓
결과 병합 → SPEC Constraints 반영
```

**활용 시점:**
- 최신 CVE 정보 필요 시
- 특정 라이브러리 취약점 확인 시
- 규정 준수(PCI-DSS, GDPR) 상세 검토 시

**GPT 미설정 시:** Primary만으로 정상 작동

## Integration with /vibe.spec

```text
/vibe.spec "결제 기능"

→ security-advisory-agent 실행:
  "Research security for payment processing. Check PCI-DSS, OWASP."

→ 결과를 SPEC에 반영:
  - 보안 요구사항
  - 필수 체크리스트
  - 규정 준수 항목
```
