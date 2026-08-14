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

Codex는 네이티브 hook을 지원한다(`codex features list` → `hooks: stable`). 두 하네스의 이벤트 집합은 이제 거의 겹치므로, **경로만 다르고 의도는 같게** 매핑한다.

> 과거 이 자리에는 "Codex에 완전한 등가물이 없다" 고 적혀 있었다. 실측(2026-08-13)으로 낡은 서술임을 확인했다 — Codex는 SessionStart · UserPromptSubmit · PreToolUse · PostToolUse · PermissionRequest · Stop · SessionEnd · Pre/PostCompact · SubagentStart/Stop 를 제공한다.

| hook 의도 | Claude Code | Codex |
|---|---|---|
| 세션 시작 | `SessionStart` | `.codex/hooks.json` → `SessionStart` |
| 키워드 디스패치 | `UserPromptSubmit` | `UserPromptSubmit` |
| pre-edit / scope guard | `PreToolUse` (동기 deny) | `PreToolUse` (동기 deny) |
| 금지 패턴 차단 | `PreToolUse` | `PreToolUse` + AGENTS.md 규칙 (이중 방어) |
| 편집 후 품질 검사 | `PostToolUse` | `PostToolUse` |
| 압축 전 체크포인트 | `Notification` (context_window_*) | `PreCompact` — 임계치 추정이 아닌 확정 신호라 더 정확 |
| **압축 후 재고정** | (없음 — 모델이 `anchor` 호출) | **`PostCompact` → `loop-ledger.js anchor`** |
| 라이프사이클 (turn 완료) | `Stop` hook | `config.toml` 의 `notify` (아래 참조) |

**`Stop` 이 아니라 `notify` 를 쓰는 이유**: Codex 도 `Stop` 이벤트를 제공하고 vibe 도 등록해 두었지만, turn 완료 후처리(auto-commit·devlog)는 `notify` 가 담당한다. 둘 다에서 실행하면 커밋이 중복된다 — `Stop` 핸들러는 의도적으로 비워 둔다.

**미등록 이벤트와 이유**: `SessionEnd`(타임아웃 1초 — 무거운 작업 불가) · `SubagentStart/Stop`(계측 외 용도 없음) · `PermissionRequest`(비용 게이트를 하네스 강제로 올릴 자리 — 후보로 남김).

**구현**: `hooks/scripts/codex-hook-adapter.js`가 Codex hook 이벤트를 기존 vibe hook 스크립트로 번역하고 deny 결정(JSON)을 보존한다. 설치는 `installProjectCodexHooks()` → `.codex/hooks.json` (프로젝트 로컬, gitignored). 라이프사이클 후처리(auto-commit·devlog)는 `codex-notify.js`가 `notify` 경로로 담당한다.

**핵심 통찰: Codex의 직역 성향이 AGENTS.md "soft hook"을 신뢰성 있게 만든다.** CC는 soft 지시를 가끔 무시해 hard hook이 필요하지만, Codex는 적힌 대로 실행한다. 따라서 AGENTS.md 운영 규칙은 네이티브 hook이 생긴 뒤에도 **폐기하지 않고 2차 방어선으로 유지한다** — hook이 설치되지 않은 환경(전역 설치만 한 경우, 다른 클론)에서도 가드가 남는다.

> ⚠️ **훅은 "설치돼 있다"고 가정하지 않는다.** 훅은 프로젝트 로컬 아티팩트라 `vibe upgrade` 만으로는 설치되지 않는다(전역 자산만 갱신). `vibe status` 가 하네스별 훅 설치 여부를 보고하고, `vibe upgrade` 는 현재 프로젝트의 누락 훅을 복구한다. 결정론적 가드의 생사는 **관측 가능해야** 한다 — 조용히 죽은 가드는 없는 가드보다 나쁘다.
