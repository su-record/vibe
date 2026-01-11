# Feature: {기능명}

> 이 파일은 **품질 보장의 핵심**입니다. 모든 시나리오 통과 = 기능 완성.

**SPEC**: `.claude/vibe/specs/{기능명}.md`
**Last verified**: -
**Quality score**: -

---

## User Story

**As a** {사용자 역할}
**I want** {원하는 기능}
**So that** {이유/가치}

---

## Scenarios

> 각 시나리오가 구현 단위이자 검증 단위입니다.

### Scenario 1: {Happy Path - 정상 케이스}

```gherkin
Scenario: {시나리오 제목}
  Given {전제 조건}
    # 검증: {무엇을 확인하는가}
  When {사용자 행동}
    # 검증: {어떤 기능이 실행되는가}
  Then {예상 결과}
    # 검증: {무엇이 보이거나 반환되는가}
```

**SPEC AC**: #1
**Status**: ⬜

---

### Scenario 2: {Edge Case - 에러 케이스}

```gherkin
Scenario: {에러 시나리오 제목}
  Given {전제 조건}
  When {잘못된 입력 또는 예외 상황}
  Then {에러 메시지 또는 적절한 처리}
```

**SPEC AC**: #2
**Status**: ⬜

---

### Scenario 3: {Boundary Case - 경계 케이스}

```gherkin
Scenario: {경계값 테스트}
  Given {전제 조건}
  When {경계값 입력}
  Then {적절한 처리}
```

**SPEC AC**: #3
**Status**: ⬜

---

## Coverage Summary

| # | Scenario | SPEC AC | Status | Retries |
|---|----------|---------|--------|---------|
| 1 | {Happy Path} | AC-1 | ⬜ | - |
| 2 | {Edge Case} | AC-2 | ⬜ | - |
| 3 | {Boundary Case} | AC-3 | ⬜ | - |

**Total**: 0/3 통과 (0%)

---

## Verification Commands

```bash
# 전체 검증
/vibe.verify "{기능명}"

# 실패 시 자동 수정
/vibe.run "{기능명}" --fix
```

---

## Notes

- 시나리오 추가/수정 시 Coverage Summary도 함께 업데이트
- Given/When/Then 각각에 검증 포인트 명시
- 모든 시나리오 통과 시 품질 보장됨
