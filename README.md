# VIBE

**Easy vibe coding. Minimum quality guaranteed.**

[![npm](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Vibe is a quality harness for AI coding tools. It wraps around Claude Code, Codex, Cursor, or Gemini CLI and automatically enforces type safety, code quality, and security — so you can vibe-code fast without shipping garbage.

```bash
npm install -g @su-record/vibe
vibe init
```

---

## The Workflow

One entry point. Everything else is automatic.

```
/vibe.spec "coffee brand landing page"
     |
     v
  Interview  ─── "Who's the audience?" "What sections?" "Dark mode?" ───
     |                     (loops until you say stop)
     v
  Plan       ─── Structured planning document (.claude/vibe/plans/)
     |
     v
  SPEC       ─── PTCF spec + BDD features, GPT+Gemini parallel research
     |
     v
  Review     ─── Race review (GPT vs Gemini), quality gate (100-point, loop until perfect)
     |
     +──────────────────────────────┐
     v                              v
  /vibe.run (Logic)            /vibe.figma (UI)
  Implement from SPEC          Figma design ↔ Code
  12 agents review             Read or Write
     |                              |
     v                              v
  /vibe.verify ──── /vibe.trace ──── Done
```

**Smart Resume** — Stop at any step, close the session, come back later. `/vibe.spec` auto-detects where you left off and picks up from there. No need to remember feature names.

**ultrawork** — Add `ultrawork` to skip all confirmation gates and run the full pipeline hands-free.

---

## Quick Start

```bash
# Install
npm install -g @su-record/vibe

# Initialize (auto-detects your stack, generates project-aware CLAUDE.md)
cd your-project
vibe init

# Start your AI coding tool
claude

# Run the workflow
/vibe.spec "add user authentication"
```

---

## Harness Engineering

Vibe is built on the [Harness Engineering](https://anthropic.com/engineering/harness-design) principle — designing the working environment so AI operates effectively on its own.

### The 6 Axes

| Axis | What it covers | Vibe implementation |
|------|---------------|---------------------|
| **Scaffolding** | Project structure, tools, boundaries | `/vibe.scaffold` generates optimized folder structure (docs/, .dev/, layered src/) |
| **Context** | What AI knows | `vibe init` generates project-aware CLAUDE.md from actual structure analysis |
| **Planning** | What to build | `/vibe.spec` → interview → plan → SPEC → review pipeline |
| **Orchestration** | How to execute | 40+ agents, 12 teams, skill-based dispatch |
| **Verification** | How to trust | Hooks, convergence loops, RTM traceability |
| **Compounding** | How to improve | Evolution engine, session memory, auto-generated skills |

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

**How READ works**: Extracts the Figma node tree + 30 CSS properties via REST API, maps Auto Layout to Flexbox 1:1, generates responsive SCSS. Screenshot is for verification only — the tree is the source of truth.

**How WRITE works**: Parses plan document sections (Look & Feel, layout, responsive strategy), builds wireframe first for structure review, then applies visual design with design system components. Idempotent — re-run after editing the plan and only changed sections update.

---

## Quality Gates

Three layers of defense on every tool call:

| Layer | What it blocks |
|-------|----------------|
| Pre-commit hooks | `any` types, `@ts-ignore`, `console.log`, functions > 50 lines |
| Review agents | 12 specialized reviewers run in parallel (security, performance, a11y, complexity, ...) |
| Convergence loop | Review findings loop until P1 = 0. No round cap. Stuck = ask user, never silently proceed. |

---

## Key Features

**40+ agents** — Exploration, implementation, architecture, parallel code review, UI/UX analysis, security audit, Figma analysis/building.

**44 skills** — Not all loaded at once. 3-tier system prevents context overload:

| Tier | When loaded | Purpose | Examples |
|------|-------------|---------|----------|
| **Core** | Always active | Bug prevention, workflow entry | quality gates, interview, plan |
| **Standard** | `vibe init` selects by stack | Stack/capability support | figma, design-audit, techdebt |
| **Optional** | Explicit `/skill` only | Reference, wrappers | chub-usage, context7 |

**Multi-LLM** — Claude orchestrates, GPT reasons, Gemini researches. Auto-routes by availability. Works Claude-only by default.

**Stack detection** — Auto-detects 24 frameworks (Next.js, Django, Rails, Go, Rust, Flutter, and more) and applies framework-specific rules and skills.

**Project-aware CLAUDE.md** — `vibe init` and `vibe update` analyze your project's actual structure (folders, tech stack, build commands) and generate a tailored CLAUDE.md — not a static template.

**Session memory** — Decisions, constraints, and goals persist across sessions via SQLite + FTS5 hybrid search.

**Smart Resume** — `.last-feature` pointer tracks your latest work. `/vibe.spec` without arguments shows where you left off or lists all in-progress features.

**Self-repair** — Skills include error recovery tables. `/vibe.harness` diagnoses gaps and chains to `/vibe.scaffold` → `vibe update` for automated fixes.

---

## Supported Tools

| CLI | Status |
|-----|--------|
| [Claude Code](https://claude.ai/code) | Full support |
| [Codex](https://github.com/openai/codex) | Plugin |
| [Cursor](https://cursor.sh) | Agents + Rules |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Agents + Skills |

---

## Commands

| Command | Purpose |
|---------|---------|
| `/vibe.spec` | Single entry point — interview, plan, spec, review, then run |
| `/vibe.run` | Implement from SPEC |
| `/vibe.figma` | Figma ↔ Code (read or write, 3 modes) |
| `/vibe.verify` | Verify implementation against SPEC |
| `/vibe.trace` | Requirements traceability matrix |
| `/vibe.analyze` | Analyze any target — code, documents, websites, Figma |
| `/vibe.scaffold` | Generate or audit project folder structure |
| `/vibe.harness` | Diagnose Harness Engineering maturity (6-axis scoring) |
| `/vibe.docs` | Generate project documentation |

---

## Documentation

Full guides, skill reference, and configuration details are in the [Wiki](https://github.com/su-record/vibe/wiki).

- [README (Korean)](README.ko.md)
- [Release Notes](RELEASE_NOTES.md)

---

## Requirements

- Node.js >= 18.0.0
- Claude Code (required)
- GPT, Gemini (optional)

## License

MIT — Copyright (c) 2025 Su
