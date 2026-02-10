---
name: techdebt
description: "Technical debt cleanup — detect and fix duplicate code, console.log, unused imports, any types, etc. Recommended before session end. Activates on techdebt, cleanup, debt keywords."
triggers: [techdebt, cleanup, debt, unused imports, console.log, dead code]
priority: 60
---

# Techdebt — Technical Debt Cleanup

Detect and clean up technical debt in the codebase before session end or periodically.

## Inspection Items

### 1. Duplicate Code

- Check for similar functions/logic across multiple files
- Identify code extractable into common utilities
- Method: Detect similar code with `core_analyze_complexity`

### 2. Unused Code

- Unused import statements
- Unused variables/functions
- Commented-out code blocks

Detection tools:

```
# Detect unused imports (using Grep tool)
Grep: pattern="^import .+ from" → cross-reference usage

# Detect commented-out code blocks
Grep: pattern="^\\s*//.*\\b(function|const|let|var|class|import)\\b"
```

### 3. Debug Code

- `console.log` / `console.error` / `console.warn`
- `debugger` statements
- Temporary comments: `// TODO`, `// FIXME`, `// HACK`, `// XXX`

Detection tools:

```
# Detect console statements (using Grep tool)
Grep: pattern="console\\.(log|error|warn|debug)" glob="*.{ts,tsx}"

# Detect TODO/FIXME
Grep: pattern="(TODO|FIXME|HACK|XXX)" glob="*.{ts,tsx}"

# Detect debugger statements
Grep: pattern="\\bdebugger\\b" glob="*.{ts,tsx}"
```

### 4. Code Quality

- `any` type usage (TypeScript)
- Hardcoded values (magic numbers/strings)
- Functions exceeding 50 lines
- Nesting deeper than 4 levels

Detection tools:

```
# Detect any types (using Grep tool)
Grep: pattern=": any\\b|as any\\b" glob="*.{ts,tsx}"

# Analyze complexity with built-in VIBE tools
core_analyze_complexity: filePath="src/**/*.ts"
core_validate_code_quality: filePath="src/**/*.ts"
```

## Output Format

```markdown
## Technical Debt Report

### Duplicate Code (N items)
- src/utils.ts:formatDate ↔ src/helpers.ts:formatDateTime

### Unused Imports (N items)
- src/components/Button.tsx:3 — React (unused)

### Debug Code (N items)
- src/api/auth.ts:23 — console.log

### Code Quality Issues (N items)
- src/services/user.ts:45 — any type usage
- src/utils/calc.ts:10 — magic number (hardcoded 365)

Total: N technical debt items found.
```

## Auto-fix Scope

### Auto-fixable (Safe)

| Item | Fix Method |
|------|-----------|
| Unused imports | Delete the import statement |
| `console.log` / `debugger` | Delete the line |
| Trailing whitespace / blank lines | Apply formatter |

### Requires Manual Review (Safety Guard)

| Item | Reason |
|------|--------|
| Duplicate code extraction | Need to verify logic equivalence |
| `any` type fixes | Need proper type design |
| Magic number extraction | Need to decide constant names and locations |
| Long function splitting | Need to decide logic separation criteria |

> Always show the scope of changes to the user and get confirmation before auto-fixing.

## VIBE Tool Integration

| Tool | Purpose |
|------|---------|
| `core_analyze_complexity` | Measure function complexity (nesting, line count) |
| `core_validate_code_quality` | Detect code quality rule violations |
| `core_suggest_improvements` | Generate improvement suggestions |
| `core_check_coupling_cohesion` | Analyze module coupling/cohesion |
