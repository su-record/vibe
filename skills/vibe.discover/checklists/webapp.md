# Discovery Checklist: Webapp

> 대시보드, SaaS, 관리자 도구, 내부 도구 등 **상호작용/상태 기반 웹 애플리케이션**.

## Required (반드시 수집)

### R1. purpose
**Q**: 이 웹앱으로 어떤 문제를 해결하시려고 하나요?
**힌트**: 구체적 사용 시나리오 1개 이상.

### R2. user-roles
**Q**: 어떤 종류의 사용자가 있나요? (역할/권한 구분)
**힌트**: 예) 관리자/일반사용자, 호스트/게스트, 판매자/구매자. 단일 역할이면 "단일".
**follow-up**: 각 역할이 할 수 있는 일을 간단히.

### R3. core-features
**Q**: 핵심 기능을 우선순위 순으로 나열해주세요.
**힌트**: Must/Should/Could로 구분. 최소 3개.
**follow-up**: "첫 버전(MVP)에 반드시 있어야 할 것만 고르면 몇 개인가요?"

### R4. data-model
**Q**: 주요 데이터는 무엇인가요? (엔티티와 관계 대략)
**힌트**: 예) User → Project → Task. ERD 수준의 정밀도는 불필요.

### R5. auth-method
**Q**: 인증 방식은?
**힌트**: 이메일/비밀번호, 소셜(Google/Apple/GitHub), 매직 링크, Passkey, SSO, 인증 없음.
**follow-up**: "MFA 필요하신가요?"

### R6. tech-stack
**Q**: 기술 스택 선호가 있나요?
**힌트**: Frontend/Backend/DB. 기존 프로젝트면 그대로 유지.

### R7. hosting-runtime
**Q**: 어디서 실행되나요? (호스팅/런타임)
**힌트**: Vercel, Fly, Railway, AWS, 자체 서버. Serverless vs 항상-on.

### R8. success-metric
**Q**: 성공 기준은? (DAU, 리텐션, 핵심 액션 N회 등)
**힌트**: 측정 가능한 숫자.

## Optional

### O1. realtime-requirement
**Q**: 실시간 기능이 필요한가요? (채팅, 알림, 협업 등)
**힌트**: WebSocket/SSE/Polling 중 어느 수준.

### O2. offline-support
**Q**: 오프라인 지원이 필요한가요? (PWA, 로컬 동기화)

### O3. notifications
**Q**: 알림은 어떤 방식으로? (in-app, 이메일, 푸시, SMS)

### O4. integrations
**Q**: 외부 서비스 통합이 필요한가요?
**힌트**: 결제(Stripe), 이메일(SendGrid/Resend), SMS(Twilio), 스토리지(S3), 검색(Algolia), AI(OpenAI).

### O5. permission-model
**Q**: 권한 모델이 복잡한가요? (RBAC, ABAC, 리소스 소유권)
**힌트**: 예) "팀 단위 권한, 관리자가 역할 지정"

### O6. data-retention
**Q**: 데이터 보존/삭제 정책이 있나요?
**힌트**: GDPR, 사용자 요청 삭제, 보관 기간.

### O7. i18n
**Q**: 다국어 지원이 필요한가요?

### O8. accessibility
**Q**: 접근성 목표는? (WCAG 레벨)

### O9. performance-slo
**Q**: 성능 목표(SLO)가 있나요?
**힌트**: 예) p95 API 응답 < 300ms, 페이지 로드 < 2s.

### O10. monitoring
**Q**: 모니터링/로깅 도구는?
**힌트**: Sentry, Datadog, Logflare, OpenTelemetry.

### O11. analytics
**Q**: 사용자 분석 도구가 필요한가요?
**힌트**: PostHog, Mixpanel, Amplitude.

### O12. test-strategy
**Q**: 테스트 전략 선호가 있나요?
**힌트**: unit/integration/e2e 중 어디에 무게.

### O13. ci-cd
**Q**: CI/CD 환경은?
**힌트**: GitHub Actions, GitLab CI, Vercel Auto, 수동 배포.

### O14. budget
**Q**: 월 인프라 예산은?

### O15. compliance
**Q**: 법적/컴플라이언스 요구사항이 있나요?
**힌트**: GDPR, HIPAA, SOC2, 개인정보보호법.
