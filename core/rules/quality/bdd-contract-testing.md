# BDD + Contract Testing Guide

**Testing strategy optimized for AI-driven development**

---

## Overview

BDD (Behavior-Driven Development) and Contract Testing are essential for **AI agents to accurately understand requirements and generate verifiable code**.

### Why is it useful for AI-driven development?

1. **Clear input/output contracts** → AI can implement accurately
2. **Automated verification** → Immediately verify AI-generated code quality
3. **Regression prevention** → AI modifications don't break existing functionality
4. **Automated documentation** → Tests serve as executable specifications

---

## Workflow

```
Write SPEC (Requirements)
     ↓
Generate Feature file (Gherkin)
     ↓
Generate Contract tests (API schema)
     ↓
Run tests (Red)
     ↓
AI agent implementation
     ↓
Run tests (Green)
     ↓
Refactoring
     ↓
Run tests again (Stay Green)
```

---

## 1. BDD (Behavior-Driven Development)

### Gherkin Syntax

```gherkin
Feature: User Login
  As a user
  I want to login
  So that I can access personalized services

  Scenario: Successful login with valid credentials
    Given user is registered with "test@example.com" and "password123"
    When login is attempted with "test@example.com" and "password123"
    Then login succeeds
    And receives JWT token
    And redirected to home screen

  Scenario: Failed login with wrong password
    Given user is registered with "test@example.com"
    When login is attempted with "test@example.com" and "wrong-password"
    Then login fails
    And receives "Invalid credentials" error message
```

### Step Definitions (Python)

```python
from pytest_bdd import scenarios, given, when, then, parsers

scenarios('features/login.feature')

@given(parsers.parse('user is registered with "{email}" and "{password}"'))
def user_exists(context, email, password):
    context.user = create_user(email=email, password=password)

@when(parsers.parse('login is attempted with "{email}" and "{password}"'))
def attempt_login(context, email, password):
    context.response = login(email=email, password=password)

@then('login succeeds')
def login_succeeds(context):
    assert context.response.status_code == 200

@then('receives JWT token')
def receives_token(context):
    assert 'access_token' in context.response.json()
```

---

## 2. Contract Testing

### API Contract Definition

```json
{
  "request": {
    "method": "POST",
    "path": "/api/auth/login",
    "body": {
      "email": "string (email format)",
      "password": "string (min 8 chars)"
    }
  },
  "response": {
    "status": 200,
    "body": {
      "access_token": "string (JWT)",
      "refresh_token": "string (JWT)",
      "user": {
        "id": "uuid",
        "email": "string",
        "name": "string"
      }
    }
  }
}
```

### Contract Test (Python)

```python
import pytest
from jsonschema import validate

RESPONSE_SCHEMA = {
    "type": "object",
    "required": ["access_token", "refresh_token", "user"],
    "properties": {
        "access_token": {"type": "string", "pattern": "^[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+$"},
        "refresh_token": {"type": "string"},
        "user": {
            "type": "object",
            "required": ["id", "email", "name"],
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "email": {"type": "string", "format": "email"},
                "name": {"type": "string"}
            }
        }
    }
}

def test_login_response_contract():
    """Verify login response adheres to contract"""
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })

    assert response.status_code == 200

    # Validate response schema
    validate(instance=response.json(), schema=RESPONSE_SCHEMA)

    # Validate JWT token format
    token = response.json()["access_token"]
    assert len(token.split('.')) == 3  # JWT has 3 parts
```

---

## 3. AI Agent Utilization

### SPEC → Feature Auto-generation

AI agent automatically converts SPEC Acceptance Criteria to Gherkin Scenarios:

**SPEC**:

```markdown
### REQ-001: User Login
**WHEN** login with valid credentials
**THEN** receive JWT token

#### Acceptance Criteria
- [ ] Login with email and password
- [ ] Return access_token and refresh_token
- [ ] Invalid credentials return 400 error
```

**Generated Feature**:

```gherkin
Scenario: Successful login with valid credentials
  Given user is registered
  When login with valid email and password
  Then receive JWT access_token
  And receive JWT refresh_token
```

### API Schema → Contract Auto-generation

AI agent automatically converts SPEC API contracts to Contract tests:

**SPEC**:

```markdown
### Endpoint: Login
POST /api/auth/login
Request: { email, password }
Response: { access_token, refresh_token, user }
```

**Generated Contract Test**:

```python
def test_login_contract():
    response = client.post("/api/auth/login", json=valid_credentials)
    assert response.status_code == 200
    validate(response.json(), LOGIN_RESPONSE_SCHEMA)
```

---

## 4. Core Commands

### Generate Feature File

```bash
core feature "user login"
# → Creates .claude/core/features/user-login.feature
```

### Generate Contract Test

```bash
core contract "user login"
# → Creates tests/contract/test_user_login_contract.py
```

### Run Tests

```bash
core test "user login"
# → Runs BDD + Contract tests
```

### Verify

```bash
core verify "user login"
# → Confirms 100% SPEC Acceptance Criteria met
```

---

## 5. Best Practices

### ✅ DO

1. **Write SPEC first** → Feature → Contract → Implementation
2. **Clearly separate Given-When-Then**
3. **Be specific with contracts** (specify types, formats, constraints)
4. **Independent scenarios** (can run in any order)
5. **Include error cases** (Happy path + Sad path)

### ❌ DON'T

1. **Don't expose implementation details** (keep in Step Definitions only)
2. **Don't confuse with UI testing** (BDD is for business logic)
3. **Don't overuse Background** (only for deduplication)
4. **Don't allow contract violations** (version up on schema changes)

---

## 6. Coverage Mapping

| SPEC REQ | Feature Scenario | Contract Test | Implementation | Status |
|----------|------------------|---------------|----------------|--------|
| REQ-001 | ✅ Scenario 1, 2 | ✅ test_login_contract | ✅ POST /api/auth/login | ✅ |
| REQ-002 | ✅ Scenario 3 | ✅ test_refresh_contract | ⬜ POST /api/auth/refresh | ⬜ |

**Coverage**: 1 / 2 (50%)

---

## 7. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: BDD + Contract Tests

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Run BDD tests
        run: pytest tests/features/ -v --gherkin-terminal-reporter

      - name: Run Contract tests
        run: pytest tests/contract/ -v

      - name: Upload coverage
        run: |
          pytest --cov=app --cov-report=xml
          codecov -f coverage.xml
```

---

## 8. Examples

### Python (FastAPI)

```bash
# Project structure
project/
├── tests/
│   ├── features/          # Gherkin feature files
│   │   └── login.feature
│   ├── step_defs/         # Step definitions
│   │   └── test_login.py
│   └── contract/          # Contract tests
│       └── test_login_contract.py
```

### Flutter (Dart)

```bash
# Project structure
project/
├── integration_test/
│   ├── features/          # Gherkin feature files
│   │   └── login.feature
│   └── step_definitions/  # Step definitions
│       └── login_test.dart
└── test/
    └── contract/          # Contract tests
        └── login_contract_test.dart
```

### React (TypeScript)

```bash
# Project structure
project/
├── tests/
│   ├── features/          # Gherkin feature files
│   │   └── login.feature
│   ├── steps/             # Step definitions
│   │   └── login.steps.ts
│   └── contract/          # Contract tests
│       └── login.contract.test.ts
```

---

## 9. Tools & Frameworks

### BDD

| Language | Framework |
|----------|-----------|
| Python | pytest-bdd, behave |
| JavaScript | Cucumber.js, Jest-Cucumber |
| TypeScript | Cucumber.js, Playwright |
| Dart | flutter_gherkin |
| Java | Cucumber-JVM |
| Ruby | Cucumber |

### Contract Testing

| Type | Framework |
|------|-----------|
| Consumer-Driven | Pact, Spring Cloud Contract |
| Provider | Postman, Dredd |
| Schema Validation | JSON Schema, Zod, Ajv |
| Mock Server | MSW, WireMock, http-mock-adapter |

---

## Summary

BDD + Contract Testing enables **AI agents to accurately implement SPECs and automatically verify**:

1. **Clear requirements** → Express business language with Gherkin
2. **Contract-based development** → Independent Frontend/Backend development with API schema
3. **Automated verification** → Immediately verify AI-generated code quality
4. **Regression prevention** → Protect existing functionality

**Usage in Vibe**:

```bash
core spec "feature" → core feature "feature" → core contract "feature" → core run
```

**Test-First → AI Implementation → Verify → Done** 🎉
