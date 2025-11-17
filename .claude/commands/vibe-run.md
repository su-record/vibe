# /vibe.run

Task를 구현합니다 (Implementation Agent).

## Usage

```
/vibe.run "Task 1-1"           # 특정 Task 실행
/vibe.run --phase 1            # Phase 1 전체 실행
/vibe.run --all                # 모든 Task 실행
```

## Description

TASKS 문서의 특정 Task를 읽고 구현 가이드를 생성한 후, 실제 코드를 작성합니다.

## Process

### 1️⃣ Task 정보 읽기
- `.vibe/tasks/{기능명}.md`에서 Task 찾기
- Task 메타데이터 확인:
  - 담당 Agent (Backend Python Expert / Frontend Flutter Expert)
  - 예상 시간
  - 우선순위
  - 의존성 (선행 Task 완료 여부 확인)
  - Acceptance Criteria

### 2️⃣ 구현 가이드 생성
- `.vibe/guides/task-{N}-{M}.md` 생성
- 포함 내용:
  - 목표 (Goal)
  - 파일 경로 (Files to Create/Modify)
  - 코드 템플릿 (Code Template)
  - 구현 순서 (Implementation Steps)
  - 검증 방법 (Verification)
  - 다음 Task

### 3️⃣ 코드 구현
- 구현 가이드에 따라 실제 파일 생성/수정
- 담당 Agent의 스킬 적용:
  - Backend Python Expert: `~/.vibe/agents/backend-python-expert.md`
  - Frontend Flutter Expert: `~/.vibe/agents/frontend-flutter-expert.md`
- TRUST 5 원칙 준수:
  - Test-first (Contract Testing)
  - Readable (명확한 코드)
  - Unified (일관된 스타일)
  - Secured (보안 고려)
  - Trackable (로깅, 모니터링)

### 4️⃣ Acceptance Criteria 검증
- TASKS 문서의 체크리스트 확인
- 검증 명령어 실행 (pytest, flutter test 등)
- 모든 기준 통과 확인

### 5️⃣ Task 상태 업데이트
- TASKS 문서에서 Task 상태를 ✅ 완료로 변경
- 완료 일시 기록
- 진행률 업데이트

## Agent Selection

| Task | Agent |
|------|-------|
| Task 1-1 ~ 1-8 (Backend) | Backend Python Expert |
| Task 2-1 ~ 2-8 (Frontend) | Frontend Flutter Expert |
| Task 3-1 ~ 3-2 (FCM Backend) | Backend Python Expert |
| Task 3-3 (E2E Test) | QA / Frontend Flutter Expert |

## Input

- `.vibe/tasks/{기능명}.md` (TASKS 문서)
- `.vibe/plans/{기능명}.md` (PLAN 참고)
- `.vibe/specs/{기능명}.md` (SPEC 참고)

## Output

- `.vibe/guides/task-{N}-{M}.md` - 구현 가이드
- 실제 코드 파일 (생성/수정)
- TASKS 문서 업데이트 (상태: ✅ 완료)

## Example

### 개별 Task 실행

```
/vibe.run "Task 1-1"
```

**동작:**
1. TASKS 문서 읽기
2. Task 1-1 정보 파싱:
   - 담당: Backend Python Expert
   - 내용: DB 마이그레이션 파일 작성
   - 예상 시간: 30분
3. 구현 가이드 생성: `.vibe/guides/task-1-1.md`
4. 코드 작성: `backend/alembic/versions/xxxx_add_notification_settings.py`
5. 검증: `alembic upgrade head` 실행
6. Task 상태 업데이트: ⬜ → ✅

### Phase 실행

```
/vibe.run --phase 1
```

**동작:**
- Phase 1의 8개 Task 순차 실행
- Task 1-1 → 1-2 → ... → 1-8
- 각 Task마다 의존성 확인 후 실행

### 전체 실행

```
/vibe.run --all
```

**동작:**
- 의존성 그래프에 따라 19개 Task 순차 실행
- Phase 1 (8개) → Phase 2 (8개) → Phase 3 (3개)
- 예상 시간: 24시간

## Verification

각 Task 완료 후:
- [ ] Acceptance Criteria 모두 통과
- [ ] 검증 명령어 실행 성공
- [ ] 코드 품질 기준 충족 (TRUST 5)
- [ ] TASKS 문서 상태 업데이트

## Error Handling

Task 실행 실패 시:
1. 에러 메시지 확인
2. 구현 가이드 재검토
3. 코드 수정 후 재시도
4. 여전히 실패 시 사용자에게 보고

## Next Step

Task 완료 후:
- 의존성 그래프 확인
- 다음 Task 실행 또는 Phase 완료 확인
- 모든 Task 완료 시:
  ```
  /vibe.verify "푸시 알림 설정 기능"
  ```
