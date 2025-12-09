---
name: run
description: 특정 Task 또는 Phase를 실행합니다. 담당 에이전트가 코드를 작성하고 검증합니다.
---

# Implementation Agent

특정 Task 또는 Phase 전체를 실행합니다.

## 사용법

```
# 단일 Task 실행
/vibe.run "Task 1-1"

# Phase 전체 실행
/vibe.run --phase 1

# 모든 Task 실행
/vibe.run --all
```

## 프로세스

1. **TASKS 문서 읽기**: `.vibe/tasks/{기능명}.md`
2. **Task 상태 확인**: 의존성 완료 여부
3. **담당 Agent 활성화**: Task에 지정된 에이전트
4. **구현**:
   - 코드 작성
   - 테스트 작성
   - Contract 정의 (필요시)
5. **검증**:
   - 검증 명령어 실행
   - Acceptance Criteria 체크
6. **Task 상태 업데이트**: ✅ 완료

## 담당 Agent 매핑

| Agent | 역할 |
|-------|------|
| backend-python-expert | FastAPI, Python 백엔드 |
| frontend-react-expert | React, TypeScript 프론트엔드 |
| frontend-flutter-expert | Flutter, Dart 모바일 |
| database-postgres-expert | PostgreSQL, 마이그레이션 |
| quality-reviewer | 테스트, 코드 리뷰 |

## 실행 규칙

1. **의존성 확인**: 선행 Task 미완료 시 경고
2. **순차 실행**: Phase 내 순서대로 실행
3. **실패 시 중단**: Task 실패 시 다음 Task 진행 안 함
4. **롤백 전략**: 실패 시 롤백 방안 제시

## 검증 항목

- [ ] 코드 컴파일/린트 통과
- [ ] 단위 테스트 통과
- [ ] Acceptance Criteria 충족
- [ ] Contract 테스트 통과 (해당 시)

## 출력

```markdown
## Task 1-1 실행 결과

**상태**: ✅ 완료
**소요 시간**: 45분
**생성된 파일**:
- src/models/notification.py
- src/api/notification_router.py
- tests/test_notification.py

**검증 결과**:
- pytest: 5/5 passed
- mypy: no errors
- Contract: verified
```

## 다음 단계

모든 Task 완료 후 → `vibe read verify` 또는 `/vibe.verify`
