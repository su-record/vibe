# Discovery Checklist: API / Backend

> REST, GraphQL, gRPC, 마이크로서비스 등 **UI 없는 백엔드 시스템**.

## Required

### R1. purpose
**Q**: 이 API/백엔드가 해결하는 문제는 무엇인가요?

### R2. consumers
**Q**: 누가 이 API를 사용하나요?
**힌트**: 자사 프론트엔드, 외부 개발자, 모바일 앱, 파트너 시스템, 내부 서비스.
**follow-up**: "공개 API인가요, 내부용인가요?"

### R3. core-endpoints
**Q**: 주요 리소스/엔드포인트는?
**힌트**: 예) Users, Products, Orders. CRUD 수준 대략.

### R4. data-model
**Q**: 주요 엔티티와 관계는?
**힌트**: ERD 수준 불필요, 핵심만.

### R5. auth-strategy
**Q**: 인증/인가 방식은?
**힌트**: API Key, JWT, OAuth2, mTLS, 인증 없음. Scope/Role 필요?

### R6. protocol
**Q**: API 프로토콜은?
**힌트**: REST / GraphQL / gRPC / WebSocket / 혼합.

### R7. tech-stack
**Q**: 기술 스택은?
**힌트**: 언어/프레임워크(Node/FastAPI/Go/Rust), DB(Postgres/Mongo/Redis), 호스팅.

### R8. performance-slo
**Q**: 성능 SLO가 있나요?
**힌트**: 예) p95 응답 시간 < 200ms, 처리량 1000 req/s.

### R9. success-metric
**Q**: 성공 기준은?
**힌트**: Uptime, 응답 시간, 에러율, API 사용량.

## Optional

### O1. versioning-strategy
**Q**: API 버저닝 전략이 있나요?
**힌트**: URL(/v1/), 헤더, 없음.

### O2. rate-limiting
**Q**: Rate limiting이 필요한가요?
**힌트**: Tier별(free/paid), 전역, IP 기반.

### O3. caching-strategy
**Q**: 캐싱 전략이 있나요?
**힌트**: HTTP 캐시, Redis, CDN, Edge.

### O4. async-jobs
**Q**: 비동기 작업/큐가 필요한가요?
**힌트**: BullMQ, SQS, Kafka, Temporal.

### O5. webhooks
**Q**: 웹훅 지원이 필요한가요?

### O6. documentation
**Q**: API 문서 자동화는?
**힌트**: OpenAPI/Swagger, GraphQL 스키마, Postman, Scalar.

### O7. sdk-generation
**Q**: 클라이언트 SDK 생성이 필요한가요?
**힌트**: 언어별(TS/Python/Go), OpenAPI 기반 생성.

### O8. observability
**Q**: 관측(logging/metrics/tracing)은?
**힌트**: OpenTelemetry, Datadog, Honeycomb, Grafana.

### O9. error-handling
**Q**: 에러 응답 포맷 표준이 있나요?
**힌트**: RFC 7807 (Problem Details), 자체 포맷.

### O10. data-retention
**Q**: 데이터 보존/삭제 정책은?

### O11. backup-recovery
**Q**: 백업/복구 전략은?
**힌트**: RPO/RTO 목표.

### O12. compliance
**Q**: 규제 준수 요구가 있나요?
**힌트**: GDPR, HIPAA, PCI-DSS, SOC2.

### O13. multi-tenant
**Q**: 멀티테넌트 구조인가요?
**힌트**: Shared DB / DB-per-tenant / Schema 분리.

### O14. testing-strategy
**Q**: 테스트 전략은?
**힌트**: 계약 테스트(Pact), 통합 테스트, 부하 테스트(k6).

### O15. deployment
**Q**: 배포 방식은?
**힌트**: Docker, Kubernetes, Serverless, Blue-Green, Canary.
