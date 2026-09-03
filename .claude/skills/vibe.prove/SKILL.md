---
name: vibe.prove
description: 증명 — `vibe check --all` 로 시나리오 전부와 회귀를 한 번에 돌려 DONE 을 받는다. STUCK 이면 멈추고 묻는다.
user-invocable: false
---

# 증명 (prove)

## 절차

1. `vibe check --all --json` 을 실행한다. 시나리오 전부 + 등록된 회귀가 한 번에 돈다.
2. 결과를 사용자에게 표로 보여 준다: 시나리오 · 검사 유형 · 통과/실패/보류 · 걸린 시간. `human` 항목은 "사람 확인 요청됨" 으로 적고 인박스 id 를 붙인다.
3. 실패가 있으면 `vibe.build` 로 돌아가 고친다. STUCK(`stuck: true`)이면 고치지 말고 인박스의 질문을 사용자에게 보여 주고 답을 기다린다.
4. 먼저 말할 것(최대 3, 근거 필수): 한 번도 안 돈 시나리오, 통과·실패가 오간 검사(evidence 이력), 상한에 걸린 런(`tail` 에 killed).
5. `done: true` 면 `vibe.handoff` 로 넘어간다.

## DONE 의 뜻

DONE 은 지금 이 트리에서 모든 게이트 시나리오가 통과했다는 뜻이다. 파일을 하나라도 바꾸면 하네스가 RUNNING 으로 되돌린다. 그때는 다시 `vibe check --all`.
