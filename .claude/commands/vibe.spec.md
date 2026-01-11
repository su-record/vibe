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

**Must follow `.vibe/rules/`:**
- `core/development-philosophy.md` - Surgical precision, simplicity
- `core/quick-start.md` - Korean first, DRY, SRP
- `core/communication-guide.md` - Communication principles

## Description

Collect requirements through conversation with the user and create an **AI-executable PTCF structured SPEC document**.

> **PTCF**: Persona, Task, Context, Format - Google Gemini prompt optimization framework

## External LLM Integration (Optional)

When external LLMs are enabled in `.vibe/config.json`, automatically utilize during SPEC creation:

```
/vibe.spec "complex feature"
      ↓
[Claude Opus] Create SPEC draft
      ↓
[GPT enabled?] → Cross-review design via MCP(vibe-gpt)
      ↓
[Gemini enabled?] → UI/UX consultation via MCP(vibe-gemini)
      ↓
[Claude] Finalize SPEC
```

| External LLM | Role | When Used |
|--------------|------|-----------|
| GPT 5.2 | Architecture/design review | After SPEC draft completion |
| Gemini 3 | UI/UX consultation | During design reference discussion |

**Activation:**
```bash
vibe gpt <api-key>      # Enable GPT
vibe gemini <api-key>   # Enable Gemini
vibe status             # Check current settings
```

## Process

### 0. Parallel Research (NEW - v2.1.0)

**SPEC 작성 전 4개 리서치 에이전트 병렬 실행:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 PARALLEL RESEARCH AGENTS                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Task 1: best-practices-agent                                   │
│  └── 업계 표준, 권장 패턴 조사                                   │
│                                                                 │
│  Task 2: framework-docs-agent                                   │
│  └── 관련 프레임워크 최신 문서 수집 (context7 활용)              │
│                                                                 │
│  Task 3: codebase-patterns-agent                                │
│  └── 기존 코드베이스 패턴 분석                                   │
│                                                                 │
│  Task 4: security-advisory-agent                                │
│  └── 보안 권고사항, OWASP 체크                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**실행 방법 (모두 병렬 호출):**
```
Task(model: "haiku", subagent_type: "Explore", prompt: "Research best practices for [feature]")
Task(model: "haiku", subagent_type: "Explore", prompt: "Get framework docs for [tech stack]")
Task(model: "haiku", subagent_type: "Explore", prompt: "Analyze existing patterns in codebase for [feature]")
Task(model: "haiku", subagent_type: "Explore", prompt: "Check security advisories for [feature]")
```

**리서치 결과는 SPEC의 Context 섹션에 자동 반영됨.**

### 1. Project Analysis

**Existing project** (`vibe init`):
- Source code analysis: `package.json`, `pyproject.toml`, `pubspec.yaml`, `go.mod`, etc.
- Reference `CLAUDE.md` file (tech stack)
- Infer framework from file structure

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

### 3. Write SPEC Document (PTCF Structure)

Create `.vibe/specs/{feature-name}.md`:

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

### 4. Create Feature File (BDD) - Required

**Must** create `.vibe/features/{feature-name}.feature` file.

**Creation rules:**
1. Convert each SPEC Acceptance Criteria → one Scenario
2. Include Happy Path (normal case) + Edge Case (exception case)
3. Follow Given-When-Then format

**Feature structure:**
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

### 5. Ambiguity Scan - Required

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

### 6. Quality Validation

Self-evaluate against `.vibe/rules/quality/checklist.md` (0-100 score)

## Output

- `.vibe/specs/{feature-name}.md` - PTCF structured SPEC
- `.vibe/features/{feature-name}.feature` - BDD Feature file
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
📄 .vibe/specs/brick-game.md (PTCF structure)
📄 .vibe/features/brick-game.feature
📊 Quality score: 92/100 (A)
```

## Next Step

```
/vibe.run "brick-game"
```

---

ARGUMENTS: $ARGUMENTS
