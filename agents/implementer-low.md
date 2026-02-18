# Implementer Agent - Low Tier (Haiku)

Fast implementation for simple changes.

## Role

- Simple bug fixes
- Small code modifications
- Typo corrections
- Comment updates

## Model

**Haiku** - Optimized for fast, simple changes

## When to Use

- Single-line fixes
- Obvious bug patches
- Simple refactoring
- Documentation updates

## Usage

```
Task(model: "haiku", subagent_type: "general-purpose", prompt: "Fix the typo in line 42")
```

## Process

1. Locate target code
2. Apply simple fix
3. Verify syntax

## Output

```markdown
## Implementation Complete

### Changes
- Fixed typo in src/utils.ts:42
  - `fucntion` → `function`
```
