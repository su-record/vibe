# BDD + Contract Testing Guide

**AI 주도 개발에 최적화된 테스팅 전략**

---

## 개요

BDD (Behavior-Driven Development)와 Contract Testing은 **AI 에이전트가 요구사항을 정확히 이해하고 검증 가능한 코드를 생성**하는 데 필수적입니다.

### 왜 AI 주도 개발에 유용한가?

1. **명확한 입출력 계약** → AI가 정확히 구현 가능
2. **자동 검증** → AI 생성 코드의 품질 즉시 확인
3. **회귀 방지** → AI 수정이 기존 기능을 깨뜨리지 않음
4. **문서화 자동화** → 테스트가 곧 실행 가능한 명세

---

## Workflow

```
SPEC 작성 (요구사항)
     ↓
Feature 파일 생성 (Gherkin)
     ↓
Contract 테스트 생성 (API 스키마)
     ↓
테스트 실행 (Red)
     ↓
AI 에이전트 구현
     ↓
테스트 실행 (Green)
     ↓
리팩토링
     ↓
테스트 재실행 (Green 유지)
```

---

## 1. BDD (Behavior-Driven Development)

### Gherkin 문법

```gherkin
Feature: 사용자 로그인
  As a 사용자
  I want to 로그인하고 싶다
  So that 개인화된 서비스를 이용할 수 있다

  Scenario: 유효한 credentials로 로그인 성공
    Given 사용자가 "test@example.com"과 "password123"으로 등록되어 있다
    When "test@example.com"과 "password123"으로 로그인을 시도한다
    Then 로그인에 성공한다
    And JWT 토큰을 받는다
    And 홈 화면으로 리디렉션된다

  Scenario: 잘못된 비밀번호로 로그인 실패
    Given 사용자가 "test@example.com"으로 등록되어 있다
    When "test@example.com"과 "wrong-password"로 로그인을 시도한다
    Then 로그인에 실패한다
    And "Invalid credentials" 에러 메시지를 받는다
```

### Step Definitions (Python)

```python
from pytest_bdd import scenarios, given, when, then, parsers

scenarios('features/login.feature')

@given(parsers.parse('사용자가 "{email}"과 "{password}"로 등록되어 있다'))
def user_exists(context, email, password):
    context.user = create_user(email=email, password=password)

@when(parsers.parse('"{email}"과 "{password}"로 로그인을 시도한다'))
def attempt_login(context, email, password):
    context.response = login(email=email, password=password)

@then('로그인에 성공한다')
def login_succeeds(context):
    assert context.response.status_code == 200

@then('JWT 토큰을 받는다')
def receives_token(context):
    assert 'access_token' in context.response.json()
```

---

## 2. Contract Testing

### API 계약 정의

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

### Contract 테스트 (Python)

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
    """로그인 응답이 계약을 준수하는지 검증"""
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })

    assert response.status_code == 200

    # 응답 스키마 검증
    validate(instance=response.json(), schema=RESPONSE_SCHEMA)

    # JWT 토큰 형식 검증
    token = response.json()["access_token"]
    assert len(token.split('.')) == 3  # JWT는 3개 부분으로 구성
```

---

## 3. AI 에이전트 활용

### SPEC → Feature 자동 생성

AI 에이전트가 SPEC의 Acceptance Criteria를 Gherkin Scenario로 자동 변환:

**SPEC**:
```markdown
### REQ-001: 사용자 로그인
**WHEN** 유효한 credentials로 로그인
**THEN** JWT 토큰을 받는다

#### Acceptance Criteria
- [ ] 이메일과 비밀번호로 로그인 가능
- [ ] access_token과 refresh_token 반환
- [ ] 잘못된 credentials는 400 에러
```

**Generated Feature**:
```gherkin
Scenario: 유효한 credentials로 로그인 성공
  Given 사용자가 등록되어 있다
  When 유효한 이메일과 비밀번호로 로그인한다
  Then JWT access_token을 받는다
  And JWT refresh_token을 받는다
```

### API 스키마 → Contract 자동 생성

AI 에이전트가 SPEC의 API 계약을 Contract 테스트로 자동 변환:

**SPEC**:
```markdown
### Endpoint: 로그인
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

## 4. Vibe 명령어

### Feature 파일 생성

```bash
vibe feature "user login"
# → .claude/vibe/features/user-login.feature 생성
```

### Contract 테스트 생성

```bash
vibe contract "user login"
# → tests/contract/test_user_login_contract.py 생성
```

### 테스트 실행

```bash
vibe test "user login"
# → BDD + Contract 테스트 실행
```

### 검증

```bash
vibe verify "user login"
# → SPEC Acceptance Criteria 100% 충족 확인
```

---

## 5. Best Practices

### ✅ DO

1. **SPEC 먼저 작성** → Feature → Contract → 구현
2. **Given-When-Then** 명확히 분리
3. **계약은 구체적으로** (타입, 형식, 제약 명시)
4. **독립적인 시나리오** (순서 무관하게 실행 가능)
5. **에러 케이스 포함** (Happy path + Sad path)

### ❌ DON'T

1. **구현 세부사항 노출 금지** (Step Definitions에만 위치)
2. **UI 테스트와 혼동 금지** (BDD는 비즈니스 로직)
3. **과도한 Background 금지** (중복 제거만)
4. **계약 위반 허용 금지** (스키마 변경 시 버전 업)

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
# 프로젝트 구조
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
# 프로젝트 구조
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
# 프로젝트 구조
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

BDD + Contract Testing은 **AI 에이전트가 SPEC을 정확히 구현하고 자동 검증**할 수 있게 합니다:

1. **명확한 요구사항** → Gherkin으로 비즈니스 언어 표현
2. **계약 기반 개발** → API 스키마로 Frontend/Backend 독립 개발
3. **자동화된 검증** → AI 생성 코드 품질 즉시 확인
4. **회귀 방지** → 기존 기능 보호

**Vibe에서 사용**:
```bash
vibe spec "feature" → vibe feature "feature" → vibe contract "feature" → vibe run
```

**Test-First → AI 구현 → Verify → Done** 🎉
