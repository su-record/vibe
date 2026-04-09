# Fullstack Team

Frontend + Backend 동시 변경이 필요한 풀스택 기능 구현 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| architect (리더) | API 인터페이스 설계, frontend/backend 분업 조율 | Opus |
| implementer-backend | Backend API, 데이터베이스, 서비스 로직 구현 | Sonnet |
| implementer-frontend | Frontend UI, 상태 관리, API 연동 구현 | Sonnet |
| tester | E2E 테스트, API 테스트, 통합 테스트 | Haiku |

## 활성화 조건

- SPEC에 frontend + backend 파일이 모두 포함된 경우
- 또는 수동으로 `fullstack` 키워드 지정 시

## 워크플로우

```
architect: API 계약 설계 (request/response 스키마, 데이터 모델)
    |
    ├──→ implementer-backend: API 엔드포인트 구현 (병렬)
    │       └── 완료 시 → implementer-frontend에 통보
    ├──→ implementer-frontend: UI 구현 (mock 데이터 → 실 API 전환) (병렬)
    │       └── 통합 완료 시 → tester에 통보
    └──→ tester: API 테스트 (backend 후) → E2E 테스트 (frontend 후)
         |
    architect: 통합 검증 → 완료
```

## spawn 패턴

```text
TeamCreate(team_name="fullstack-{feature}", description="Fullstack team for {feature}")

Task(team_name="fullstack-{feature}", name="architect", subagent_type="architect",
  prompt="Fullstack team leader. Design API contract for {feature}.
  SPEC: {spec_content}
  Role: Define API endpoints (request/response schemas). Design data models.
  Share API contract with both implementers. Coordinate integration timing.")

Task(team_name="fullstack-{feature}", name="implementer-backend", subagent_type="implementer",
  mode="bypassPermissions",
  prompt="Fullstack team backend developer. Implement API for {feature}.
  SPEC: {spec_content}
  Role: Implement API endpoints per architect's contract. Create data models and services.
  Notify implementer-frontend when endpoints are ready for integration.
  Share API response samples with tester.")

Task(team_name="fullstack-{feature}", name="implementer-frontend", subagent_type="implementer",
  mode="bypassPermissions",
  prompt="Fullstack team frontend developer. Implement UI for {feature}.
  SPEC: {spec_content}
  Role: Build UI components and pages per SPEC. Use architect's API contract for types.
  Start with mock data, switch to real API when backend notifies readiness.
  Notify tester when UI is ready for E2E testing.")

Task(team_name="fullstack-{feature}", name="tester", subagent_type="tester",
  mode="bypassPermissions",
  prompt="Fullstack team tester. Write comprehensive tests for {feature}.
  SPEC: {spec_content}
  Role: Write API tests (after backend ready). Write E2E tests (after frontend ready).
  Test API contract conformance. Report integration issues to architect.")
```

## 팀원 간 통신

```text
architect → implementer-backend: "API 계약 확정: POST /api/orders (request: OrderCreateDto, response: OrderResponse)"
architect → implementer-frontend: "API 계약 공유. mock 데이터로 먼저 시작하세요"
implementer-backend → implementer-frontend: "POST /api/orders 구현 완료. 실 API로 전환 가능합니다"
implementer-frontend → tester: "주문 페이지 구현 + API 연동 완료. E2E 테스트 요청합니다"
tester → architect: "API 응답 스키마 불일치: createdAt 필드 누락. 계약과 다릅니다"
architect → broadcast: "풀스택 구현 완료. API 6개 + UI 4페이지 + E2E 12 시나리오 통과"
```

## ⛔ 하지 않는 것

- architect API 계약 없이 구현 시작
- frontend가 backend 완료 전에 실 API 연동 (mock 먼저)
- 테스트 없이 통합 완료 선언
