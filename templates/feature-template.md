# Feature: {기능명}

**SPEC**: `.vibe/specs/{기능명}.md`

## User Story

**As a** {사용자 역할}
**I want** {원하는 기능}
**So that** {이유/가치}

---

## Scenarios

### Scenario 1: {Happy Path - 정상 케이스}

```gherkin
Scenario: {시나리오 제목}
  Given {전제 조건}
  When {사용자 행동}
  Then {예상 결과}
```

**검증 기준**: SPEC Acceptance Criteria #1

---

### Scenario 2: {Edge Case - 예외 케이스}

```gherkin
Scenario: {에러 시나리오 제목}
  Given {전제 조건}
  When {잘못된 입력}
  Then {에러 처리}
```

**검증 기준**: SPEC Acceptance Criteria #2

---

### Scenario Outline: {파라미터화 테스트}

```gherkin
Scenario Outline: {시나리오 제목}
  Given {전제 조건}
  When I input "<input>"
  Then I should see "<output>"

Examples:
  | input  | output  |
  | value1 | result1 |
  | value2 | result2 |
```

---

## Coverage

| Scenario | SPEC Acceptance | Status |
|----------|-----------------|--------|
| Scenario 1 | AC-1 | ⬜ |
| Scenario 2 | AC-2 | ⬜ |

---

## Verification

```bash
/vibe.verify "{기능명}"
```
