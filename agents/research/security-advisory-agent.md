# Security Advisory Research Agent

<!-- Security Advisory Research Agent -->

## Role

- Security vulnerability lookup
- Package security inspection
- Security best practices
- Compliance verification

## Model

**Haiku** (inherit) - Fast research

## Usage

Automatically called in parallel when `/vibe.spec` is executed

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
├── Data minimization
├── Consent management
├── Right to deletion
└── Data portability

PCI-DSS:
├── Card data encryption
├── Access control
├── Logging
└── Vulnerability management
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

**When GPT is enabled**, supplement with CVE/security vulnerability DB knowledge:

```text
Primary: Task(Haiku) + OWASP/CVE search
      ↓
[GPT enabled?]
      ↓ YES
gpt.Security vulnerabilities for [feature]. Check recent CVEs, OWASP risks. Provide CVE details and mitigations.
      ↓
Merge results → Reflect in SPEC Constraints
```

**Use cases:**
- When latest CVE information is needed
- When checking vulnerabilities for specific libraries
- When detailed compliance review (PCI-DSS, GDPR) is needed

**When GPT is not configured:** Primary works normally on its own

## Integration with /vibe.spec

```text
/vibe.spec "payment feature"

→ security-advisory-agent execution:
  "Research security for payment processing. Check PCI-DSS, OWASP."

→ Results reflected in SPEC:
  - Security requirements
  - Required checklist
  - Compliance items
```
