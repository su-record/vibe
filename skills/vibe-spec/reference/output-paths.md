# vibe.spec — Output Path Contract

> File creation rules for SPEC + Feature outputs. These paths are **mandatory** — do not improvise.

## Table of Contents

1. [Small scope (single file)](#small-scope-single-file)
2. [Large scope (split files)](#large-scope-split-files)
3. [Forbidden / Required](#forbidden)
4. [File creation templates](#file-creation-template)

---

## Small scope (single file)

| File | Path | When |
|------|------|------|
| SPEC | `.claude/vibe/specs/{feature-name}.md` | After quality validation (Step 7) |
| Feature | `.claude/vibe/features/{feature-name}.feature` | Immediately after SPEC |

## Large scope (split files)

| File | Path | When |
|------|------|------|
| Master SPEC | `.claude/vibe/specs/{feature-name}/_index.md` | After quality validation |
| Phase SPEC | `.claude/vibe/specs/{feature-name}/phase-{N}-{name}.md` | Per phase |
| Master Feature | `.claude/vibe/features/{feature-name}/_index.feature` | After Master SPEC |
| Phase Feature | `.claude/vibe/features/{feature-name}/phase-{N}-{name}.feature` | Per phase SPEC |

## Forbidden

- Creating files in project root (e.g., `feature-name.md`)
- Creating files outside `.claude/vibe/` directory
- Skipping file creation
- Using different file names than feature-name
- Creating split SPEC without matching split Feature files

## Required

- Use Write tool to create files
- Verify directories exist (create if needed)
- Confirm file creation in response
- **Each SPEC file must have a matching Feature file**

## File creation template

**Single file:**

```
1. Write .claude/vibe/specs/{feature-name}.md
2. Write .claude/vibe/features/{feature-name}.feature
3. Confirm: "✅ Created: specs/{feature-name}.md + features/{feature-name}.feature"
```

**Split files:**

```
1. Write .claude/vibe/specs/{feature-name}/_index.md
2. Write .claude/vibe/specs/{feature-name}/phase-1-setup.md
3. Write .claude/vibe/specs/{feature-name}/phase-2-core.md
4. Write .claude/vibe/features/{feature-name}/_index.feature
5. Write .claude/vibe/features/{feature-name}/phase-1-setup.feature
6. Write .claude/vibe/features/{feature-name}/phase-2-core.feature
7. Confirm: "✅ Created: {N} SPEC files + {N} Feature files"
```
