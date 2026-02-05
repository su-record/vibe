/**
 * Cursor Skills 생성 (VIBE 커맨드 → Cursor 스킬 변환)
 */

import path from 'path';
import fs from 'fs';
import { ensureDir } from './fs-utils.js';

/**
 * Cursor Skills 생성 (VIBE 커맨드 → Cursor 스킬 변환)
 * 설치 경로: ~/.cursor/skills/[skill-name]/SKILL.md
 */
export function generateCursorSkills(cursorSkillsDir: string): void {
  const skills = [
    {
      id: 'su-spec',
      content: `---
name: su-spec
model: claude-4.5-sonnet-thinking
description: "SPEC document creation with parallel research. Use when starting new feature implementation."
---

# vibe spec - SPEC Creation Skill

SPEC-driven feature development workflow. Creates AI-executable specification documents.

## When to Use

- Starting new feature implementation
- Complex tasks requiring research and planning
- Features needing clear requirements documentation

## Invocation

User says: "vibe spec [feature-name]" or "Create SPEC for [feature-name]"

## Workflow

### Phase 1: Requirements Gathering
1. Ask user for feature requirements
2. Clarify scope and constraints
3. Identify tech stack and dependencies

### Phase 2: Parallel Research (Manual)
Run these in parallel:
- "Use best-practices-agent for [feature]"
- "Use security-advisory-agent for [feature]"
- Search framework docs with context7

### Phase 3: SPEC Document Generation
Create SPEC in PTCF format:
\`\`\`
<role>      AI role definition
<context>   Background, tech stack, related code
<task>      Phase-by-phase task list
<constraints> Constraints
<output_format> Files to create/modify
<acceptance> Verification criteria
\`\`\`

### Phase 4: Save SPEC
Save to \`.claude/vibe/specs/[feature-name]-spec.md\`

## Output Format

\`\`\`markdown
# [Feature Name] SPEC

## Overview
[1-2 sentence summary]

## Requirements
- REQ-001: [Requirement]
- REQ-002: [Requirement]

## Technical Approach
[Implementation strategy]

## Phases
### Phase 1: [Setup]
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Core Implementation]
...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
\`\`\`

## Next Steps

After SPEC creation:
- "vibe spec review" - Review SPEC with external LLMs
- "vibe run [feature-name]" - Start implementation
`,
    },
    {
      id: 'su-run',
      content: `---
name: su-run
model: claude-4.5-opus-high
description: "Execute SPEC implementation with Scenario-Driven Development. Use after SPEC is approved."
---

# vibe run - Implementation Execution Skill

Executes SPEC-based implementation using Scenario-Driven Development methodology.

## When to Use

- After SPEC is created and approved
- When implementing features phase by phase
- For complex multi-file implementations

## Invocation

User says: "vibe run [feature-name]" or "Implement [feature-name]"

## Pre-requisites

1. SPEC document exists at \`.claude/vibe/specs/[feature-name]-spec.md\`
2. SPEC has been reviewed (optional but recommended)

## Workflow

### Step 1: Load SPEC
Read SPEC from \`.claude/vibe/specs/[feature-name]-spec.md\`

### Step 2: For Each Phase in SPEC

#### 2a. Phase Planning
- List all tasks for current phase
- Identify file dependencies
- Check existing code patterns

#### 2b. Implementation
- Implement each task
- Follow existing code style
- Keep functions under complexity limits

#### 2c. Phase Verification
- Run relevant tests
- Check TypeScript compilation
- Verify no regressions

### Step 3: Phase Completion
Mark phase complete, proceed to next phase

## ULTRAWORK Mode

Add "ultrawork" or "ulw" for maximum performance:
- Parallel sub-agent exploration
- Auto-continue between phases
- Auto-retry on errors (max 3)

## Output Format

Per phase:
\`\`\`
## Phase [N]: [Name]

### Completed Tasks
- [x] Task 1 - [file.ts]
- [x] Task 2 - [file.ts]

### Files Modified
- src/feature/index.ts (new)
- src/feature/utils.ts (modified)

### Verification
- ✅ TypeScript compilation
- ✅ Tests passing
\`\`\`

## Next Steps

After implementation:
- "vibe review" - Run 12+ agent code review
- "vibe verify [feature-name]" - Verify against SPEC
- "vibe trace [feature-name]" - Generate traceability matrix
`,
    },
    {
      id: 'su-review',
      content: `---
name: su-review
model: auto
description: "Parallel code review with 12+ specialized agents. Use after code changes."
---

# vibe review - Parallel Code Review Skill

Orchestrates 12+ specialized review agents for comprehensive code review.

## When to Use

- After implementing new features
- Before creating pull requests
- After significant code changes

## Invocation

User says: "vibe review" or "Review my code"

## Available Review Agents

### Security & Architecture (Thinking Models)
- **security-reviewer** - OWASP Top 10, authentication, data handling
- **architecture-reviewer** - Design patterns, dependencies, structure
- **data-integrity-reviewer** - Data flow, state management, persistence

### Language Specialists (Codex Models)
- **typescript-reviewer** - Type safety, modern patterns
- **python-reviewer** - Type hints, PEP8, async patterns
- **react-reviewer** - Hooks, component patterns
- **rails-reviewer** - MVC, ActiveRecord best practices

### Pattern Checkers (Flash Models)
- **performance-reviewer** - N+1 queries, loops, memory
- **complexity-reviewer** - Function length, nesting, cyclomatic
- **simplicity-reviewer** - Over-engineering detection
- **test-coverage-reviewer** - Missing tests, edge cases
- **git-history-reviewer** - Risk patterns, commit analysis

## Workflow

### Step 1: Analyze Changes
\`\`\`bash
git diff HEAD~1
\`\`\`

### Step 2: Select Relevant Agents
Based on changed files:
- .ts/.tsx → typescript-reviewer, react-reviewer
- .py → python-reviewer
- Security-related → security-reviewer
- Architecture changes → architecture-reviewer

### Step 3: Run Reviews (Parallel)
Invoke selected agents:
- "Use security-reviewer"
- "Use typescript-reviewer"
- (etc.)

### Step 4: Consolidate Findings

## Priority System

| Priority | Meaning | Action |
|----------|---------|--------|
| 🔴 P1 | Critical | Blocks merge, fix immediately |
| 🟡 P2 | Important | Fix recommended before merge |
| 🔵 P3 | Nice-to-have | Add to backlog |

## Output Format

\`\`\`markdown
# Code Review Summary

## 🔴 P1 - Critical (X issues)
- [Issue description] - [file:line]

## 🟡 P2 - Important (X issues)
- [Issue description] - [file:line]

## 🔵 P3 - Suggestions (X issues)
- [Issue description] - [file:line]

## Reviewed By
- security-reviewer ✅
- typescript-reviewer ✅
- performance-reviewer ✅
\`\`\`

## Next Steps

After review:
- Fix P1 issues immediately
- Address P2 issues before merge
- Track P3 in backlog
- Ready to commit when P1/P2 resolved
`,
    },
    {
      id: 'su-analyze',
      content: `---
name: su-analyze
model: claude-4.5-sonnet-thinking
description: "Project and feature analysis. Use when exploring codebase or planning changes."
---

# vibe analyze - Analysis Skill

Comprehensive project and feature analysis for understanding codebases.

## When to Use

- Exploring unfamiliar codebase
- Planning feature changes
- Understanding dependencies
- Identifying potential issues

## Invocation

User says: "vibe analyze" or "Analyze [feature/path]"

## Analysis Modes

### 1. Project Analysis (Default)
Analyzes entire project structure and architecture.

### 2. Feature Analysis
Analyzes specific feature or module.
\`\`\`
vibe analyze src/auth
vibe analyze "login feature"
\`\`\`

### 3. Dependency Analysis
Maps dependencies and coupling.

## Workflow

### Step 1: Structure Scan
\`\`\`bash
# Find key files
ls -la
find . -name "*.ts" -o -name "*.tsx" | head -20
\`\`\`

### Step 2: Entry Points
Identify main entry points:
- package.json scripts
- src/index.ts
- app/main.ts

### Step 3: Architecture Mapping
- Module boundaries
- Data flow paths
- External dependencies

### Step 4: Quality Assessment
- Complexity hotspots
- Test coverage gaps
- Security concerns

## Output Format

\`\`\`markdown
# Project Analysis: [Name]

## Overview
- Framework: [e.g., Next.js 14]
- Language: [e.g., TypeScript 5.x]
- Package Manager: [e.g., pnpm]

## Architecture
### Layers
1. Presentation (src/components/)
2. Business Logic (src/services/)
3. Data Access (src/repositories/)

### Key Modules
| Module | Purpose | Files |
|--------|---------|-------|
| auth | Authentication | 12 |
| api | API routes | 8 |

## Dependencies
### Internal
- auth → db, utils
- api → auth, services

### External (Notable)
- next: ^14.0.0
- prisma: ^5.0.0

## Quality Metrics
| Metric | Value | Status |
|--------|-------|--------|
| Avg Complexity | 8.2 | ✅ Good |
| Test Coverage | 65% | ⚠️ Moderate |
| Type Coverage | 95% | ✅ Good |

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
\`\`\`

## Next Steps

After analysis:
- "vibe spec [feature]" - Create SPEC for changes
- "vibe review" - Review existing code quality
- Plan Mode - For simple modifications
`,
    },
    {
      id: 'su-verify',
      content: `---
name: su-verify
model: claude-4.5-sonnet-thinking
description: "Verify implementation against SPEC requirements. Use after implementation."
---

# vibe verify - Verification Skill

Verifies implementation completeness against SPEC requirements.

## When to Use

- After completing implementation
- Before marking feature as done
- For requirement traceability

## Invocation

User says: "vibe verify [feature-name]"

## Pre-requisites

1. SPEC exists at \`.claude/vibe/specs/[feature-name]-spec.md\`
2. Implementation is complete

## Workflow

### Step 1: Load SPEC
Read SPEC and extract:
- Requirements (REQ-XXX)
- Acceptance criteria
- Expected outputs

### Step 2: Map Implementation
For each requirement:
- Find implementing code
- Identify test coverage
- Check acceptance criteria

### Step 3: Gap Analysis
Identify:
- Unimplemented requirements
- Untested features
- Missing acceptance criteria

### Step 4: Generate Report

## Verification Levels

| Level | Meaning |
|-------|---------|
| ✅ Full | Code + Test + Verified |
| ⚠️ Partial | Code exists, missing test or verification |
| ❌ None | Not implemented |

## Output Format

\`\`\`markdown
# Verification Report: [Feature]

## Summary
- Total Requirements: 10
- Fully Verified: 8 (80%)
- Partial: 1 (10%)
- Missing: 1 (10%)

## Requirement Matrix

| ID | Requirement | Code | Test | Status |
|----|-------------|------|------|--------|
| REQ-001 | User login | ✅ | ✅ | ✅ Full |
| REQ-002 | Password reset | ✅ | ❌ | ⚠️ Partial |
| REQ-003 | MFA support | ❌ | ❌ | ❌ None |

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Login < 2s | ✅ | Performance test |
| No plain passwords | ✅ | Code review |

## Gaps to Address

1. **REQ-003**: MFA support not implemented
2. **REQ-002**: Missing test for password reset

## Recommendation
⚠️ Address gaps before release
\`\`\`

## Next Steps

After verification:
- Fix gaps if any
- "vibe trace [feature]" - Full traceability matrix
- "vibe review" - Final code review
- Ready for release if all verified
`,
    },
    {
      id: 'su-reason',
      content: `---
name: su-reason
model: claude-4.5-opus-high-thinking
description: "Systematic 9-step reasoning framework. Use for complex problem solving."
---

# vibe reason - Reasoning Framework Skill

Applies systematic reasoning to complex problems and decisions.

## When to Use

- Complex debugging scenarios
- Architecture decisions
- Trade-off analysis
- Root cause analysis

## Invocation

User says: "vibe reason [problem]" or "Reason about [problem]"

## 9-Step Reasoning Framework

### Step 1: Problem Definition
- What exactly is the problem?
- What are the symptoms?
- What is the expected vs actual behavior?

### Step 2: Context Gathering
- What is the relevant code/system?
- What changed recently?
- What are the constraints?

### Step 3: Hypothesis Generation
Generate multiple hypotheses:
- Hypothesis A: [Description]
- Hypothesis B: [Description]
- Hypothesis C: [Description]

### Step 4: Evidence Collection
For each hypothesis:
- What evidence supports it?
- What evidence contradicts it?
- What additional info needed?

### Step 5: Hypothesis Evaluation
Score each hypothesis:
| Hypothesis | Support | Contradict | Confidence |
|------------|---------|------------|------------|
| A | 3 | 1 | 75% |
| B | 2 | 2 | 50% |
| C | 1 | 3 | 25% |

### Step 6: Deep Dive
Focus on highest-confidence hypothesis:
- Trace code paths
- Check logs/metrics
- Reproduce issue

### Step 7: Solution Design
Design solution addressing root cause:
- Option 1: [Description] - Pros/Cons
- Option 2: [Description] - Pros/Cons

### Step 8: Risk Assessment
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| [Risk 1] | High | Medium | [Strategy] |

### Step 9: Recommendation
Final recommendation with:
- Chosen solution
- Implementation steps
- Verification plan

## Output Format

\`\`\`markdown
# Reasoning Analysis: [Problem]

## 1. Problem Definition
[Clear statement of the problem]

## 2. Context
[Relevant background and constraints]

## 3. Hypotheses
1. **H1**: [Description]
2. **H2**: [Description]
3. **H3**: [Description]

## 4-5. Evidence & Evaluation
| Hypothesis | Evidence For | Evidence Against | Confidence |
|------------|--------------|------------------|------------|
| H1 | [List] | [List] | 80% |
| H2 | [List] | [List] | 40% |

## 6. Deep Dive (H1)
[Detailed analysis of most likely cause]

## 7. Solutions
### Option A (Recommended)
- Description: [...]
- Pros: [...]
- Cons: [...]

### Option B
- Description: [...]
- Pros: [...]
- Cons: [...]

## 8. Risks
| Risk | Mitigation |
|------|------------|
| [Risk] | [Strategy] |

## 9. Recommendation
**Proceed with Option A because:**
1. [Reason 1]
2. [Reason 2]

**Next Steps:**
1. [Step 1]
2. [Step 2]
\`\`\`

## Next Steps

After reasoning:
- Implement chosen solution
- "vibe spec [solution]" - If solution needs SPEC
- "vibe verify" - Verify solution addresses problem
`,
    },
    {
      id: 'su-ui',
      content: `---
name: su-ui
model: gpt-5.2-codex
description: "UI preview and generation utilities. Use for UI component work."
---

# vibe ui - UI Utilities Skill

UI preview, generation, and refactoring utilities.

## When to Use

- Creating new UI components
- Previewing UI designs
- Refactoring existing components
- Generating component code from descriptions

## Invocation

User says: "vibe ui [description]" or "Preview UI for [description]"

## Modes

### 1. UI Preview
Generate visual preview of UI description.
\`\`\`
vibe ui "Login form with email, password, and remember me checkbox"
\`\`\`

### 2. Component Generation
Generate component code from description.
\`\`\`
vibe ui generate "User profile card with avatar, name, and bio"
\`\`\`

### 3. UI Refactoring
Refactor existing component for better patterns.
\`\`\`
vibe ui refactor src/components/UserCard.tsx
\`\`\`

## Workflow

### UI Preview Mode

1. **Parse Description**
   - Extract UI elements
   - Identify layout requirements
   - Note interactions

2. **Generate Preview**
   - Create HTML/CSS mockup
   - Show component structure
   - Illustrate states (default, hover, active)

3. **Output**
   - Visual description
   - Component hierarchy
   - Suggested implementation

### Component Generation Mode

1. **Analyze Requirements**
   - Component purpose
   - Props interface
   - State requirements

2. **Generate Code**
   - TypeScript/React component
   - Styled with project's CSS approach
   - Include prop types

3. **Output**
   - Complete component file
   - Usage example
   - Test suggestions

### Refactoring Mode

1. **Analyze Existing**
   - Current structure
   - Identified issues
   - Improvement opportunities

2. **Plan Refactor**
   - Extract components
   - Improve patterns
   - Optimize performance

3. **Apply Changes**
   - Preserve functionality
   - Improve readability
   - Add documentation

## Output Format

### Preview Output
\`\`\`markdown
# UI Preview: [Description]

## Visual Structure
\`\`\`
┌─────────────────────────────────┐
│  [Header]                       │
├─────────────────────────────────┤
│  📧 Email: [_______________]    │
│  🔒 Password: [_______________] │
│  ☐ Remember me                  │
│                                 │
│        [  Login  ]              │
└─────────────────────────────────┘
\`\`\`

## Component Hierarchy
- LoginForm
  - FormField (email)
  - FormField (password)
  - Checkbox (remember)
  - Button (submit)

## Suggested Props
\`\`\`typescript
interface LoginFormProps {
  onSubmit: (data: LoginData) => void;
  isLoading?: boolean;
  error?: string;
}
\`\`\`
\`\`\`

### Generation Output
\`\`\`typescript
// Complete component code with:
// - TypeScript types
// - React hooks
// - Styled components or CSS classes
// - Event handlers
\`\`\`

## Next Steps

After UI work:
- "vibe review" - Review generated components
- "vibe run [feature]" - Continue implementation
- Add tests for new components
`,
    },
  ];

  let updated = 0;
  for (const skill of skills) {
    const skillDir = path.join(cursorSkillsDir, skill.id);
    ensureDir(skillDir);
    const destPath = path.join(skillDir, 'SKILL.md');
    try {
      fs.writeFileSync(destPath, skill.content, 'utf-8');
      updated++;
    } catch {
      // 무시 - 권한 문제 등
    }
  }

  console.log(`   🎯 Cursor skills: ${updated}/${skills.length} updated`);
}
