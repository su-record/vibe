---
description: Execute implementation from SPEC
argument-hint: "feature name" or --phase N
---

# /su.run

Execute **Scenario-Driven Implementation** with automatic quality verification.

> **Core Principle**: Scenarios are both the implementation unit and verification criteria. All scenarios passing = Quality guaranteed.

## Usage

```
/su.run "feature-name"              # Full implementation
/su.run "feature-name" --phase 1    # Specific Phase only
/su.run "feature-name" ultrawork    # ULTRAWORK mode (recommended)
/su.run "feature-name" ulw          # Short alias for ultrawork
```

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## **Scenario-Driven Development (SDD)**

> Automate **Scenario = Implementation = Verification** so even non-developers can trust quality

### Core Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCENARIO-DRIVEN IMPLEMENTATION                │
│                                                                  │
│   Load Feature file                                              │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 1: Happy Path                                    │  │
│   │   Given → When → Then                                     │  │
│   │        ↓                                                  │  │
│   │   [Implement] → [Verify immediately] → ✅ Pass            │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario 2: Edge Case                                     │  │
│   │   Given → When → Then                                     │  │
│   │        ↓                                                  │  │
│   │   [Implement] → [Verify] → ❌ Fail → [Fix] → ✅ Pass      │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Scenario N: ...                                           │  │
│   │   [Implement] → [Verify immediately] → ✅ Pass            │  │
│   └──────────────────────────────────────────────────────────┘  │
│        ↓                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  📊 QUALITY REPORT                                        │  │
│   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  │
│   │  Scenarios: 5/5 passed ✅                                 │  │
│   │  Quality score: 94/100                                    │  │
│   │  Build: ✅ | Tests: ✅                                    │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Scenario = Implementation Unit

**Traditional approach (Phase-based)**:
```
Phase 1 → Phase 2 → Phase 3 → ... → Verify at the end
                                      ↓
                              "Where did it go wrong?"
```

**SDD approach (Scenario-based)**:
```
Scenario 1 → Implement → Verify ✅
Scenario 2 → Implement → Verify ✅
Scenario 3 → Implement → Verify ❌ → Fix → ✅
...
All pass = Quality guaranteed
```

### Automated Verification

After implementing each scenario, **automatic verification**:

| Verification Item | Auto Check |
|-------------------|------------|
| Given (precondition) | State/data preparation confirmed |
| When (action) | Feature execution possible |
| Then (result) | Expected result matches |
| Code quality | Complexity, style, security |

### Auto-Fix on Failure

```
Scenario verification failed
      ↓
[Root cause analysis] - Which Then condition failed?
      ↓
[Implement fix] - Fix only that part
      ↓
[Re-verify] - Check again
      ↓
Repeat until pass (max 3 times)
```

---

## **ULTRAWORK Mode** (ulw)

> Include `ultrawork` or `ulw` in your command to activate **maximum performance mode**.

### What ULTRAWORK Enables

When you include `ultrawork` (or `ulw`), ALL of these activate automatically:

| Feature | Description |
|---------|-------------|
| **Parallel Exploration** | 3+ Task(haiku) agents run simultaneously |
| **Boulder Loop** | Auto-continues until ALL phases complete |
| **Context Compression** | Aggressive auto-save at 70%+ context |
| **No Pause** | Doesn't wait for confirmation between phases |
| **External LLMs** | Auto-consults GPT/Gemini if enabled |
| **Error Recovery** | Auto-retries on failure (up to 3 times) |
| **Race Review (v2.6.9)** | Multi-LLM review (GPT+Gemini) with cross-validation |

### Boulder Loop (Inspired by Sisyphus)

Like Sisyphus rolling the boulder, ULTRAWORK **keeps going until done**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOULDER LOOP (ultrawork)                      │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│   │ Phase 1  │───→│ Phase 2  │───→│ Phase 3  │───→│ Phase N  │  │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│        │               │               │               │         │
│        ↓               ↓               ↓               ↓         │
│   [Parallel]      [Parallel]      [Parallel]      [Parallel]    │
│   [Implement]     [Implement]     [Implement]     [Implement]   │
│   [Test]          [Test]          [Test]          [Test]        │
│        │               │               │               │         │
│        └───────────────┴───────────────┴───────────────┘         │
│                              │                                   │
│                              ↓                                   │
│                     ┌──────────────┐                             │
│                     │  ALL DONE?   │                             │
│                     └──────────────┘                             │
│                       │         │                                │
│                      NO        YES                               │
│                       │         │                                │
│                       ↓         ↓                                │
│                   [Continue]  [🎉 Complete!]                     │
│                                                                  │
│   NO STOPPING until acceptance criteria met or error limit hit   │
└─────────────────────────────────────────────────────────────────┘
```

### Ralph Loop (Completion Verification) - CRITICAL

> **Inspired by [ghuntley.com/ralph](https://ghuntley.com/ralph)**: "Deterministically bad in an undeterministic world" - Keep iterating until TRULY complete.

**Problem**: AI often claims "complete" when implementation is partial.

**Solution**: RTM-based automated coverage verification with iteration tracking.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RALPH LOOP (Mandatory)                        │
│                                                                  │
│   After ALL phases complete:                                     │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  RTM COVERAGE VERIFICATION [Iteration {{ITER}}/{{MAX}}]   │  │
│   │                                                           │  │
│   │  Generate RTM via core tools:                             │  │
│   │  → generateTraceabilityMatrix("{feature-name}")           │  │
│   │                                                           │  │
│   │  Coverage Metrics (automated):                            │  │
│   │  □ Requirements coverage: {coveragePercent}%              │  │
│   │  □ SPEC → Feature mapping: {featureCovered}/{total}       │  │
│   │  □ Feature → Test mapping: {testCovered}/{total}          │  │
│   │  □ Build successful?                                      │  │
│   │  □ Tests passing?                                         │  │
│   │                                                           │  │
│   │  UNCOVERED: {uncoveredRequirements[]}                     │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                   ┌──────────┴──────────┐                       │
│                   │  Coverage ≥ 95%?    │                       │
│                   └──────────┬──────────┘                       │
│                       │              │                          │
│                      NO            YES                          │
│                       │              │                          │
│                       ↓              ↓                          │
│              ┌────────────────┐  ┌────────────────┐             │
│              │ IMPLEMENT      │  │ ✅ TRULY DONE  │             │
│              │ UNCOVERED      │  │                │             │
│              │ REQUIREMENTS   │  │ Report final   │             │
│              │ (auto-extract) │  │ RTM coverage   │             │
│              └───────┬────────┘  └────────────────┘             │
│                      │                                          │
│                      └──────────→ [Re-generate RTM]             │
│                                                                  │
│   MAX_ITERATIONS: 5 (prevent infinite loops)                    │
│   COVERAGE_THRESHOLD: 95% (quality gate)                        │
│   ZERO TOLERANCE for scope reduction                            │
└─────────────────────────────────────────────────────────────────┘
```

**Ralph Loop with RTM:**

```bash
# Generate RTM for coverage verification
node -e "import('@su-record/core/tools').then(t => t.generateTraceabilityMatrix('{feature-name}', {projectPath: process.cwd()}).then(r => console.log(JSON.stringify(r, null, 2))))"
```

**RTM provides automated metrics:**

| Metric | Description |
|--------|-------------|
| `totalRequirements` | Total REQ-* items in SPEC |
| `specCovered` | Requirements with SPEC mapping |
| `featureCovered` | Requirements with Feature scenarios |
| `testCovered` | Requirements with test files |
| `coveragePercent` | Overall coverage percentage |
| `uncoveredRequirements` | List of missing REQ-* IDs |

**Ralph Loop Rules:**

| Rule | Description |
|------|-------------|
| **No Scope Reduction** | Never say "simplified" or "basic version" - implement FULL request |
| **Iteration Tracking** | Display `[{{ITER}}/{{MAX}}]` to show progress |
| **RTM-Based Gap List** | Use `uncoveredRequirements` array - no manual comparison |
| **Coverage Threshold** | Must reach 95% coverage to complete |
| **Max Iterations** | Stop at 5 iterations (report remaining gaps) |

**Ralph Loop Output Format:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 RALPH VERIFICATION [Iteration 1/5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RTM Coverage Report: login

Requirements Traceability:
  Total Requirements: 9
  SPEC Covered: 9/9 (100%)
  Feature Covered: 5/9 (55%)
  Test Covered: 4/9 (44%)

  ✅ REQ-login-001: Login form UI → Scenario 1 → login.test.ts
  ✅ REQ-login-002: Email validation → Scenario 2 → validation.test.ts
  ✅ REQ-login-003: Password validation → Scenario 2 → validation.test.ts
  ❌ REQ-login-004: Remember me checkbox → NOT IMPLEMENTED
  ❌ REQ-login-005: Forgot password link → NOT IMPLEMENTED
  ✅ REQ-login-006: API integration → Scenario 3 → api.test.ts
  ❌ REQ-login-007: Loading state → NOT IMPLEMENTED
  ❌ REQ-login-008: Error toast → NOT IMPLEMENTED
  ✅ REQ-login-009: Session storage → Scenario 4 → (no test)

Overall Coverage: 55% ⚠️ BELOW 95% THRESHOLD

UNCOVERED REQUIREMENTS (auto-extracted from RTM):
  1. REQ-login-004: Remember me checkbox
  2. REQ-login-005: Forgot password link
  3. REQ-login-007: Loading state
  4. REQ-login-008: Error toast notifications

⚠️ NOT COMPLETE - Implementing uncovered requirements...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 RALPH VERIFICATION [Iteration 2/5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RTM Coverage Report: login

Requirements Traceability:
  Total Requirements: 9
  SPEC Covered: 9/9 (100%)
  Feature Covered: 9/9 (100%)
  Test Covered: 9/9 (100%)

Overall Coverage: 100% ✅ ABOVE 95% THRESHOLD

Build: ✅ Passed
Tests: ✅ 12/12 Passed
Type Check: ✅ No errors

✅ RALPH VERIFIED COMPLETE!

📄 RTM saved: .claude/core/rtm/login-rtm.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to Trigger Ralph Loop:**

1. After all phases complete
2. Before final quality report
3. Whenever user says "ultrawork" or "ralph"

**Forbidden Responses (VIOLATIONS):**

| ❌ NEVER Say | ✅ Instead |
|-------------|-----------|
| "I've implemented a basic version" | Implement the FULL version |
| "This is a simplified approach" | Implement as specified |
| "You can add X later" | Add X now |
| "For demonstration purposes" | Implement production-ready |
| "The core functionality is done" | ALL functionality must be done |

### ULTRAWORK Example

```
User: /su.run "brick-game" ultrawork

Claude:
🚀 ULTRAWORK MODE ACTIVATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 SPEC: .claude/core/specs/brick-game.md
🎯 4 Phases detected
⚡ Boulder Loop: ENABLED (will continue until all phases complete)
🔄 Auto-retry: ON (max 3 per phase)
💾 Context compression: AGGRESSIVE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏔️ BOULDER ROLLING... Phase 1/4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ [PARALLEL] Launching 3 exploration agents...
✅ Exploration complete (7.2s)
🔨 Implementing...
✅ Phase 1 complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏔️ BOULDER ROLLING... Phase 2/4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ [PARALLEL] Launching 3 exploration agents...
✅ Exploration complete (6.8s)
🔨 Implementing...
❌ Test failed: collision detection
🔄 Auto-retry 1/3...
🔨 Fixing...
✅ Phase 2 complete

[...continues automatically...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 BOULDER REACHED THE TOP!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All 4 phases complete
✅ All acceptance criteria passed
✅ Build succeeded
✅ Tests passed

⏱️ Total: 8m 24s
📊 Retries: 2
💾 Context saved: 3 checkpoints
```

### Normal vs ULTRAWORK Comparison

| Aspect | Normal | ULTRAWORK |
|--------|--------|-----------|
| Phase transition | May pause | Auto-continues |
| On error | Reports and stops | Auto-retries (3x) |
| Context 70%+ | Warning only | Auto-compress + save |
| Exploration | Sequential possible | FORCED parallel |
| Completion | Phase-by-phase | Until ALL done |

---

## Rules Reference

**Must follow `~/.claude/core/rules/` (global):**

- `core/development-philosophy.md` - Surgical precision, modify only requested scope
- `core/quick-start.md` - Korean, DRY, SRP, YAGNI
- `standards/complexity-metrics.md` - Functions ≤20 lines, nesting ≤3 levels
- `quality/checklist.md` - Code quality checklist

**Language guide:** `~/.claude/core/languages/{stack}.md` (global reference)

---

## Coding Guidelines (Mandatory)

### Type Safety: Use Types Explicitly

> **Core Principle**: Use types explicitly in every language that has a type system!

Type definitions are not just language syntax — they are a **core engineering philosophy for simplifying and controlling complex software**.

### Applies to ALL Typed Languages

| Category | Languages | Key Principle |
|----------|-----------|---------------|
| **Static Typed** | Java, C#, C++, Go, Rust, Swift, Kotlin, Scala | Types = compile-time contracts |
| **Gradual Typed** | TypeScript, Python (typing), PHP (typed), Ruby (RBS) | Types = optional safety nets |
| **Functional** | Haskell, OCaml, F#, Elm | Types = logical proofs |

### Universal Anti-Patterns (All Languages)

| ❌ Forbidden Pattern | Why | ✅ Instead |
|---------------------|-----|-----------|
| Type escape hatches (`any`, `Any`, `Object`, `void*`, `interface{}`) | Loses type info, runtime errors | Concrete types or `unknown` + guards |
| Type suppression (`@ts-ignore`, `# type: ignore`, `@SuppressWarnings`) | Hides errors | Fix actual type issues |
| Raw generic types (`List`, `Map` without params) | Loses type safety | `List<User>`, `Map<String, Order>` |
| Excessive casting (`as`, `(Type)`, `unsafe`) | Bypasses compiler | Type guards or pattern matching |

### Language-Specific Guidelines

**TypeScript/JavaScript:**
```typescript
// ❌ BAD
function process(data: any): any { return data.foo; }

// ✅ GOOD
function process(data: unknown): Result {
  if (isValidData(data)) return data.foo;
  throw new Error('Invalid');
}
```

**Python:**
```python
# ❌ BAD
def process(data: Any) -> Any: return data["key"]

# ✅ GOOD
def process(data: UserData) -> str: return data["name"]
```

**Java/Kotlin:**
```java
// ❌ BAD
List items = new ArrayList();  // Raw type
Object data = getData();       // Lost type info

// ✅ GOOD
List<User> users = new ArrayList<>();
User user = getUser();
```

**Go:**
```go
// ❌ BAD
func process(data interface{}) interface{} { ... }

// ✅ GOOD
func process(data UserRequest) (UserResponse, error) { ... }
```

**Rust:**
```rust
// ❌ BAD (unnecessary unsafe or Box<dyn Any>)
let data: Box<dyn Any> = get_data();

// ✅ GOOD
let data: UserData = get_data()?;
```

**C#:**
```csharp
// ❌ BAD
object data = GetData();
dynamic result = Process(data);

// ✅ GOOD
UserData data = GetData();
Result result = Process(data);
```

### Type Safety Rules (Universal)

| Rule | Description |
|------|-------------|
| **Boundary Validation** | Validate only at system boundaries (API, JSON, user input) |
| **Internal Trust** | After validation, pass only precise types internally |
| **No Type Escape** | Never use escape hatches to "fix" type errors |
| **Explicit Signatures** | Specify types in function/method signatures |
| **Generics with Params** | Always use generics with type parameters |

### Quality Gate: Type Violations Block Merge

| Violation | Action |
|-----------|--------|
| Type escape hatches (`any`, `Any`, `Object`, `interface{}`, etc.) | ❌ Block |
| Type suppression comments | ❌ Block |
| Raw generic types | ❌ Block |
| Missing function return types | ⚠️ Warning |
| Excessive type casting | ⚠️ Warning |

## Description

Read PTCF structured SPEC document and execute implementation immediately.

> **PLAN, TASKS documents unnecessary** - SPEC is the executable prompt

## Model Orchestration (Intelligent Routing)

Automatically select optimal model based on **task complexity analysis**.

### Complexity-Based Model Selection

| Complexity Score | Model | When to Use |
|------------------|-------|-------------|
| 0-7 (Low) | **Haiku** | Simple fixes, searches, single file changes |
| 8-19 (Medium) | **Sonnet** | Standard features, 3-5 files, integrations |
| 20+ (High) | **Opus** | Architecture, security, multi-service, 6+ files |

### Complexity Signals

The following signals increase complexity score:

| Signal | Score |
|--------|-------|
| Architecture change | +15 |
| Security implication | +12 |
| Multi-service | +8 |
| Refactoring | +12 |
| 6+ files | +15 |
| 3-5 files | +8 |
| New feature | +5 |
| Bug fix | -3 |
| Documentation | -5 |

### Agent Tier System

Each agent has tier variants for cost optimization:

| Agent | Low (Haiku) | Medium (Sonnet) | High (Opus) |
|-------|-------------|-----------------|-------------|
| explorer | explorer-low | explorer-medium | explorer |
| implementer | implementer-low | implementer-medium | implementer |
| architect | architect-low | architect-medium | architect |

### Task Calls by Role

| Task Type | Model | Task Parameter |
|-----------|-------|----------------|
| Simple search | Haiku | `model: "haiku"` |
| Codebase exploration | Haiku/Sonnet | Auto-selected |
| Core implementation | Sonnet | `model: "sonnet"` |
| Test writing | Haiku | `model: "haiku"` |
| Architecture decisions | Opus | Main session |
| Final review | Opus | Main session |

### External LLM Usage (When Enabled)

When external LLMs are enabled in `.claude/core/config.json`:

| Role | Method | Condition |
|------|--------|-----------|
| User direct query | `gpt.question`, `gemini.question` | Hook auto-handles |
| Internal orchestration | Call global script via Bash | Claude calls directly |

**User questions (Hook auto-handles):**
- `gpt.question` - GPT architecture consultation
- `gemini.question` - Gemini Q&A/consultation

**Claude internal calls (directly via Bash):**
```bash
# Usage: node llm-orchestrate.js <provider> <mode> [systemPrompt] [prompt]
#   - If systemPrompt omitted, uses default
#   - If systemPrompt is "-", uses default and treats next argument as prompt

# Cross-platform path (works on Windows/macOS/Linux)
CORE_SCRIPTS="$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/core/hooks/scripts"

# GPT call
node "$CORE_SCRIPTS/llm-orchestrate.js" gpt orchestrate-json "[question content]"

# Gemini call
node "$CORE_SCRIPTS/llm-orchestrate.js" gemini orchestrate-json "[question content]"

# Custom system prompt usage
node "$CORE_SCRIPTS/llm-orchestrate.js" gpt orchestrate-json "You are a code reviewer" "[question content]"
```

### External LLM Fallback

**IMPORTANT**: When GPT/Gemini hook fails, Claude MUST handle the task directly:

**Fallback behavior**:
- Do NOT retry the external LLM call
- Claude handles the task using its own capabilities
- Continue with the implementation without interruption
- Log the fallback but don't block progress

## Core Tools (Semantic Analysis & Memory)

Use core tools for accurate codebase understanding and session continuity.

### Tool Invocation

All tools are called via:
```bash
node -e "import('@su-record/core/tools').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Semantic Analysis Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `findSymbol` | Find symbol definitions | `{symbolName: 'functionName', searchPath: '.'}` |
| `findReferences` | Find all references | `{symbolName: 'functionName', searchPath: '.'}` |
| `analyzeComplexity` | Analyze code complexity | `{filePath: 'src/file.ts'}` |
| `validateCodeQuality` | Validate code quality | `{filePath: 'src/file.ts'}` |

**Example - Find symbol:**
```bash
node -e "import('@su-record/core/tools').then(t => t.findSymbol({symbolName: 'login', searchPath: '.'}).then(r => console.log(r.content[0].text)))"
```

### Memory Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `saveMemory` | Save important decisions | `{key: 'decision-name', value: 'content', category: 'project'}` |
| `recallMemory` | Recall saved memory | `{key: 'decision-name'}` |
| `listMemories` | List all memories | `{category: 'project'}` |

**Example - Save important decision:**
```bash
node -e "import('@su-record/core/tools').then(t => t.saveMemory({key: 'auth-pattern', value: 'Using JWT with refresh tokens', category: 'project'}).then(r => console.log(r.content[0].text)))"
```

### Session Management (Auto via Hooks)

- **Session start**: Hook auto-calls `startSession` to restore previous context
- **Context 80%+**: Hook auto-calls `autoSaveContext` to preserve state

## Process

### 1. Load SPEC + Feature

```
📄 .claude/core/specs/{feature-name}.md      → SPEC (structure, constraints, context)
📄 .claude/core/features/{feature-name}.feature → Feature (scenario = implementation unit)
```

**Error if Feature file missing**:
```
❌ Feature file not found.
   Run /su.spec "{feature-name}" first.
```

### 2. Extract Scenario List

Extract all Scenarios from Feature file:

```markdown
## Scenarios to Implement

| # | Scenario | Status |
|---|----------|--------|
| 1 | Valid login success | ⬜ |
| 2 | Invalid password error | ⬜ |
| 3 | Email format validation | ⬜ |
| 4 | Password reset link | ⬜ |

Total: 4 scenarios
```

### 3. Scenario-by-Scenario Implementation (Core)

**For each scenario**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 1/4: Valid login success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Given: User is registered
When: Login with valid email and password
Then: Login success + JWT token returned

[Step 1] Analyzing implementation...
  - Required files: auth.service.ts, login.controller.ts
  - Exploring related code...

[Step 2] Implementing...
  ✅ auth.service.ts - Added login() method
  ✅ login.controller.ts - POST /login endpoint

[Step 3] Verifying...
  ✅ Given: Test user creation possible
  ✅ When: Login API call succeeded
  ✅ Then: JWT token return confirmed

✅ Scenario 1 passed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**On failure**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 2/4: Invalid password error
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 3] Verifying...
  ✅ Given: Test user exists
  ✅ When: Login attempt with wrong password
  ❌ Then: "Invalid credentials" error message
     Actual: "Error occurred" returned

[Auto-fix 1/3]
  Cause: Error message not properly set
  Fix: auth.service.ts line 42

[Re-verify]
  ✅ Then: "Invalid credentials" error message

✅ Scenario 2 passed! (1 fix)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## **CRITICAL: Parallel Sub-Agent Execution**

> **MUST USE PARALLEL TASK CALLS** - This is REQUIRED, not optional.
> Sequential execution when parallel is possible = VIOLATION of this workflow.

### Mandatory Parallel Exploration (Phase Start)

**BEFORE any implementation, you MUST launch these Task calls IN PARALLEL (single message, multiple tool calls):**

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: PARALLEL EXPLORATION (REQUIRED)                        │
│                                                                 │
│  Launch ALL of these in ONE message:                            │
│                                                                 │
│  Task(haiku) ─┬─→ "Analyze related files in <context>"          │
│               │                                                 │
│  Task(haiku) ─┼─→ "Check dependencies and imports"              │
│               │                                                 │
│  Task(haiku) ─┴─→ "Find existing patterns and conventions"      │
│                                                                 │
│  [If GPT enabled] Bash: node {{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js gpt orchestrate-json "[question]"
│  [If Gemini enabled] Bash: node {{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js gemini orchestrate-json "[question]"
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ (wait for all to complete)
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: SYNTHESIZE (Opus)                                      │
│  - Review all exploration results                               │
│  - Decide implementation approach                               │
│  - Identify files to modify/create                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: IMPLEMENT + BACKGROUND AGENTS (PARALLEL)               │
│                                                                 │
│  Main Agent (sonnet):                                           │
│  └─→ Execute current phase implementation                       │
│                                                                 │
│  Background Agents (haiku, run_in_background=true):             │
│  ├─→ Task: "Prepare Phase N+1 - analyze required files"         │
│  ├─→ Task: "Pre-generate test cases for current implementation" │
│  └─→ Task: "Search for related types/interfaces needed"         │
│                                                                 │
│  [ULTRAWORK] All 4 agents run simultaneously!                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ (main completes, check backgrounds)
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: TEST + PHASE PIPELINING                                │
│                                                                 │
│  Current Phase:                                                 │
│  └─→ Task(haiku): Write tests using pre-generated cases         │
│                                                                 │
│  Next Phase Prep (from background results):                     │
│  └─→ Already have file analysis, ready to start immediately     │
└─────────────────────────────────────────────────────────────────┘
```

### Parallel Task Call Pattern (MUST FOLLOW)

**Correct - Single message with multiple parallel Tasks:**
```
<message>
  Task(haiku, "Analyze src/components/ for existing patterns")
  Task(haiku, "Check package.json dependencies")
  Task(haiku, "Find usage of similar features in codebase")
</message>
→ All 3 run simultaneously, ~3x faster
```

**WRONG - Sequential calls (DO NOT DO THIS):**
```
<message>Task(haiku, "Analyze...")</message>
<message>Task(haiku, "Check...")</message>
<message>Task(haiku, "Find...")</message>
→ 3x slower, wastes time
```

### Background Agent Pattern (ULTRAWORK) via Orchestrator

**Launch background agents for next phase via Orchestrator:**
```bash
# Start background agent (doesn't block)
node -e "import('@su-record/core/orchestrator').then(o => o.runAgent('Phase 2 prep: Analyze auth API endpoints', 'phase2-prep').then(r => console.log(r.content[0].text)))"

# Multiple backgrounds in parallel
node -e "import('@su-record/core/orchestrator').then(async o => {
  await Promise.all([
    o.runAgent('Phase 2 prep: Analyze auth API endpoints', 'phase2-prep'),
    o.runAgent('Pre-generate test cases for login form', 'test-prep'),
    o.runAgent('Find existing validation patterns', 'pattern-finder')
  ]);
  console.log('All background agents started');
})"
```

**Check background agent status:**
```bash
node -e "import('@su-record/core/orchestrator').then(o => console.log(o.status().content[0].text))"
```

**Get result when ready:**
```bash
node -e "import('@su-record/core/orchestrator').then(o => o.getResult('SESSION_ID').then(r => console.log(r.content[0].text)))"
```

**Why Background Agents Matter:**

| Without Background | With Background |
|--------------------|-----------------|
| Phase 1: 60s | Phase 1: 60s (+ backgrounds running) |
| Phase 2 prep: 20s | Phase 2 prep: 0s (already done!) |
| Phase 2: 60s | Phase 2: 60s |
| **Total: 140s** | **Total: 120s** |

For 5 phases: 4 × 20s saved = **80s faster**

### Why Parallel Matters

| Approach | Time | Cache Benefit |
|----------|------|---------------|
| Sequential (3 Tasks) | ~30s | Cache cold on each |
| **Parallel (3 Tasks)** | **~10s** | **Cache warmed once, shared** |

core ProjectCache (LRU) caches ts-morph parsing results. Parallel calls share the warmed cache.

### Phase Execution Flow (ULTRAWORK Pipeline)

```
Phase N Start
    │
    ├─→ [PARALLEL] Task(haiku) × 3: Exploration
    │       - Related code analysis
    │       - Dependency check
    │       - Pattern discovery
    │
    ↓ (all complete)
    │
    ├─→ Opus: Synthesize and decide
    │
    ├─→ [PARALLEL PIPELINE] ←── KEY SPEED OPTIMIZATION
    │       │
    │       ├─→ Main: Task(sonnet) Implementation
    │       │
    │       └─→ Background (run_in_background=true):
    │               ├─→ Task(haiku): Phase N+1 file analysis
    │               ├─→ Task(haiku): Test case preparation
    │               └─→ Task(haiku): Type/interface lookup
    │
    ↓ (main completes)
    │
    ├─→ Task(haiku): Tests (uses pre-generated cases)
    │
    ↓
Phase N Complete
    │
    ↓ (Background results ready - NO WAIT for Phase N+1 exploration!)
    │
Phase N+1 Start (IMMEDIATE - exploration already done!)
```

**Speed Comparison:**

| Mode | Phase Time | 5 Phases Total |
|------|------------|----------------|
| Sequential | ~2min/phase | ~10min |
| Parallel Exploration | ~1.5min/phase | ~7.5min |
| **ULTRAWORK Pipeline** | **~1min/phase** | **~5min** |

**Why Pipeline is Faster:**
- Background agents prepare next phase WHILE current phase implements
- No idle time between phases
- Test cases pre-generated during implementation
- Cache stays warm across parallel tasks

---

1. **Related code analysis**: Task(haiku) explores `<context>` related code
2. **File creation/modification**: Task(sonnet) implements per `<output_format>`
3. **Constraint compliance**: Check `<constraints>`
4. **Run verification**: Execute verification commands

### 4. Brand Assets Generation (Optional)

When starting a **new project** with brand context in SPEC, auto-generate app icons and favicons:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 BRAND ASSETS GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Check] Brand assets exist? → Skip if favicon.ico exists
[Check] Gemini API configured? → Required for image generation
[Check] SPEC has brand context? → Extract app name, colors, style

[Generate] Creating app icon with Gemini Image API...
  - Prompt: "App icon for [AppName], [style], [color]..."
  - Generated: 512x512 master icon

[Resize] Creating platform variants...
  ✅ favicon.ico (16/32/48)
  ✅ favicon-16x16.png
  ✅ favicon-32x32.png
  ✅ apple-touch-icon.png (180x180)
  ✅ android-chrome-192x192.png
  ✅ android-chrome-512x512.png
  ✅ site.webmanifest

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Brand assets generated in public/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**SPEC Brand Context Example:**

```xml
<context>
Brand:
  - App Name: MyApp
  - Primary Color: #2F6BFF
  - Style: Modern, minimalist, flat design
  - Icon Concept: Abstract geometric shape
</context>
```

**Trigger Conditions:**
- First `/su.run` execution (no existing icons)
- SPEC contains brand/design context
- Gemini API key configured (`su-core gemini auth`)

**Manual Generation:**
```bash
node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/core/hooks/scripts/llm-orchestrate.js" gemini image "App icon for MyApp, primary color #2F6BFF, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist" --output "./public/app-icon.png"
```

---

### 5. Race Code Review (GPT + Gemini) + Auto-Fix (v2.6.9)

After all scenarios are implemented, **GPT and Gemini review in parallel with cross-validation**:

> **ULTRAWORK Default**: In ULTRAWORK mode, race review is automatically enabled.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 RACE CODE REVIEW (GPT + Gemini)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] Parallel review execution...
  ├─ GPT-5.2-Codex: Reviewing...
  └─ Gemini-3-Flash: Reviewing...

[Step 2] Cross-validation results:
  ┌───────────────────────────────────────────────────────────┐
  │ Issue                          │ GPT │ Gemini │ Confidence│
  │────────────────────────────────│─────│────────│───────────│
  │ Timing attack in password      │ ✅  │ ✅     │ 100% → P1 │
  │ Rate limiting missing          │ ✅  │ ✅     │ 100% → P1 │
  │ Magic number usage             │ ✅  │ ❌     │ 50% → P2  │
  └───────────────────────────────────────────────────────────┘

  Summary: 3 issues (P1: 2, P2: 1)

[Step 3] Auto-fixing P1/P2 issues...
  ✅ auth.service.ts:24 - Applied timingSafeEqual (P1)
  ✅ auth.controller.ts:15 - Added rate limiter (P1)
  ✅ auth.service.ts:42 - Extracted constant (P2)

[Step 4] Re-verifying...
  ✅ Build succeeded
  ✅ Tests passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Race review complete! 3 improvements (2 P1, 1 P2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Race Review Invocation (GPT + Gemini in parallel via Bash):**

**🚨 Use stdin pipe to avoid CLI argument length limits on Windows.**

1. Save code to review into `[SCRATCHPAD]/review-code.txt` (using Write tool)
2. Run GPT + Gemini in PARALLEL (two Bash tool calls at once):

```bash
# GPT review (Bash tool call 1)
node -e "const fs=require('fs');const p=JSON.stringify({prompt:'Review this code for security, performance, and best practices. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: '+fs.readFileSync('[SCRATCHPAD]/review-code.txt','utf8')});process.stdout.write(p)" | node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/core/hooks/scripts/llm-orchestrate.js" gpt orchestrate-json
```

```bash
# Gemini review (Bash tool call 2 - run in parallel)
node -e "const fs=require('fs');const p=JSON.stringify({prompt:'Review this code for security, performance, and best practices. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: '+fs.readFileSync('[SCRATCHPAD]/review-code.txt','utf8')});process.stdout.write(p)" | node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/core/hooks/scripts/llm-orchestrate.js" gemini orchestrate-json
```

**Confidence-based Priority:**

| Confidence | Priority | Action |
|------------|----------|--------|
| 100% (2/2) | P1 | Auto-fix immediately |
| 50% (1/2) | P2 | Auto-fix with review |

**Fallback handling:**
- If one LLM fails → Use single LLM result (reduced confidence)
- If both fail → Skip and proceed (log warning)

**Review application rules:**

| Feedback Type | Action |
|---------------|--------|
| Security vulnerability (P1) | Auto-fix immediately |
| Performance improvement (P1/P2) | Auto-fix immediately |
| Best practices (P2) | Auto-fix |
| Style/preference (P3) | Apply selectively |

**Conditions:**
- **ULTRAWORK**: Race review enabled by default
- **Normal mode**: Use `--race` flag to enable
- Must re-verify build/tests after fixes

### 6. Quality Report (Auto-generated)

After all scenarios complete + Gemini review, **quality report is auto-generated**:

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 QUALITY REPORT: login                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Scenarios: 4/4 passed                                       │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ # │ Scenario                  │ Status │ Retries │        │  │
│  │───│───────────────────────────│────────│─────────│        │  │
│  │ 1 │ Valid login success       │ ✅     │ 0       │        │  │
│  │ 2 │ Invalid password error    │ ✅     │ 1       │        │  │
│  │ 3 │ Email format validation   │ ✅     │ 0       │        │  │
│  │ 4 │ Password reset link       │ ✅     │ 0       │        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📈 Quality score: 94/100                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Item              │ Result │ Notes                       │    │
│  │───────────────────│────────│─────────────────────────────│    │
│  │ Build             │ ✅     │ npm run build succeeded     │    │
│  │ Tests             │ ✅     │ 12/12 passed                │    │
│  │ Type check        │ ✅     │ 0 errors                    │    │
│  │ Complexity        │ ✅     │ All functions ≤30 lines     │    │
│  │ Security          │ ✅     │ 0 vulnerabilities           │    │
│  │ Gemini review     │ ✅     │ 3 improvements applied      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ⏱️ Started: {start_time}                                        │
│  ⏱️ Completed: {getCurrentTime 결과}                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**What users should check**:
- Scenario pass rate (4/4 = 100%)
- Quality score (94/100)
- Build/test status

**This alone is enough to trust quality.**

### 7. Update Feature File

Auto-update scenario status:

```markdown
## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| Valid login success | AC-1 | ✅ |
| Invalid password error | AC-2 | ✅ |
| Email format validation | AC-3 | ✅ |
| Password reset link | AC-4 | ✅ |

**Last verified**: 2024-01-15 14:32
**Quality score**: 94/100
```

## TRUST 5 Principles

Follow during implementation:

| Principle | Description |
|-----------|-------------|
| **T**est-first | Write tests first |
| **R**eadable | Clear code |
| **U**nified | Consistent style |
| **S**ecured | Consider security |
| **T**rackable | Logging, monitoring |

## Input

- `.claude/core/specs/{feature-name}.md` (PTCF SPEC)
- `.claude/core/features/{feature-name}.feature` (BDD)
- `CLAUDE.md` (project context)

## Output

- Implemented code files
- Test files
- Updated SPEC document (checkmarks)

## Example

```
User: /su.run "login"

Claude:
📄 Loading SPEC: .claude/core/specs/login.md
📄 Loading Feature: .claude/core/features/login.feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Scenarios to Implement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| # | Scenario | Status |
|---|----------|--------|
| 1 | Valid login success | ⬜ |
| 2 | Invalid password error | ⬜ |
| 3 | Email format validation | ⬜ |
| 4 | Password reset link | ⬜ |

Total: 4 scenarios

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 1/4: Valid login success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Given: User is registered
When: Login with valid email and password
Then: Login success + JWT token returned

⚡ [PARALLEL] Exploring...
✅ Exploration complete (2.1s)

🔨 Implementing...
  ✅ auth.service.ts - Added login()
  ✅ auth.controller.ts - POST /login

🔍 Verifying...
  ✅ Given: OK
  ✅ When: OK
  ✅ Then: OK

✅ Scenario 1 passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 2/4: Invalid password error
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 Implementing...
  ✅ auth.service.ts - Password validation logic

🔍 Verifying...
  ✅ Given: OK
  ✅ When: OK
  ❌ Then: "Invalid credentials" error message
     Actual: "Error" returned

🔄 Auto-fix 1/3...
  Fix: auth.service.ts line 42

🔍 Re-verifying...
  ✅ Then: OK

✅ Scenario 2 passed! (1 fix)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 3/4: Email format validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 Implementing...
🔍 Verifying...
✅ Scenario 3 passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Scenario 4/4: Password reset link
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 Implementing...
🔍 Verifying...
✅ Scenario 4 passed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 GEMINI CODE REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 Sending code to Gemini...
📝 Gemini feedback:
  1. [Security] Need timing attack prevention → Fixing...
  2. [Performance] Unnecessary DB call → Fixing...

✅ 2 improvements auto-applied
🔍 Re-verifying... ✅ Passed

┌─────────────────────────────────────────────────────────────────┐
│  📊 QUALITY REPORT: login                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Scenarios: 4/4 passed                                       │
│                                                                 │
│  | # | Scenario              | Status | Retries |               │
│  |---|───────────────────────|───────|─────────|               │
│  | 1 | Valid login success   | ✅    | 0       |               │
│  | 2 | Invalid password error| ✅    | 1       |               │
│  | 3 | Email format validation| ✅   | 0       |               │
│  | 4 | Password reset link   | ✅    | 0       |               │
│                                                                 │
│  📈 Quality score: 94/100                                       │
│  Build: ✅ | Tests: ✅ | Types: ✅ | Gemini: ✅ (2 applied)     │
│                                                                 │
│  ⏱️ Started: {start_time}                                        │
│  ⏱️ Completed: {getCurrentTime 결과}                             │
└─────────────────────────────────────────────────────────────────┘

🎉 Implementation complete! All scenarios passed + Gemini review applied.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 AUTO REVIEW (13+ Agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ [PARALLEL] 13 expert agents reviewing...
  - security-reviewer ✅
  - performance-reviewer ✅
  - architecture-reviewer ✅
  - ...

📋 Review results:
  - P1 Critical: 0
  - P2 Important: 2
  - P3 Nice-to-have: 1

🔧 Auto-fixing P2 issues...
  1. [PERF] N+1 query → Fixed
  2. [ARCH] Circular dependency → Fixed

✅ Auto Review complete! 2 issues auto-resolved.
```

### Phase-specific Execution

```
User: /su.run "brick-game" --phase 2

Claude:
📄 Reading SPEC: .claude/core/specs/brick-game.md
🎯 Executing Phase 2 only.

Phase 2: Game Logic
1. [ ] Paddle movement implementation
2. [ ] Ball physics engine
3. [ ] Brick collision handling
4. [ ] Score system
5. [ ] Game over conditions

⚡ Launching parallel exploration...
[Task(haiku) × 3 launched in parallel]

🚀 Starting implementation...
```

## Error Handling

On failure:
1. Check error message
2. Review `<constraints>`
3. Fix code and retry
4. If continues to fail, report to user

---

## Quality Gate (Mandatory)

### Implementation Quality Checklist

Before marking any scenario as complete, ALL items must pass:

| Category | Check Item | Weight |
|----------|------------|--------|
| **Functionality** | All Given/When/Then conditions verified | 20% |
| **Functionality** | Edge cases handled per scenario | 10% |
| **Code Quality** | No `any` types in TypeScript | 10% |
| **Code Quality** | Functions ≤30 lines, nesting ≤3 levels | 10% |
| **Code Quality** | No hardcoded values (use constants) | 5% |
| **Security** | Input validation implemented | 10% |
| **Security** | Authentication/authorization checked | 5% |
| **Error Handling** | Try-catch or error states present | 10% |
| **Error Handling** | User-friendly error messages | 5% |
| **Testing** | Unit tests exist for core logic | 10% |
| **Performance** | No N+1 queries or unnecessary loops | 5% |

### Quality Score Calculation

```
Score = Σ(checked items × weight) / 100

Grades:
- 95-100: ✅ EXCELLENT - Ready to merge
- 90-94:  ⚠️ GOOD - Minor improvements required before merge
- 80-89:  ⚠️ FAIR - Significant improvements required
- 0-79:   ❌ POOR - Major fixes needed
```

### Quality Gate Thresholds

| Gate | Minimum Score | Condition |
|------|---------------|-----------|
| **Scenario Complete** | 95 | Each scenario must score ≥95 |
| **Phase Complete** | 95 | Average of all scenarios ≥95 |
| **Feature Complete** | 95 | All phases complete + Gemini review |

### Auto-Fix Triggers

| Issue Type | Auto-Fix Action |
|------------|-----------------|
| Missing error handling | Add try-catch wrapper |
| Hardcoded values | Extract to constants file |
| Missing input validation | Add validation schema |
| Function too long | Suggest split points |
| N+1 query detected | Add eager loading |

### Forbidden Patterns (Block Merge)

| Pattern | Why Forbidden | Detection |
|---------|---------------|-----------|
| `console.log` | Debug code in production | Regex scan |
| `// TODO` without issue | Untracked work | Comment scan |
| `any` type | Type safety bypass | TypeScript check |
| `@ts-ignore` | Type error suppression | TypeScript check |
| Empty catch blocks | Silent error swallowing | AST analysis |
| Commented-out code | Dead code | Comment scan |

---

## Auto-Retrospective (Post-Implementation)

After ALL phases complete successfully, **automatically** perform a brief retrospective:

### Retrospective Template

```
## Retrospective: {feature-name}

### What Worked
- [List effective patterns, tools, approaches used]

### What Didn't
- [List issues, failures, unexpected blockers]

### Key Decisions
- [Important architectural or implementation decisions made during this run]

### Lessons Learned
- [Principle format: "When X, do Y because Z"]
```

### Execution Steps

1. Generate retrospective based on the implementation session
2. Save to `.claude/core/retros/{feature-name}.md`
3. Save key lessons via `core_save_memory` (for cross-session recall)
4. Update `claude-progress.txt` with final status

**Important:**

- Keep it concise (under 20 lines)
- Focus on **project-specific** insights, not generic knowledge
- Only save to memory if the lesson is actionable and non-obvious

---

## Next Step

```
/su.verify "brick-game"
```

---

ARGUMENTS: $ARGUMENTS
