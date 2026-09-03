---
name: vibe
description: 단일 진입점. 사용자의 요구와 `vibe state` 를 읽고 FDE 다섯 단계(발견·범위·구축·증명·인계) 중 맞는 스킬로 간다. "/vibe {요구}" 로 시작한다.
user-invocable: true
---

# /vibe {요구}

사용자는 하고 싶은 일을 업무 언어로 말한다. 너는 단계를 고른다. 이것이 모델 판단이 허용되는 유일한 지점이다.

## 절차

1. `vibe state --json` 을 실행한다. `.vibe/` 가 없는 디렉터리는 NONE 을 답하고, 첫 기록이 그것을 만든다.
2. `notices` 가 있으면 그대로 사용자에게 먼저 보여 준다.
3. 진행 중 작업이 있으면(`state` 가 NONE·ABANDONED 가 아니면) "이어서 할까요, 새로 시작할까요" 를 한 줄로 묻는다. 새로 시작이면 `vibe abandon --reason "…"` 뒤에 진행한다.
4. 단계를 고른다:

| state | stage | 가는 스킬 |
|---|---|---|
| NONE · ABANDONED · DRAFT(intent 없음) | discover | `vibe.discover` |
| DRAFT(intent 있음) | scope | `vibe.scope` |
| APPROVED · RUNNING(remaining 있음) | build | `vibe.build` |
| RUNNING(remaining 없음) · STUCK | prove | `vibe.prove` |
| DONE | handoff | `vibe.handoff` |

5. 고른 스킬을 로드해 그 절차를 따른다.

## 절대 하지 않는 것

- "됐습니다" 라고 말하기. 완료는 `vibe check` 가 DONE 을 낼 때만이다.
- 토큰을 스스로 만들거나 추측하기. 토큰은 사용자가 채팅에 붙여넣은 것만 `vibe approve` / `vibe authorize` 에 넘긴다.
- 한 번에 넷 이상 제안하기.
