---
description: Create SPEC document with Specification Agent
argument-hint: "feature name"
---

# /vibe.spec

Create a SPEC document (Specification Agent).

## Usage

```
/vibe.spec "feature-name"           # Conversation mode (requirements gathering)
/vibe.spec "docs/login-prd.md"      # File path input (auto-detected)
/vibe.spec + 📎 file attachment     # Use attached file
```

## Input Mode Detection (Auto-detect)

**Input priority:**

```
1. Attachment exists? → Use attached file
2. Argument is file path? (existence check) → Read file
3. Otherwise → Conversation mode (start with feature name)
```

| Input | Result |
|-------|--------|
| 📎 Attached file | → Analyze attached file |
| File path (exists) | → Read file (Read tool) |
| Feature name | → Start conversation mode |

**All supported files:**
- Text: `.md`, `.txt`, `.rst`, `.html`, `.json`, `.yaml`, etc.
- Documents: `.pdf` (page-by-page analysis)
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, etc.
- Notebooks: `.ipynb` (Jupyter)
- **All formats Claude can read**

**File input mode flow:**

```
/vibe.spec "docs/login-prd.md"

📄 File loaded: docs/login-prd.md (2.3KB)

📋 Parsed requirements:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Feature: Login
  - Email/password login
  - Social login (Google, Apple)
  - Password recovery
  - Auto login persistence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ Additional confirmation needed:
  1. Session expiration time? (default: 24 hours)
  2. Allow concurrent login?
  3. Confirm tech stack? (current: React + Supabase)

User: 1 hour, disallow, confirm

✅ Requirements confirmed → Run research → Generate SPEC → Review
```

**Supported file formats:**

| Format | Extension | Purpose |
|--------|-----------|---------|
| Markdown | `.md` | PRD, planning docs, README |
| Text | `.txt` | Requirements list |
| PDF | `.pdf` | Planning docs, design documents |
| Image | `.png`, `.jpg`, `.jpeg`, `.webp` | Wireframes, UI design, screenshots |

**Image input example:**
```
/vibe.spec "designs/login-wireframe.png"

🖼️ Image analysis: designs/login-wireframe.png

📋 Detected UI elements:
  - Email input field
  - Password input field
  - "Login" button
  - "Forgot password" link
  - Social login buttons (Google, Apple)

❓ Confirmation needed:
  1. Feature name? (e.g., "login")
  2. Additional requirements?

→ Generate SPEC
```

## Rules Reference

**Must follow `~/.claude/vibe/rules/` (global):**
- `core/development-philosophy.md` - Surgical precision, simplicity
- `core/quick-start.md` - Korean first, DRY, SRP
- `core/communication-guide.md` - Communication principles

## Description

Collect requirements through conversation with the user and create an **AI-executable PTCF structured SPEC document**.

> **PTCF**: Persona, Task, Context, Format - Google Gemini prompt optimization framework

## External LLM Integration (GPT/Gemini)

When GPT/Gemini are enabled, they are automatically utilized during SPEC creation:

```
/vibe.spec "feature"
      ↓
[Claude] Draft SPEC
      ↓
[Parallel Research] GPT + Gemini + Claude agents (8 parallel)
      ↓
[SPEC Review] GPT + Gemini parallel review
      ↓
[Claude] Finalize SPEC
```

**Setup:**
```bash
vibe gpt auth       # Enable GPT (OAuth)
vibe gemini auth    # Enable Gemini (OAuth)
vibe status         # Check current settings
```

## Process

### 0. Git Branch Setup (MANDATORY - Execute First!)

> ⚠️ **CRITICAL: You MUST execute this step FIRST before anything else!**
> This is NOT optional documentation - you must RUN these git commands.

**Step 0 is BLOCKING - do not proceed to Step 1 until branch is ready.**

**Execute these commands using Bash tool:**

```bash
# 1. Check current branch
git branch --show-current
```

**Then based on result:**

| Current Branch | Action |
|----------------|--------|
| `main` or `master` | **MUST** create feature branch: `git checkout -b feature/{feature-name}` |
| `feature/*` | Ask user: "Continue on this branch or create new?" |
| Other | Ask user to confirm |

**Example execution:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌿 GIT BRANCH SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current branch: main

Creating feature branch...
$ git checkout -b feature/login-page

✅ Switched to new branch: feature/login-page

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Branch naming rules:**
- Convert to lowercase: `Login Page` → `login-page`
- Replace spaces with hyphens
- Prefix with `feature/`
- Example: `feature/passkey-auth`, `feature/dark-mode`

### 1. Project Analysis

**Existing project** (`vibe init`):
- Source code analysis: `package.json`, `pyproject.toml`, `pubspec.yaml`, `go.mod`, etc.
- Reference `CLAUDE.md` file (tech stack)
- Infer framework from file structure
- **Use `findSymbol` tool** to locate relevant existing implementations

**New project** (`vibe init <project-name>`):
- Suggest tech stack (2-3 options)

### 2. Collect Requirements via Conversation

**Principles:**
- Ask **one question at a time**
- Present options **with numbers** + "Feel free to describe in your own words"
- **Natural conversation** without fixed order

**Required confirmations:**
- Purpose (Why): Why is it needed?
- User (Who): Who will use it?
- Feature scope (What): What features are needed?
- Tech stack: Confirm existing stack or suggest new
- Design reference: UI/UX to reference

### 2.5. Reference Documents via config.json (MANDATORY after tech stack confirmed)

**🚨 CRITICAL: Read config.json references IMMEDIATELY after tech stack is confirmed**

Reference documents are automatically generated in `config.json` based on the stack detected during `vibe init`:

```json
// .claude/vibe/config.json
{
  "language": "ko",
  "stacks": [
    { "type": "typescript-react", "path": "package.json" }
  ],
  "references": {
    "rules": [
      "~/.claude/vibe/rules/code-quality.md",
      "~/.claude/vibe/rules/error-handling.md",
      "~/.claude/vibe/rules/security.md"
    ],
    "languages": [
      "~/.claude/vibe/languages/typescript-react.md"
    ],
    "templates": [
      "~/.claude/vibe/templates/spec-template.md",
      "~/.claude/vibe/templates/feature-template.md",
      "~/.claude/vibe/templates/constitution-template.md"
    ]
  }
}
```

**Workflow:**

1. Read `.claude/vibe/config.json`
2. Extract `references.languages[]` paths
3. Read each language document for stack-specific guidelines

**Example:**
```bash
# 1. Check references in config.json
Read .claude/vibe/config.json

# 2. Reference documents specified in references.languages
Read ~/.claude/vibe/languages/typescript-react.md
```

**Important:**

- No manual mapping needed - config.json contains all reference paths
- `config.json.references` is automatically referenced when running `/vibe.run`
- Not copied to project (referenced from global package)

### 3. Parallel Research (v2.5.0) - MANDATORY AFTER requirements confirmed

**🚨🚨🚨 ABSOLUTE RULES FOR RESEARCH PHASE 🚨🚨🚨**

**STOP! Before doing ANY research, read this carefully:**

1. **DO NOT** use Task tool to spawn research agents
2. **DO NOT** use context7 MCP directly for research
3. **DO NOT** use WebSearch tool directly for research
4. **YOU MUST** use Bash tool to call llm-orchestrate.js directly

**🚨🚨🚨 CRITICAL: NO FILE CREATION DURING RESEARCH 🚨🚨🚨**

5. **DO NOT** create any files in project root during research
6. **DO NOT** create SECURITY_*.md, RESEARCH_*.md, SUMMARY_*.md files
7. **DO NOT** use Write tool during research phase
8. **ALL research results** must be returned as text output only
9. **Files are ONLY created** in Step 4 (SPEC) and Step 5 (Feature) in `.claude/vibe/` directory

**When to trigger:**
1. ✅ Feature type decided (e.g., "passkey authentication")
2. ✅ Tech stack confirmed (e.g., "React + Supabase")
3. ✅ Language guide copied (step 2.5)
4. ✅ Core requirements collected

**→ IMMEDIATELY run these 4 Bash commands IN PARALLEL (all at once):**

```bash
# Cross-platform path (works on Windows/macOS/Linux)
VIBE_SCRIPTS="$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts"

# 1. GPT: Best practices
node "$VIBE_SCRIPTS/llm-orchestrate.js" gpt orchestrate-json "Best practices for [FEATURE] with [STACK]. Focus: architecture patterns, code conventions. Return JSON: {patterns: [], antiPatterns: [], libraries: []}"

# 2. GPT: Security
node "$VIBE_SCRIPTS/llm-orchestrate.js" gpt orchestrate-json "Security vulnerabilities for [FEATURE] with [STACK]. Focus: CVE database, known exploits. Return JSON: {vulnerabilities: [], mitigations: [], checklist: []}"

# 3. Gemini: Best practices
node "$VIBE_SCRIPTS/llm-orchestrate.js" gemini orchestrate-json "Best practices for [FEATURE] with [STACK]. Focus: latest trends, framework updates. Return JSON: {patterns: [], antiPatterns: [], libraries: []}"

# 4. Gemini: Security
node "$VIBE_SCRIPTS/llm-orchestrate.js" gemini orchestrate-json "Security advisories for [FEATURE] with [STACK]. Focus: latest patches, recent incidents. Return JSON: {advisories: [], patches: [], incidents: []}"
```

**Concrete example - run all 4 in parallel:**
```bash
# GPT best practices
node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts/llm-orchestrate.js" gpt orchestrate-json "Best practices for passkey authentication with React, Supabase. Focus: architecture patterns, code conventions. Return JSON: {patterns: [], antiPatterns: [], libraries: []}"

# GPT security
node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts/llm-orchestrate.js" gpt orchestrate-json "Security vulnerabilities for passkey authentication with React, Supabase. Focus: CVE database, known exploits. Return JSON: {vulnerabilities: [], mitigations: [], checklist: []}"

# Gemini best practices
node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts/llm-orchestrate.js" gemini orchestrate-json "Best practices for passkey authentication with React, Supabase. Focus: latest trends, framework updates. Return JSON: {patterns: [], antiPatterns: [], libraries: []}"

# Gemini security
node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts/llm-orchestrate.js" gemini orchestrate-json "Security advisories for passkey authentication with React, Supabase. Focus: latest patches, recent incidents. Return JSON: {advisories: [], patches: [], incidents: []}"
```

**ALSO run Claude research agents in parallel using Task tool:**

| Claude Agent | Role | Source |
|--------------|------|--------|
| `best-practices-agent` | Best practices for [feature] + [stack] | WebSearch |
| `framework-docs-agent` | Latest docs via context7 | context7 MCP |
| `codebase-patterns-agent` | Similar patterns in existing codebase | Glob, Grep |
| `security-advisory-agent` | Security advisories for [feature] | WebSearch |

**Total: 4 GPT/Gemini calls (Bash) + 4 Claude agents (Task) = 8 parallel research tasks**

**🚨 GPT/Gemini MUST be called via Bash with llm-orchestrate.js! 🚨**

#### 3.1 Result Merge Rules

| Area | Merge Strategy |
|------|----------------|
| Best Practices | Deduplicate, keep most detailed |
| Security | ALL included (no dedup for safety) |
| Libraries | Consensus recommendations |

**IMPORTANT:**
- ❌ DO NOT skip research step
- ❌ DO NOT ask user "should I run research?"
- ✅ ALWAYS run after requirements confirmed
- ✅ Show "Running parallel research (Claude + GPT + Gemini)..." message
- ✅ Include all agent + LLM results in SPEC Context
- ✅ Run all 4 Bash LLM calls in parallel + 4 Task agents in parallel

**Research results are reflected in SPEC's Context section.**

### 4. Write SPEC Document (PTCF Structure)

#### 4.0 Large Scope Detection & Auto-Split (MANDATORY)

**🚨 CRITICAL: Automatically split SPEC when scope is large**

**❌ DO NOT ask user for confirmation - auto-split silently**

**Detection criteria (ANY triggers split):**

| Criteria | Threshold |
|----------|-----------|
| Phases | 5+ phases |
| Files to create | 15+ files |
| Platforms | 2+ platforms |
| Major features | 4+ distinct features |

**Auto-split output (SPEC + Feature files must match):**

```
.claude/vibe/specs/{feature-name}/
├── _index.md           # Master SPEC
├── phase-1-setup.md
├── phase-2-core.md
└── ...

.claude/vibe/features/{feature-name}/
├── _index.feature      # Master Feature
├── phase-1-setup.feature
├── phase-2-core.feature
└── ...
```

**🚨 CRITICAL: Each SPEC phase file MUST have a matching Feature file**

**Master SPEC (`_index.md`):**

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

**Master Feature (`_index.feature`):**

```markdown
# Feature: {feature-name} (Master)

**Master SPEC**: `.claude/vibe/specs/{feature-name}/_index.md`

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

**Small scope (default):**

Create `.claude/vibe/specs/{feature-name}.md`:

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
### Phase 1: {phase-name}
1. [ ] {specific task}
   - File: `path/to/file`
   - Verify: `command`
2. [ ] {specific task}

### Phase 2: {phase-name}
1. [ ] {specific task}
2. [ ] {specific task}

### Phase 3: Testing and Verification
1. [ ] Unit Tests
2. [ ] Integration Tests
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

### 5. Create Feature File (BDD) - Required

**🚨 CRITICAL: Feature files MUST match SPEC file structure**

| SPEC Structure | Feature Structure |
|----------------|-------------------|
| Single file (`{feature}.md`) | Single file (`{feature}.feature`) |
| Split (`{feature}/_index.md` + phases) | Split (`{feature}/_index.feature` + phases) |

#### 5.1 Single File (Small Scope)

Create `.claude/vibe/features/{feature-name}.feature`:

**Creation rules:**
1. Convert each SPEC Acceptance Criteria → one Scenario
2. Include Happy Path (normal case) + Edge Case (exception case)
3. Follow Given-When-Then format

```markdown
# Feature: {feature-name}

**SPEC**: `.claude/vibe/specs/{feature-name}.md`

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

#### 5.2 Split Files (Large Scope)

When SPEC is split into phases, Feature files MUST also be split:

```
.claude/vibe/features/{feature-name}/
├── _index.feature        # Master: links to all phase features
├── phase-1-setup.feature # Scenarios for phase-1-setup.md
├── phase-2-core.feature  # Scenarios for phase-2-core.md
└── ...
```

**Phase Feature file structure:**

```markdown
# Feature: {feature-name} - Phase {N}: {phase-name}

**SPEC**: `.claude/vibe/specs/{feature-name}/phase-{N}-{name}.md`
**Master Feature**: `.claude/vibe/features/{feature-name}/_index.feature`

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

### 6. Ambiguity Scan - Required

After creating SPEC draft, **must perform systematic ambiguity check**.

#### 6.1 Mandatory Check Categories

| Category | Check Items | Red Flags |
|----------|-------------|-----------|
| **Functional Scope** | Missing features, unclear behavior | "etc.", "other", "if needed" |
| **Data Model** | Undefined entities, relationships | Undefined types, missing fields |
| **Non-Functional** | Performance, security requirements | Performance requirements without numbers |
| **Edge Cases** | Boundary conditions, errors | 0 failure scenarios |
| **Integration Points** | External APIs, contracts | API version/endpoint undefined |
| **User Input** | Validation rules, limits | Input limits not specified |
| **State Management** | State transitions, persistence | Missing state diagram |

#### 6.2 Forbidden Ambiguous Terms

If the following terms exist in SPEC, **clarification is mandatory**:

| Forbidden Term | Replacement Method |
|----------------|-------------------|
| "appropriately", "properly" | Provide specific criteria (e.g., "within 3 seconds") |
| "quickly", "rapidly" | Specify with numbers (e.g., "under 100ms") |
| "various", "multiple" | List specific items |
| "etc.", "other" | Specify complete list or limit scope |
| "if needed", "depending on situation" | Specify conditions (e.g., "when credits < 10") |
| "later", "in the future" | Explicitly exclude from current scope |

#### 6.3 Check Process

```
1. Write SPEC draft
      ↓
2. Auto-scan for forbidden terms
      ↓
3. Review checklist by category
      ↓
4. List discovered ambiguities
      ↓
5. Auto-fixable items → Fix immediately
   Needs user confirmation → Ask question
      ↓
6. Re-verify (repeat until 0 ambiguities)
```

#### 6.4 Auto-Fix for Common Ambiguities

| Ambiguity Type | Auto-Fix Method |
|----------------|-----------------|
| Timeout undefined | Apply default 30 seconds |
| Retry count undefined | Apply default 3 retries |
| Pagination undefined | Apply default 20 items/page |
| Input length undefined | Text 500 chars, password 8-64 chars |
| File size undefined | Image 5MB, video 100MB |

#### 6.5 Ambiguity Output Format

```markdown
## 🔍 Ambiguity Scan Results

### Found Issues: 3

#### 1. Functional Scope
- ⚠️ "Login failure behavior" not defined
  → **Auto-fix**: Apply 5-minute lockout after 3 failures
- ⚠️ "Session expiration handling" unclear
  → **Question**: Session expiration time? (30min/1hour/24hours)

#### 2. Edge Cases
- ⚠️ Concurrent login permission undefined
  → **Question**: Allow concurrent login? (Y/N)

### Auto-fixed: 1
### Needs clarification: 2
```

### 7. Quality Validation (Self-Check)

**Must perform self-quality check after SPEC completion**

#### 7.1 Quality Checklist (Required Items)

| Category | Check Item | Weight |
|----------|------------|--------|
| **Completeness** | All user flows included in Task | 15% |
| **Completeness** | All ACs converted to Feature scenarios | 10% |
| **Clarity** | No ambiguous terms (e.g., "appropriately", "quickly") | 10% |
| **Clarity** | All numbers/limits specified (e.g., "max 500 chars") | 10% |
| **Testability** | All ACs are auto-testable | 10% |
| **Security** | Authentication/authorization requirements defined | 10% |
| **Security** | Sensitive data handling method specified | 5% |
| **Error Handling** | Major failure scenarios defined | 10% |
| **Error Handling** | User error messages specified | 5% |
| **Performance** | Response time/throughput targets specified | 5% |
| **Edge Cases** | Boundary condition handling defined | 5% |
| **Dependencies** | External systems/APIs specified | 5% |

#### 7.2 Quality Score Calculation

```
Score = Σ(Check item met × Weight) / 100

Grades:
- 95-100: ✅ EXCELLENT - Ready to start implementation
- 90-94:  ⚠️ GOOD - Minor improvements required before implementation
- 80-89:  ⚠️ FAIR - Significant improvements required
- 0-79:   ❌ POOR - Rewrite required
```

#### 7.3 Quality Gate (Auto-verification)

**Minimum 95 points required to proceed to next step (GPT+Gemini review)**

```
SPEC writing complete
      ↓
[Calculate Quality Score]
      ↓
Score < 95? → Show missing items → Attempt auto-fix → Re-evaluate
      ↓
Score ≥ 95 → Proceed to GPT + Gemini review
```

#### 7.4 Auto-Fix for Low Score

If score is below 95, attempt automatic fixes:

| Missing Item | Auto-Fix Method |
|--------------|-----------------|
| Missing AC | Auto-generate AC based on Task |
| Numbers not specified | Apply project defaults (e.g., timeout 30s) |
| Missing error handling | Add common error scenarios |
| Missing performance targets | Apply industry standard criteria |

### 8. SPEC Review (GPT/Gemini) - 3-Round Mandatory Review

**🚨 CRITICAL: YOU MUST EXECUTE ALL 3 ROUNDS. DO NOT SKIP.**

```bash
/vibe.spec "feature"          # Default: 3 rounds (MANDATORY)
/vibe.spec "feature" --quick  # Quick mode: 1 round only
```

**3-Round Review Process (MANDATORY):**

```
# 🚨 CRITICAL: This is a FOR loop, NOT a WHILE loop with early exit
# You MUST complete all 3 rounds regardless of feedback

FOR round_count IN [1, 2, 3]:  # EXACTLY 3 rounds, NO early exit

    print(f"━━━ Round {round_count}/3 ━━━")

    # 1. Call GPT + Gemini in parallel (Bash)
    gpt_result = Bash("node llm-orchestrate.js gpt ...")
    gemini_result = Bash("node llm-orchestrate.js gemini ...")

    # 2. Merge and apply feedback (even if "no issues", still run next round)
    apply_feedback(gpt_result, gemini_result)
    update_spec()

    # 3. Show progress
    print(f"✅ Round {round_count}/3 complete")

    # 4. NO EARLY EXIT - continue to next round
    # Even if both say "no issues", proceed to next round for verification

# After ALL 3 rounds complete:
print(f"🎉 Review complete! All 3 rounds finished.")
```

**🚨 ABSOLUTE RULES (NO EXCEPTIONS):**
1. **MUST complete Round 1** - never skip
2. **MUST complete Round 2** - even if Round 1 had no issues
3. **MUST complete Round 3** - even if Round 1 and 2 had no issues
4. **MUST show "Round X/3"** in output for EACH round
5. **NO EARLY EXIT** - all 3 rounds are mandatory for quality assurance
6. **VIOLATION = SPEC NOT COMPLETE** - if less than 3 rounds, SPEC is invalid

**Output format for each round:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SPEC REVIEW - Round 1/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GPT] 3 issues found: ...
[Gemini] 2 issues found: ...
✅ Applied 5 improvements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SPEC REVIEW - Round 2/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GPT] 1 issue found: ...
[Gemini] 0 issues found
✅ Applied 1 improvement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SPEC REVIEW - Round 3/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GPT] 0 issues found
[Gemini] 0 issues found
✅ No changes needed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 SPEC Review complete! 3 rounds, 6 total improvements
```

**After SPEC draft, execute review loop:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SPEC REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] Sending SPEC to Gemini/GPT...
  - Full SPEC content
  - Feature file (scenarios)
  - Project context

[Step 2] Review feedback:
  ┌─────────────────────────────────────────┐
  │ 📝 SPEC Review Feedback                 │
  │                                         │
  │ 1. [Missing] Error handling scenarios   │
  │    → Recommend adding "retry on network │
  │      error"                             │
  │                                         │
  │ 2. [Security] Auth token expiry         │
  │    handling undefined                   │
  │    → Recommend adding refresh token     │
  │      flow                               │
  │                                         │
  │ 3. [Edge] Concurrent login policy       │
  │    undefined                            │
  │    → Need to specify existing session   │
  │      handling method                    │
  └─────────────────────────────────────────┘

[Step 3] Auto-applying...
  ✅ Added error handling Phase to SPEC Task
  ✅ Added token expiry scenario to Feature
  ✅ Added concurrent login policy to Constraints

[Step 4] Re-verifying...
  ✅ Ambiguity Scan: 0 issues
  ✅ Quality Score: 95/100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPEC Review complete! 3 improvements applied
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**MUST: SPEC Review (Required) - GPT + Gemini Parallel Execution**

🚨 **Run GPT and Gemini in parallel for cross-validation to ensure quality**

**Parallel execution (2 Bash calls simultaneously):**

```bash
# Cross-platform path (works on Windows/macOS/Linux)
VIBE_SCRIPTS="$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts"

# GPT review (code patterns, architecture perspective)
node "$VIBE_SCRIPTS/llm-orchestrate.js" gpt orchestrate-json "Review SPEC for [feature-name]. Stack: [stack]. Summary: [summary]. Check: completeness, error handling, security, edge cases."

# Gemini review (latest docs, best practices perspective)
node "$VIBE_SCRIPTS/llm-orchestrate.js" gemini orchestrate-json "Review SPEC for [feature-name]. Stack: [stack]. Summary: [summary]. Check: completeness, error handling, security, edge cases."
```

**Important:**

- **Must call both GPT and Gemini** (parallel execution)
- Merge feedback from both models and apply to SPEC
- If one model fails, apply only the remaining result
- Don't send full SPEC, send only **key summary** (save tokens)
- Parse JSON response and auto-apply to SPEC

**Why parallel execution:**

| Model | Strengths |
|-------|-----------|
| GPT | Code patterns, architecture, logic validation |
| Gemini | Latest web info, doc search, best practices |

**Result merge:** Combine feedback from both models for more thorough review

**Review items:**

| Category | Check Point |
|----------|-------------|
| Completeness | All user flows covered? |
| Error Handling | Failure scenarios defined? |
| Security | Auth/authorization/data protection? |
| Edge Cases | Boundary conditions handled? |
| Testability | ACs verifiable? |

**Auto-apply rules:**

| Feedback Type | Action |
|---------------|--------|
| Missing scenario | Auto-add to Feature |
| Security considerations | Auto-add to Constraints |
| Edge cases | Auto-add to Task Phase |
| Lack of clarity | Supplement the section |

**Fallback handling:**
- On `"status": "fallback"` response → Skip and proceed to next step
- On network error → Retry once then skip

## Output (MANDATORY File Creation)

**🚨 CRITICAL: Files MUST be created in these EXACT paths. NO exceptions.**

### Small Scope (Single File)

| File | Path | When |
|------|------|------|
| SPEC | `.claude/vibe/specs/{feature-name}.md` | After quality validation (Step 7) |
| Feature | `.claude/vibe/features/{feature-name}.feature` | Immediately after SPEC |

### Large Scope (Split Files)

| File | Path | When |
|------|------|------|
| Master SPEC | `.claude/vibe/specs/{feature-name}/_index.md` | After quality validation |
| Phase SPEC | `.claude/vibe/specs/{feature-name}/phase-{N}-{name}.md` | Per phase |
| Master Feature | `.claude/vibe/features/{feature-name}/_index.feature` | After Master SPEC |
| Phase Feature | `.claude/vibe/features/{feature-name}/phase-{N}-{name}.feature` | Per phase SPEC |

**❌ FORBIDDEN:**

- Creating files in project root (e.g., `feature-name.md`)
- Creating files outside `.claude/vibe/` directory
- Skipping file creation
- Using different file names than feature-name
- Creating split SPEC without matching split Feature files

**✅ REQUIRED:**

- Use Write tool to create files
- Verify directories exist (create if needed)
- Confirm file creation in response
- **Each SPEC file must have a matching Feature file**

### File Creation Template

**Single file:**
```
1. Write .claude/vibe/specs/{feature-name}.md
2. Write .claude/vibe/features/{feature-name}.feature
3. Confirm: "✅ Created: specs/{feature-name}.md + features/{feature-name}.feature"
```

**Split files:**
```
1. Write .claude/vibe/specs/{feature-name}/_index.md
2. Write .claude/vibe/specs/{feature-name}/phase-1-setup.md
3. Write .claude/vibe/specs/{feature-name}/phase-2-core.md
4. Write .claude/vibe/features/{feature-name}/_index.feature
5. Write .claude/vibe/features/{feature-name}/phase-1-setup.feature
6. Write .claude/vibe/features/{feature-name}/phase-2-core.feature
7. Confirm: "✅ Created: {N} SPEC files + {N} Feature files"
```

## Example

```
User: /vibe.spec "brick-game"

Claude:
You're making a brick game! What style are you thinking of?

1. Classic Breakout style
2. Arkanoid (with power-up items)
3. Custom style with special gameplay

Feel free to describe in your own words.

User: 1

Claude: What platform will it run on?

1. Web (browser)
2. Mobile (iOS/Android)
3. Desktop

User: 1

Claude:
Here are tech stack suggestions for web game development:

1. **Phaser.js** (Recommended) - Game framework with built-in physics engine
2. **Canvas + JavaScript** - Lightweight with fine control
3. **PixiJS + Matter.js** - High-performance rendering

User: 1

Claude: What design style?

1. Retro pixel (Atari Breakout)
2. Neon graphics (Arkanoid)
3. Modern 3D effects

User: 2

[Conversation continues...]

Claude: SPEC draft created. Running ambiguity scan.

## 🔍 Ambiguity Scan Results

### Functional Scope
- ⚠️ Game over condition not defined (ball drop vs lives system)
- ⚠️ Stage clear condition unclear

### Edge Cases
- ⚠️ Ball reflection angle when hitting paddle edge
- ⚠️ Multiple brick collision handling

Please clarify the above items.

User: 3 lives, clear when all bricks destroyed, edge reflects at 45 degrees

Claude: Thank you. SPEC has been refined.

🔍 Re-check result: 0 ambiguities
📊 Quality score: 92/100 (A)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SPEC REVIEW (Gemini)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 Sending SPEC...
📝 Gemini feedback:
  1. [Edge] Ball speed increase logic undefined
  2. [Security] Need score manipulation prevention

✅ 2 improvements auto-applied
🔍 Re-verifying... ✅ Passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPEC Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/specs/brick-game.md (PTCF structure)
📄 .claude/vibe/features/brick-game.feature
📊 Quality score: 95/100 (A) ← Improved after review
```

## Vibe Tools (Semantic Analysis & Memory)

### Tool Invocation
All tools are called via:
```bash
node -e "import('@su-record/vibe/tools').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Recommended Tools for SPEC Creation

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `findSymbol` | Find symbol definitions | Locate existing implementations to reference |
| `findReferences` | Find all references | Understand how existing code is used |
| `analyzeComplexity` | Code complexity analysis | Evaluate complexity of code to modify |
| `saveMemory` | Save important decisions | Store confirmed requirements, design decisions |
| `recallMemory` | Recall saved memory | Retrieve previous project decisions |

### Example Tool Usage in SPEC Creation

**1. Find existing auth implementation:**
```bash
node -e "import('@su-record/vibe/tools').then(t => t.findSymbol({symbolName: 'login', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

**2. Save confirmed requirements:**
```bash
node -e "import('@su-record/vibe/tools').then(t => t.saveMemory({key: 'brick-game-requirements', value: 'Platform: Web, Stack: Phaser.js, Style: Neon', category: 'spec', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Recall previous decisions:**
```bash
node -e "import('@su-record/vibe/tools').then(t => t.recallMemory({key: 'brick-game-requirements', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

## Next Step

```
/vibe.run "brick-game"
```

---

ARGUMENTS: $ARGUMENTS
