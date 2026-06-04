# LLM 동작 오버헤드 — 통합 분석 보고서

> 두 개의 독립 분석을 병합한 통합본.
> **Part A (프롬프트/지시 층)** — LLM에게 *무엇을·어떻게 말하는가*. 스킬/훅/에이전트 정의 정독 기반.
> **Part B (런타임/인프라 층)** — provider 호출이 *실제로 어떻게 실행/중단/추적되는가*. 코드 + vitest 검증 기반.
> **Part C (교차점·충돌·화해안)** — 두 층이 만나는 단 한 곳과, 수정 방향이 정면충돌하는 지점.

- 분석 일시: 2026-06-04
- 범위: 스킬 프롬프트, 훅 오케스트레이션, 에이전트 라우팅, 루트 지시 문서(CLAUDE.md/AGENTS.md), SmartRouter, 직접 provider 호출, telemetry
- 핵심 결론: **안전장치(재귀 가드·dispatcher 격리)는 견고. 진짜 문제는 "컨텍스트 오염 · 과잉 자동발동 · SSOT 불일치"(Part A)와 "timeout 미스매치 · abort 누락 · fallback 미구현"(Part B).** 두 층은 `prompt-dispatcher.js` 한 곳에서 겹치며, 거기서 수정 방향이 충돌한다(Part C).

---

# Part A — 프롬프트/지시 층

가장 큰 메타 패턴: **프레임워크가 LLM을 신뢰하지 못하고 결정론적 잔소리로 과보정한다.** 정규식 휴리스틱이 LLM 판단 영역(매직넘버·복잡도)을 침범하고, 그 부정확한 결과를 컨텍스트에 주입해 오작동을 유발한다.

## A-테마 1: 컨텍스트 오염 — "도우려는 주입"이 노이즈가 됨

| 심각도 | 위치 | 문제 | LLM 영향 |
|---|---|---|---|
| **P1** | `prompt-dispatcher.js:117` | `/추론.*해\|reasoning\|복잡.*분석\|deep.*analysis/i` 매칭 시 외부 GPT spawn(동기, 최대 180s) + 전체 응답 컨텍스트 주입 | 평범한 요청에 걸림. Claude가 답하기 전 외부 답변이 박혀 베끼거나 충돌·혼란 |
| **P2** | `hooks.json:76-84` | 매 프롬프트마다 무조건 `[INTERRUPT RULE]...` echo 주입 (matcher 없음) | 대부분 턴은 인터럽트 아님. 정상 후속을 "취소"로 오해 여지 + 둔감화 |
| **P2** | `session-start.js:83-201` | 세션 시작 시 8+ 블록(Autonomy/Evolution/Recipes/Anti-patterns) 무조건 출력 | 첫 토큰부터 수백~수천 토큰을 메타상태로 소모. "70% 컨텍스트 관리" 강조와 자기모순 |
| **P2** | `code-check.js:136-150` | Write/Edit마다 `[SELF-HEAL] magic number`를 `\b\d{2,}\b` 휴리스틱 주입(포트·HTTP 200·인덱스 오탐) | "고쳐라" 압박 → 요청 안 한 리팩토링 유발. CLAUDE.md "Modify only requested scope"와 정면충돌 |

## A-테마 2: 자동 트리거 과발동 — 일상어/광범위 패턴

| 심각도 | 위치 | 문제 | LLM 영향 |
|---|---|---|---|
| **P1** | `keyword-detector.js:100` | `\b${keyword}\b`로 `quick`/`plan`/`verify`/`explore` 매칭 | "quick question"→`[QUICK MODE] minimal verification` → Convergence "loop until P1=0"와 충돌. "I plan to"→`[PLAN MODE]` 인터뷰 강제 |
| **P1** | `claude-agents.ts:40-51` | review 에이전트 7종 `"Use proactively for .ts/.tsx files"` 등 | typescript+react+security reviewer가 한 파일에 동시 발동 → vibe.review 오케스트레이터 우회·중복 |
| **P1** | `claude-agents.ts:106` | event-image/event-scheduler description 누락 → fallback `"Use proactively when relevant"` | 의도 없는 상황에도 후보 부상 |

## A-테마 3: SSOT 불일치 — 지시 문서가 서로 다른 사실을 말함 (하네스 패리티 직격)

| 심각도 | 위치 | 문제 |
|---|---|---|
| **P1** | `AGENTS.md` (60행 부근) | `Quality SSOT(DESIGN.md)` · `Dual-Harness Doctrine` 섹션 통째 누락(CLAUDE.md엔 있음). "자동생성·수동편집 금지" 주장과 실제 drift. → Codex는 DESIGN.md 존재 자체를 모름 (검증 완료) |
| **P1** | `vibe.run:609`(≤20) vs `:1620`(≤30) vs `CLAUDE.md`(≤50) | 함수 길이 한계가 같은 파일 안에서도 3중 모순 → Quality Gate가 같은 코드를 통과/실패 양쪽 판정 |
| **P2** | `package.json:4` | `"56 agents, 45 skills"` ↔ 실제 71 agents, 69 skills |
| **P2** | `SKILL-CATALOG.md:6` | `Total 68 = 28+10+10` 산술이 48. 실제 69개. 라우팅 카탈로그 stale(8일) |
| **P2** | `README.en.md:10,181,202,237` · `dual-harness-doctrine.md:3` | Gemini→Antigravity 교체가 영문/doctrine 미반영 (검증 완료) |

## A-테마 4: 실행 불가능/모호 지시

| 심각도 | 위치 | 문제 |
|---|---|---|
| **P2** | 12개 스킬(`vibe.run:37` 등) | `getCurrentTime`을 "tool 호출"로 지시하나 MCP 미등록 — 다른 도구는 `node -e` 패턴인데 이것만 불일치. Codex 환각 위험 (검증 완료) |
| **P2** | `vibe.run:1796-1814` | "AUTO REVIEW (13+ Agents)"가 출력 예시로만 존재, 실제 호출 절차 없음 → 가짜 ✅ 환각 + vibe.review와 중복 |
| **P2** | `vibe.run:605` | rules 경로 `~/.claude/vibe/rules/` 하드코딩 — CLAUDE.md는 ".vibe/로 이동"이라 명시 → 이동 후 파일 없음 |
| **P2** | `vibe.run:1569` | 자체 금지어("selectively/if needed")를 vibe.run 자신이 사용(spec:848이 금지 지정) |

## A-테마 5: 경직성·형식 과잉 / 무단 부작용

- **P2** `vibe.run/SKILL.md` 1967줄 — 핵심 실행규칙(Phase Isolation·Scope Lock)이 중간부(918-1044)에 묻힘("lost in the middle"). 언어별 예제·속도비교표·ASCII 박스 20여 개가 토큰 잠식
- **P2** `auto-commit.js:77-97` — feature 브랜치면 Stop마다 `git add -A` 강제 커밋 → "요청 시에만 커밋" 위반, 스코프 밖 파일 스테이징
- **P2** `codex-review-gate.js:73-78` — 페이로드 파싱 실패 시 `hasCodeChanges()` 폴백 true → 변경 없어도 "Run /codex:review" 자동 지시
- **P3** 고아 에이전트 4종(`qa-coordinator`·`junior-mentor`·`requirements-analyst`·`ux-advisor`) — 어디서도 호출 안 됨, 선택지 노이즈
- **P3** explorer/architect/implementer 3-tier가 형용사 차이뿐(정량 기준 없음), explorer-base/low는 모델까지 haiku 동일 → 사실상 중복

## A 안전성 검증 (긍정)

`VIBE_HOOK_DEPTH` 재귀 가드는 일관 적용(`prompt-dispatcher.js:27`, `stop-dispatcher.js:20`, `codex-notify.js:21`, `codex-hook-adapter.js:24`). 자식 Claude 세션 fork bomb 차단. dispatcher cascade 격리 정상. **Stop hook 강제 무한루프 없음.**

---

# Part B — 런타임/인프라 층

- 검증 명령: `npx vitest run src/infra/orchestrator/SmartRouter.test.ts hooks/scripts/__tests__/llm-orchestrate-antigravity.test.js`
- 결과: 39개 테스트 통과. 단, 일부 테스트는 문제가 될 수 있는 현재 fallback 동작을 그대로 고정하고 있음.

## 확정 P1 이슈

### B-1. SmartRouter는 Claude fallback을 선언하지만 실제로 Claude를 실행하지 않음

- `src/infra/orchestrator/types.ts:214`는 작업별 우선순위에 Claude를 포함한다.
- `src/infra/orchestrator/types.ts:236`은 Codex와 Antigravity가 없으면 `['claude']`를 반환한다.
- `src/infra/orchestrator/SmartRouter.ts:197`은 `gpt`와 `antigravity`만 실제 호출하고, `claude`는 `Claude fallback - handled by caller` 예외를 던진다.
- `src/infra/orchestrator/SmartRouter.test.ts:425`는 이 실패 동작을 명시적으로 기대한다.

영향:
- Claude만 설치된 환경에서 SmartRouter는 Claude CLI를 쓰지 못하고 실패한다.
- GPT/Antigravity 장애 시 마지막 fallback은 항상 실패한다.
- `src/infra/orchestrator/index.ts:486`, `:496` 등 smart helper 주석의 `... -> Claude` fallback 설명이 런타임과 맞지 않는다.

권장 수정:
- SmartRouter 안에 Claude 실행 경로를 구현(`LLMCluster.claudeOrchestrate()` 재사용 또는 공통 `ClaudeProvider` 분리).
- `Claude fallback - handled by caller`를 기대하는 테스트를 성공적인 Claude fallback mock 테스트로 교체.

### B-2. UserPromptSubmit LLM hook이 30초 후 LLM 오케스트레이션을 죽임

- `hooks/scripts/prompt-dispatcher.js:160`은 child script를 `timeout: 30000`으로 실행한다.
- `hooks/scripts/llm-orchestrate.js:206`은 primary CLI timeout 180초, fallback 30초.
- `hooks/scripts/llm-orchestrate.js:607`은 fallback provider에만 30초 timeout 적용.
- `hooks/scripts/codex-hook-adapter.js:38`도 `prompt-dispatcher.js`를 다시 30초 timeout으로 감싼다.

영향:
- prompt-dispatcher에서 트리거된 LLM 호출은 180초 primary timeout과 무관하게 부모에서 30초에 hard kill.
- 긴 호출은 retry/fallback 로직이 끝나기 전에 종료.
- 부모가 stderr/timeout error를 사용자에게 전달하지 않아 실패 원인이 묻힌다.

권장 수정:
- dispatcher timeout을 orchestration timeout과 맞추거나 rule별 timeout으로 분리. **(단, Part C 충돌 참조 — 단순 정렬은 컨텍스트 오염을 악화시킴)**
- child process timeout/error를 stdout 또는 hook additional context로 노출.
- 느린 fake provider로 fallback 실행을 증명하는 hook 테스트 추가.

## P2 병목 및 비용 리스크

### B-3. Timeout wrapper가 실제 LLM 작업을 abort하지 않음
- `SmartRouter.ts:173` `Promise.race` timeout이나, 직접 fetch(`gpt/chat.ts:218,327,499`, `antigravity/chat.ts:96`)에 `AbortSignal` 미전달.
- `parallelResearch.ts:153`은 timeout과 race하나 Agent SDK query를 abort 안 함.
- `BackgroundManager.ts:602`는 race 후 `handle.cancel()` 호출하나, `AgentExecutor.ts:127`은 SDK query에 cancel signal 미전달 → 로컬 promise만 resolve, 실제 process는 계속.

영향: 로컬 caller가 timeout으로 빠져나와도 원격 요청/SDK stream 지속. quota 낭비, socket/child process 잔류, retry 중첩.

권장 수정: `SmartRouteRequest`/provider `ChatOptions`/Agent SDK/background handle까지 `AbortSignal` 관통. fetch는 `AbortController`, SDK/CLI는 실제 stream/process 종료.

### B-4. 직접 GPT/Antigravity 호출에 hard network timeout 없음
- `gpt/chat.ts:218,327,499`, `antigravity/chat.ts:96` timeout signal 없음. 반면 `gpt/embedding.ts:55`는 30초 abort path 이미 구현.

영향: runtime/network 실패까지 hang 가능. SmartRouter가 timeout 보고해도 fetch 미취소.

권장 수정: embedding의 timeout 패턴을 공통 LLM fetch helper로 승격. provider-level timeout/retry를 `ChatOptions`에 추가.

### B-5. Token refresh locking은 존재하지만 GPT auth에서 쓰이지 않음
- `TokenRefresher.ts:169`는 in-process dedupe + cross-process file lock 구현. 그러나 `gpt/auth.ts:105`/`gpt/oauth.ts:113`은 공유 lock 없이 refresh. production에 `refreshWithLock()` 사용처 없음.

영향: 병렬 에이전트가 같은 Codex token 동시 refresh → 불필요 auth traffic, 간헐 실패.

권장 수정: GPT refresh를 `tokenRefresher.refreshWithLock('gpt', ...)`로 래핑. 타 프로세스 refresh token 재사용하도록 `readCurrentToken` 제공.

### B-6. Ultrawork pipeline이 미래 phase 준비를 모두 speculative 실행함
- `PhasePipeline.ts:213` 시작 시 `startBackgroundPreparations()`, `:426` phase 2~끝까지 모두 prepare 시작, `:450` cancellation 없이 실행, `:191` timeout은 phase boundary에서만 확인.

영향: 앞 phase 성공 전 미래 phase가 token 소비. 실패/checkpoint 멈춤에도 이미 시작된 preparation 미취소. 전체 timeout이 실행 중 `prepare()`/`execute()` 미중단.

권장 수정: 다음 phase 하나만 prepare. `prepare()`/`execute()`에 `AbortSignal` 전달. 실패/pause/timeout 시 `backgroundPreparations` 취소.

### B-7. Multi-LLM research는 provider 호출 수가 빠르게 늘어남
- `parallelResearch.ts:283` Claude-agent + Multi-LLM 병렬, `MultiLlmResearch.ts:87,107,125,145` 최대 4개 직접 호출 예약, `parallelResearch.ts:217` chunk당 `AGENT.MAX_CONCURRENCY`(=4, `constants.ts:21`) task.

영향: `researchFeature()` 한 번에 agent task 4 + 직접 LLM 4 동시 가능. fan-out 전 global budget gate 없음.

권장 수정: 실행 전 call 수/concurrency/token budget preflight 표시. 직접 호출 예약 전 `CostAccumulator.checkBudget()` 적용.

### B-8. Cost/token telemetry가 부분적으로만 연결됨
- hook CLI는 `llm-orchestrate.js:618`/`utils.js:284`로 비용 추정 로그. TS 직접 호출은 `logLlmCost()` 미호출. `VibeSpan.ts:15` `llm_call` span은 테스트에서만 사용. `TokenBudgetTracker.trackConsumption()` 미사용.

영향: 비용 리포트가 직접 API/SDK 사용량 과소집계. latency/retry/timeout/token/cache/fallback을 한 곳에서 못 봄.

권장 수정: provider/model/duration/retry/timeout/tokens/fallback 기록하는 공통 `LLMObserver` 또는 provider wrapper. hook CLI와 TS 직접 호출 모두 동일 wrapper 사용.

## B 긍정적 확인 사항

- `AgentRegistry`는 SQLite WAL로 duration/status 영속화: `AgentRegistry.ts:109`.
- `BackgroundManager`는 bounded queue + model/provider별 concurrency limit: `BackgroundManager.ts:99`.
- `AgentManifestCache`는 manifest warmup + full-content LRU: `AgentManifestCache.ts:79`.
- embedding 호출은 실제 abort semantics 구현: `gpt/embedding.ts:55`.
- hook dispatch는 외부 LLM 호출 전 prompt pattern matching으로 불필요 호출 감소: `prompt-dispatcher.js:60`. **(단 Part C — 패턴 경계가 너무 넓다.)**

---

# Part C — 교차점 · 충돌 · 화해안

두 층이 만나는 코드는 **딱 하나, `prompt-dispatcher.js`의 외부 LLM 호출.**

## C-1. 결합 인사이트 — 같은 코드, 두 결함이 겹쳐 최악

광범위 정규식이 외부 GPT를 부르고(A-테마1 P1), 그 호출은 30초에 hard kill되며 에러도 안 보인다(B-2).
→ **"평범한 한국어 요청에 외부 LLM을 깨우고 → 토큰·시간을 쓰다가 → 30초에 조용히 죽어 → 아무 결과도 안 남는다."** 과발동 + 무음실패의 최악 조합.

## C-2. 수정 방향 충돌 (가장 중요)

- **B-2 권장:** "dispatcher timeout(30s)을 orchestration timeout(180s)과 맞춰라" → 외부 LLM을 끝까지 완수
- **A-테마1 P1 권장:** "UserPromptSubmit에서 외부 LLM 동기 호출 자체를 줄여라" → 180초로 늘리면 매 프롬프트 최대 3분 블로킹 + 컨텍스트 오염 악화

→ B-2대로 timeout만 맞추면 A가 지적한 오염·블로킹이 더 나빠진다.

## C-3. 화해안 (둘 다 해결) — 채택

UserPromptSubmit에서 외부 LLM을 ① **명시적 트리거에서만**(자연어 광범위 패턴 제거, 접두사 기반) ② **비동기 백그라운드**로 돌리고 ③ 응답은 파일 저장 + "참고: X에 저장됨" 포인터 한 줄만 주입.
→ timeout 미스매치(B-2)·컨텍스트 오염·블로킹(A) 동시 해소.

## C-4. 시각차 1건

B 긍정 항목 "pattern matching으로 불필요 호출 감소"(`prompt-dispatcher.js:60`)는 "패턴이 있다는 사실"을, A는 "패턴 경계가 넓다는 것"을 본 것. 모순 아님 → 정답: **"패턴 매칭은 옳은 설계, 단 경계를 좁혀야 함."**

---

# 통합 우선순위 (수정 순서)

## 즉시 (A 시급 — 저위험·즉효 + C 충돌 해소)
1. **[C 화해안] 외부 LLM 트리거 축소 + 비동기화** — `prompt-dispatcher.js` 자연어 6규칙 → 명시적 접두사, 동기 주입 제거 (B-2 + A-P1 동시 해결)
2. **일상어 키워드 트리거 엄격화** — `keyword-detector.js` quick/plan/verify/explore
3. **AGENTS.md SSOT 동기화** — DESIGN.md/Doctrine 섹션 반영
4. **복잡도 한계 SSOT 통일** — vibe.run ≤20/≤30 → ≤50
5. **review 에이전트 자동발동 제거** — `claude-agents.ts` "Use proactively"
6. **auto-commit opt-in 전환** — `auto-commit.js`

## 후속 (B 인프라 — 코드·테스트 영향 큼, 별도 작업)
7. SmartRouter Claude fallback 구현 + 테스트 교체 (B-1)
8. abort 가능한 provider helper + `AbortSignal` 관통 (B-3, B-4)
9. GPT token refresh를 `TokenRefresher`로 연결 (B-5)
10. 직접 provider 호출에 telemetry wrapper (B-8)
11. PhasePipeline preparation 다음 phase만 + 취소 가능 (B-6)
12. `parallelResearchWithMultiLlm()` budget/concurrency preflight (B-7)

---

# 수정 진행 로그

- 2026-06-04: 통합 리포트 작성. A 시급 항목(1~6) 수정 착수.
- 2026-06-04: **A 시급 항목 6건 완료** (hook 테스트 166/166 통과, `npm run build` 통과):
  1. ✅ `prompt-dispatcher.js` — 자연어 외부 LLM 트리거 6개를 명시적 provider 접두사(`^\s*gpt`/`^\s*(agy|antigravity)`)로 한정. 일상 요청 미발동. 30s 무음실패 시 한 줄 안내 추가(완전 비동기화는 B-2 후속).
  2. ✅ `keyword-detector.js` — strict 키워드(quick/plan/verify/explore)를 명령 끝 위치 또는 `--flag`에서만 발동. 오탐 방지 회귀 테스트 4건 추가. (조어 ralph/ultrawork는 단어경계 유지)
  3. ✅ `AGENTS.md` — `Quality SSOT(DESIGN.md)` + `Dual-Harness Doctrine` 섹션 수동 동기화.
  4. ✅ 복잡도 SSOT **≤50으로 통일** (사용자 결정): `vibe.run:609/1620/1860`, `vibe.verify:260`, `complexity-metrics.md:286,310`. hook 검사(`code-check.js:79`)가 이미 `>50`이라 자동 게이트와도 정합.
  5. ✅ `claude-agents.ts` — review 에이전트 12종 description의 `"Use proactively"` → `"Invoked by the /vibe.review orchestrator (not a standalone auto-trigger)"`.
  6. ✅ `auto-commit.js` — opt-in 가드 추가. `hooks["auto-commit"].enabled === true` 일 때만 동작(기본 비활성).

## 후속 권고 (이번에 미처리)

- **[근본원인] AGENTS.md 결정론적 생성기 부재**: 루트 `AGENTS.md`는 `/vibe.docs agent` LLM 스킬이 CLAUDE.md를 보고 *수동 작성* → 이번 Quality SSOT/Doctrine 누락처럼 drift 재발. doctrine("결정론은 결정론에게")에 따라 CLAUDE.md→AGENTS.md **1:1 결정론적 sync 스크립트**가 필요. (현재는 수동 동기화로 메움)
- **B 인프라 P1 미처리**: SmartRouter Claude fallback 미구현(B-1), prompt-dispatcher↔orchestration timeout 미스맵(B-2)은 코드·테스트 변경이 커 별도 작업으로 남김. C-3 화해안(외부 LLM 완전 비동기화 + 파일 포인터)과 함께 진행 권장.
- **A 미처리 P2/P3**: SessionStart 8블록 과적재, INTERRUPT echo 매턴 주입, code-check self-heal magic-number 오탐, getCurrentTime "tool" 표현(12스킬), vibe.run 1967줄 재배치, 고아 에이전트 4종 — 즉시성 낮아 후속.
