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

### Complexity Limits (기계 판정 — `.oxlintrc.json` + `$vibe lint:ratchet`)
Function ≤50 lines · Nesting ≤3 · Params ≤5 · Cyclomatic ≤10
- `max-params` 는 **error** — 신규 위반 0건이어야 CI 통과
- 나머지 3종은 저장소에 기존 부채가 있어 **라쳇**으로 잡는다: `.oxlint-baseline.json` 의 규칙별 상한을 넘으면 CI 실패. 부채는 늘지 않고 줄이는 방향으로만 갱신한다 (`pnpm lint:ratchet --update`)
- 현황과 상환 순서: `.vibe/todos/complexity-debt-2026-08-03.md`

### Forbidden Patterns
No `console.log` in commits · No hardcoded strings/numbers · No commented-out code · No incomplete code without TODO

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

### Config Locations
| Path | Purpose |
|---|---|
| `~/.vibe/config.json` | Global credentials, models (0o600) |
| `.vibe/config.json` | Project stacks, capabilities — Claude/Codex 공용 SSOT |
| `.claude/settings.local.json` | Claude Code hooks (auto-generated, don't commit) |
| `.codex/hooks.json` | Codex native hooks (auto-generated, don't commit) |
| `~/.codex/config.toml` | Codex `notify` (turn-complete lifecycle hook, auto-installed) |

> ⚠️ 훅은 **프로젝트 로컬** 아티팩트다 — `vibe upgrade` 는 전역 자산만 갱신하므로 upgrade 만 쓰면 훅이 설치되지 않는다. `vibe upgrade` 가 현재 프로젝트의 누락 훅을 복구하고, `vibe status` 가 하네스별 설치 여부를 보고한다.

**`.vibe/config.json` behavior keys** (set per-project to tune gate behavior):
- `scopeGuard.enabled` / `scopeGuard.mode` — scope fence opt-in (default **off** everywhere — CLI and hooks share this default); mode `warn` (default) or `block`
- `verifyGate.mode` — `warn` (default) or `block` (Stop hook blocks once if run started but verify not passed)
- `autoTest.mode` — `debounce` (default, 120s cooldown per unchanged test file) / `always` / `off`
- `qualityCheck.consoleAllow` — array of file globs where `console.log` is permitted

### Quality SSOT (3-tier)
| Path | Purpose |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Code quality + build quality (existing) |
| `DESIGN.md` | **Visual quality** — Stitch 9-section format, project root, managed by `/vibe.design` (init/lint/verify/sync). Figma 독립. UI stack 에서만 권유 — 부재해도 워크플로 블록하지 않음. |

Legacy: 기존 `.claude/vibe/` 는 런타임에 자동 인식되며 `vibe init`/`update` 시 `.vibe/` 로 이동한다.

### Dual-Harness Doctrine
하네스 차이는 경로가 아니라 **인지 방식**(CC=추론 / Codex=직역)에 있다. 원칙: **암묵적 동작에 의존하지 않는다 — 추론은 `/vibe` 디스패처가 앞단에서, skill 본문은 전부 명시적으로.** ("명시성 공통분모 + 추론 앞단"). Hook은 의도별 매핑: 라이프사이클(turn 완료) → Codex `config.toml notify`, 나머지(SessionStart·UserPromptSubmit·Pre/PostToolUse) → Codex 네이티브 hook(`.codex/hooks.json` + `codex-hook-adapter.js`). AGENTS.md soft-hook 은 폐기하지 않고 **훅 미설치 환경의 2차 방어선**으로 유지(직역이라 신뢰성↑). 전문: `vibe/rules/principles/dual-harness-doctrine.md`.

### Gotchas
- `better-sqlite3` WAL mode — synchronous API
- `crypto.timingSafeEqual` requires same-length buffers — check length first
- **Stack → asset SSOT**: `GLOBAL_SKILLS_*`, `STACK_TO_SKILLS`, `CAPABILITY_SKILLS` in `src/cli/postinstall/constants.ts`
- **Hook dispatch order**: `prompt-dispatcher.js` → `llm-orchestrate.js` (매직 키워드 배너 훅 없음 — deprecated 별칭은 "Deprecated aliases" 표가 SSOT, 모델이 직접 해석)
- **Hook 실행 모델**: per-event process spawn 유지 — **daemon/IPC 지양** (무상태·크래시 격리·인프라 제로가 ~20ms VM 기동 절감보다 우선). 훅 레이턴시 최적화는 dispatcher in-process 평탄화(자식 spawn → `import` 실행)로만 접근한다

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
- `$vibe.spec` — single-pass SPEC (인라인 질문 → SPEC 1패스 → 승인 1회; 구 interview/plan/spec-review 4단계는 폐지)
- `$vibe.figma` — Figma ↔ code (UI track)
- `$vibe.run` — SPEC-driven implementation
- `$vibe.verify` — implementation vs SPEC verification
- `$vibe.regress` — regression test auto-evolution. Auto-registers on verify failure; `generate` produces preventive tests; `cluster` promotes recurring patterns.
- `$vibe.contract` — API contract drift detection. Compares the contract extracted from the SPEC against the implementation; P1 drift auto-propagates to regress.
- `$vibe.trace` — Requirements Traceability Matrix
- `$vibe.loop` — loop engineering. Goal loops whose completion is judged by deterministic gates (run-ledger/tests), with stuck detection by discover-hash and a human triage inbox. Loops never push/release.
- `$vibe.test` — vibe self-test across the CC ↔ Codex harnesses. Subcommands: `parity` (static), `report` (runtime), `compare` (diff). P1 drift auto-propagates to regress. Recommended before every release.

| Task Size | Approach |
|---|---|
| 1–2 files | Plan Mode |
| 3+ files | `$vibe "<requirement>"` (or `$vibe.spec` if you want to start at SPEC phase explicitly) |

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
- At 85%+ context: `save_memory` → `/new` → `$vibe.continue` (raised from 70% — `/new` 는 KV prefix cache 를 전량 폐기하므로, 압축 빈도를 낮춰 캐쉬 재사용을 늘린다)

## Git

**Include**: `.vibe/{plans,specs,features,todos,research,regressions,contracts,recipes,anti-patterns,loops,config.json,constitution.md}`, `AGENTS.md`
**Vibe-global (not project-local)**: `~/.vibe/test-reports/` — `vibe.test` artifacts live with the vibe install, not with the project
**Exclude**: `~/.codex/{rules,agents,skills}/`, `.claude/settings.local.json`, `.codex/hooks.json`, `.vibe/{memories,checkpoints,metrics}/`

<!-- VIBE:END -->
