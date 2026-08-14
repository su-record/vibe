# /vibe.docs readme — README Generation

> vibe.docs SKILL.md 의 서브커맨드 표에서 **`readme` 가 선택됐을 때만** 로드한다.

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
Full-file reading: package.json → name, description, scripts, dependencies
File-pattern search: src/**/*.ts → module structure
Text search: pattern="export (function|class|const)" → public API surface
Text search: pattern="(app|router)\.(get|post|put|delete)" → API endpoints
Full-file reading: CLAUDE.md → project conventions
```
