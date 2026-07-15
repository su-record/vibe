# Boundary Mismatch Detection — Full Reference

> Loaded by vibe.review SKILL.md Phase 2.7 for the full verification-area table and checklist.

**검증 방법: "양쪽 동시 읽기"**

반드시 **생산자와 소비자 코드를 동시에** Read하여 교차 비교한다.

| 검증 영역 | 생산자 (왼쪽) | 소비자 (오른쪽) | 검증 내용 |
|----------|-------------|---------------|----------|
| API ↔ 훅 타입 | route의 Response.json() shape | hooks의 fetch\<T\> 타입 | shape 일치, 래핑 unwrap, case 변환 |
| 라우팅 정합성 | src/app/ page 파일 경로 | href, router.push 값 | 경로 매칭, route group 처리, 동적 세그먼트 |
| 상태 전이 | STATE_TRANSITIONS 맵 | .update({ status }) 코드 | 죽은 전이, 무단 전이, 중간→최종 누락 |
| 데이터 흐름 | DB 스키마 필드명 | API 응답 → 프론트 타입 | 필드명 일치, optional 처리 일관성 |

**검증 체크리스트:**

- [ ] API 응답 shape과 대응 훅의 제네릭 타입이 일치
- [ ] 래핑된 응답(`{ items: [...] }`)은 훅에서 unwrap하는지 확인
- [ ] snake_case ↔ camelCase 변환이 일관되게 적용
- [ ] 모든 API 엔드포인트에 대응하는 프론트 훅이 존재하고 실제 호출됨
- [ ] 코드 내 모든 href/router.push 값이 실제 page 파일 경로와 매칭
- [ ] 정의된 모든 상태 전이가 코드에서 실행됨 (죽은 전이 없음)
- [ ] 프론트에서 상태 기반 분기의 값이 실제 도달 가능한 상태
- [ ] DB 필드명 → API 응답 필드명 → 프론트 타입 정의 간 매핑 일관
