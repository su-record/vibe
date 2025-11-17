# SPEC: {기능명}

## Metadata
- **작성일**: {YYYY-MM-DD}
- **작성자**: {이름}
- **상태**: DRAFT
- **우선순위**: {HIGH | MEDIUM | LOW}
- **언어**: {ko | en}
- **담당 에이전트**: {에이전트명}
- **기술 스택**: {프로젝트 기술 스택 요약}

---

## 1. 기능 개요

{1-2문장으로 요약}

### 배경 (Background)
{왜 이 기능이 필요한가}

### 목표 (Goals)
- 목표 1
- 목표 2

### 비목표 (Non-Goals)
- 이번에 하지 않을 것 1
- 이번에 하지 않을 것 2

### 기술 스택 컨텍스트

**기존 기술:**
- 백엔드: {FastAPI, Django, Express 등}
- 프론트엔드: {React, Flutter, Vue 등}
- 데이터베이스: {PostgreSQL, MySQL, MongoDB 등}
- 인프라: {GCP, AWS, Azure 등}

**이번 기능에 필요한 새 기술:**
- {새 라이브러리/서비스 1} - {사유}
- {새 라이브러리/서비스 2} - {사유}

**외부 API/서비스 연동:**
- {서비스명} - {용도}

**제약사항:**
- 비용 한도: {금액}
- 성능 요구사항: {목표 응답 시간, 처리량 등}

---

## 2. 사용자 스토리

### Story 1: {스토리 제목}
**As a** {사용자 역할}
**I want** {원하는 기능}
**So that** {이유/가치}

#### Acceptance Criteria
- [ ] {검증 가능한 조건 1}
- [ ] {검증 가능한 조건 2}

---

## 3. Requirements (EARS 형식)

### REQ-001: {요구사항 제목}

**WHEN** {특정 조건}
**THEN** {시스템 동작} (SHALL | SHOULD | MAY)

#### Acceptance Criteria
- [ ] {테스트 가능한 기준 1}
- [ ] {테스트 가능한 기준 2}

#### Example
```
Input: {...}
Output: {...}
```

---

## 4. 비기능 요구사항

### 성능 (Performance)
- 응답 시간: {목표}
- 처리량: {목표}

### 보안 (Security)
- 인증: {방식}
- 권한: {규칙}

### 확장성 (Scalability)
- 예상 성장률: {수치}

---

## 5. 데이터 모델 (초안)

### Entity: {이름}
```json
{
  "field1": "type",
  "field2": "type"
}
```

---

## 6. API 계약 (초안)

### Endpoint: {이름}
```
POST /api/v1/resource
Request: {...}
Response: {...}
```

---

## 7. Out of Scope

- ❌ {제외 항목 1}
- ❌ {제외 항목 2}

---

## 8. 검증 체크리스트

- [ ] 모든 요구사항이 테스트 가능한가?
- [ ] SHALL/SHOULD/MAY가 명확한가?
- [ ] Acceptance Criteria가 구체적인가?
- [ ] 성능 목표가 측정 가능한가?

---

## 9. 승인

- [ ] 사용자 승인
- [ ] 기술 리뷰 완료

승인일: ____________
승인자: ____________
