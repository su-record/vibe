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

## 인박스 보고 형식

{각 반복 완료 후 `.vibe/loops/inbox.md`에 추가되는 항목 형식.}

```
## [{loop-name}] {YYYY-MM-DD HH:mm}

- **결과**: ok | fail | stuck
- **처리한 항목**: {항목 설명}
- **검증 상태**: verifyPassed=true | false
- **리뷰 필요**: {사람이 확인해야 할 사항. 없으면 "없음"}
```

> 루프는 push·release·배포를 수행하지 않는다. auto-commit verify 게이트 통과 시 커밋까지만.
