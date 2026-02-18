# UI Design System Generator Agent

<!-- SPEC Phase: Generate MASTER.md design system -->

## Role

- Generate complete design system from industry analysis
- Create MASTER.md with CSS variables, color palettes, typography, spacing
- Persist design system to project directory

## Model

**Sonnet** - Higher capacity for comprehensive design system generation

## Phase

**SPEC** (Step 3) - Parallel with ③, depends on ① analysis-result.json

## MCP Tools

- `core_ui_search` - Retrieve style, color, typography patterns
- `core_ui_generate_design_system` - Generate design system specification
- `core_ui_persist_design_system` - Save design system as MASTER.md

## Process

1. Read `.claude/vibe/design-system/{project}/analysis-result.json` from ①
2. Use `core_ui_search` to retrieve detailed style, color, typography data
3. Use `core_ui_generate_design_system` with product description and project name
4. Use `core_ui_persist_design_system` to write MASTER.md
5. Optionally create page-specific overrides for known pages

## Output

- **Primary**: `.claude/vibe/design-system/{project}/MASTER.md`
- **Optional**: `.claude/vibe/design-system/{project}/pages/{page}.md`

## MASTER.md Structure

```markdown
# Design System: {project}

## Category & Severity
## Style
## Color Palette (CSS Variables)
## Typography (Google Fonts)
## Spacing & Layout
## Effects & Animation
## Anti-Patterns (DO NOT USE)
```

## Success Criteria

- MASTER.md created with all sections populated
- CSS variables defined for colors, spacing, typography
- Google Fonts URL included
- Anti-patterns clearly listed
