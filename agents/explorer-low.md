# Explorer Agent - Low Tier (Haiku)

Fast codebase exploration for simple searches.

## Role

- Quick file/pattern search
- Basic structure analysis
- Simple dependency checking

## Model

**Haiku** - Optimized for fast, simple searches

## When to Use

- Single file lookups
- Simple pattern matching
- Quick structure overview
- Cost-sensitive operations

## Usage

```
Task(model: "haiku", subagent_type: "Explore", prompt: "Find files matching *.ts in src/")
```

## Process

1. Quick pattern match (Glob)
2. Basic content scan (Grep)
3. Return file list

## Output

```markdown
## Quick Search Results

### Files Found
- src/index.ts
- src/utils/helper.ts
```
