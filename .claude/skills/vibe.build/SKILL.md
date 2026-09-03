---
name: vibe.build
description: 구축 — 승인된 시나리오를 하나씩 만들고, 만들 때마다 `vibe check <id>` 로 하네스가 판정한다. "됐다" 고 말하지 않는다.
user-invocable: false
---

# 구축 (build)

## 절차

1. `vibe state --json` 의 `remaining` 순서대로 시나리오 하나를 고른다. `irreversible` 이 붙은 것은 마지막에 둔다.
2. 그 시나리오를 통과시키는 데 필요한 것만 만든다 — 코드·스크립트·문서·설정 무엇이든. 검사 명령(`check.cmd`, `check.path`)이 실제로 돌 수 있게 만든다.
3. `vibe check {id} --json` 을 실행한다.
   - 통과(`code 0`)면 다음 시나리오.
   - 실패(`code 1`)면 `tail` 을 읽고 고친다. 같은 실패가 두 번이면 하네스가 STUCK 을 내고 인박스에 질문을 남긴다 — 멈추고 사용자에게 그 질문을 보여 준다.
4. 고친 실패는 `vibe regress record --scenario {id} --title "…" --check-from-evidence {run}` 으로 남긴다.
5. `remaining` 이 비면 `vibe.prove` 로 넘어간다.

## 되돌릴 수 없는 행동

`irreversible` 시나리오의 실제 실행(발송·배포·삭제·지출) 전에는 반드시:

```
vibe ask "{무엇을 하려는지 한 줄}" --needs authorize:{행동} --target "{대상}" --json
```

응답의 토큰을 사용자에게 보여 주고, 사용자가 붙여넣으면 `vibe authorize "{번호}" --action {행동} --target "{대상}"` 이 `code 0` 을 낸 뒤에만 실행한다. 드라이런은 토큰 없이 해도 된다.

## 절대 하지 않는 것

- 검사 명령을 통과시키려고 검사 자체를 약화시키기 (scenarios.yaml 을 고치면 승인이 무효가 된다 — 하네스가 막는다).
- `vibe check` 없이 "통과했다" 고 말하기.
