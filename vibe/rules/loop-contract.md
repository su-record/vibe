# Loop Contract — vibe 실행의 기본 계약 (SSOT)

> `/vibe`의 기본 동작은 **단계별 1회 실행이 아니라 완성까지의 루프**다.
> 루프가 기본이 될 수 있는 이유: 폭주 방어가 모델의 양심이 아니라 결정론적 가드(코드)이기 때문.
> 이 문서가 루프 시맨틱의 유일한 정의다 — ralph/Boulder/Convergence 등 과거 명칭은 전부 이 계약의 파라미터로 환원된다.

## 적용 범위

- **적용**: 검증 가능한 목표가 있는 실행 — `vibe.run`, `vibe.verify`, `vibe.review`, `vibe.loop` 및 이들을 체인하는 `/vibe` 파이프라인
- **제외**: 단발 조회·생성 작업 (`vibe.docs`, `vibe.analyze`, `vibe.scaffold` 등) — 루프 의례를 강제하지 않는다

## 계약

```
/vibe {요구사항}
  → SPEC 확정  ← 유일한 의무적 사람 개입 지점 (DONE의 정의 = REQ-ID + 수용 기준 승인)
  → 루프:
      ANCHOR   디스크에서 재고정: SPEC + run-ledger + scope.json (+ 직전 인박스)
      ACT      파이프라인 실행 (스킬 체인)
      JUDGE    결정론 판정만 인정: run-ledger verifyPassed │ 테스트 exit code │ RTM status
               — 모델의 "완료했습니다" 자기 보고는 종료 조건이 될 수 없다
      RECORD   run-ledger(현재 회전) + loop-history.jsonl(회전 이력, 스케줄 루프)
  → 종료(EXIT): 게이트 전부 통과 │ stuck │ max_iterations │ 예산 상한
```

### ANCHOR가 컨텍스트 오염 방어인 이유
루프 상태는 컨텍스트가 아니라 디스크에 산다. 매 회전이 아티팩트에서 다시 시작하므로 컨텍스트가 오염되거나 compact로 소실돼도 루프는 깨지지 않으며, 회전마다 fresh 컨텍스트(서브에이전트)로 돌려도 된다.

### stuck (결정론)
연속 2회 회전의 발견(discover/findings) 해시가 동일 → 중단하고 사람에게 (`loop-ledger.js check-stuck`이 판정·기록). "다시 해보면 될 것 같다"는 모델 판단으로 무시 금지.

## 파라미터 (기본값)

| 파라미터 | 기본 | 의미 |
|---|---|---|
| `max_iterations` | 10 | 회전 상한. 도달 시 잔여를 인박스로 이월 |
| `exit` | 게이트 통과 (P1=0 ∧ verifyPassed) | 종료 기준. coverage 100% 등으로 상향 가능 |
| `--interactive` | off | 단계별 확인 모드 (회전마다 사람 승인 — 과거의 기본값) |
| `--max-iter N` | — | 회전 상한 명시 (N=1이면 1회 시도) |
| `automationLevel` | `confirm` | `confirm`(SPEC·stuck에서 질문) / `autonomous`(기록 후 계속, 비대화형) — `.vibe/config.json` |

## 금지 (루프 권한 경계)

루프는 push·release·배포·버전 범프를 수행하지 않는다. 커밋은 auto-commit verify 게이트 통과 시만. 결과는 인박스(사람 리뷰 큐)로.

## Deprecated 별칭 (하위 호환 매핑 — 새 문서에서 가르치지 않는다)

| 별칭 | 환원 |
|---|---|
| `ralph` | 기본 동작과 동일 (no-op). 굳이 구분하면 `exit: coverage-100` |
| `verify` | 기본 동작과 동일 (no-op) — JUDGE는 항상 결정론 검증 |
| `quick` | `--max-iter 1` + 최소 JUDGE |
| `ralplan` | 같은 계약을 계획 단계에 적용 |
| `ultrawork` / `ulw` | `automationLevel: autonomous` + 병렬 ACT — 루프 시맨틱이 아니라 자율성·병렬성 축 |
