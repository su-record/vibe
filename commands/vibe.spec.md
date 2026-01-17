---
description: Create SPEC document with Specification Agent
argument-hint: "feature name"
---

# /vibe.spec

Create a SPEC document (Specification Agent).

## Usage

```
/vibe.spec "feature-name"
```

## Rules Reference

**Must follow `.claude/vibe/rules/`:**
- `core/development-philosophy.md` - Surgical precision, simplicity
- `core/quick-start.md` - Korean first, DRY, SRP
- `core/communication-guide.md` - Communication principles

## Description

Collect requirements through conversation with the user and create an **AI-executable PTCF structured SPEC document**.

> **PTCF**: Persona, Task, Context, Format - Google Gemini prompt optimization framework

## External LLM Integration (Optional)

When external LLMs are enabled, automatically utilize during SPEC creation:

```
/vibe.spec "complex feature"
      ↓
[Claude Opus] Create SPEC draft
      ↓
[GPT enabled?] → vibe-gpt- Review this architecture: [design]
      ↓
[Gemini enabled?] → vibe-gemini- Suggest UX improvements for: [component]
      ↓
[Claude] Finalize SPEC
```

| External LLM | Prefix | Role | When Used |
|--------------|--------|------|-----------|
| GPT (user query) | `gpt-`, `gpt.`, `지피티-` | Direct question (Web Search enabled) | User asks directly |
| GPT (orchestration) | `vibe-gpt-` | Internal orchestration (JSON, no search) | SPEC/vibe.run internal |
| Gemini (user query) | `gemini-`, `gemini.`, `제미나이-` | Direct question (Google Search enabled) | User asks directly |
| Gemini (orchestration) | `vibe-gemini-` | Internal orchestration (JSON, no search) | SPEC/vibe.run internal |

**Activation:**
```bash
vibe gpt login      # Enable GPT (OAuth)
vibe gemini login   # Enable Gemini (OAuth)
vibe status         # Check current settings
```

## Process

### 0. Git Branch Setup (Automatic)

**CRITICAL: Always create feature branch before starting SPEC**

```bash
# Check current branch
current=$(git branch --show-current 2>/dev/null || echo "main")

# Sanitize feature name (spaces → hyphens, lowercase)
branch_name="feature/$(echo "{feature-name}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

# Create feature branch if on main/master
if [[ "$current" == "main" || "$current" == "master" ]]; then
  git checkout -b "$branch_name"
  echo "✅ Created and switched to: $branch_name"
else
  echo "ℹ️  Already on feature branch: $current"
  echo "   Continue on this branch? (Y/n)"
  # If user says no, create new branch
fi
```

**Rules:**
- If on `main`/`master` → **Always** create `feature/{feature-name}` branch
- If already on feature branch → Ask user to confirm or create new branch
- Branch naming: `feature/passkey-auth`, `feature/dark-mode`, etc.
- Git check BEFORE starting requirements gathering

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

### 3. Parallel Research (v2.4.0) - MANDATORY AFTER requirements confirmed

**🚨 CRITICAL: Research is MANDATORY after requirements are confirmed**

**When to trigger:**
1. ✅ Feature type decided (e.g., "passkey authentication")
2. ✅ Tech stack confirmed (e.g., "React + Supabase")
3. ✅ Core requirements collected

**→ IMMEDIATELY run orchestrator research. NO EXCEPTIONS.**

**Execution via Orchestrator (4 agents in parallel):**
```bash
node -e "import('@su-record/vibe/orchestrator').then(o => o.research('[FEATURE]', ['[STACK1]', '[STACK2]']).then(r => console.log(r.content[0].text)))"
```

**Example:**
```bash
# After confirming: passkey auth + React + Supabase
node -e "import('@su-record/vibe/orchestrator').then(o => o.research('passkey authentication', ['React', 'Supabase']).then(r => console.log(r.content[0].text)))"
```

**What runs in parallel (180s timeout each):**
| Agent | Role | Tools |
|-------|------|-------|
| `best-practices-agent` | Best practices for [feature] + [stack] | WebSearch |
| `framework-docs-agent` | Latest docs via context7 | context7 MCP |
| `codebase-patterns-agent` | Similar patterns in existing codebase | Glob, Grep |
| `security-advisory-agent` | Security advisories for [feature] | WebSearch |

**IMPORTANT:**
- ❌ DO NOT skip research step
- ❌ DO NOT ask user "should I run research?"
- ✅ ALWAYS run after requirements confirmed
- ✅ Show "Running parallel research..." message
- ✅ Include all 4 agent results in SPEC Context

**Research results are reflected in SPEC's Context section.**

### 4. Write SPEC Document (PTCF Structure)

Create `.claude/vibe/specs/{feature-name}.md`:

```markdown
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

**Must** create `.claude/vibe/features/{feature-name}.feature` file.

**Creation rules:**
1. Convert each SPEC Acceptance Criteria → one Scenario
2. Include Happy Path (normal case) + Edge Case (exception case)
3. Follow Given-When-Then format

**Feature structure:**
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

### 6. Ambiguity Scan - Required

After creating SPEC draft, **must perform systematic ambiguity check**.

**Check categories:**

| Category | Check Items |
|----------|-------------|
| **Functional Scope** | Missing features, unclear behavior definitions |
| **Data Model** | Undefined entities, unclear relationships |
| **Non-Functional** | Missing performance requirements, security considerations |
| **Edge Cases** | Boundary conditions, error handling scenarios |
| **Integration Points** | External system integration, API contracts |

**Check process:**

```
1. Create SPEC draft
      ↓
2. Scan by category for ambiguity
      ↓
3. Present list of found ambiguities
      ↓
4. Request user clarification
      ↓
5. Refine SPEC
      ↓
6. Re-check (until 0 ambiguities)
```

**Ambiguity output format:**

```markdown
## 🔍 Ambiguity Scan Results

### Functional Scope
- ⚠️ "Login failure behavior" not defined
- ⚠️ "Session expiration handling" unclear

### Edge Cases
- ⚠️ Concurrent login permission undefined
- ⚠️ No password retry limit specified

Please clarify the above items.
```

### 7. Quality Validation

Self-evaluate against `.claude/vibe/rules/quality/checklist.md` (0-100 score)

## Output

- `.claude/vibe/specs/{feature-name}.md` - PTCF structured SPEC
- `.claude/vibe/features/{feature-name}.feature` - BDD Feature file
- Ambiguity scan results (0 ambiguities confirmed)
- Quality score and improvement suggestions

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

✅ SPEC document complete!
📄 .claude/vibe/specs/brick-game.md (PTCF structure)
📄 .claude/vibe/features/brick-game.feature
📊 Quality score: 92/100 (A)
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
