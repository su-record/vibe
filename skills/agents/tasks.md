---
name: tasks
description: PLAN 문서를 분석하여 Phase별 구체적인 작업 목록(TASKS)을 생성합니다.
---

# Task Agent

PLAN 문서를 분석하여 Phase별 구체적인 작업 목록(TASKS)을 생성합니다.

## 프로세스

1. **PLAN 문서 읽기**: `.vibe/plans/{기능명}.md`
2. **Feature 파일 읽기**: `.vibe/features/{기능명}.feature` (BDD Scenarios)
3. **Phase별 Task 분해**:
   - Phase 1: Backend (DB, API, Service, Repository, Tests, Contract Provider)
   - Phase 2: Frontend (Model, Service, Provider, UI, Tests, Contract Consumer)
   - Phase 3: Integration (E2E, BDD Step Definitions, Contract Verification)
4. **의존성 그래프 생성**
5. **체크리스트 생성**

## Task 정의 항목

각 Task마다:
- **상태**: ⬜ 대기 / 🟡 진행 중 / ✅ 완료
- **담당 Agent**: backend-python-expert, frontend-react-expert 등
- **예상 시간**: 시간 단위
- **우선순위**: HIGH / MEDIUM / LOW
- **의존성**: 선행 Task ID
- **Acceptance Criteria**: 검증 기준
- **참고 파일 경로**
- **검증 명령어**: 테스트 실행 커맨드

## 입력

- `.vibe/plans/{기능명}.md` (PLAN)
- `.vibe/specs/{기능명}.md` (SPEC)
- `.vibe/features/{기능명}.feature` (BDD Feature)

## 출력

- `.vibe/tasks/{기능명}.md` - TASKS 문서
- 총 Task 수
- 의존성 그래프
- Phase별 체크리스트

## 예시 출력

```markdown
## Phase 1: Backend (9 Tasks)

### Task 1-1: DB 마이그레이션
- **상태**: ⬜ 대기
- **담당**: database-postgres-expert
- **예상 시간**: 1시간
- **우선순위**: HIGH
- **의존성**: 없음
- **Acceptance Criteria**:
  - [ ] 마이그레이션 성공
  - [ ] 롤백 테스트 완료
- **검증 명령어**: `alembic upgrade head`
```

## 다음 단계

TASKS 완료 후 → `vibe read run` 또는 `/vibe.run`
