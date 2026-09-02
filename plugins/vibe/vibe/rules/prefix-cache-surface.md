# 프리픽스 캐시 표면

> 매 요청의 **앞부분에 항상 실리는 자산**이 무엇이고, 그것을 건드리면 무엇이 깨지는지.
> 검증: `npm run validate:cache-surface` (CI `test` job).

## 왜 이 문서가 있는가

컨텍스트 정책(85% 룰, `/new` 가 KV 프리픽스 캐시를 전량 폐기한다)은 `CLAUDE.md` 에 한 줄로
적혀 있었다. 그 한 줄은 **어떤 파일을 고치면 캐시가 깨지는지**를 말해주지 않는다 — 그래서
"상시 로드 자산에 문단 하나 추가" 같은 변경이 리뷰에서 그냥 통과한다. 비용은 그 PR 이
아니라 이후 모든 세션의 첫 토큰에서 나온다.

여기서 고정하는 것은 두 가지다: **모델이 이 자산을 어떻게 경험하는가**(Model Experience)와
**이 자산을 바꾸면 캐시가 어떻게 되는가**(KV Cache effect). 자산이 늘거나 사라지면 게이트가 막는다.

## 무효화의 규칙 (모든 표면 공통)

프리픽스 캐시는 **접두사 일치**로 재사용된다 — 앞에서 한 바이트가 달라지면 그 뒤는 전부
다시 계산된다. 따라서 비용은 "얼마나 고쳤나" 가 아니라 **"얼마나 앞에서 고쳤나"** 로 정해진다.
표면을 아래 순서대로 읽는다: 위쪽일수록 한 글자의 대가가 크다.

<!-- surface: always-loaded-docs -->
## 표면 1 — 루트 지침 문서 (`CLAUDE.md` · `AGENTS.md`)

- **Model Experience**: 세션 시작 시 **전문이** 시스템 프롬프트에 들어간다. 모델은 이 문서를
  "검색해서 찾는 문서" 가 아니라 **이미 알고 있는 규칙**으로 경험한다 — 그래서 여기 적힌 것은
  탐색 없이 즉시 적용되고, 여기 없는 것은 존재를 모른다.
- **KV Cache effect**: 프리픽스의 가장 앞쪽에 가깝다. **한 줄만 고쳐도 그 아래 전체가 무효화**되고,
  이후 모든 세션이 첫 요청에서 전문을 다시 계산한다. 문단 추가는 상시 비용이므로, 상세는
  `vibe/rules/**` 로 내리고 루트에는 **포인터만** 남긴다.

| 자산 | 비고 |
|---|---|
| `CLAUDE.md` | content SSOT |
| `AGENTS.md` | `CLAUDE.md` 에서 생성 (`npm run gen:agents-md`) |

<!-- surface: prefix-hooks -->
## 표면 2 — 프리픽스에 stdout 을 얹는 훅

훅 전체가 아니라 **턴 앞단에서 도는 두 이벤트**만 해당한다. `PreToolUse`/`PostToolUse`/`Stop` 은
턴 중간에 끼어들어 이미 만들어진 프리픽스를 바꾸지 않는다.

- **Model Experience**: 이 훅의 stdout 은 모델에게 **사용자가 말하지 않은 지시문**으로 보인다.
  출처 표시가 없으면 사용자 발화와 구분되지 않으므로, 출력은 짧고 라벨이 붙어야 한다.
- **KV Cache effect**: `SessionStart` 출력은 세션 프리픽스에 **한 번** 박힌다 — 길이가 그대로
  상시 비용이다. `UserPromptSubmit` 출력은 **매 턴** 프리픽스 끝에 붙는다. 출력이 턴마다
  달라지면(시각·카운터·랜덤 순서) 그 지점부터 재사용이 끊기므로, **불변 텍스트를 앞에, 가변
  텍스트를 뒤에** 둔다.

| 이벤트 | 스크립트 |
|---|---|
| SessionStart | `hooks/scripts/session-start.js` |
| UserPromptSubmit | `hooks/scripts/prompt-dispatcher.js` |

<!-- surface: agents -->
## 표면 3 — 에이전트 frontmatter `description`

- **Model Experience**: 에이전트 **본문은 로드되지 않는다.** 모델이 항상 보는 것은 이름과
  `description` 한 줄뿐이고, 위임 여부는 전적으로 그 한 줄로 결정된다. description 이 비면
  에이전트는 설치돼 있어도 **없는 것과 같다** (실측: frontmatter 가 YAML 파싱에 실패해 통째로
  버려진 설치본이 11개 중 4개였다 — `CLAUDE.md` Gotchas).
- **KV Cache effect**: 에이전트 목록 전체가 프리픽스에 실린다. 에이전트를 **추가·삭제**하면
  목록이 바뀌어 그 뒤가 무효화되고, description 을 한 글자 고쳐도 같다. 본문을 아무리 늘려도
  프리픽스는 커지지 않는다 — **길이는 본문으로, 신호는 description 으로**.

| 에이전트 |
|---|
| `agents/architect.md` |
| `agents/build-error-resolver.md` |
| `agents/code-reviewer.md` |
| `agents/e2e-tester.md` |
| `agents/implementer.md` |
| `agents/security-reviewer.md` |
| `agents/tester.md` |
| `agents/event/event-ops.md` |
| `agents/event/event-planner.md` |
| `agents/ui/design-reviewer.md` |
| `agents/ui/design-system-gen.md` |

<!-- surface: skills -->
## 표면 4 — 스킬 frontmatter `description` (집계)

- **Model Experience**: 에이전트와 같다 — **본문은 호출될 때만** 로드되고, 상시 실리는 것은
  `name` + `description` 이다. 따라서 스킬 본문의 길이는 라우팅 정확도에 기여하지 않는다.
  라우팅은 description 이 한다.
- **KV Cache effect**: 스킬 **개수**가 프리픽스 길이를 좌우한다. 스킬을 하나 추가하면 목록이
  길어져 그 뒤가 무효화된다. 그래서 스택·capability 로 갈라 설치하는 것이다 — 아무 프로젝트에나
  실릴 이유가 없는 스킬은 내려둔다 (`GLOBAL_SKILLS_*` / `STACK_TO_SKILLS` / `CAPABILITY_SKILLS`).
- **개수 검증은 여기서 하지 않는다** — `npm run validate:counts` 가 이미 그 사실의 집이다.
  같은 사실을 두 곳에서 세면 그 순간 두 벌이 된다.

## 새 표면을 추가할 때

1. 위 형식으로 절을 만든다 — `<!-- surface: {id} -->` 마커 + `Model Experience` + `KV Cache effect`.
2. 자산을 나열한다면 표의 백틱 경로가 실물과 **정확히 일치**해야 한다. 게이트가 양방향으로 본다:
   문서에 없는 실물도, 실물이 없는 문서 항목도 실패다.
3. 집계로 충분하면 나열하지 않는다. 나열은 그 자체가 유지보수 비용이고, 다른 게이트가 이미
   세고 있다면 여기서 또 세지 않는다.
