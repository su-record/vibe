---
name: claude-md-guide
tier: standard
description: "Guide for writing effective CLAUDE.md files from scratch. Evidence-based methodology from 40+ sources including research papers, official docs, and real-world examples. Covers 3-layer architecture, Curse of Instructions mitigation, progressive disclosure, and maintenance. Use when creating new CLAUDE.md, improving existing ones, or teaching team members how to write project instructions for AI agents."
triggers: [claude-md guide, write claude.md, create claude.md, claude.md 작성, 클로드 문서, project instructions, claude-md]
priority: 55
chain-next: [agents-md]
---

# claude-md-guide — CLAUDE.md Writing Guide

> **Principle**: "Would the agent make a mistake without this?" → If No, delete it. If Yes, keep it.

## Why This Matters

Research shows that LLM compliance drops **exponentially** as the number of instructions increases (Curse of Instructions):

| Instructions | GPT-4o Compliance | Claude Sonnet Compliance |
|-------------|------------------|--------------------------|
| 1 | ~85% | ~90% |
| 5 | ~44% | ~59% |
| 10 | ~15% | ~44% |
| 15+ | ~5% | ~15% |

**Conclusion**: Every line has a cost. A short, precise CLAUDE.md is better than a long, comprehensive one.

---

## Step 1: Project Exploration — Auto-Collect

Explore the project before writing CLAUDE.md:

```
Glob: pattern="package.json"       → Check stack and scripts
Glob: pattern="*.config.*"         → Build/lint configuration
Glob: pattern="tsconfig.json"      → TypeScript configuration
Glob: pattern=".env.example"       → Environment variable structure
Glob: pattern="Makefile"           → Build system
Glob: pattern="docker-compose.*"   → Infrastructure structure
Glob: pattern="CLAUDE.md"          → Check for existing file
Glob: pattern="AGENTS.md"          → Check for compatible file
```

Summarize the collected information for the user, then ask about any missing context.

## Step 2: Interview — Extract Non-Discoverable Information

Only ask about information that cannot be found through auto-exploration. **One question at a time, multiple-choice when possible:**

### Question Categories

**1. Runtime Traps**
- Are there runtime differences not visible in the code? (e.g., Bun vs Node, ESM vs CJS)
- Are there bugs that only occur in certain environments?

**2. Forbidden Patterns**
- Are there libraries/patterns that must never be used?
- Are there approaches that caused problems in the past?

**3. Non-standard Conventions**
- Are there naming/structure rules that differ from standards?
- Are there special workflows agreed upon by the team?

**4. Architecture Decisions**
- Are there design reasons that can't be inferred from the code alone?
- Is there business context behind why certain patterns were chosen?

**5. Boundaries**
- Are there files/directories the agent must never touch?
- Are there areas that require approval before changes are made?

## Step 3: Structure Design — 3-Layer Architecture

Separate the collected information into 3 layers:

### Layer 1: CLAUDE.md (Project Constitution)

**Auto-loaded every session** → only universal, stable information.

```markdown
# {Project Name}

{1-2 sentences on what the project is. Only if the purpose isn't clear from the code.}

## Tech Stack
{Only what can't be inferred immediately from package.json. e.g., "Bun runtime (not Node)"}

## Commands
{Only what's missing from package.json scripts or non-intuitive}
- `npm run build && npx vitest run` — build then test (order matters)

## Conventions
{Only what the linter can't catch}
- ESM only — imports need `.js` extension
- {Any non-standard naming rules}

## Gotchas
{Things the agent will repeatedly get wrong}
- **{Trap title}.** {Specific do/don't explanation}

## Boundaries
✅ Always: {things to always do}
⚠️ Ask first: {things requiring approval first}
🚫 Never: {absolute prohibitions}
```

### Layer 2: SPEC.md (Per-Feature Design Document)

**Loaded only when working on a specific feature** → focus on what and why, leave how to the agent.

Storage location: `.claude/vibe/specs/YYYY-MM-DD-{topic}.md`

```markdown
# {Feature Name} SPEC

## Purpose (Why)
## Requirements (What)
## Success Criteria (Acceptance Criteria)
## Technical Constraints (Constraints)
## Boundaries (Out of Scope)
```

### Layer 3: plan.md (Execution Plan)

**Per-session task list** → 2-5 minute units, with file paths specified.

Storage location: `.claude/vibe/specs/{name}-execplan.md`

```markdown
# Execution Plan

## Task 1: {Title}
- Files: `src/foo.ts`, `src/foo.test.ts`
- Action: {Specific change}
- Verify: `npm test src/foo.test.ts`

## Task 2: ...
```

## Step 4: Writing — Apply Evidence-Based Principles

### Size Limits

| Grade | Lines | When Appropriate |
|-------|-------|-----------------|
| Optimal | 60-150 | Most projects |
| Acceptable | 150-200 | Complex monorepos |
| Warning | 200-300 | Separation needed |
| Danger | 300+ | Agent ignores half of it |

### Attention Distribution by Position (Lost in the Middle Effect)

LLMs focus on the **beginning and end** of a document and **ignore the middle**:

```
Attention: ████████░░░░░░░░████████
           ^start    ^middle(↓20-40%)  ^end
```

**Countermeasures**:
- **Most important rules** → place at the top of the document
- **Frequently violated rules** → place at the bottom (end) of the document
- **Background information** → place in the middle (OK if ignored)

### Include vs Exclude Checklist

**✅ Include (non-discoverable, operationally important)**

| Type | Example |
|------|---------|
| Runtime traps | "Bun runtime, not Node" |
| Forbidden patterns | "Never use `any`, use `unknown` + type guards" |
| SSOT location | "Only edit `constants.ts` for stack mapping" |
| Order invariants | "Build before test, always" |
| Non-standard commands | Compound commands, special flags |
| Security rules | Auth, path traversal prevention, etc. |

**❌ Exclude (discoverable or delegate to other tools)**

| Type | Reason | Alternative |
|------|--------|-------------|
| Directory structure | Discoverable via `ls` | The code itself |
| Tech stack list | In `package.json` | The code itself |
| Code style (indentation, semicolons) | Linter catches it | ESLint, Prettier |
| API documentation | Readable from code | Swagger, JSDoc |
| General best practices | LLM already knows | Unnecessary |
| API keys, secrets | Goes stale quickly | `.env`, vault |
| Per-feature detailed instructions | Move to Layer 2 | SPEC.md |

### Emphasis Techniques

Use these when important rules keep getting ignored:

```markdown
**IMPORTANT**: {critical rule}
**MUST**: {mandatory action}
**NEVER**: {absolute prohibition}
```

However, adding emphasis to every line **nullifies the emphasis**. Use only for P1 rules.

### Progressive Disclosure

Don't put everything in CLAUDE.md — reference it:

```markdown
# Architecture
See @docs/ARCHITECTURE.md for design decisions.

# Security
@.claude/rules/security.md
```

Claude Code follows `@` references and loads them only when needed.

## Step 5: Validation — Writing Quality Check

Validate the written CLAUDE.md:

### Line-by-Line Validation

4 questions for every line:

1. **Would the agent make a mistake without this?** → If No, delete
2. **Is it needed in every session?** → If No, move to Layer 2/3
3. **Can a linter/hook replace it?** → If Yes, move to linter/hook
4. **Is it discoverable from code?** → If Yes, delete

### Anchoring Warning

Mentioning a technology name biases the agent toward it:
- ❌ "We use React" → unnecessary (it's in package.json)
- ✅ "Never use jQuery, even for legacy code" → useful (prevents a trap)

### Token Efficiency

| Problem | Example | Improvement |
|---------|---------|-------------|
| Verbose explanation | "Please always make sure to..." | "Always:" |
| Duplication | Same rule repeated in different wording | State it once |
| Unnecessary context | "As we discussed..." | Delete |

## Step 6: Maintenance — A Living Document

### Incremental Addition Pattern

Don't try to write it perfectly from the start:

```
1. Start with a minimal CLAUDE.md (30-50 lines)
2. Observe where the agent makes mistakes
3. Only add rules for recurring mistakes
4. Clean up unnecessary lines every 2-3 weeks
```

### Reflection Loop (Addy Osmani Pattern)

```
Agent task complete
  → Ask "What was different from expectations?"
  → When a recurring pattern is found, add 1 line to CLAUDE.md
  → If the root cause is code structure, fix the code and don't add a rule
```

### Warning Signs

| Signal | Meaning | Response |
|--------|---------|----------|
| Over 300 lines | Information overload | Split or trim |
| Same mistake repeats | Rule is lost in noise | Emphasize or consolidate |
| Adding rules has no effect | File is too long | Fix root cause |
| Team ignores rules | Discoverable information | Delete |

---

## Quick Reference: Guide by Project Scale

### Small (fewer than 10 files)

```markdown
# {Project Name}

## Commands
- `{build}` — {description}
- `{test}` — {description}

## Gotchas
- **{Trap 1}.** {description}
- **{Trap 2}.** {description}

## Never
- 🚫 {prohibited item}
```

**Target: 20-30 lines**

### Medium (10-50 files)

Above + add Conventions and Boundaries sections.

**Target: 60-150 lines**

### Large (50+ files, monorepo)

Root CLAUDE.md (shared rules) + CLAUDE.md per subdirectory.

```
project/
├── CLAUDE.md              ← shared (60 lines)
├── packages/api/CLAUDE.md ← API-specific (30 lines)
├── packages/web/CLAUDE.md ← web-specific (30 lines)
└── .claude/rules/         ← path-specific rules
    ├── security.md
    └── testing.md
```

**Target: root 100 lines + each subdirectory 30 lines**

---

## Session Separation Principle

Splitting CLAUDE.md writing into separate sessions improves quality:

| Session | Goal | Output |
|---------|------|--------|
| Session 1 | Project exploration + interview | Draft |
| Session 2 | Validation + optimization | Final version |
| Ongoing | Incremental maintenance | Continuous improvement |

After writing: run `→ /agents-md` skill for optimization validation.

---

## References

### Research
- [Curse of Instructions: LLMs Cannot Follow Multiple Instructions at Once](https://openreview.net/forum?id=R6q67CDBCH)
- [Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)
- [The Instruction Hierarchy: Training LLMs to Prioritize Privileged Instructions](https://arxiv.org/html/2404.13208v1)
- [Context Length Alone Hurts LLM Performance Despite Perfect Retrieval](https://arxiv.org/html/2510.05381v1)

### Official Docs
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [Using CLAUDE.md Files](https://claude.com/blog/using-claude-md-files)

### Community
- [Addy Osmani: AGENTS.md](https://addyosmani.com/blog/agents-md/)
- [HumanLayer: Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Builder.io: CLAUDE.md Guide](https://www.builder.io/blog/claude-md-guide)
- [GitHub Blog: How to Write a Great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
