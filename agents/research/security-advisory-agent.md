# Security Advisory Research Agent

<!-- Security Advisory Research Agent -->

## Role

- Security vulnerability lookup
- Package security inspection
- Security best practices
- Compliance verification

## Model

**Haiku** (inherit) - Fast research

## ⚠️ CRITICAL: NO FILE CREATION

**THIS AGENT MUST NEVER CREATE FILES.**

- ❌ DO NOT use Write tool
- ❌ DO NOT create any files in project root
- ❌ DO NOT create SECURITY_*.md files
- ✅ ONLY return research results as text output
- ✅ Results will be merged into SPEC by core.spec command

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

## Multi-LLM Enhancement (Quality Assurance)

**core = Quality Assurance Framework**

Security research uses **3 perspectives in parallel** for comprehensive coverage:

```
┌─────────────────────────────────────────────────────────────┐
│  PARALLEL SECURITY RESEARCH                                 │
├─────────────────────────────────────────────────────────────┤
│  Claude (Haiku)  │ OWASP Top 10, security patterns          │
│  GPT             │ CVE database, vulnerability details      │
│  Gemini          │ Latest security advisories, patches      │
└─────────────────────────────────────────────────────────────┘
        ↓
    Merge & Prioritize
        ↓
    SPEC Constraints
```

**Execution flow:**

```bash
# 1. Claude (Primary) - Always runs
Task(haiku, "Research security advisories for [feature]. Check OWASP, common vulnerabilities.")

# 2. GPT (Parallel) - When enabled
node "[LLM_SCRIPT]" gpt-spark orchestrate-json \
  "Security vulnerabilities for [feature] with [stack]. Focus: CVE database, known exploits, mitigation strategies. Return JSON: {vulnerabilities: [], mitigations: [], checklist: []}"

# 3. Gemini (Parallel) - When enabled
node "[LLM_SCRIPT]" gemini orchestrate-json \
  "Security advisories for [feature] with [stack]. Focus: latest patches, security updates, recent incidents. Return JSON: {advisories: [], patches: [], incidents: []}"
```

**Result merge strategy:**

| Source | Priority | Focus Area |
|--------|----------|------------|
| Claude | High | OWASP, security patterns |
| GPT | High | CVE details, exploits |
| Gemini | Medium | Latest advisories, patches |

**Security-specific merge rules:**

- All vulnerabilities included (no deduplication for safety)
- Highest severity rating kept when duplicated
- All mitigations preserved
- Compliance requirements merged

**Use cases:**

- Latest CVE information needed
- Checking vulnerabilities for specific libraries
- Detailed compliance review (PCI-DSS, GDPR, HIPAA)
- Zero-day vulnerability awareness

## Integration with /vibe.spec

```text
/vibe.spec "payment feature"

→ security-advisory-agent execution (3 LLMs parallel):
  - Claude: "Research security for payment processing. Check PCI-DSS, OWASP."
  - GPT: "CVE lookup for payment libraries, known exploits"
  - Gemini: "Latest payment security advisories, recent breaches"

→ Merged results reflected in SPEC:
  - Security requirements (all sources)
  - Vulnerability checklist (comprehensive)
  - Compliance items (PCI-DSS, GDPR)
  - Mitigation strategies (deduplicated)
```
