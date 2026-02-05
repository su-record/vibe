---
description: "세션 종료 전 HANDOFF.md 작업 인계 문서 생성. 인계, handoff, 세션 정리 키워드에 자동 활성화."
---

# Handoff — 세션 인계 문서 생성

세션 종료 전 작업 상태를 기록하여 다음 세션에서 즉시 이어서 작업할 수 있도록 한다.

## HANDOFF.md란?

컨텍스트 리셋 전에 현재 작업 상태를 기록하는 파일이다. 새 세션에서 이 파일만 읽으면 바로 이어서 작업할 수 있다.

### `/vibe.utils --continue`와의 차이점

| 항목 | `/vibe.utils --continue` | Handoff |
|------|--------------------------|---------|
| 방식 | 자동 세션 컨텍스트 복원 | 수동 인계 문서 생성 |
| 포함 정보 | 메모리 + 세션 상태 | 작업 진행상황 + 주의사항 + 파일 목록 |
| 사용 시점 | 새 세션 시작 시 | 세션 종료 전 |
| 용도 | 빠른 자동 복원 | 상세한 인수인계 (팀/미래 자신) |

## 사용 시점

- 컨텍스트가 80-100k 토큰에 도달했을 때
- `/compact` 3회 사용 후
- 작업을 장시간 중단하기 전
- 복잡한 작업 중간에 진행상황 기록이 필요할 때

## vibe 도구 연계

Handoff 생성 전에 vibe 내장 도구를 활용하여 현재 상태를 저장한다:

```bash
# 현재 세션 컨텍스트 저장
core_auto_save_context

# 중요 결정사항 메모리에 저장
core_save_memory --key "handoff-decision" --value "인증 방식을 JWT로 결정" --category "project"

# 저장된 메모리 확인
core_list_memories --category "project"
```

## HANDOFF.md 생성 템플릿

```markdown
# 작업 인계 문서

## 완료된 작업
- [x] 완료된 작업 1
- [x] 완료된 작업 2

## 진행 중인 작업
- [ ] 현재 작업 중인 것
  - 진행 상황: 70%
  - 다음 단계: ~~ 구현

## 다음에 해야 할 작업
1. 우선순위 높은 작업
2. 그다음 작업

## 주의사항
- 건드리면 안 되는 파일: ~~
- 알려진 버그: ~~
- 임시 해결책: ~~

## 관련 파일
- src/components/Login.tsx — 로그인 폼
- src/api/auth.ts — 인증 API

## 마지막 상태
- 브랜치: feature/auth
- 마지막 커밋: abc1234
- 테스트 상태: 통과
```

## 생성 절차

1. `git status`로 현재 변경 파일 확인
2. `git log --oneline -5`로 최근 커밋 확인
3. 진행 중인 작업과 남은 작업을 정리
4. `core_auto_save_context`로 세션 컨텍스트 저장
5. `core_save_memory`로 핵심 결정사항 저장
6. HANDOFF.md 파일 생성

## 새 세션에서 복원

```
HANDOFF.md 읽고 이어서 작업해줘
```

또는 vibe 자동 복원과 병행:

```
/vibe.utils --continue
```

이 경우 `core_recall_memory`로 저장된 결정사항도 함께 복원된다.
