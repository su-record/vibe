---
name: vibe-docs
tier: standard
description: "Generate project documentation — README, architecture docs, user guide, release notes. Activates on docs, readme, documentation keywords."
triggers: [vibe-docs, docs, documentation, readme, release notes, architecture doc]
priority: 50
---

# vibe.docs — Project Documentation Generator

Generate or update project documentation by analyzing the actual codebase.

## Subcommands

### `/vibe.docs readme` — README Generation

Analyze the codebase and generate a complete README.md:

1. **Detect project nature**: Read package.json, CLAUDE.md, existing README
2. **Extract key info**: Tech stack, installation, usage, API surface
3. **Generate sections**:

```markdown
# Project Name
> One-line description from package.json

## What is this?
[2-3 sentences explaining the problem and solution]

## Quick Start
[Installation + minimal usage example]

## Features
[Auto-detected from codebase — exported functions, CLI commands, API endpoints]

## Architecture
[High-level module diagram if 5+ source directories]

## Configuration
[Detected config files and their purposes]

## Development
[Build, test, lint commands from package.json scripts]

## License
```

**Analysis approach:**
```
Read: package.json → name, description, scripts, dependencies
Glob: src/**/*.ts → module structure
Grep: pattern="export (function|class|const)" → public API surface
Grep: pattern="(app|router)\.(get|post|put|delete)" → API endpoints
Read: CLAUDE.md → project conventions
```

### `/vibe.docs guide` — User Guide

Generate a step-by-step user guide:

1. **Installation**: Detect package manager, prerequisites
2. **Configuration**: Find all config files, document each option
3. **Usage**: Extract CLI commands or API usage patterns
4. **FAQ**: Common issues from error handling patterns
5. **Troubleshooting**: Known edge cases from test files

Output: `docs/GUIDE.md`

**Analysis approach:**
```
Read: package.json → bin, scripts, peerDependencies
Glob: src/cli/commands/*.ts → CLI command list
Grep: pattern="throw new|Error\(" → common error scenarios
Grep: pattern="(process\.env|config)\.\w+" → configuration options
```

### `/vibe.docs arch` — Architecture Documentation

Generate architecture overview with diagrams:

1. **Module map**: Directory structure → responsibility mapping
2. **Dependency graph**: Import analysis → Mermaid diagram
3. **Data flow**: Entry points → processing → output
4. **Key decisions**: Extract from CLAUDE.md and code comments

Output: `docs/ARCHITECTURE.md`

**Mermaid diagram generation:**
```
Glob: src/**/ → module list
Grep: pattern="^import .+ from" → dependency edges
Read: CLAUDE.md → architecture notes

Generate:
graph TD
    CLI[CLI Commands] --> Core[Core Logic]
    Core --> Infra[Infrastructure]
    Infra --> DB[(Database)]
    Infra --> API[External APIs]
```

### `/vibe.docs agent` — Agent Instruction Files (CLAUDE.md / AGENTS.md)

**CLI ↔ file mapping:**

| CLI | File | Support |
|---|---|---|
| Claude Code | `CLAUDE.md` | 100% (Primary) |
| coco | `AGENTS.md` | 100% (Primary) |

Gemini CLI / Codex CLI / Cursor are not supported — do not generate or check `GEMINI.md`.

**Source of truth:**
- **`CLAUDE.md` is the content SSOT.** Always edit it first; `AGENTS.md` is a regenerated derivative.
- Behavioral block: `skills/vibe-docs/templates/behavioral-principles.md` (4 Karpathy principles, wrapped in `<!-- VIBE-BEHAVIORAL:START/END -->` markers).

**Procedure (applies to both creation and modification):**

1. **Detect state** — check which of `CLAUDE.md` / `AGENTS.md` exist in project root. **`CLAUDE.md` is always the SSOT**; if missing, create it first (never derive from AGENTS.md).
2. **For `AGENTS.md`**:
   - **If missing** → create by cloning `CLAUDE.md` + applying CLI substitution (below).
   - **If exists** → regenerate from current `CLAUDE.md` + substitution, preserving user-specific additions outside the VIBE block.
3. **CLI substitution for `AGENTS.md`** (coco): `Claude Code` → `coco` · `~/.claude/` → `~/.coco/` · `.claude/` → `.coco/` · `CLAUDE.md` → `AGENTS.md`. `CLAUDE.md` itself gets no substitution.
4. **Validate every touched file (whether newly created or modified)** via the `claude-md-guide` → `agents-md` skill chain — see validation block below. **Never write or save without running this step.**
5. Report per file: created / updated / skipped / validation warnings.

**Idempotent:** Re-running re-syncs the behavioral block and re-applies substitutions without duplication.

**Mandatory validation (every create & every update) — invoke `claude-md-guide` → `agents-md`:**

1. **`claude-md-guide`**:
   - Size target 60–150 lines (Optimal). Warn at 200+, force split/trim at 300+.
   - 4-question check per line (outside `VIBE-BEHAVIORAL` block):
     - Would the agent make a mistake without this? (No → delete)
     - Needed every session? (No → move to SPEC/plan)
     - Can a linter/hook replace it? (Yes → move)
     - Discoverable from code? (Yes → delete)
   - Lost-in-the-Middle: critical rules at top, frequently-violated rules at bottom.
2. **`agents-md`**:
   - Addy Osmani test: "Can the agent discover this by reading the code?" → Yes = delete.
   - Strip tech-stack name-drops already stated in `package.json`.

Report line ranges to trim per file. Do not auto-delete; surface findings for user approval before finalizing.

**When to run:**
- After `vibe init` / `vibe update` if `CLAUDE.md` or `AGENTS.md` is missing or out of sync.
- After upgrading `@su-record/vibe` when the behavioral template changes.
- Whenever the SSOT file is edited — re-sync `AGENTS.md`.
- User explicitly asks to refresh agent instructions.

### `/vibe.docs release` — Release Notes

Generate release notes from git history:

1. **Collect**: `git log` since last tag
2. **Classify**: feat/fix/refactor/docs/chore from commit messages
3. **Group**: By category with breaking changes highlighted
4. **Format**: Semantic versioning suggestion

Output: `RELEASE_NOTES.md` or append to `CHANGELOG.md`

**Output format:**
```markdown
## [x.y.z] - YYYY-MM-DD

### Breaking Changes
- ...

### Features
- feat: description (#PR)

### Bug Fixes
- fix: description (#PR)

### Other
- refactor/docs/chore items
```

## Pipeline Integration

`/vibe.docs` completes the development pipeline:

```
/vibe.spec    → Design (what to build)
/vibe.run     → Implement (build it)
/vibe.trace   → Verify (prove it works)
/vibe.docs    → Document (explain it)
```

### Auto-trigger after `/vibe.trace`

When `/vibe.trace` completes with all scenarios passing, suggest:
> "All scenarios verified. Run `/vibe.docs readme` to update documentation?"

## Guidelines

### DO
- Read the actual codebase before generating — never guess
- Preserve existing documentation that's still accurate
- Include concrete code examples from the actual project
- Keep language consistent with project (Korean/English based on CLAUDE.md)
- Use changelog-writer agent for `/vibe.docs release`
- Use api-documenter agent for API-heavy projects
- Use diagrammer agent for `/vibe.docs arch` Mermaid generation
- Use `claude-md-guide` → `agents-md` chain for `/vibe.docs agent` — applies equally to CLAUDE.md and AGENTS.md

### DON'T
- Don't generate placeholder text ("Lorem ipsum", "TODO: fill in")
- Don't document internal implementation details in user-facing docs
- Don't create files without reading existing ones first
- Don't assume features — verify by reading code

## Quality Checklist

Before finalizing any document:

- [ ] All code examples are runnable (copy-paste ready)
- [ ] Installation steps tested against package.json
- [ ] Links and paths are valid
- [ ] No placeholder text remaining
- [ ] Consistent with project language (Korean/English)
