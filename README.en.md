# VIBE

**Easy vibe coding. Done is judged by machines.**

[![npm](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Vibe is a **verification harness** for AI coding. Today's models already plan and implement well — what's missing is a reason to trust "it's done." Vibe wraps Claude Code, Codex, Cursor, or Antigravity CLI and hands the completion verdict to **deterministic gates (test exit codes, a run ledger, regression memory) instead of the model's self-report** — so you can vibe-code fast without shipping unverified code.

```bash
npm install -g @su-record/vibe
vibe init
```

---

## Philosophy: verify, don't instruct

Scaffolding that teaches a 2026-era model *how to work* is pure overhead. Vibe v3 stripped that layer away — what remains is only **what the model cannot prove about itself**:

- **Did the tests actually pass?** — the PR gate runs the suite itself
- **Did verification actually run?** — `.vibe/metrics/run-ledger.json` records it in code
- **Is the review loop converging?** — a discover-hash (2 identical rounds → stuck) decides
- **Are we repeating the same mistake?** — verify failures auto-register as regression tests

The smarter the model, the more persuasive its "done" — which makes a code-enforced ground truth *more* valuable, not less.

---

## The Workflow

One entry point. Single-pass SPEC → one approval → loop until the gates pass.

```
/vibe "coffee brand landing page"
     |
     v
  Intent classification ─── new feature? figma-driven? clone? resume? review? regress? ...
     |
     v
  Smart Resume ─── detect .vibe/{specs,features}/ state ("continue?")
     |
     v
  Single-pass SPEC ─── inline questions only at genuine forks → SPEC + BDD scenarios
     |
     v
  SPEC approval once ─── the only mandatory human gate (defines Done)
     |
     v
  Loop ─── ANCHOR→ACT→JUDGE→RECORD until deterministic gates pass
```

**Single-pass SPEC** — the old interview → plan → spec → review 4-stage pipeline is gone. The model produces the SPEC in one pass and asks only at genuine forks. One approval gate: SPEC confirmation.

**Smart Resume** — Stop at any step, close the session, come back later. `/vibe` auto-detects where you left off and picks up from there. No need to remember feature names.

**Loop-default** — After SPEC approval, vibe loops (ANCHOR→ACT→JUDGE→RECORD) until gates pass, with deterministic stuck/iteration guards. `--interactive` for step-by-step confirmation; `--max-iter N` to cap iterations; `automationLevel: autonomous` (`.vibe/config.json`) runs non-interactively to completion.

**Loop engineering** — `/vibe.loop` designs and installs autonomous goal loops (triage → run/verify pipelines). Completion is judged by deterministic gates (run-ledger/tests), not self-report; results land in a human triage inbox — loops never push or release.

---

## Quick Start

```bash
# Install
npm install -g @su-record/vibe

# Initialize (auto-detects your stack, generates project-aware harness files)
cd your-project
vibe init

# Start either AI coding tool
claude
codex

# Run the workflow
/vibe "add user authentication"
```

---

## Harness Engineering

Vibe is built on the [Harness Engineering](https://anthropic.com/engineering/harness-design) principle — designing the working environment so AI operates effectively on its own.

### The 6 Axes

| Axis | What it covers | Vibe implementation |
|------|---------------|---------------------|
| **Scaffolding** | Project structure, tools, boundaries | `/vibe.scaffold` generates optimized folder structure (docs/, .dev/, layered src/) |
| **Context** | What AI knows | `vibe init` generates project-aware `CLAUDE.md` / `AGENTS.md` from actual structure analysis |
| **Planning** | What to build | `/vibe` routes to a single-pass SPEC with one approval gate |
| **Orchestration** | How to execute | 15 goal-oriented agents + native parallel subagents, skill-based dispatch |
| **Verification** | How to trust | Deterministic gates (run-ledger, test exit codes), convergence loops, RTM traceability |
| **Compounding** | How to improve | Regression memory, session memory, recipes/anti-patterns |

### Diagnose Your Project

```bash
/vibe.harness    # Score your project across all 6 axes (0-100)
```

Produces a detailed report with per-axis scores, grade (S/A/B/C/D), and auto-fixable improvement suggestions. Detects project type (app vs package/library) and adjusts scoring accordingly.

---

## Analyze Anything

`/vibe.analyze` works on more than just source code:

```bash
/vibe.analyze "login"              # Feature/module code exploration
/vibe.analyze --code               # Code quality analysis
/vibe.analyze report.pdf           # Document analysis (PDF, slides, markdown)
/vibe.analyze https://example.com  # Website analysis (UX, tech, SEO, a11y)
/vibe.analyze https://figma.com/…  # Figma design analysis
```

Auto-detects input type (file extension → URL pattern → flag → string) and routes to the appropriate analysis mode with mode-specific quality gates.

---

## Figma ↔ Code

Bidirectional. Read designs from Figma, or write designs to Figma from a plan.

```bash
# READ — Add UI to existing project (follows project conventions)
/vibe.figma <figma-url> <figma-url>

# READ — New standalone page (independent styles)
/vibe.figma --new <figma-url>

# WRITE — Create Figma design from plan document
/vibe.figma plan.md --create                 # Full (wireframe + visual design)
/vibe.figma plan.md --create-storyboard      # Wireframe only
/vibe.figma plan.md --create-design          # Visual design only
```

**How READ works**: Extracts the Figma node tree + 30 CSS properties via REST API, maps Auto Layout to Flexbox 1:1, generates responsive SCSS. Screenshot is for verification only — the tree is the source of truth; rendering is gated by pixelmatch visual comparison.

**How WRITE works**: Parses plan document sections (Look & Feel, layout, responsive strategy), builds wireframe first for structure review, then applies visual design with design system components. Idempotent — re-run after editing the plan and only changed sections update.

---

## DESIGN.md — Visual Quality SSOT

The **third SSOT** alongside `CLAUDE.md` (code) and `AGENTS.md` (build). Google Stitch 9-section format, lives at project root, human-readable so any AI agent can read it. **Figma-independent** — Figma is just one of 4 input paths.

```bash
# 4 init paths (start without Figma)
/vibe.design init                                  # Interview (default)
/vibe.design init --from=code                      # Reverse-extract tokens (Tailwind / CSS vars / styled-components)
/vibe.design init --from=reference --reference=linear   # 12 awesome-design-md seeds
/vibe.design init --from=figma --file=<key>        # Delegate to /vibe.figma (optional)

# Lifecycle
/vibe.design lint                                  # Verify Stitch 9-section completeness
/vibe.design verify                                # Implementation ↔ DESIGN.md hex token drift (<1s / 100 files)
```

**Auto-integrated**:
- `/vibe.run` — On UI work, suggests DESIGN.md once if missing (silent skip in autonomous mode, never blocks)
- `/vibe.verify` — `### 3.2 Visual Drift Detection` flags hardcoded hex as P1
- `/vibe.review` — `#### Visual P1 Baseline` — DESIGN.md first, WCAG AA fallback
- `/vibe.figma` — `--emit-design-md` outputs DESIGN.md from READ; WRITE uses DESIGN.md tone/palette as primary input

> v1 scope: hex color drift. Spacing / font drift in Phase 2+

---

## Quality Gates

Detection at edit time, blocking at deterministic gates:

| Layer | What it does |
|-------|--------------|
| Edit hooks (Edit/Write) | **Detects** only low-false-positive hard rules — `any`/`@ts-ignore`, `console.log` → injects findings to the model (additionalContext). No length/nesting heuristics — the model judges those better in context |
| Deterministic gates | **PR test gate** (runs the actual test suite before PR creation, incl. `gh pr create`) · **auto-commit verify gate** (refuses commits until verify passes) · **Stop hook** verify-skip warn/block · **scope-guard** (opt-in; monitors edits outside SPEC scope) · **sentinel** (blocks destructive commands and harness self-modification) |
| Review + convergence loop | Parallel `code-reviewer` instances — one per focus (correctness / architecture / performance / data-integrity / …) — plus `security-reviewer`. Loops until P1 = 0, with convergence decided by discover-hash: two identical rounds = stuck, ask the user. Never silently proceeds. |

---

## Key Features

**7+ agents** — 7 global goal-oriented agents (architect, implementer, tester, code-reviewer, security-reviewer, …) + 4 conditional (UI/Event — installed project-locally only when the stack/capability matches; 11 total). Agents are delegated by goal + constraints + Done criteria, not step scripts; exploration, planning, and parallelism use the harness's native subagents directly.

**60 skills** — Not all loaded at once. 3-tier system prevents context overload:

| Tier | When loaded | Purpose | Examples |
|------|-------------|---------|----------|
| **Core** | Always active | Gate entry, restraint principles | spec, test, restraint, arch-guard |
| **Standard** | `vibe init` selects by stack | Stack/capability support | figma, design-review, docs |
| **Optional** | Explicit `/skill` only | Reference, wrappers | chub-usage, context7 |

Skills teach only what the model doesn't know (domain gotchas, current APIs, project conventions). Skills that re-taught basics like "how to debug" were deleted in v3.

**Second opinion (opt-in)** — Default execution is the session model alone. When you want one, prefix with `gpt …`/`agy …` to ask an external LLM, or run `/vibe.review --race` for cross-validation. No auto-routing ever pulls an external model into your loop.

**Stack detection** — Auto-detects 24 frameworks (Next.js, Django, Rails, Go, Rust, Flutter, and more) and applies framework-specific rules and skills.

**Project-aware harness docs** — `vibe init` and `vibe update` analyze your project's actual structure (folders, tech stack, build commands) and generate tailored `CLAUDE.md` / `AGENTS.md` files — not static templates.

**Regression memory** — verify failures auto-register via `/vibe.regress`; recurring patterns get promoted to preventive tests. Decisions and constraints persist across sessions via SQLite + FTS5 search.

**Smart Resume** — `.last-feature` pointer tracks your latest work. `/vibe` without arguments shows where you left off or lists all in-progress features.

---

## Supported Tools

| CLI | Status |
|-----|--------|
| [Claude Code](https://claude.ai/code) | Full support |
| [Codex](https://github.com/openai/codex) | Full support (`~/.codex/`, AGENTS.md, native hooks.json, config.toml notify, codex exec agent fallback) |
| [Cursor](https://cursor.sh) | Agents + Rules |
| Antigravity CLI (`agy`) | Agents + Skills |

---

## Commands

| Command | Purpose |
|---------|---------|
| `/vibe` | Main entry point — natural language requirement → single-pass SPEC → one approval → loop until gates pass |
| `/vibe.spec` | Advanced — explicit single-pass SPEC (inline questions → SPEC + BDD → approval) |
| `/vibe.run` | Implement from SPEC |
| `/vibe.figma` | Figma ↔ Code (read or write, 3 modes) |
| `/vibe.design` | DESIGN.md visual quality SSOT — init / lint / verify / sync / preview |
| `/vibe.verify` | Verify implementation against SPEC Done criteria — result recorded in the run ledger |
| `/vibe.regress` | Regression test auto-evolution — auto-registers on verify failure, promotes recurring patterns |
| `/vibe.trace` | Requirements traceability matrix |
| `/vibe.analyze` | Analyze any target — code, documents, websites, Figma |
| `/vibe.scaffold` | Generate or audit project folder structure |
| `/vibe.harness` | Diagnose Harness Engineering maturity (6-axis scoring) |
| `/vibe.docs` | Generate project documentation — plus diagram / codemaps modes |
| `/vibe.continue` | Session restore — pick up where you left off after `save_memory` → `/new` at 85%+ context |
| `/vibe.image` | Image generation (Antigravity) — icons, banners, mockups |

---

## Documentation

Full guides, skill reference, and configuration details are in the [Wiki](https://github.com/su-record/vibe/wiki).

- [README (Korean)](README.md)
- [Release Notes](RELEASE_NOTES.md)

---

## Requirements

- Node.js >= 18.0.0
- Claude Code or Codex CLI
- GPT, Antigravity (optional — second opinions only)

## License

MIT — Copyright (c) 2025 Su
