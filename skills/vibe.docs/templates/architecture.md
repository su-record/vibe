# Architecture: {{PROJECT_NAME}}

> Version: {{VERSION}} | Updated: {{DATE}}

## Overview

{{2-3 SENTENCES: WHAT THIS SYSTEM DOES AND ITS PRIMARY ARCHITECTURAL APPROACH.}}

## System Diagram

```mermaid
graph TD
    {{ENTRY_POINT}}[{{ENTRY_LABEL}}] --> {{MODULE_A}}[{{MODULE_A_LABEL}}]
    {{MODULE_A}} --> {{MODULE_B}}[{{MODULE_B_LABEL}}]
    {{MODULE_A}} --> {{MODULE_C}}[{{MODULE_C_LABEL}}]
    {{MODULE_B}} --> {{STORE}}[({{STORE_LABEL}})]
    {{MODULE_C}} --> {{EXTERNAL}}[{{EXTERNAL_SERVICE_LABEL}}]
```

> Replace nodes above based on actual `import` analysis. Run:
> `grep -r "^import .* from" src/ | sed 's/.*from //' | sort | uniq` to get dependency edges.

## Module Responsibilities

| Module / Directory | Responsibility | Key Files |
|--------------------|---------------|-----------|
| `{{MODULE_1}}/` | {{RESPONSIBILITY}} | `{{KEY_FILE}}` |
| `{{MODULE_2}}/` | {{RESPONSIBILITY}} | `{{KEY_FILE}}` |
| `{{MODULE_3}}/` | {{RESPONSIBILITY}} | `{{KEY_FILE}}` |

## Data Flow

```
{{INPUT_SOURCE}}
  ↓ {{STEP_1_DESCRIPTION}}
{{PROCESSING_MODULE}}
  ↓ {{STEP_2_DESCRIPTION}}
{{OUTPUT_TARGET}}
```

### Key Data Entities

| Entity | Where Defined | Storage |
|--------|--------------|---------|
| `{{ENTITY_1}}` | `{{FILE_PATH}}` | {{DB / FILE / MEMORY}} |
| `{{ENTITY_2}}` | `{{FILE_PATH}}` | {{DB / FILE / MEMORY}} |

## External Dependencies

| Service | Purpose | Auth Method |
|---------|---------|-------------|
| `{{SERVICE_1}}` | {{PURPOSE}} | {{API_KEY / OAUTH / NONE}} |
| `{{SERVICE_2}}` | {{PURPOSE}} | {{AUTH_METHOD}} |

## Key Decisions

| Decision | Chosen Approach | Alternatives Considered | Rationale |
|----------|----------------|------------------------|-----------|
| {{DECISION_1}} | {{CHOICE}} | {{ALTERNATIVES}} | {{WHY}} |
| {{DECISION_2}} | {{CHOICE}} | {{ALTERNATIVES}} | {{WHY}} |

## Constraints & Non-Goals

**Constraints:**
- {{CONSTRAINT_1}} (e.g., "Must work offline")
- {{CONSTRAINT_2}}

**Non-goals (out of scope):**
- {{NON_GOAL_1}}
- {{NON_GOAL_2}}

## Local Development Setup

```bash
{{SETUP_COMMANDS}}
```

## Further Reading

- {{INTERNAL_LINK_OR_DOC}}
