---
name: nightly-triage
trigger: scheduled
schedule: "0 6 * * *"
goal: "open 회귀 0건, 테스트 실패 0건을 유지한다"
discover: |
  우선순위순 일거리 목록을 만든다 (P1 먼저):
  1. .vibe/regressions/ 및 .claude/vibe/regressions/ 에서 status: open 항목
  2. npm run build && npx vitest run 실패 테스트
  3. .vibe/contracts/ 가 있으면 drift 의심 항목
  반환 형식: `- [P1|P2] <출처>: <설명>` 불릿 목록. 항목 없으면 "EMPTY".
pipeline:
  - vibe.run
  - vibe.verify
verify: ledger
max_iterations: 5
isolation: worktree
status: active
---

# 루프: nightly-triage

## 목적

밤사이 회귀·테스트 실패·계약 drift를 스스로 발견해 SPEC 범위 내에서 수정하고, 검증 통과분만 커밋 후보로 만들어 아침 인박스에 보고한다.

## Discover 상세

- 스캔 대상: 회귀 레지스트리(open), vitest 전체 실행 결과, 계약 디렉토리
- 반환 형식: `- [P1] regress/<slug>: <증상>` 불릿 목록
- 빈 결과 처리: "EMPTY"면 ledger에 ok 기록 후 즉시 종료 (인박스에 "발견 0건" 1줄)

## 항목별 파이프라인

| 단계 | 스킬 | 입력 | 출력 |
|------|------|------|------|
| 1 | vibe.run | 회귀 기록/실패 테스트 (기존 SPEC 범위 내) | 수정 |
| 2 | vibe.verify | 수정 | run-ledger verifyPassed |

## 종료 조건

- `verify: ledger` — `.vibe/metrics/run-ledger.json`의 `verifyPassed === true` (모델 자기 보고 불가)
- 연속 2회 `discoverHash` 동일 → stuck으로 중단, 인박스 기록
- max_iterations 5 도달 시 잔여 항목을 인박스로 이월

## 인박스 보고 형식

```
## [nightly-triage] {YYYY-MM-DD HH:mm}

- **결과**: ok | fail | stuck
- **처리한 항목**: {항목 설명}
- **검증 상태**: verifyPassed=true | false
- **리뷰 필요**: {사람이 확인해야 할 사항. 없으면 "없음"}
```

> 루프는 push·release·배포를 수행하지 않는다. auto-commit verify 게이트 통과 시 커밋까지만.
