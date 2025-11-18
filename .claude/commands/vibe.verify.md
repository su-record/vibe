---
description: Verify implementation against SPEC requirements
argument-hint: "feature name"
---

# /vibe.verify

구현된 코드를 SPEC 요구사항에 대해 검증합니다.

## Usage

```
/vibe.verify "기능명"
```

## Description

SPEC 문서의 모든 요구사항(REQ-001~N)과 비기능 요구사항(NFR)을 구현된 코드가 만족하는지 검증합니다.

## Process

1. **SPEC 문서 읽기**: `.vibe/specs/{기능명}.md`
2. **TASKS 문서 확인**: 모든 Task가 ✅ 완료 상태인지 확인
3. **요구사항별 검증**:
   - REQ-001: 6개 알림 카테고리 정의 → DB 스키마 확인
   - REQ-002: 설정 저장 (P95 < 500ms) → 성능 테스트
   - REQ-003: 설정 조회 (P95 < 300ms) → 성능 테스트
   - REQ-004: 알림 필터링 동작 → 통합 테스트
   - REQ-005: 기본 설정 생성 → 유닛 테스트
   - REQ-006: UI 피드백 → 위젯 테스트
4. **비기능 요구사항 검증**:
   - 성능 (Performance): Locust로 부하 테스트
   - 보안 (Security): JWT 인증 확인
   - 접근성 (Accessibility): WCAG AA 기준
5. **검증 리포트 생성**: `.vibe/reports/{기능명}-verification.md`

## Agent

Quality Reviewer Agent

## Input

- `.vibe/specs/{기능명}.md` (SPEC 문서)
- `.vibe/tasks/{기능명}.md` (TASKS 문서)
- 구현된 코드 (backend/, frontend/)

## Output

- `.vibe/reports/{기능명}-verification.md` - 검증 리포트
- 통과/실패 요구사항 목록
- 성능 테스트 결과
- 개선 제안 사항

## Verification Checklist

### Functional Requirements
- [ ] REQ-001: 6개 알림 카테고리 정의
- [ ] REQ-002: 설정 저장 (P95 < 500ms)
- [ ] REQ-003: 설정 조회 (P95 < 300ms)
- [ ] REQ-004: 알림 필터링 동작
- [ ] REQ-005: 기본 설정 생성
- [ ] REQ-006: UI 피드백

### Non-Functional Requirements
- [ ] 성능: P95 응답 시간 목표 달성
- [ ] 보안: JWT 인증, 권한 검증
- [ ] 접근성: WCAG AA 기준 (4.5:1 대비, 48x48dp 터치)
- [ ] 확장성: 새 카테고리 추가 용이
- [ ] 가용성: 99.9% uptime

### Code Quality (TRUST 5)
- [ ] Test-first: Contract tests 작성
- [ ] Readable: Docstring, Type hints
- [ ] Unified: 일관된 스타일
- [ ] Secured: 보안 고려
- [ ] Trackable: Logging, Monitoring

### Tests
- [ ] 유닛 테스트 커버리지 > 80%
- [ ] 통합 테스트 통과
- [ ] E2E 테스트 통과 (실제 푸시 수신)
- [ ] 성능 테스트 통과 (Locust)

## Example

```
/vibe.verify "푸시 알림 설정 기능"
```

**결과:**
```markdown
# Verification Report: 푸시 알림 설정 기능

## Summary
- **전체 요구사항**: 12개
- **통과**: 12개 ✅
- **실패**: 0개
- **품질 점수**: 95/100 (A+)

## Functional Requirements (6/6 통과)
✅ REQ-001: 6개 알림 카테고리 정의
✅ REQ-002: 설정 저장 (P95: 420ms < 500ms)
✅ REQ-003: 설정 조회 (P95: 280ms < 300ms)
✅ REQ-004: 알림 필터링 동작
✅ REQ-005: 기본 설정 생성
✅ REQ-006: UI 피드백

## Non-Functional Requirements (4/4 통과)
✅ 성능: P95 < 500ms
✅ 보안: JWT 인증 적용
✅ 접근성: WCAG AA 준수
✅ 테스트 커버리지: 85%

## 개선 제안
- 캐시 히트율 80% 달성 (현재 75%)
```

## Next Step

검증 통과 시:
```
vibe deploy "푸시 알림 설정 기능"  # Staging 배포
```

검증 실패 시:
```
/vibe.run "Task X-Y"  # 실패한 Task 재구현
```
