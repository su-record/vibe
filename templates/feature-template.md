# Feature: {기능명}

**Generated from**: `specs/{기능명}.md`
**Language**: {ko | en}
**Priority**: {HIGH | MEDIUM | LOW}

---

## Feature Description

**As a** {사용자 역할}
**I want** {원하는 기능}
**So that** {이유/가치}

---

## Background (Optional)

```gherkin
Background:
  Given {공통 전제 조건 1}
  And {공통 전제 조건 2}
```

---

## Scenarios

### Scenario 1: {시나리오 제목}

**Mapped to**: REQ-001 in SPEC

```gherkin
Scenario: {시나리오 제목}
  Given {전제 조건}
  And {추가 전제 조건}
  When {사용자 행동}
  And {추가 행동}
  Then {예상 결과}
  And {추가 검증}
```

**Acceptance Criteria**:
- [ ] {SPEC의 Acceptance Criteria 1}
- [ ] {SPEC의 Acceptance Criteria 2}

**Test Data**:
```json
{
  "input": {...},
  "expected_output": {...}
}
```

---

### Scenario 2: {에러 케이스 제목}

```gherkin
Scenario: {에러 케이스 제목}
  Given {전제 조건}
  When {잘못된 입력}
  Then {에러 응답}
  And {에러 메시지 검증}
```

---

### Scenario Outline: {파라미터화된 시나리오}

```gherkin
Scenario Outline: {시나리오 제목}
  Given {전제 조건}
  When I {행동} with "<parameter>"
  Then I should see "<result>"

Examples:
  | parameter | result |
  | value1    | result1 |
  | value2    | result2 |
  | value3    | result3 |
```

---

## Implementation Guide

### Backend Tests (Python + Pytest-BDD)

**File**: `tests/features/{기능명}.feature`

```python
# tests/step_defs/test_{기능명}.py
import pytest
from pytest_bdd import scenarios, given, when, then, parsers

# Load scenarios
scenarios('features/{기능명}.feature')

@given(parsers.parse('사용자가 {role}로 로그인되어 있다'))
def user_logged_in(context, role):
    context.user = create_user(role)
    context.token = authenticate(context.user)

@when(parsers.parse('{action}을 실행한다'))
def execute_action(context, action):
    context.response = api_call(action, context.token)

@then(parsers.parse('응답 코드는 {status_code:d}이어야 한다'))
def check_status_code(context, status_code):
    assert context.response.status_code == status_code
```

**Run**:
```bash
pytest tests/features/{기능명}.feature --verbose
```

---

### Frontend Tests (Flutter + Gherkin)

**File**: `integration_test/features/{기능명}.feature`

```dart
// integration_test/step_definitions/{기능명}_test.dart
import 'package:flutter_gherkin/flutter_gherkin.dart';

class UserLoggedInStep extends Given1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String role) async {
    await world.appDriver.waitForAppToSettle();
    // Login logic
  }

  @override
  RegExp get pattern => RegExp(r'사용자가 {string}로 로그인되어 있다');
}
```

**Run**:
```bash
flutter test integration_test/{기능명}_test.dart
```

---

### Frontend Tests (React + Cucumber)

**File**: `tests/features/{기능명}.feature`

```javascript
// tests/step_definitions/{기능명}.steps.js
const { Given, When, Then } = require('@cucumber/cucumber');
const { render, screen, fireEvent } = require('@testing-library/react');

Given('사용자가 {string}로 로그인되어 있다', async function (role) {
  this.user = await createUser(role);
  this.token = await authenticate(this.user);
});

When('{string}을 실행한다', async function (action) {
  this.response = await apiCall(action, this.token);
});

Then('응답 코드는 {int}이어야 한다', function (statusCode) {
  expect(this.response.status).toBe(statusCode);
});
```

**Run**:
```bash
npm test -- --features tests/features/{기능명}.feature
```

---

## Tags

```gherkin
@priority-high
@smoke
@regression
@backend
@frontend
```

**Run by tag**:
```bash
# Python
pytest -m "priority-high"

# JavaScript
npm test -- --tags "@smoke"
```

---

## Coverage Mapping

| Scenario | SPEC REQ | Acceptance Criteria | Status |
|----------|----------|---------------------|--------|
| Scenario 1 | REQ-001 | AC-1, AC-2, AC-3 | ⬜ |
| Scenario 2 | REQ-002 | AC-4, AC-5 | ⬜ |
| Scenario 3 | REQ-003 | AC-6, AC-7 | ⬜ |

**Coverage**: 0 / {총 시나리오 수} (0%)

---

## Test Execution Report

**Last Run**: {날짜 시간}
**Environment**: {dev | staging | production}

| Scenario | Status | Duration | Error |
|----------|--------|----------|-------|
| Scenario 1 | ⬜ PENDING | - | - |
| Scenario 2 | ⬜ PENDING | - | - |

**Total**: 0 passed, 0 failed, {총 수} pending

---

## Next Steps

1. **구현 전 테스트 작성** (Test-First):
   ```bash
   # Create feature file first
   vibe feature "{기능명}"

   # Then implement
   vibe run "Task 1-1"
   ```

2. **구현 중 테스트 실행**:
   ```bash
   vibe test "{기능명}" --watch
   ```

3. **완료 후 검증**:
   ```bash
   vibe verify "{기능명}"
   ```

---

## Notes

- ✅ **Given**: 테스트 전제 조건 (상태 설정)
- ✅ **When**: 사용자 행동 (액션 실행)
- ✅ **Then**: 예상 결과 (검증)
- ✅ **And/But**: 추가 조건/검증

**Best Practices**:
- 시나리오는 비즈니스 언어로 작성
- 구현 세부사항은 Step Definitions에
- 각 시나리오는 독립적으로 실행 가능해야 함
- Background는 중복 제거용으로만 사용
