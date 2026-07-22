---
name: vibe.agents-md
user-invocable: false
invocation: [auto, chain]
tier: standard
description: "Author and optimize AGENTS.md / CLAUDE.md (same doctrine, different filenames): write new context files from scratch, or strip discoverable info and keep only gotchas. Based on Addy Osmani's AGENTS.md principles + Curse of Instructions research. Activates on agents.md, claude.md, context file authoring/optimization."
triggers: [agents.md, claude.md, context file, optimize agents, optimize claude, write claude.md, create claude.md, project instructions]
priority: 50
---

# agents-md — Context File Author & Optimizer

Author and optimize AGENTS.md / CLAUDE.md files. They are the **same doctrine
under different filenames** — everything below applies to both.
Reference: https://addyosmani.com/blog/agents-md/

## Core Principles

**One-line test**: "Can the agent discover this by reading the code?" → Yes = delete.

**Every line has a cost** (Curse of Instructions): LLM compliance drops
exponentially with instruction count — roughly 90% at 1 instruction, ~59% at 5,
~44% at 10, ~15% at 15+. A short, precise file beats a long, comprehensive one.

**Lost in the Middle**: LLMs attend to the beginning and end of a document and
under-weight the middle. Most important rules → top. Frequently violated rules
→ bottom. Background context → middle (OK if ignored).

## Step 1: Find Target Files

Search project root for these files:

```
Glob: pattern="AGENTS.md"
Glob: pattern="CLAUDE.md"
Glob: pattern=".cursorrules"
Glob: pattern=".github/copilot-instructions.md"
Glob: pattern=".windsurfrules"
```

If a target exists → optimize it (Steps 2–3). If none exists and the user wants
one → author it (Step 1b), then run the same optimization pass on the draft.

## Step 1b: Authoring From Scratch

Explore before writing: `package.json` (stack, scripts), `*.config.*`,
`tsconfig.json`, `.env.example`, `Makefile`, `docker-compose.*`. Everything
found this way is **discoverable — leave it out**.

Then interview for what exploration cannot reveal (one question at a time,
multiple-choice when possible):

1. **Runtime traps** — differences invisible in code (Bun vs Node, ESM vs CJS)
2. **Forbidden patterns** — libraries/approaches that burned the team before
3. **Non-standard conventions** — naming/structure rules that differ from defaults
4. **Architecture decisions** — business context the code can't explain
5. **Boundaries** — files never to touch, changes requiring approval first

Draft using `templates/claude-md.md`. Keep per-feature detail out — that
belongs in SPEC files (`.vibe/specs/`), loaded only when relevant, not in the
always-loaded context file. For large monorepos: one shared root file plus a
small per-package file, instead of one giant root.

Don't aim for perfect on day one: start minimal (30–50 lines), observe where
the agent actually errs, add one line per *recurring* mistake. If the root
cause is code structure, fix the code instead of adding a rule.

## Step 2: Classify Current Content

Classify each entry by the following criteria:

### Delete (Discoverable)

Information the agent can find by exploring the code:

| Type | Example | Discovery Path |
|------|---------|---------------|
| Directory structure | "Components are in src/" | `ls`, `Glob` |
| Tech stack | "Uses React + TypeScript" | `package.json`, file extensions |
| Phase/progress tables | "Phase 1 ✅, Phase 2 ✅..." | Just history, not actionable guidance |
| Build/test commands | "Run tests with npm test" | `package.json` scripts |
| API endpoint lists | "POST /api/users" | Router code |
| Feature descriptions | "Phase 3 implements circuit breaker" | Readable from the code itself |
| Architecture diagrams | ASCII box diagrams | Conceptual only, no mistake prevention |
| Code style rules | Indentation, semicolons | Linter/formatter enforces them |

### Keep (Non-discoverable)

Traps and rules the agent cannot know from code alone:

| Type | Example |
|------|---------|
| Runtime traps | "This is Bun, not Node" (not in package.json) |
| Forbidden patterns | "Never use require()", "No React patterns" |
| SSOT locations | "Only edit model-registry.ts, no hardcoding" |
| Invariant ordering | "Priority: A → B → C, never change this order" |
| Retry/fallback limits | "Max 2 retries, never 3+" |
| Tool choices | "Use Zod only, no joi/yup" |
| Naming conventions | Non-standard patterns only (if standard, delete) |
| Project one-liner | Only when purpose is unclear from code |
| Language/response directives | "Respond in Korean" etc. |

### Anchoring Warning

Mentioning a technology name anchors the agent toward it. "Don't use X" is
useful, but "We use X" is unnecessary if already visible in code.

### Emphasis Budget

`**IMPORTANT**` / `**MUST**` / `**NEVER**` work only while rare. Reserve them
for P1 rules; emphasis on every line nullifies all of it.

## Step 3: Restructure

Rewrite in this structure:

```markdown
# {Project Name} — {One-liner}

{What the project does in 1-2 sentences. Only if purpose is unclear from code.}

# Gotchas

- **{Trap title}.** {Specific do/don't description}.
- ...

# Naming

{Only if non-standard naming patterns exist. Omit if standard (camelCase etc.).}
```

Rules:
- Maximum 3 sections (Intro, Gotchas, Naming)
- Each gotcha has **bold title + specific do/don't**
- "Don't use X" is more useful than "We use X"
- Target under 50 lines total; 60–150 acceptable for complex projects; at 300+ the agent ignores half of it
- Don't inline everything — Claude Code follows `@docs/FILE.md` references and loads them on demand (progressive disclosure)

## Step 4: CLAUDE.md Separation (if applicable)

If both files exist, put common rules in AGENTS.md and keep only
Claude-specific directives (e.g., "Always respond in Korean") in CLAUDE.md.
Claude Code reads both. If only one file exists, it carries everything —
same content rules apply.

## Step 5: Report Results

```markdown
## AGENTS.md Optimization Results

| Metric | Before | After |
|--------|--------|-------|
| Lines | N | N |
| Deleted items | - | N (discoverable) |
| Kept items | - | N (gotchas) |

### Deleted Items
- {Item}: {Reason for deletion}

### Kept/Added Items
- {Item}: {Reason for keeping}
```

## Maintenance Signals

| Signal | Meaning | Response |
|--------|---------|----------|
| Over 300 lines | Information overload | Split or trim |
| Same mistake repeats | Rule is lost in noise | Emphasize or consolidate |
| Adding rules has no effect | File is too long | Fix root cause |
