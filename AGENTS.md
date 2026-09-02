# VIBE

> Source code for `@su-record/vibe` npm package. Modify files in THIS repository only — never the installed copies (`~/.claude/`, `~/.codex/`, `~/.vibe/`).
>
> **Primary file for Codex (100% supported).**
>
> Content SSOT is `CLAUDE.md` — this file is regenerated from it via `$vibe.docs agent`. Edit `CLAUDE.md` first; do not hand-edit this file.

## Hard Rules

### Behavior
- **Modify only requested scope** — Every changed line traces to the user's request
- **Edit existing files over creating new** — Fix at source. Creating files is correct when the user asks for a new feature, module, or scaffold — an explicit request overrides this default
- **Preserve existing style** — Match conventions even if you'd do it differently
- **Respect Ctrl+C / Escape** — Previous task CANCELLED
- **State assumptions, ask when uncertain** — Don't pick silently when ambiguity exists; push back if a simpler approach exists

### Goal-Driven Execution
Transform imperative tasks into verifiable goals **before** coding:

| Instead of | Transform to |
|---|---|
| "Add validation" | "Tests for invalid inputs pass" |
| "Fix the bug" | "A test reproducing it passes" |
| "Refactor X" | "Tests pass before and after" |

Weak criteria ("make it work") require constant clarification. Strong criteria let the loop run independently.

### TypeScript (hard rules — `pnpm lint`(oxlint) 가 CI `verify` job 에서 강제한다; Quality Gate 훅은 편집 시점 조기 경고로 남는다)
- No `any` / `as any` / `@ts-ignore` — use `unknown` + type guards; fix at root
- Explicit return types on all functions
- `console.log` 금지 · `console.warn`/`console.error`(stderr 진단)는 허용 — `src/cli/**`·`hooks/scripts/**` 는 stdout 이 곧 인터페이스라 예외 (`.oxlintrc.json` overrides)

### Complexity Limits (기계 판정 — `.oxlintrc.json` + `pnpm lint:ratchet`)
Function ≤50 lines · Nesting ≤3 · Params ≤5 · Cyclomatic ≤10
- `max-params` 는 **error** — 신규 위반 0건이어야 CI 통과
- 나머지 3종은 저장소에 기존 부채가 있어 **라쳇**으로 잡는다: `.oxlint-baseline.json` 의 규칙별 상한을 넘으면 CI 실패. 부채는 늘지 않고 줄이는 방향으로만 갱신한다 (`pnpm lint:ratchet --update`)
- 현황과 상환 순서: `.vibe/todos/complexity-debt-2026-08-03.md`

### Forbidden Patterns
No `console.log` in commits · No hardcoded strings/numbers · No commented-out code · No incomplete code without TODO
- **수치에는 출처를 붙인다** — 실측(무엇을 어떻게 쟀는지) · 1차 문서 · 추정(추정임을 명시). 셋 다 아니면 숫자를 쓰지 않고 방향만 적는다. 측정 안 한 배수/퍼센트 금지, 모델마다 달라지는 값의 절대 하드코딩 금지(하네스 임계 신호를 쓴다). SSOT: `vibe/constitution.md` §3.5

### Convergence (review / auto-fix loops)
Loop semantics SSOT: `vibe/rules/loop-contract.md` (ANCHOR→ACT→JUDGE→RECORD; exit = gates pass │ stuck │ max_iterations).
- **Loop until P1 = 0 AND no new findings** — run/verify state is tracked in `.vibe/metrics/run-ledger.json`; stuck is judged by discover-hash (2 identical rounds), not by the model
- **Narrowing scope**: Round 1 full → Round 2 P1+P2 → Round 3+ P1 only
- **Stuck** → **ends the loop** in both modes. `confirm` asks the user (fill values / approve sub-100 / abort); `autonomous` records a TODO and moves to the next independent unit non-interactively — it does NOT keep retrying the stuck loop, and never records sub-100 as complete
- **Changed files only** — never full-project scan

## Architecture (Non-Obvious)

### Module System
- ESM only (`"type": "module"`) — imports need `.js` extension
- Build before test: `npm run build && npx vitest run`

### Release Gates (전부 exit 0 이어야 배포)
| 명령 | 막는 것 |
|---|---|
| `npm run build && npx vitest run` | 타입·동작 회귀 |
| `npm run gen:skill-docs:check` | SKILL-CATALOG.md 드리프트 |
| `npm run validate:counts` | README/package.json 개수 주장과 실제 불일치 |
| `npm run validate:skill-invocation` | 스킬 invocation 선언 오류 |
| `npm run sync:agent-models:check` | 에이전트 모델 섹션 드리프트 |
| `npm run gen:plugin-hooks:check` | 훅 정의 세 벌의 드리프트 |
| `npm run validate:mermaid` | 렌더 안 되는 다이어그램 — 그림이 안 그려지면 리뷰 표면이 죽는다 |
| `npm run validate:plugin-tree` | 배포 트리와 소스 불일치 |
| `npm run gen:agents-md:check` | CLAUDE.md ↔ AGENTS.md 드리프트 — 한 사실에 집이 둘 |
| `npm run validate:spec-lifecycle` | SPEC 헤더의 닫힌 집합 이탈 · 죽은 Anchor(코드가 움직였는데 SPEC 이 안 따라옴) |
| `npm run validate:cache-surface` | 상시 로드 자산 ↔ `vibe/rules/prefix-cache-surface.md` 불일치 |

이 표 전부가 CI(`test.yml`)에서 돈다 — 아무도 안 돌리는 가드는 아무것도 잡지 못한다. **배포 순서는 PR 병합 먼저, 태그는 그다음** — 태그를 먼저 밀면 보호 브랜치에 막혀 병합이 실패해도 CI 가 이미 npm 에 게시한다(실측 v3.2.19).

**릴리스 입구는 둘이다** (`.github/workflows/release.yml`):

| 입구 | 언제 | 검사 주체 |
|---|---|---|
| `push: tags: ['v*']` | 기본 — `pnpm release` 가 미는 태그 | `scripts/release.sh` 가 태그 전에 확인 |
| `workflow_dispatch` (`version` 입력) | **태그를 밀 수 없는 환경** (에이전트 세션의 이그레스 정책 등) | 워크플로 안의 Guard 스텝 |

dispatch 는 `scripts/release.sh` 를 거치지 않으므로 워크플로가 스스로 같은 것을 확인한다: main 에서만 실행 · 입력 버전이 `package.json` 과 일치 · 같은 태그 부재. 태그는 **테스트 통과 뒤 publish 앞에** 워크플로가 만든다 — 깨진 빌드에 태그를 남기지도, 게시된 버전에 태그가 없게 두지도 않는다. 두 입구가 쓰는 태그 이름은 워크플로 `env.RELEASE_TAG` 한 곳에서 만든다(스텝마다 분기하면 한쪽만 조용히 틀린 태그로 게시된다).

> ⚠️ dispatch 의 태그 push 가 Release 워크플로를 **다시 부르지 않는 이유**는 `GITHUB_TOKEN` 으로 만든 push 가 워크플로를 트리거하지 않기 때문이다(GitHub 재귀 방지). PAT·App 토큰으로 바꾸면 같은 버전이 두 번 게시된다.

**버전 범프는 여전히 PR 로 병합된 뒤여야 한다** — dispatch 는 태그 push 만 대체하고 병합 순서는 바꾸지 않는다.

### Config Locations
| Path | Purpose |
|---|---|
| `~/.vibe/config.json` | Global credentials, models (0o600) |
| `.vibe/config.json` | Project stacks, capabilities — Claude/Codex 공용 SSOT |
| `.claude/settings.local.json` | Claude Code hooks (auto-generated, don't commit) |
| `.codex/hooks.json` | Codex native hooks (auto-generated, don't commit) |
| `~/.codex/config.toml` | Codex `notify` (turn-complete lifecycle hook, auto-installed) |
| `.claude-plugin/plugin.json` | Claude Code 플러그인 매니페스트 (버전은 package.json 이 SSOT) |
| `.claude-plugin/marketplace.json` | Claude Code 마켓플레이스 — `source: ./plugins/vibe` |
| `.codex-plugin/plugin.json` | Codex/ChatGPT 플러그인 매니페스트 |
| `.agents/plugins/marketplace.json` | Codex 마켓플레이스 — 같은 배포 트리를 가리킨다 |
| `plugins/vibe/` | **커밋되는** 배포 트리 (`npm run build:plugin`) — 아래 배포 3경로 참조 |

> ⚠️ 훅은 **프로젝트 로컬** 아티팩트다 — `vibe upgrade` 는 전역 자산만 갱신하므로 upgrade 만 쓰면 훅이 설치되지 않는다. `vibe upgrade` 가 현재 프로젝트의 누락 훅을 복구하고, `vibe status` 가 하네스별 설치 여부를 보고한다.

**`.vibe/config.json` behavior keys** (set per-project to tune gate behavior):
- `scopeGuard.enabled` / `scopeGuard.mode` — scope fence opt-in (default **off** everywhere — CLI and hooks share this default); mode `warn` (default) or `block`
- `verifyGate.mode` — `warn` (default) or `block` (Stop hook blocks once if run started but verify not passed)
- `autoTest.mode` — `debounce` (default, 120s cooldown per unchanged test file) / `always` / `off`
- `qualityCheck.consoleAllow` — array of file globs where `console.log` is permitted
- `costGate.{enabled, maxAgentsWithoutApproval, paidGenerationRequiresApproval}` — 되돌릴 수 없는 지출·이상 규모 팬아웃 직전 승인 (기본 on / 12 / true). 평상시 규모는 통과 — SSOT: `vibe/rules/loop-contract.md`

### Quality SSOT (3-tier)
| Path | Purpose |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Code quality + build quality (existing) |
| `DESIGN.md` | **Visual quality** — Stitch 9-section format, project root, managed by `$vibe.design` (init/lint/verify/sync). Figma 독립. UI stack 에서만 권유 — 부재해도 워크플로 블록하지 않음. |

Legacy: 기존 `.claude/vibe/` 는 런타임에 자동 인식되며 `vibe init`/`update` 시 `.vibe/` 로 이동한다.

### Dual-Harness Doctrine
하네스 차이는 경로가 아니라 **인지 방식**(CC=추론 / Codex=직역)에 있다. 원칙: **암묵적 동작에 의존하지 않는다 — 추론은 `$vibe` 디스패처가 앞단에서, skill 본문은 전부 명시적으로.** ("명시성 공통분모 + 추론 앞단"). Hook은 의도별 매핑: 라이프사이클(turn 완료) → Codex `config.toml notify`, 나머지(SessionStart·UserPromptSubmit·Pre/PostToolUse·Pre/PostCompact) → Codex 네이티브 hook(`.codex/hooks.json` + `codex-hook-adapter.js`). **`PostCompact` 는 압축 직후 `loop-ledger.js anchor` 로 재고정한다** — ANCHOR 가 컨텍스트 소실에 대비하는 장치인데 정작 압축 시점에 자동 실행이 없었다. AGENTS.md soft-hook 은 폐기하지 않고 **훅 미설치 환경의 2차 방어선**으로 유지(직역이라 신뢰성↑). 전문: `vibe/rules/principles/dual-harness-doctrine.md`.

### 배포 3경로 (npm · Claude Code 플러그인 · Codex 플러그인)
같은 자산을 세 경로로 내보낸다. **경로가 늘어난 만큼 정의도 갈라진다** — 갈라지면 한쪽 하네스에서만 게이트가 죽고, 그건 조용히 일어난다. 그래서 SSOT 를 하나로 묶고 생성·검증한다.

| 경로 | 설치 | 훅 정의 | 경로 변수 |
|---|---|---|---|
| npm | `npm i -g @su-record/vibe` | `hooks/hooks.json` (**SSOT**) | `{{VIBE_PATH}}` — postinstall 이 치환 |
| Claude Code | `claude plugin marketplace add su-record/vibe` | `hooks/claude-plugin-hooks.json` (생성물) | `${CLAUDE_PLUGIN_ROOT}` |
| Codex/ChatGPT | `vibe plugin install` → `codex plugin add vibe@vibe` | `hooks/plugin-hooks.json` (생성물) | `${PLUGIN_ROOT}` |

- **생성**: `npm run gen:plugin-hooks` — `--check` 가 CI 게이트. 손으로 고치지 않는다
- **이중 실행 가드**: 플러그인 훅은 `plugin-hook-entry.js` 를 거친다. 프로젝트에 **vibe 훅**이 있으면 플러그인 쪽이 물러난다 — 없으면 게이트가 2회, Stop auto-commit 도 2회 돈다. 판정은 "훅 키가 있다" 가 아니라 "vibe 훅이 있다" (사용자 자작 훅만 있는 프로젝트에서 침묵하면 설치한 의미가 없다). 실행은 spawn 이 아니라 in-process `import` — 위 훅 실행 모델 규약을 플러그인 경로에서도 지킨다
- **배포 트리를 커밋하는 이유**: Claude Code 마켓플레이스는 저장소를 **클론**해서 읽는다. `dist/` 는 gitignore 대상이고 `agents/*.md` 의 frontmatter 는 postinstall 이 만든다 — 저장소를 그대로 가리키면 기능이 빠진 플러그인이 된다(실측: 에이전트 11개 중 7개만, description 없이 로드). `plugins/vibe/` 를 커밋하고 드리프트는 `npm run validate:plugin-tree` 가 막는다. `.gitignore` 의 `dist/` 가 이 트리까지 삼키므로 `!/plugins/vibe/dist/` 예외가 필수다

### 폭이 큰 작업 — 네이티브 workflow 로 라우팅 (Claude Code)
Claude Code 는 `Workflow` 도구(dynamic workflows)를 제공한다 — 한 실행에서 **누적 1000 에이전트**, **동시 min(16, cores-2)**. vibe 의 병렬 ACT 는 그보다 앞서 만든 자체 팬아웃이라 이 상한을 쓰지 않는다.

**언제 넘길지**: 독립 작업 단위가 **수십 개 이상**이고(파일별 감사·전면 마이그레이션·다각도 탐색), 중간 결과가 세션 컨텍스트에 쌓이면 안 될 때. 조율 비용은 스크립트 변수로 빠지지만 **에이전트 사용량 자체는 그대로 든다** — 절약되는 것은 조율이지 작업이 아니다.

**넘기지 않을 때**: 단위가 한 자릿수, 단계가 진짜로 서로 의존, 매 단계 사람 승인이 필요, 또는 아직 뭘 찾는지 모르는 탐색. 이 경우 워크플로는 순수 오버헤드다.

- **자동 라우팅하지 않는다** — 워크플로는 사용자가 명시적으로 옵트인해야 하는 도구다. vibe 는 조건에 맞을 때 **제안만** 하고, 기본은 자체 병렬 ACT 를 유지한다
- **Codex 에는 등가물이 없다** — 하네스별 능력 차이지 워크플로 분기가 아니다. vibe 코어의 루프 계약은 양쪽에서 동일하게 남는다 (Dual-Harness Doctrine)
- 넘기더라도 **격리·검증 규정은 그대로** 적용된다 — 파일을 쓰는 병렬 단위는 worktree, 검증자는 독립 컨텍스트

### 테스트는 불변식을 고정하고, 선택은 고정하지 않는다
값을 박은 단언은 유지보수자가 선택을 바꾸려 할 때 **"되돌려라" 를 요구한다**. 실제로 `browser-ladder.test.ts` 가 "Agent Browser 가 1순위" 를 단언하고 있어서, 도구를 걷어내는 작업이 테스트 수정을 동반해야 했다.

| 고정한다 (불변식) | 고정하지 않는다 (선택) |
|---|---|
| 사다리에 오른 도구는 **얻는 경로**가 함께 적혀 있을 것 | 어느 도구가 1순위인지 |
| 마켓플레이스 source 가 **빌드 산출물**을 가리킬 것 | 그 산출물이 어느 경로인지 (빌드 스크립트에서 읽는다) |
| 고른 capability 의 매핑값**만** 나올 것 | 그 매핑이 어느 패키지인지 (매핑에서 읽는다) |

기준값이 필요하면 **SSOT 에서 읽어온다** — 테스트에 복사하면 그 순간 두 벌이 된다.

예외: **정책 단언**은 값을 박아도 된다 (예: "taste-skill 은 자동 설치 매핑에 없다"). 임의의 선택이 아니라 결정을 고정하는 것이고, 뒤집으려면 테스트를 의도적으로 지우면 된다 — 그 사실을 테스트 이름에 적는다.

### Gotchas
- `better-sqlite3` WAL mode — synchronous API
- `crypto.timingSafeEqual` requires same-length buffers — check length first
- **Stack → asset SSOT**: `GLOBAL_SKILLS_*`, `STACK_TO_SKILLS`, `CAPABILITY_SKILLS` in `src/cli/postinstall/constants.ts`
- **Hook dispatch order**: `prompt-dispatcher.js` → `llm-orchestrate.js` (매직 키워드 배너 훅 없음 — deprecated 별칭은 "Deprecated aliases" 표가 SSOT, 모델이 직접 해석)
- **Hook 실행 모델**: per-event process spawn 유지 — **daemon/IPC 지양** (무상태·크래시 격리·인프라 제로가 ~20ms VM 기동 절감보다 우선). 훅 레이턴시 최적화는 dispatcher in-process 평탄화(자식 spawn → `import` 실행)로만 접근한다
- **npm 12 `allowScripts`**: install 스크립트가 **기본 차단**된다. 설치는 ✅ 인데 vibe postinstall 도 `better-sqlite3` 네이티브 바인딩도 안 만들어진다 — 둘 다 자기복구(`runInstalledPostinstall`, `repairNativeDeps`)로 덮고 `vibe status` 가 보고한다. 근본 처방은 사용자 레벨 승인 하나뿐이다: `npm config set allow-scripts=@su-record/vibe,better-sqlite3 --location=user`. `npm install-scripts approve` 는 설치본 package.json 에 쓰므로 다음 설치에 지워진다(실측)
- **에이전트 frontmatter 는 따옴표 필수**: description 에 `: ` 가 들어가면 YAML 평문 스칼라가 매핑으로 해석돼 **frontmatter 전체가 버려진다** — 에러 없이. 실측으로 설치본 11개 중 4개가 그 상태였다 (`convertAgentToClaude` 의 `yamlString`)
- **Claude Code 는 `agents/*.md` 평면만 스캔**한다 — 하위 디렉토리 에이전트는 경고 없이 사라진다. 배포 트리는 평면화해서 굽는다

## Workflow

Codex exposes Vibe entrypoints as skills. Use `$vibe`, `$vibe.spec`, or `/skills` instead of expecting top-level `/vibe.*` slash commands in the Codex popup. Natural-language requirement (+ optional URL/image/PDF/file attachments) → vibe analyzes intent, confirms the SPEC once (the only mandatory human gate), then loops per `vibe/rules/loop-contract.md` until gates pass. `automationLevel: autonomous` skips the confirmation for non-interactive runs.

```
$vibe "<requirement>" [+ 📎 attachments]
  → Intent classification (new feature / figma-driven / clone / resume / review / regress / contract / scaffold / docs / analyze / harness / test / continue / image)
  → Smart Resume detection (.vibe/{specs,features}/ — legacy interviews/plans 는 입력 컨텍스트로만 인식)
  → SPEC confirmation (1-time approval; skipped on automationLevel: autonomous)
  → Loop: ANCHOR→ACT→JUDGE→RECORD until gates pass │ stuck │ max-iter
```

**Advanced (explicit phase) entrypoints** — still available for power users when you know exactly which phase to run:
- `$vibe.spec` — single-pass SPEC (커버리지 스윕 → 최대 3개 인라인 질문 → SPEC 1패스 → 승인 1회; 구 interview/plan/spec-review 4단계는 폐지). 제한하는 축은 질문 수가 아니라 **사용자가 반드시 답해야 하는 수** — 훑지 않은 결정 지점이 SPEC 에 아예 없는 상태를 막고, 묻지 않은 것은 전부 Assumptions 로 편입한다
- `$vibe.figma` — Figma ↔ code (UI track)
- `$vibe.run` — SPEC-driven implementation
- `$vibe.verify` — implementation vs SPEC verification
- `$vibe.regress` — regression test auto-evolution. Auto-registers on verify failure; `generate` produces preventive tests; `cluster` promotes recurring patterns.
- `$vibe.contract` — API contract drift detection. Compares the contract extracted from the SPEC against the implementation; P1 drift auto-propagates to regress. `reverse` runs the other direction (implementation → SPEC) and routes SPEC gaps to the inbox — it never blocks the loop. `agent` asserts a SPEC's Agent Contract against an agent's tool-call log — that one does block, because a logged call is observed fact rather than a model's judgement.
- `$vibe.trace` — Requirements Traceability Matrix
- `$vibe.loop` — loop engineering. Goal loops whose completion is judged by deterministic gates (run-ledger/tests), with stuck detection by discover-hash and a human triage inbox. Loops never push/release. `bench` self-compares loop settings and reports 'inconclusive' rather than inventing a difference the sample cannot support.
- `$vibe.test` — vibe self-test. Probes every shipped surface (commands, skills, hooks, agents) in one install dir and writes a pass/fail report with STCV skill-quality verdicts. One command, no subcommands. Recommended before every release.

| Task Size | Approach |
|---|---|
| 1–2 files | Plan Mode |
| 3+ files | `$vibe "<requirement>"` (or `$vibe.spec` to start at the SPEC phase) |

## Loop Contract (default execution model)

`$vibe {requirement}` = SPEC approval once (the only mandatory human gate) → loop ANCHOR→ACT→JUDGE→RECORD until gates pass. Completion is judged by deterministic gates (run-ledger `verifyPassed`, test exit codes), never by self-report. SSOT: `vibe/rules/loop-contract.md`.

| Parameter | Default | Meaning |
|---|---|---|
| `--interactive` | off | Per-step confirmation (the old default) |
| `--max-iter N` | 10 | Iteration cap |
| `automationLevel` | `confirm` | `confirm` / `autonomous` (non-interactive; stuck → TODO) — `.vibe/config.json` |

**Deprecated aliases** (mapped, not taught): `ralph`→default(no-op) · `verify`→default(no-op) · `quick`→`--max-iter 1` + min JUDGE · `ralplan`→loop applied to planning · `ultrawork`/`ulw`→`automationLevel: autonomous` + parallel ACT

## Skill Tiers

Public skills use the `vibe.*` namespace and are classified as **entry** / **standard** / **optional or project-local**. Core behavior is bundled inside the relevant public skill and is never exposed as a separate discovery entry. SSOT: `GLOBAL_SKILLS_ENTRY`, `GLOBAL_SKILLS_STANDARD`, and the stack/capability mappings in `src/cli/postinstall/constants.ts`.

## Context Management

- **Model routing: inherit by default** — 서브에이전트는 세션 모델을 상속한다. 명시적 예외만 tier alias 로 지정 (아키텍처 심층 리뷰 → `opus`). 구세대 "탐색→Haiku·구현→Sonnet" 비용 라우팅은 폐기 — 강한 기본 모델에서 라우팅 우회가 절약보다 품질 손실이 크다
- **어떤 자산이 프리픽스 캐시를 무효화하는가**: `vibe/rules/prefix-cache-surface.md` (표면별 `Model Experience` + `KV Cache effect`, `validate:cache-surface` 가 실물과 맞춘다)
- At 85%+ context: `save_memory` → `/new` → `$vibe.continue` (raised from 70% — `/new` 는 KV prefix cache 를 전량 폐기하므로, 압축 빈도를 낮춰 캐쉬 재사용을 늘린다)
- **단계 경계 리셋 (용량 기준과 병행)**: SPEC 승인 시점에 새 세션에서 `$vibe.run` 을 시작하는 선택지를 승인 메시지에 편승시킨다 (`vibe.spec` Step 6 `[2]`). 명확화 왕복 ≥2회 · SPEC 수정 요청 ≥1회 · 분할 SPEC 중 하나라도 충족할 때만 권장 표시. 85% 규칙을 대체하지 않는다 — 용량이 찼을 때가 아니라 **잔류 컨텍스트가 노이즈가 되는 경계**에서 끊는 별개 축이다 (명확화 왕복·기각안 논의 텍스트가 구현에 새는 것을 막는다)

## Git

**Include**: `.vibe/{plans,specs,features,todos,research,regressions,contracts,recipes,anti-patterns,loops,config.json,constitution.md}`, `AGENTS.md`, `plugins/vibe/` (배포 트리 — 생성물이지만 커밋한다, 위 "배포 3경로" 참조)
**Vibe-global (not project-local)**: `~/.vibe/test-reports/` — `$vibe.test` artifacts live with the vibe install, not with the project
**Exclude**: `~/.codex/{rules,agents,skills}/`, `.claude/settings.local.json`, `.codex/hooks.json`, `.vibe/{memories,checkpoints,metrics,gates,ephemeral}/`

### 일회성 코드 레인 (`lifetime` 축)

`.vibe/ephemeral/` 은 **생성·실행 후 폐기되는 코드**의 자리다 — 분석 스크립트, 일회성 프로브. 품질 검사(`code-check` 훅)를 면제받는 대신 **커밋되지 않는다.** 면제받은 코드가 배포되면 그 면제가 곧 구멍이다.

- **판정은 모델이 아니라 경로가 한다.** "이건 일회성이라 린트 면제" 를 모델이 정하면 축이 아니라 뒷문이고, 뒷문은 바쁠 때 쓰인다. 경로가 판정하면 면제 대상이 `ls` 하나로 감사된다
- 정규화 후 판정한다 — `.vibe/ephemeral/../src/x.ts` 는 일회성이 **아니다**. 상위 탈출로 면제를 훔칠 수 없다
- **방어 순서**: `.gitignore` 가 **1차**(`git add` 는 무시된 경로를 거부한다), `pre-tool-guard` 가 `git add -f` 하나를 막는 **심층 방어**. 훅은 프로젝트 로컬이라 미설치가 흔하므로 1차가 아니다
- 면제 범위는 `code-check` 품질 검사뿐. 라쳇·린트·테스트는 커밋된 소스를 보므로 이 경로를 애초에 보지 않는다
- 판정에 실패하면 **일회성이 아니라고 답한다**(fail-safe). 잘못된 면제는 조용히 게이트를 끄지만, 잘못된 비면제는 검사가 한 번 더 도는 것뿐이다

<!-- VIBE:END -->
