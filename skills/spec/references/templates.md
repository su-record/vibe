# SPEC / Feature Document Templates

> Referenced by `spec` SKILL.md Step 4 (Write SPEC Document) and Step 5 (Create Feature File).
> Read this file when you reach those steps — copy the matching template verbatim and fill the placeholders.

## Master SPEC (`_index.md`) — Large Scope

```markdown
# SPEC: {feature-name} (Master)

## Overview
- Total phases: N
- Dependencies: [list]

## Sub-SPECs

| Order | SPEC File | Feature File | Status |
|-------|-----------|--------------|--------|
| 1 | phase-1-setup.md | phase-1-setup.feature | ⬜ |
| 2 | phase-2-core.md | phase-2-core.feature | ⬜ |

## Shared Context
- Tech Stack: [all phases]
- Constraints: [all phases]
```

## Master Feature (`_index.feature`) — Large Scope

```markdown
# Feature: {feature-name} (Master)

**Master SPEC**: `.vibe/specs/{feature-name}/_index.md`

## Sub-Features

| Order | Feature File | SPEC File | Status |
|-------|--------------|-----------|--------|
| 1 | phase-1-setup.feature | phase-1-setup.md | ⬜ |
| 2 | phase-2-core.feature | phase-2-core.md | ⬜ |

## Overall User Story
**As a** {user}
**I want** {complete feature}
**So that** {value}
```

## Single SPEC (`.vibe/specs/{feature-name}.md`) — Small Scope

```markdown
---
status: pending
currentPhase: 0
totalPhases: 3
createdAt: {ISO-timestamp}
lastUpdated: {ISO-timestamp}
---

# SPEC: {feature-name}

## Persona
<role>
Define AI role and expertise for implementation
- Senior developer on the project
- Follow existing code patterns
- Write testable code
</role>

## Context
<context>
### Background
- Why this feature is needed
- Who will use it

### Tech Stack
- Backend: {technology}
- Frontend: {technology}
- Database: {technology}

### Related Code
- `src/xxx/`: Existing implementation to reference
- `src/yyy/`: Files to modify

### Design Reference
- {Reference app/service}
</context>

## Task
<task>
<!-- ⚠️ MANDATORY: Every functional requirement item MUST carry a REQ-ID so the RTM can extract it.
     Format: REQ-{feature-name}-NNN  (feature = SPEC file basename, NNN = 3-digit zero-padded number)
     Example: REQ-auth-login-001
     Regex the RTM uses: /\b(REQ-[a-z0-9-]+-\d{3})[:\s]/gi  — use uppercase REQ-, lowercase feature segment, exactly 3 digits.
     status === 'empty' means the RTM gate MUST be treated as failed/not-applicable, never as 100% pass. -->
### Phase 1: {phase-name}
1. [ ] REQ-{feature-name}-001: {specific task}
   - File: `path/to/file`
   - Verify: `command`
2. [ ] REQ-{feature-name}-002: {specific task}

### Phase 2: {phase-name}
1. [ ] REQ-{feature-name}-003: {specific task}
2. [ ] REQ-{feature-name}-004: {specific task}

### Phase 3: Testing and Verification
1. [ ] REQ-{feature-name}-005: Unit Tests
2. [ ] REQ-{feature-name}-006: Integration Tests
</task>

## Constraints
<constraints>
- Follow existing code patterns
- Localize error messages
- Separate configuration via environment variables
- {other constraints}
</constraints>

## Output Format
<output_format>
### Files to Create
- `path/to/new/file.ts`
- `path/to/new/file.test.ts`

### Files to Modify
- `path/to/existing/file.ts`

### Verification Commands
- `npm test`
- `npm run build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] {verifiable criterion 1}
- [ ] {verifiable criterion 2}
- [ ] All tests pass
- [ ] Build succeeds
</acceptance>
```

## Single Feature (`.vibe/features/{feature-name}.feature`) — Small Scope

```markdown
# Feature: {feature-name}

**SPEC**: `.vibe/specs/{feature-name}.md`

## User Story
**As a** {user}
**I want** {feature}
**So that** {value}

## Scenarios

### Scenario 1: {Happy Path}
\`\`\`gherkin
Scenario: {title}
  Given {precondition}
  When {action}
  Then {result}
\`\`\`
**Verification**: SPEC AC #1

### Scenario 2: {Edge Case}
...

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ⬜ |
```

## Phase Feature (`.vibe/features/{feature-name}/phase-{N}-{name}.feature`) — Large Scope

```markdown
# Feature: {feature-name} - Phase {N}: {phase-name}

**SPEC**: `.vibe/specs/{feature-name}/phase-{N}-{name}.md`
**Master Feature**: `.vibe/features/{feature-name}/_index.feature`

## User Story (Phase Scope)
**As a** {user}
**I want** {phase-specific feature}
**So that** {phase-specific value}

## Scenarios

### Scenario 1: {Phase Happy Path}
...

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | Phase {N} AC-1 | ⬜ |
```
