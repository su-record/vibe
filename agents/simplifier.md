# Code Simplifier Agent

Sub-agent that automatically validates and corrects code quality rules.

## Trigger

Automatically executed after `Write`, `Edit` operations via PostToolUse Hook.

## Rules Reference

**Validation criteria (`~/.claude/core/rules/` global):**

### Required Rules

- `core/development-philosophy.md` - Surgical precision
- `core/quick-start.md` - DRY, SRP, YAGNI
- `quality/checklist.md` - Quality checklist

### Complexity Standards
- `standards/complexity-metrics.md`:
  - Cyclomatic complexity ≤ 10
  - Function length ≤ 20 lines
  - Nesting depth ≤ 3 levels
  - Parameters ≤ 5
  - Component JSX ≤ 50 lines

### Anti-patterns
- `standards/anti-patterns.md` - Patterns to avoid

## Process

### 1. Analyze Changed Files

```
Check list of modified files
Analyze changes in each file
```

### 2. Rule Validation

```typescript
const checks = {
  // Complexity
  cyclomaticComplexity: '≤ 10',
  functionLength: '≤ 20 lines',
  nestingDepth: '≤ 3 levels',
  parameterCount: '≤ 5',

  // Code Quality
  noAnyType: true,
  noMagicNumbers: true,
  singleResponsibility: true,

  // Style
  consistentNaming: true,
};
```

### 3. Auto-correction (when possible)

- Long function → Suggest splitting
- Deep nesting → Early return pattern
- Magic numbers → Extract constants
- any type → Type inference/explicit typing

### 4. Report Results

```
✅ Quality check passed (Score: 95/100)

or

⚠️ Improvements needed:
- src/utils/helper.ts:15 - Function 25 lines (limit: 20)
- src/components/Form.tsx:42 - Nesting 4 levels (limit: 3)

🔧 Auto-corrected:
- 3 magic numbers → Converted to constants
```

## Quick Check

```
✅ Modified only requested scope?
✅ No any types?
✅ Functions ≤ 20 lines?
✅ Nesting ≤ 3 levels?
✅ Error handling included?
✅ Magic numbers extracted to constants?
✅ Tests written?
```

## Grade

| Grade | Score | Action |
|-------|-------|--------|
| A+ | 95-100 | Pass |
| A | 90-94 | Pass |
| B+ | 85-89 | Show warning |
| B | 80-84 | Recommend improvement |
| C | 70-79 | Needs improvement |
| F | < 70 | Correction required |

## Usage

This agent is not called directly.
It runs automatically via PostToolUse Hook in `settings.json`.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "tools": ["Write", "Edit"],
        "command": "claude --agent simplifier"
      }
    ]
  }
}
```
