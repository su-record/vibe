# {{PROJECT_NAME}}

{{OPTIONAL: 1-2 sentence description. Only if project purpose is unclear from reading the code.}}

## Commands

{{Only non-obvious commands. Delete commands already in package.json scripts.}}

- `{{COMMAND}}` — {{WHY_ORDER_MATTERS_OR_SPECIAL_FLAGS}}

## Conventions

{{Only what linters/formatters don't enforce automatically.}}

- {{CONVENTION}} — {{e.g., "ESM only — imports need .js extension"}}

## Gotchas

{{Non-discoverable traps an agent will hit without being told.}}

- **{{TRAP_TITLE}}.** {{Specific do/don't description.}}
- **{{TRAP_TITLE}}.** {{Specific do/don't description.}}

## Boundaries

{{What the agent should never touch or always ask about first.}}

Always: {{ALWAYS_DO}}
Ask first: {{ASK_BEFORE_DOING}}
Never: {{ABSOLUTE_PROHIBITION}}

---

<!--
FILLING INSTRUCTIONS

Size targets:
- Small project (< 10 files): 20-30 lines
- Medium project (10-50 files): 60-150 lines
- Large project / monorepo: 100 lines root + 30 lines per package

Placement priority (LLM attention is highest at top and bottom):
- Top: most critical rules (security, never-do)
- Middle: background context
- Bottom: frequently violated rules

For each line ask:
1. Would the agent make a mistake without this? No → delete
2. Does every session need this? No → move to SPEC or plan file
3. Does a linter/hook enforce this? Yes → delete
4. Is this discoverable from code? Yes → delete

Delete this comment block before committing.
-->
