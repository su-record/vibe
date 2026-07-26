# Automation Level — vibe.run 자율성 축

> vibe.run SKILL.md 에서 `automationLevel` 동작이 필요할 때 로드한다.
>
> **SSOT는 `vibe/rules/loop-contract.md`다.** 이 파일은 그 계약이 vibe.run 안에서
> 구체적으로 무엇을 바꾸는지만 설명한다. 값·별칭·exit 조건을 여기서 새로 정의하지 않는다.

## 값은 둘뿐이다

| `automationLevel` | 사람 개입 |
|---|---|
| `confirm` (기본) | SPEC 승인 1회 + stuck 시 질문 |
| `autonomous` | SPEC 승인·stuck 질문 모두 skip |

> ⚠️ **stuck 은 두 값 모두에서 루프를 종료한다.** `autonomous` 가 바꾸는 것은 "사람에게 묻는지" 뿐이며, stuck 난 루프를 더 돌린다는 뜻이 아니다 (2회 연속 동일 발견은 정의상 재시도가 무의미). 미달은 TODO 로 남기고 다음 독립 단위로 넘어가며, **완료로 기록하지 않는다.** SSOT: `vibe/rules/loop-contract.md` stuck 절.

`.vibe/config.json` 에서 설정한다. 루프 자체(ANCHOR→ACT→JUDGE→RECORD)는 두 값에서
**동일하게** 돌아간다 — automationLevel 은 루프의 유무가 아니라 **질문 여부**를 바꾼다.

> ⛔ L0/L1/L4 같은 레벨 체계는 없다. 과거 이 문서가 5단계 레벨과 confirmation matrix 를
> 정의했지만 loop-contract 에 그런 값은 존재하지 않았다 — 실행할 수 없는 스펙이었다.
> `manual`/`guided`/`full-auto` 를 요구하는 지시를 만나면 위 두 값으로 환원한다.

## `autonomous` 가 vibe.run 에서 바꾸는 것

| 항목 | `confirm` | `autonomous` |
|---|---|---|
| stuck 처리 | **루프 종료** + 사용자에게 질문 | **루프 종료** + TODO 기록 후 다음 시나리오 (질문 없음) |
| ACT 병렬화 | 순차 허용 | 서로 의존하지 않는 시나리오 병렬 |
| 컨텍스트 85%+ | 경고 | 자동 저장 |
| 외부 LLM (GPT/Antigravity) | 명시 요청 시 | 활성화돼 있으면 자동 상담 |
| Race Review | 명시 요청 시 | 기본 활성 |

**바뀌지 않는 것**: 시나리오 단위 구현→검증 원자성. `autonomous` 라도 여러 시나리오를
묶어 빅뱅으로 만들지 않는다 (SSOT: SKILL.md "하네스-안전 증분").

## 파괴적 작업은 자율성과 무관하다

`autonomous` 는 **파일 수정·테스트 실행**의 확인을 없애는 것이고, 아래는 어느 값에서도
사람 확인을 받는다:

- push / release / 배포 / 버전 범프 — 루프의 권한 밖 (loop-contract "금지")
- 되돌리기 어려운 삭제, 외부 발송

## Deprecated 별칭

매핑 SSOT 는 `vibe/rules/loop-contract.md` Deprecated 별칭 표다. 여기서 다시 정의하지
않는다 — 요약하면 `ultrawork`/`ulw` → `automationLevel: autonomous` + 병렬 ACT,
`ralph`/`verify` → 기본 동작(no-op), `quick` → `--max-iter 1`.
