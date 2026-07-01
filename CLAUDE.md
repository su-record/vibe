# VIBE

> Source code for `@su-record/vibe` npm package. Modify files in THIS repository only — never the installed copies (`~/.claude/`, `~/.codex/`, `~/.vibe/`).
>
> **File-to-CLI mapping:**
> - `CLAUDE.md` — **Claude Code** (100% supported) · **content SSOT**
> - `AGENTS.md` — **Codex** (100% supported)
>
> `AGENTS.md` is regenerated from this file via `/vibe.docs agent`. Edit here first.

## Hard Rules

### Behavior
- **Modify only requested scope** — Every changed line traces to the user's request
- **Edit existing files over creating new** — Fix at source
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

### TypeScript (hard rules — `any`/`console.log` detected by Quality Gate hooks and injected as additionalContext; deterministic gates are pr-test-gate + Stop verify warning)
- No `any` / `as any` / `@ts-ignore` — use `unknown` + type guards; fix at root
- Explicit return types on all functions

### Complexity Limits (model-judged, not hook-detected)
Function ≤50 lines · Nesting ≤3 · Params ≤5 · Cyclomatic ≤10 — apply in-context judgement; no regex heuristics enforce these

### Forbidden Patterns
No `console.log` in commits · No hardcoded strings/numbers · No commented-out code · No incomplete code without TODO

### Convergence (review / auto-fix loops)
Loop semantics SSOT: `vibe/rules/loop-contract.md` (ANCHOR→ACT→JUDGE→RECORD; exit = gates pass │ stuck │ max_iterations).
- **Loop until P1 = 0 AND no new findings** — run/verify state is tracked in `.vibe/metrics/run-ledger.json`; stuck is judged by discover-hash (2 identical rounds), not by the model
- **Narrowing scope**: Round 1 full → Round 2 P1+P2 → Round 3+ P1 only
- **Stuck** → ask user (fill values / approve sub-100 / abort); `automationLevel: autonomous` records a TODO and continues non-interactively. Never silently proceed sub-100
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
| `~/.codex/config.toml` | Codex `notify` (turn-complete lifecycle hook, auto-installed) |

**`.vibe/config.json` behavior keys** (set per-project to tune gate behavior):
- `scopeGuard.enabled` / `scopeGuard.mode` — scope fence on/off; `warn` (default) or `block`
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
하네스 차이는 경로가 아니라 **인지 방식**(CC=추론 / Codex=직역)에 있다. 원칙: **암묵적 동작에 의존하지 않는다 — 추론은 `/vibe` 디스패처가 앞단에서, skill 본문은 전부 명시적으로.** ("명시성 공통분모 + 추론 앞단"). Hook은 의도별 매핑: 라이프사이클 → Codex `config.toml notify`, 행동 가드 → AGENTS.md soft-hook(직역이라 신뢰성↑). 전문: `vibe/rules/principles/dual-harness-doctrine.md`.

### Gotchas
- `better-sqlite3` WAL mode — synchronous API
- `crypto.timingSafeEqual` requires same-length buffers — check length first
- **Stack → asset SSOT**: `GLOBAL_SKILLS_*`, `STACK_TO_SKILLS`, `CAPABILITY_SKILLS` in `src/cli/postinstall/constants.ts`
- **Hook dispatch order**: `prompt-dispatcher.js` → `llm-orchestrate.js` (매직 키워드 배너 훅 없음 — deprecated 별칭은 "Deprecated aliases" 표가 SSOT, 모델이 직접 해석)
- **Hook 실행 모델**: per-event process spawn 유지 — **daemon/IPC 지양** (무상태·크래시 격리·인프라 제로가 ~20ms VM 기동 절감보다 우선). 훅 레이턴시 최적화는 dispatcher in-process 평탄화(자식 spawn → `import` 실행)로만 접근한다

## Workflow

Claude Code uses `/vibe` as the **single slash entry point**. Codex exposes the same Vibe entrypoints as skills, so use `$vibe`, `$vibe.spec`, or `/skills` instead of expecting top-level `/vibe.*` slash commands in the Codex popup. Natural-language requirement (+ optional URL/image/PDF/file attachments) → vibe analyzes intent, confirms the SPEC once (the only mandatory human gate), then loops per `vibe/rules/loop-contract.md` until gates pass. `automationLevel: autonomous` skips the confirmation for non-interactive runs.

```
$vibe "<requirement>" [+ 📎 attachments]   # Codex
/vibe "<requirement>" [+ 📎 attachments]   # Claude Code
  → Intent classification (new feature / figma-driven / clone / resume / review / regress / contract / scaffold / docs / analyze / harness / test / utils)
  → Smart Resume detection (.vibe/{interviews,plans,specs,features}/)
  → SPEC confirmation (1-time approval; skipped on automationLevel: autonomous)
  → Loop: ANCHOR→ACT→JUDGE→RECORD until gates pass │ stuck │ max-iter
```

**Advanced (explicit phase) entrypoints** — still available for power users when you know exactly which phase to run:
- Codex: `$vibe.spec` / Claude Code: `/vibe.spec` — interview → plan → spec → review orchestration
- Codex: `$vibe.figma` / Claude Code: `/vibe.figma` — Figma ↔ code (UI track)
- Codex: `$vibe.run` / Claude Code: `/vibe.run` — SPEC-driven implementation
- Codex: `$vibe.verify` / Claude Code: `/vibe.verify` — implementation vs SPEC verification
- Codex: `$vibe.regress` / Claude Code: `/vibe.regress` — regression test auto-evolution. Auto-registers on verify failure; `generate` produces preventive tests; `cluster` promotes recurring patterns.
- Codex: `$vibe.contract` / Claude Code: `/vibe.contract` — API contract drift detection. Compares the contract extracted from the SPEC against the implementation; P1 drift auto-propagates to regress.
- Codex: `$vibe.trace` / Claude Code: `/vibe.trace` — Requirements Traceability Matrix
- Codex: `$vibe.loop` / Claude Code: `/vibe.loop` — loop engineering. Goal loops whose completion is judged by deterministic gates (run-ledger/tests), with stuck detection by discover-hash and a human triage inbox. Loops never push/release.
- Codex: `$vibe.test` / Claude Code: `/vibe.test` — vibe self-test across the CC ↔ Codex harnesses. Subcommands: `parity` (static), `report` (runtime), `compare` (diff). P1 drift auto-propagates to regress. Recommended before every release.

| Task Size | Approach |
|---|---|
| 1–2 files | Plan Mode |
| 3+ files | `$vibe "<requirement>"` in Codex, `/vibe "<requirement>"` in Claude Code (or the explicit `vibe.spec` entrypoint) |

## Loop Contract (default execution model)

`/vibe {requirement}` = SPEC approval once (the only mandatory human gate) → loop ANCHOR→ACT→JUDGE→RECORD until gates pass. Completion is judged by deterministic gates (run-ledger `verifyPassed`, test exit codes), never by self-report. SSOT: `vibe/rules/loop-contract.md`.

| Parameter | Default | Meaning |
|---|---|---|
| `--interactive` | off | Per-step confirmation (the old default) |
| `--max-iter N` | 10 | Iteration cap |
| `automationLevel` | `confirm` | `confirm` / `autonomous` (non-interactive; stuck → TODO) — `.vibe/config.json` |

**Deprecated aliases** (mapped, not taught): `ralph`→default(no-op) · `verify`→default(no-op) · `quick`→`--max-iter 1` · `ralplan`→loop applied to planning · `ultrawork`/`ulw`→`automationLevel: autonomous` + parallel ACT

## Skill Tiers

3 tiers prevent context overload: **core** (always active) / **standard** (project-setup selected) / **optional** (explicit `/skill` only). SSOT: `GLOBAL_SKILLS_CORE` + `GLOBAL_SKILLS_STANDARD` in `src/cli/postinstall/constants.ts`. Proactive triggers live in each skill's frontmatter.

## Context Management

- Exploration → Haiku · Implementation → Sonnet · Architecture → Opus
- At 85%+ context: `save_memory` → `/new` → `/vibe.utils --continue` (raised from 70% — `/new` 는 KV prefix cache 를 전량 폐기하므로, 압축 빈도를 낮춰 캐쉬 재사용을 늘린다)

## Git

**Include**: `.vibe/{plans,specs,features,todos,research,regressions,contracts,recipes,anti-patterns,loops,config.json,constitution.md}`, `CLAUDE.md`
**Vibe-global (not project-local)**: `~/.vibe/test-reports/` — `/vibe.test` artifacts live with the vibe install, not with the project
**Exclude**: `~/.claude/{rules,commands,agents,skills}/`, `.claude/settings.local.json`, `.vibe/{memories,checkpoints,metrics}/`

<!-- VIBE:END -->
