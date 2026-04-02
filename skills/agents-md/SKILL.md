---
name: agents-md
tier: standard
description: "Optimize AGENTS.md / CLAUDE.md by removing discoverable info and keeping only gotchas. Based on Addy Osmani's AGENTS.md principles. Activates on agents.md, claude.md, context file optimization."
triggers: [agents.md, claude.md, context file, optimize agents, optimize claude]
priority: 50
---

# agents-md — Context File Optimizer

Optimize AGENTS.md / CLAUDE.md files.
Reference: https://addyosmani.com/blog/agents-md/

## Core Principle

**One-line test**: "Can the agent discover this by reading the code?" → Yes = delete.

## Step 1: Find Target Files

Search project root for these files:

```
Glob: pattern="AGENTS.md"
Glob: pattern="CLAUDE.md"
Glob: pattern=".cursorrules"
Glob: pattern=".github/copilot-instructions.md"
Glob: pattern=".windsurfrules"
```

If no target files exist, ask the user whether to create one.

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

Mentioning a technology name anchors the agent toward it. "Don't use X" is useful, but "We use X" is unnecessary if already visible in code.

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
- Target under 50 lines total

## Step 4: CLAUDE.md Separation (if applicable)

If CLAUDE.md exists, keep only Claude-specific directives:

```markdown
{Claude-specific directives. e.g., "Always respond in Korean."}
```

Put common rules in AGENTS.md. Claude Code reads both.

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
