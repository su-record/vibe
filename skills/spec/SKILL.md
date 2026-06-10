---
name: spec
description: PTCF 구조 SPEC 한 문서 작성 — parallel research (GPT/Antigravity/Claude agents), ambiguity scan, 100-point quality gate. plan 파일 입력 → .vibe/specs/{feature}.md + .vibe/features/{feature}.feature 생성.
when_to_use: vibe.spec orchestrator의 Phase 3에서 호출. 직접 호출 금지 — /vibe.spec 사용.
user-invocable: false
tier: core
chain-next: [spec-review]
---

# vibe.spec — Specification Agent

Create a SPEC document (Specification Agent).

## Usage

```
/vibe.spec "feature-name"                    # Conversation mode (requirements gathering)
/vibe.spec "feature-name" ultrawork          # Auto: SPEC → Review → Implementation
/vibe.spec "docs/login-prd.md"               # File path input (auto-detected)
/vibe.spec + 📎 file attachment              # Use attached file
```

### ultrawork Mode

When `ultrawork` (or `ulw`) is included, automatically chains:

```
/vibe.spec "feature" ultrawork
    ↓
[1] SPEC Creation (this command)
    ↓
[2] Auto: Load skill `spec-review` (chain-next from this skill)
    ↓
[3] Auto: /vibe.run "{feature}" ultrawork
```

**No manual intervention between steps.**

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

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

**Image input analysis:**

When image files (`.png`, `.jpg`, `.jpeg`, `.webp`) are provided as input, analyze them using the best available method:

- **Antigravity Enabled**: `llm-orchestrate.js antigravity analyze-image` (Antigravity Flash - best image recognition)
- **Antigravity Disabled**: Claude Opus Read tool (built-in multimodal, existing behavior)

**Antigravity enabled - analyze via llm-orchestrate.js:**

```bash
# [LLM_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js
node "[LLM_SCRIPT]" antigravity analyze-image "./designs/login-wireframe.png" "Analyze this UI design image. Identify all UI elements, layout structure, colors, typography, and component hierarchy. Output a structured breakdown."
```

Parse the JSON result: `{ success: true, analysis: "..." }` → use `analysis` field content.

If `success: false`, fall back to Claude Read tool.

**Antigravity disabled - analyze via Claude Read tool:**

Use the Read tool directly on the image file. Claude can read images natively.

**Image input example:**
```
/vibe.spec "designs/login-wireframe.png"

🖼️ Image analysis: designs/login-wireframe.png
   (via Antigravity Flash / Claude Opus)

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

> **PTCF**: Persona, Task, Context, Format - Google Antigravity prompt optimization framework

## External LLM Integration (GPT/Antigravity)

When GPT/Antigravity are enabled, they are automatically utilized during SPEC creation:

```
/vibe.spec "feature"
      ↓
[Claude] Draft SPEC
      ↓
[Parallel Research] GPT + Antigravity + Claude agents (8 parallel)
      ↓
[SPEC Review] GPT + Antigravity parallel review
      ↓
[Claude] Finalize SPEC
```

**Setup:**
```bash
vibe gpt key <key>      # Enable GPT
vibe antigravity key <key>   # Enable Antigravity
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

**`.last-feature` pointer update** (immediately after Git branch setup):

```
Write ".vibe/.last-feature" ← feature-name (single line)
Execute at the point when the feature name is finalized.
No-op if the value is already the same.
```

### 1. Project Analysis

**Existing project** (`vibe init`):
- Reference `CLAUDE.md` file (tech stack)
- **Delegate codebase analysis to explorer agent** — do NOT read project files in main session:

```text
Task(subagent_type="explorer-low",
  prompt="Analyze project structure: package.json, pyproject.toml, pubspec.yaml, go.mod.
  Find existing implementations related to [FEATURE]. Return: tech stack, relevant files, patterns used.
  Keep summary under 200 tokens.")
```

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

### 2.1 Critical Requirements Confirmation (askUser) - v2.6.1

**🚨 IMPORTANT: Use `askUser` tool for CRITICAL requirements that must not be missed**

After initial conversation, use the structured `askUser` tool for:
- 🔐 Authentication: method, MFA, password policy
- 🛡️ Security: rate limiting, session management
- ⏱️ Session: duration, concurrent login policy
- 📊 Data Model: required fields, relationships

**When to use askUser vs conversation:**

| Scenario | Method |
|----------|--------|
| Exploratory (feature scope, style) | Natural conversation |
| **Critical** (auth, security, session) | `askUser` tool |
| Optional (performance, integration) | Natural conversation |

**Usage**: read `references/askuser-examples.md` in this skill directory for `askUser`/`askUserQuick` invocation code, example output format, and `parseUserResponse` response parsing.

**Available categories:**
- `authentication`: Auth methods, MFA
- `security`: Password policy, rate limiting
- `session`: Session expiry, concurrent login
- `data_model`: User profile fields
- `performance`: Response time targets
- `integration`: External service integration


**ultrawork mode:**
- askUser is **skipped** in ultrawork mode
- Uses default values from templates automatically

### 2.5. Reference Documents via config.json (MANDATORY after tech stack confirmed)

**🚨 CRITICAL: Read config.json references IMMEDIATELY after tech stack is confirmed**

Reference documents are automatically generated in `config.json` based on the stack detected during `vibe init`:

```json
// .vibe/config.json
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

1. Read `.vibe/config.json`
2. Extract `references.languages[]` paths
3. Read each language document for stack-specific guidelines

**Example:**
```bash
# 1. Check references in config.json
Read .vibe/config.json

# 2. Reference documents specified in references.languages
Read ~/.claude/vibe/languages/typescript-react.md
```

**Important:**

- No manual mapping needed - config.json contains all reference paths
- `config.json.references` is automatically referenced when running `/vibe.run`
- Not copied to project (referenced from global package)

### 2.9 Research Cache Check (BEFORE step 3)

Before spawning any research agents, check for a prior persisted dataset:

```bash
# Slug = kebab-case of the feature/topic, max 50 chars
ls .vibe/research/<slug>/paper.md 2>/dev/null
```

**If `paper.md` exists:**
1. Read `.vibe/research/<slug>/paper.md`
2. Read `.vibe/research/<slug>/awesome-list.md` (if present)
3. Inject the **Findings**, **Recommendation**, and **Security considerations** sections verbatim into SPEC Context, prefixed with `> Source: .vibe/research/<slug>/paper.md (cached {{FILE_MTIME}})`
4. **Skip step 3** (parallel research) entirely — do not re-run GPT/Antigravity/Claude agents
5. Print: `✅ Research cache hit: <slug> (saved ~30s of LLM calls)`

**Cache invalidation:**
- User passes `--refresh-research` → delete dir, rerun step 3 from scratch
- `paper.md` mtime older than 30 days → warn the user, ask to refresh or reuse
- `stack` in `paper.md` frontmatter differs from current stack → auto-refresh

**If `paper.md` does NOT exist:**
Proceed to step 3. After step 3 completes, the synthesizer **must** write the 3 artifacts (see `parallel-research/orchestrator.md` Phase 5) so the next `/vibe.spec` run on this topic hits the cache.

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
9. **Files are ONLY created** in Step 4 (SPEC) and Step 5 (Feature) in `.vibe/` directory

**When to trigger:**
1. ✅ Feature type decided (e.g., "passkey authentication")
2. ✅ Tech stack confirmed (e.g., "React + Supabase")
3. ✅ Language guide copied (step 2.5)
4. ✅ Core requirements collected

**→ IMMEDIATELY run these 6 Bash commands IN PARALLEL (all at once):**

**Step 0: Script path:**
- `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`

**Run all 4 in PARALLEL (each as separate Bash tool call):**
```bash
# 1. GPT: Best practices (codex — code review & analysis)
node "[LLM_SCRIPT]" gpt-codex orchestrate-json "Best practices for [FEATURE] with [STACK]. Focus: architecture patterns, code conventions. Return JSON: {patterns: [], antiPatterns: [], libraries: []}"

# 2. GPT: Security (codex — code review & analysis)
node "[LLM_SCRIPT]" gpt-codex orchestrate-json "Security vulnerabilities for [FEATURE] with [STACK]. Focus: CVE database, known exploits. Return JSON: {vulnerabilities: [], mitigations: [], checklist: []}"

# 3. Antigravity: Best practices
node "[LLM_SCRIPT]" antigravity orchestrate-json "Best practices for [FEATURE] with [STACK]. Focus: latest trends, framework updates. Return JSON: {patterns: [], antiPatterns: [], libraries: []}"

# 4. Antigravity: Security
node "[LLM_SCRIPT]" antigravity orchestrate-json "Security advisories for [FEATURE] with [STACK]. Focus: latest patches, recent incidents. Return JSON: {advisories: [], patches: [], incidents: []}"
```

**Concrete example - run all 4 in parallel:**
```bash
# GPT best practices (codex — code review & analysis)
node "[LLM_SCRIPT]" gpt-codex orchestrate-json "Best practices for passkey authentication with React, Supabase. Focus: architecture patterns, code conventions. Return JSON: {patterns: [], antiPatterns: [], libraries: []}"

# GPT security (codex — code review & analysis)
node "[LLM_SCRIPT]" gpt-codex orchestrate-json "Security vulnerabilities for passkey authentication with React, Supabase. Focus: CVE database, known exploits. Return JSON: {vulnerabilities: [], mitigations: [], checklist: []}"

# Antigravity best practices
node "[LLM_SCRIPT]" antigravity orchestrate-json "Best practices for passkey authentication with React, Supabase. Focus: latest trends, framework updates. Return JSON: {patterns: [], antiPatterns: [], libraries: []}"

# Antigravity security
node "[LLM_SCRIPT]" antigravity orchestrate-json "Security advisories for passkey authentication with React, Supabase. Focus: latest patches, recent incidents. Return JSON: {advisories: [], patches: [], incidents: []}"
```

**ALSO run Claude research agents in parallel using Task tool:**

| Claude Agent | Role | Source |
|--------------|------|--------|
| `best-practices` | Best practices for [feature] + [stack] | WebSearch |
| `framework-docs` | Latest docs via context7 | context7 MCP |
| `codebase-patterns` | Similar patterns in existing codebase | Glob, Grep |
| `security-advisory` | Security advisories for [feature] | WebSearch |

**Total: 4 GPT/Antigravity calls (Bash) + 4 Claude agents (Task) = 8 parallel research tasks**

**🚨 GPT/Antigravity MUST be called via Bash with llm-orchestrate.js! 🚨**

#### 3.0.1 Agent Teams — Research Collaboration

> **Team definition**: See `agents/teams/research-team.md`
> Settings: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `teammateMode: in-process` (`~/.claude/settings.json` global — auto-configured by postinstall)

**Discussion results are reflected in the SPEC's Context section.**

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
- ✅ Show "Running parallel research (Claude + GPT + Antigravity)..." message
- ✅ Include all agent + LLM results in SPEC Context
- ✅ Run all 4 Bash LLM calls in parallel + 4 Task agents in parallel

**Research results are reflected in SPEC's Context section.**

### 3.2 UI/UX Design Intelligence (Auto-triggered)

> **Condition**: Auto-executes when UI/UX keywords are present in the SPEC context (website, landing, dashboard, app, e-commerce, portfolio, SaaS, mobile app, web app, UI, UX, frontend, design)
> **Disable**: Set `"uiUxAnalysis": false` in `.vibe/config.json`

**When UI/UX keywords are detected, run 3 agents sequentially in parallel with research:**

```
[Parallel Research] GPT + Antigravity + Claude agents
        ↓ (concurrent execution)
[UI/UX Intelligence]
  ① ui-industry-analyzer (Haiku) → industry analysis + design strategy
        ↓
  ②③ parallel execution:
    ② ui-design-system-gen (Sonnet) → generate MASTER.md
    ③ ui-layout-architect (Haiku) → layout design
```

**How to execute:**

1. **① ui-industry-analyzer** — Run as Task(haiku) agent:
```text
Task(subagent_type="ui-industry-analyzer",
  prompt="Analyze product: [USER_DESCRIPTION]. Use core_ui_search to detect category, style priority, color mood, typography mood. Save result to .vibe/design-system/{project}/analysis-result.json")
```

2. **②③ parallel execution** — Using ①'s result as input:
```text
# ② Generate design system (Sonnet)
Task(subagent_type="ui-design-system-gen",
  prompt="Generate design system from analysis-result.json for project '{project}'. Use core_ui_search for style/color/typography, then core_ui_generate_design_system and core_ui_persist_design_system.")

# ③ Layout design (Haiku) — parallel execution
Task(subagent_type="ui-layout-architect",
  prompt="Design layout from analysis-result.json for project '{project}'. Use core_ui_search for landing patterns and dashboard layout.")
```

3. **Inject results into SPEC Context:**
```markdown
### Design System (Auto-generated)
- Category: {① category}
- Style: {① style_priority}
- MASTER.md: .vibe/design-system/{project}/MASTER.md
- Layout: {③ pattern + sections}
```

### 3.9 Persist Research Cache (AFTER research completes, BEFORE SPEC write)

> The "no Write during research" rule from step 3 does **not** apply here — research is done; artifacts are safe to persist.

After parallel research + UI/UX intelligence complete, before writing the SPEC, save the merged research to `.vibe/research/<slug>/`:

1. Compute slug: kebab-case of feature name, max 50 chars
2. Write **three files** using templates from `parallel-research/templates/`:
   - `.vibe/research/<slug>/synthesis.md` — raw merged findings (all agent outputs)
   - `.vibe/research/<slug>/awesome-list.md` — curated links/repos/patterns (every entry needs a one-line "why"; drop entries without one)
   - `.vibe/research/<slug>/paper.md` — structured survey (Abstract → Background → Method → Findings → Recommendation → Security → References)
3. Include a frontmatter header in `paper.md` with a `stack:` field so step 2.9 can detect stack drift
4. If the directory already exists (user passed `--refresh-research`), overwrite

This makes the next `/vibe.spec` (or future `/vibe.research`) invocation on the same topic hit the cache at step 2.9.

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
.vibe/specs/{feature-name}/
├── _index.md           # Master SPEC
├── phase-1-setup.md
├── phase-2-core.md
└── ...

.vibe/features/{feature-name}/
├── _index.feature      # Master Feature
├── phase-1-setup.feature
├── phase-2-core.feature
└── ...
```

**🚨 CRITICAL: Each SPEC phase file MUST have a matching Feature file**

**Master SPEC / Master Feature**: copy the `Master SPEC (_index.md)` and `Master Feature (_index.feature)` templates from `references/templates.md`.

**Small scope (default):**

Create `.vibe/specs/{feature-name}.md` with the **Single SPEC template** in `references/templates.md` — PTCF structure (Persona / Context / Task / Constraints / Output Format / Acceptance Criteria) + status frontmatter (status/currentPhase/totalPhases/createdAt/lastUpdated).

### 5. Create Feature File (BDD) - Required

**🚨 CRITICAL: Feature files MUST match SPEC file structure**

| SPEC Structure | Feature Structure |
|----------------|-------------------|
| Single file (`{feature}.md`) | Single file (`{feature}.feature`) |
| Split (`{feature}/_index.md` + phases) | Split (`{feature}/_index.feature` + phases) |

#### 5.1 Single File (Small Scope)

Create `.vibe/features/{feature-name}.feature`:

**Creation rules:**
1. Convert each SPEC Acceptance Criteria → one Scenario
2. Include Happy Path (normal case) + Edge Case (exception case)
3. Follow Given-When-Then format

Use the **Single Feature template** in `references/templates.md` — User Story + gherkin Given-When-Then scenarios + Coverage table mapping each scenario to a SPEC AC.

#### 5.2 Split Files (Large Scope)

When SPEC is split into phases, Feature files MUST also be split:

```
.vibe/features/{feature-name}/
├── _index.feature        # Master: links to all phase features
├── phase-1-setup.feature # Scenarios for phase-1-setup.md
├── phase-2-core.feature  # Scenarios for phase-2-core.md
└── ...
```

**Phase Feature file structure**: use the **Phase Feature template** in `references/templates.md`.

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
6. Re-verify (max 2 rounds — remaining ambiguities → user confirmation or TODO)
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

**100 points required to complete SPEC draft. Loop until perfect — ask user if auto-fixer hits a wall.**

```
SPEC writing complete
      ↓
[Calculate Quality Score]
      ↓
Score < 100? → Show missing items → Auto-fix → Re-evaluate
      ↓
Stuck? (score == prev_score)
  ├─ Interactive: ask user → fill values OR "proceed" OR "abort"
  └─ ultrawork: record gaps as TODO → proceed
      ↓
Score == 100 (or user-approved) → SPEC Draft Complete → Handoff to spec-review skill
```

#### 7.4 Auto-Fix for Low Score

If score is below 100, attempt automatic fixes:

| Missing Item | Auto-Fix Method |
|--------------|-----------------|
| Missing AC | Auto-generate AC based on Task |
| Numbers not specified | Apply project defaults (e.g., timeout 30s) |
| Missing error handling | Add common error scenarios |
| Missing performance targets | Apply industry standard criteria |

### 8. SPEC Draft Complete - Handoff to Review

**🚨 IMPORTANT: GPT/Antigravity review is now a SEPARATE command**

After SPEC draft is complete (score ≥ 95):

**If `ultrawork` mode:**
- ❌ DO NOT show handoff message
- ❌ DO NOT ask for confirmation
- ✅ Immediately load skill `spec-review` with feature `{feature-name}` (chain-next)
- ✅ After review passes, immediately proceed to `/vibe.run "{feature-name}" ultrawork`

**If normal mode:**
Output the handoff message:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPEC DRAFT COMPLETE: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 SPEC: .vibe/specs/{feature-name}.md
📋 Feature: .vibe/features/{feature-name}.feature
📊 Quality Score: {score}/100
⏱️ Started: {start_time}
⏱️ Completed: {getCurrentTime result}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ NEXT STEP: Run SPEC review (spec-review skill)

Option 1 (same session):
  Load skill `spec-review` with feature `{feature-name}`
  (or natural language: "spec review")

Option 2 (recommended for large context):
  /new → /vibe.spec "{feature-name}"
  (Smart Resume will start from Phase 4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Tip:** New session recommended when context > 50% to ensure review accuracy

## Output (MANDATORY File Creation)

**🚨 CRITICAL: Files MUST be created in these EXACT paths. NO exceptions.**

### Small Scope (Single File)

| File | Path | When |
|------|------|------|
| SPEC | `.vibe/specs/{feature-name}.md` | After quality validation (Step 7) |
| Feature | `.vibe/features/{feature-name}.feature` | Immediately after SPEC |

### Large Scope (Split Files)

| File | Path | When |
|------|------|------|
| Master SPEC | `.vibe/specs/{feature-name}/_index.md` | After quality validation |
| Phase SPEC | `.vibe/specs/{feature-name}/phase-{N}-{name}.md` | Per phase |
| Master Feature | `.vibe/features/{feature-name}/_index.feature` | After Master SPEC |
| Phase Feature | `.vibe/features/{feature-name}/phase-{N}-{name}.feature` | Per phase SPEC |

**❌ FORBIDDEN:**

- Creating files in project root (e.g., `feature-name.md`)
- Creating files outside `.vibe/` directory
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
1. Write .vibe/specs/{feature-name}.md
2. Write .vibe/features/{feature-name}.feature
3. Confirm: "✅ Created: specs/{feature-name}.md + features/{feature-name}.feature"
```

**Split files:**
```
1. Write .vibe/specs/{feature-name}/_index.md
2. Write .vibe/specs/{feature-name}/phase-1-setup.md
3. Write .vibe/specs/{feature-name}/phase-2-core.md
4. Write .vibe/features/{feature-name}/_index.feature
5. Write .vibe/features/{feature-name}/phase-1-setup.feature
6. Write .vibe/features/{feature-name}/phase-2-core.feature
7. Confirm: "✅ Created: {N} SPEC files + {N} Feature files"
```

## Example

Full interview → ambiguity scan → quality gate → review walkthrough: read `references/example-session.md` in this skill directory (load only when you need a concrete end-to-end example).

## Core Tools (Semantic Analysis & Memory)

### Tool Invocation
All tools are called via:
```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
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
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.findSymbol({symbolName: 'login', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

**2. Save confirmed requirements:**
```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.saveMemory({key: 'brick-game-requirements', value: 'Platform: Web, Stack: Phaser.js, Style: Neon', category: 'spec', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Recall previous decisions:**
```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.recallMemory({key: 'brick-game-requirements', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

## Next Step

```
/vibe.run "brick-game"
```

---

ARGUMENTS: $ARGUMENTS
