---
name: {loop-name}
trigger: scheduled
schedule: "0 2 * * *"
goal: "{사람이 읽는 루프 목표 — 한 문장}"
discover: |
  {일거리를 발견하는 지시문.
  여러 줄 사용 가능.
  예: .vibe/regressions/open/*.md 를 스캔해 우선순위 높은 항목을 반환한다.}
pipeline:
  - vibe.spec
  - vibe.run
  - vibe.verify
verify: ledger
max_iterations: 10
isolation: none
# continuous: 한 호출에서 max_iterations 까지 계속 돈다 (기본)
# per-iteration: 한 바퀴만 돌고 끝낸다 — 반복은 스케줄러가 만든다.
#   컨텍스트가 호출마다 0에서 시작하므로 누적이 없다. 대신 매번 ANCHOR 문서를
#   다시 읽어야 하고, 회전 사이 맥락은 파일(원장·인박스)로만 넘어간다.
#   쓰려면 max_iterations 를 1 로 맞춰야 한다.
session: continuous
status: active
---

# 루프: {loop-name}

## 목적

{이 루프가 자동화하는 작업과 그 이유를 1–3문장으로 설명한다.}

## Discover 상세

{`discover` frontmatter 필드의 상세 설명.
루프 런타임이 어떤 소스를 보는지, 어떤 형식으로 항목이 반환되는지 기술한다.

예시:
- 스캔 대상: `.vibe/regressions/open/`
- 반환 형식: `- REQ-XXX-NNN: 설명` 불릿 목록
- 빈 결과 처리: 항목 없을 시 루프 즉시 종료}

## 항목별 파이프라인

{`pipeline` frontmatter에 나열된 각 스킬이 단일 항목에 대해 수행하는 작업을 설명한다.

| 단계 | 스킬 | 입력 | 출력 |
|------|------|------|------|
| 1 | vibe.spec | 항목 설명 | SPEC 파일 |
| 2 | vibe.run | SPEC | 구현 |
| 3 | vibe.verify | 구현 | 검증 결과 |
}

## 종료 조건

{루프가 단일 항목 처리를 완료로 판정하는 조건을 명시한다.}

- `verify: ledger` — `.vibe/metrics/run-ledger.json`의 `verifyPassed === true` (모델 자기 보고 불가)
- `verify: tests` — `test_command` exit code 0
- `verify: none` — 파이프라인 마지막 스킬 완료 시
- 연속 2회 `discoverHash` 동일 → stuck으로 중단, 인박스 기록
- `max_iterations` 소진 → 잔여를 인박스로 이월. **회전 수는 코드가 센다** —
  `loop-ledger.js iteration <name> <verified|unverified>` 로 기록하고
  `budget <name> <max>` 로 확인한다 (모델이 세지 않는다)
- 실행 실패(스킬 미설치·도구 부재·명령 비정상 종료) → stuck 이 아니라 즉시 종료.
  같은 방식으로 재시도하지 않는다

전문: `vibe/rules/loop-contract.md` (예산 · 실행 실패 절)

## 인박스 보고 형식

블록 형식과 최신순 정렬은 **명령이 보장한다** — 손으로 마크다운을 쓰지 않는다:

```bash
node "$HOOKS_DIR/loop-ledger.js" inbox {loop-name} <ok|fail|stuck> \
  "발견: N건 / 처리: M건 / 검증: {기준과 결과}" \
  "리뷰 필요: {사람이 확인해야 할 사항 — 없으면 없음}"
```

기록되는 형식: `## {loop-name} — {ISO 시각} — {결과}` + 본문 줄들.

> 루프는 push·release·배포를 수행하지 않는다. auto-commit verify 게이트 통과 시 커밋까지만.
