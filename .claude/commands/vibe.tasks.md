---
description: Create TASKS document with Task Agent
argument-hint: "feature name"
---

# /vibe.tasks

TASKS 문서를 작성합니다 (Task Agent).

## Usage

```
/vibe.tasks "기능명"
```

## Description

PLAN 문서를 분석하여 Phase별 구체적인 작업 목록(TASKS)을 생성합니다.

## Process

1. **PLAN 문서 읽기**: `.vibe/plans/{기능명}.md` 분석
2. **Feature 파일 읽기**: `.vibe/features/{기능명}.feature` 확인 (BDD Scenarios)
3. **Phase별 Task 분해**:
   - Phase 1: Backend 개발 (DB, API, Service, Repository, Unit Tests, **Contract Provider**)
   - Phase 2: Frontend 개발 (Model, Service, Provider, UI, Unit Tests, **Contract Consumer**)
   - Phase 3: 통합 및 테스트 (FCM, E2E, **BDD Step Definitions**, **Contract Verification**)
4. **각 Task마다 정의**:
   - 상태 (⬜ 대기 / 🟡 진행 중 / ✅ 완료)
   - 담당 Agent
   - 예상 시간
   - 우선순위 (HIGH/MEDIUM/LOW)
   - 의존성 (선행 Task)
   - Acceptance Criteria (검증 기준)
   - 참고 파일 경로
   - 검증 명령어
4. **의존성 그래프 생성**: Task 간 실행 순서 시각화
5. **체크리스트 생성**: 코드 품질, 테스트, 문서, SPEC 검증

## Agent

`~/.vibe/agents/task-agent.md`

## Input

- `.vibe/plans/{기능명}.md` (PLAN 문서)
- `.vibe/specs/{기능명}.md` (SPEC 문서)
- `.vibe/features/{기능명}.feature` (BDD Feature 파일)

## Output

- `.vibe/tasks/{기능명}.md` - TASKS 문서
- 총 Task 수
- 의존성 그래프
- Phase별 체크리스트

## Example

```
/vibe.tasks "푸시 알림 설정 기능"
```

**결과:**
- 23개 Task (Phase 1: 9개, Phase 2: 9개, Phase 3: 5개)
  - **Phase 1:** DB, API, Service, Repository, Unit Tests, **Contract Provider 정의**
  - **Phase 2:** Model, Service, Provider, UI, Unit Tests, **Contract Consumer 정의**
  - **Phase 3:** FCM, E2E, **BDD Step Definitions**, **Contract Verification**
- 의존성 그래프 포함
- 각 Task별 Acceptance Criteria
- BDD Scenarios와 매핑된 Contract Test Tasks

## Next Step

```
/vibe.run "Task 1-1"
```

또는:

```
/vibe.run --phase 1  # Phase 1 전체 실행
/vibe.run --all      # 모든 Task 실행
```
