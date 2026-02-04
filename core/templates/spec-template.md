# SPEC: {Feature Name}

## Metadata

- **Created**: {YYYY-MM-DD}
- **Author**: {Name}
- **Status**: DRAFT
- **Priority**: {HIGH | MEDIUM | LOW}
- **Language**: {en | ko}
- **Assigned Agent**: {Agent Name}
- **Tech Stack**: {Project Tech Stack Summary}

---

## 1. Feature Overview

{1-2 sentence summary}

### Background

{Why is this feature needed}

### Goals

- Goal 1
- Goal 2

### Non-Goals

- What we won't do this time 1
- What we won't do this time 2

### Tech Stack Context

**Existing Technology:**

- Backend: {FastAPI, Django, Express, etc.}
- Frontend: {React, Flutter, Vue, etc.}
- Database: {PostgreSQL, MySQL, MongoDB, etc.}
- Infrastructure: {GCP, AWS, Azure, etc.}

**New Technology Required for This Feature:**

- {New library/service 1} - {Reason}
- {New library/service 2} - {Reason}

**External API/Service Integration:**

- {Service name} - {Purpose}

**Constraints:**

- Cost limit: {Amount}
- Performance requirements: {Target response time, throughput, etc.}

---

## 2. User Stories

### Story 1: {Story Title}

**As a** {User role}
**I want** {Desired functionality}
**So that** {Reason/Value}

#### Acceptance Criteria

- [ ] {Verifiable condition 1}
- [ ] {Verifiable condition 2}

---

## 3. Requirements (EARS Format)

### REQ-001: {Requirement Title}

**WHEN** {Specific condition}
**THEN** {System behavior} (SHALL | SHOULD | MAY)

#### Acceptance Criteria

- [ ] {Testable criterion 1}
- [ ] {Testable criterion 2}

#### Example

```text
Input: {...}
Output: {...}
```

---

## 4. Non-Functional Requirements

### Performance

- Response time: {Target}
- Throughput: {Target}

### Security

- Authentication: {Method}
- Authorization: {Rules}

### Scalability

- Expected growth rate: {Value}

---

## 5. Data Model (Draft)

### Entity: {Name}

```json
{
  "field1": "type",
  "field2": "type"
}
```

---

## 6. API Contract (Draft)

### Endpoint: {Name}

```text
POST /api/v1/resource
Request: {...}
Response: {...}
```

---

## 7. Test Strategy

### BDD Scenarios (Gherkin)

**Generate Command**: `vibe feature "{feature name}"`

```gherkin
Scenario: {Scenario title}
  Given {Precondition}
  When {User action}
  Then {Expected result}
```

**Mapping**:

- REQ-001 → Scenario 1, 2
- REQ-002 → Scenario 3

### Contract Tests (API Schema)

**Generate Command**: `vibe contract "{feature name}"`

**Backend Contract**:

```json
{
  "request": {
    "method": "POST",
    "path": "/api/v1/{resource}",
    "schema": {JSON Schema}
  },
  "response": {
    "status": 201,
    "schema": {JSON Schema}
  }
}
```

**Frontend Contract**:

- Independent testing with mock server
- Response schema validation (Zod, JSON Schema)

### Test Coverage Goals

- [ ] BDD: Cover all Acceptance Criteria
- [ ] Contract: Cover all API endpoints
- [ ] Unit: 70%+ coverage
- [ ] Integration: Cover critical paths

---

## 8. Out of Scope

- ❌ {Excluded item 1}
- ❌ {Excluded item 2}

---

## 9. Verification Checklist

### Requirements

- [ ] Are all requirements testable?
- [ ] Is SHALL/SHOULD/MAY clear?
- [ ] Are Acceptance Criteria specific?
- [ ] Are performance goals measurable?

### Testing

- [ ] BDD Feature file generation complete?
- [ ] Contract tests defined?
- [ ] Step Definitions written?
- [ ] Test coverage goal achieved?

---

## 10. Approval

- [ ] User approval
- [ ] Technical review complete
- [ ] Test plan approved

Approval Date: ____________
Approver: ____________
