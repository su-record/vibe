# PLAN: {기능명}

## Metadata
- **SPEC**: `specs/{기능명}.md`
- **작성일**: {YYYY-MM-DD}
- **작성자**: {이름}
- **담당 에이전트**: {Backend Python Expert | Frontend Flutter Expert | etc.}

---

## 1. 기술 스택 선정

### 선택된 기술
| 항목 | 기술 | 이유 |
|------|------|------|
| 백엔드 | {기술} | {이유} |
| 프론트엔드 | {기술} | {이유} |
| 데이터베이스 | {기술} | {이유} |
| 외부 서비스 | {기술} | {이유} |

### 대안 기술 (검토 후 제외)
- **{기술 A}**: 제외 이유
- **{기술 B}**: 제외 이유

---

## 2. 아키텍처 설계

### High-level Architecture
```
[Client] → [API Gateway] → [Service] → [Database]
                    ↓
              [External API]
```

### 컴포넌트 설계
- **Component 1**: {역할}
- **Component 2**: {역할}

### 데이터 흐름
1. 사용자 요청
2. 검증
3. 처리
4. 응답

---

## 3. API 설계

### Endpoint 1: {이름}
```
POST /api/v1/resource
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Request:
{
  "field1": "value"
}

Response (200):
{
  "id": "...",
  "status": "success"
}

Error (400):
{
  "error": "Invalid request",
  "details": "..."
}
```

---

## 4. 데이터베이스 스키마

### 테이블: {이름}
```sql
CREATE TABLE resource (
  id UUID PRIMARY KEY,
  field1 VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  INDEX idx_field1 (field1)
);
```

### 인덱스 전략
- `idx_field1`: 조회 성능 향상

---

## 5. 외부 서비스 통합

### Service 1: {이름}
- **용도**: {목적}
- **비용**: 월 ${금액} (예상 {건}건 기준)
- **API 문서**: {URL}
- **인증 방식**: {방법}

---

## 6. 보안 설계

### 인증 (Authentication)
- 방식: JWT
- 토큰 유효 기간: 1시간
- Refresh 토큰: 7일

### 권한 (Authorization)
- Role-based Access Control (RBAC)
- Roles: Admin, User, Guest

### 데이터 보호
- 개인정보 암호화: AES-256
- 전송 암호화: TLS 1.3

---

## 7. 성능 최적화 전략

### 캐싱
- Redis 캐시: {대상 데이터}
- TTL: {시간}

### 데이터베이스 최적화
- 인덱싱: {컬럼}
- 커넥션 풀: {크기}

### 비동기 처리
- 무거운 작업: 백그라운드 Job

---

## 8. 에러 처리 전략

### 에러 분류
| 코드 | 유형 | 처리 |
|------|------|------|
| 400 | Bad Request | 입력 검증 에러 메시지 |
| 401 | Unauthorized | 로그인 필요 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 500 | Server Error | 로그 + 일반 메시지 |

### 재시도 전략
- 네트워크 에러: 3회 재시도 (Exponential Backoff)
- 외부 API 에러: 1회 재시도

---

## 9. 모니터링 및 로깅

### 메트릭
- 응답 시간: P50, P95, P99
- 에러율: 5분 단위
- 처리량: RPS

### 로깅
- 레벨: INFO, ERROR
- 포맷: JSON (Structured Logging)
- 보관 기간: 30일

### 알림
- 에러율 > 5%: Slack 알림
- 응답 시간 > 3초: 경고

---

## 10. 테스트 전략

### Contract Testing
- Pydantic/Zod 스키마로 API 계약 검증

### Integration Testing
- 핵심 경로: {경로 1}, {경로 2}
- 목표 커버리지: 70%

### Load Testing
- 목표: {TPS}
- 도구: Locust / k6

---

## 11. 배포 전략

### 환경
- Development: 로컬 Docker
- Staging: Cloud Run (1 instance)
- Production: Cloud Run (auto-scale 1-10)

### CI/CD
- GitHub Actions
- 자동 테스트 → 자동 배포

### Rollback 계획
- 이전 버전으로 즉시 롤백 가능

---

## 12. 비용 예측

| 항목 | 월 비용 | 근거 |
|------|---------|------|
| Cloud Run | ${금액} | {근거} |
| Database | ${금액} | {근거} |
| 외부 API | ${금액} | {근거} |
| **총계** | **${금액}** | |

---

## 13. 마일스톤

| 단계 | 내용 | 예상 시간 |
|------|------|-----------|
| 1 | {작업} | {시간} |
| 2 | {작업} | {시간} |
| 3 | {작업} | {시간} |

---

## 14. 리스크 및 완화 방안

### 리스크 1: {제목}
- **확률**: High | Medium | Low
- **영향**: High | Medium | Low
- **완화 방안**: {방법}

---

## 15. 다음 단계

1. SPEC 재검토 및 승인
2. TASKS 문서 생성
   → `sutory tasks "{기능명}"`
3. 구현 시작
