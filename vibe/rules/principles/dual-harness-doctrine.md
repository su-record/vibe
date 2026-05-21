# Dual-Harness Doctrine

> vibe는 여러 하네스(Claude Code, Codex, Gemini) 위에서 동작한다.
> 차이는 경로·파일명 같은 **인프라**가 아니라 **인지 방식**에 있다.

## 비대칭의 본질

| | Claude Code | Codex |
|---|---|---|
| 모호한 요청 | 의도를 **추론**해 알아서 채움 | **직역** — 지시한 그대로만, 예시 텍스트도 실데이터로 |
| research 트리거 | planning mode를 켜야 시작 | 모드 없이 **자발적** 탐색 |
| 작업 단위 | 한 번에 working solution → 끝에 QA | **작게 순차** + 단계별 검증이 성공률 높음 |
| 도메인 지식 | 탐색을 맡겨도 됨 | 직접 주입할수록(라이브러리·함수·위치) 정확도↑ |

## Core Principle

> **vibe는 어떤 하네스의 *암묵적 동작*에도 의존하지 않는다.**
> **추론은 `/vibe` 디스패처가 앞단에서 한 번 하고, skill 본문은 모든 것을 명시적으로 쓴다.**

= **"명시성 공통분모 + 추론 앞단"** 모델

- **skill 본문 = 낮은 공통분모**: 명시적·직역-안전. Codex에서 안전하고 CC에서도 여전히 정확.
- **`/vibe` 디스패처 = 추론 레이어**: 모호한 자연어를 명시적 지시로 *먼저* 펼쳐, 모든 하네스에서 CC급 편의를 제공.

## Operating Rules

1. **추론은 앞단에서 단 한 번.** `/vibe`가 모호한 NL → 명시적·직역 가능한 지시로 전개한다. 하위 skill은 모호한 입력을 받지 않는다.
2. **예시·placeholder는 명시 표기.** 직역 하네스가 실데이터로 넣을 수 있는 예시 텍스트를 무표기로 쓰지 않는다. `<예시>`, `[채워넣을 값]`, `{{placeholder}}` 사용. (Codex는 무표기 예시를 그대로 테스트 데이터에 넣는다.)
3. **research는 명시적으로 트리거.** "planning mode" 스위치에 의존하지 않는다. 조사·탐색이 필요한 단계는 skill이 말로 지시한다.
4. **가장 작은 검증 단위로 분해.** 구현 → 검증 → 다음. 여러 단위를 묶지 않는다. (`vibe.run`의 시나리오 루프가 이미 이 방식 — ultrawork가 빅뱅으로 무너뜨리지 않게 유지.)
5. **도메인 지식은 SPEC에 주입.** SPEC/plan은 구체적 라이브러리명·함수명·파일 위치를 담는다. 선택이 아닌 **의무 출력** — Codex 정확도가 여기에 비례한다.

## Hooks Across Harnesses

CC의 풍부한 hook 모델(PreToolUse/PostToolUse/UserPromptSubmit/Stop)에는 Codex에 완전한 등가물이 없다. hook의 **의도**별로 하네스에 맞는 메커니즘에 매핑한다.

| hook 의도 | Claude Code | Codex |
|---|---|---|
| 라이프사이클 (turn 완료, 세션 시작/종료) | `Stop` / `SessionStart` hook | `config.toml`의 `notify` 프로그램 (agent-turn-complete 시 JSON 발화) |
| pre-edit / scope guard | `PreToolUse` (동기 deny) | ❌ 동기 인터셉트 없음 → AGENTS.md 운영 규칙 + notify 기반 사후 검증 |
| 키워드 디스패치 (ralph/ultrawork) | `UserPromptSubmit` | AGENTS.md 지시 (Codex가 직역 실행) |
| 금지 패턴 차단 | `PreToolUse` | AGENTS.md 규칙 + 에이전트에게 실행하라 지시한 check 명령 |

**핵심 통찰: Codex의 직역 성향이 AGENTS.md "soft hook"을 신뢰성 있게 만든다.** CC는 soft 지시를 가끔 무시해 hard hook이 필요하지만, Codex는 적힌 대로 실행한다. 따라서:

- **하드 라이프사이클 이벤트** → Codex `config.toml notify` (실제·결정적). `stop-dispatcher` 로직(auto-commit, devlog, review gate) 재사용 가능.
- **행동 가드** → AGENTS.md 운영 규칙. 직역이라 *오히려* 신뢰성 있음.
- **진짜 동기 pre-edit 차단은 Codex에서 불가** — 사후 검증을 완화책으로 수용한다.

> **Action item (미구현):** `.codex/settings.local.json`에 죽은 hook을 쓰는 것을 중단하고, 대신 `.codex/config.toml`에 `notify` 핸들러를 생성해 `stop-dispatcher` 로직을 재사용하며, 가드 규칙은 AGENTS.md로 방출한다.
