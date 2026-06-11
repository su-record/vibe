# Race Code Review & Quality Gate — Full Reference

> Loaded by vibe.run SKILL.md when Race Review (GPT+Antigravity), quality gate thresholds, or type safety details are needed.

## Race Code Review (GPT + Antigravity) + Auto-Fix (v2.6.9)

After all scenarios are implemented, **GPT and Antigravity review in parallel with cross-validation**:

> **ULTRAWORK Default**: In ULTRAWORK mode, race review is automatically enabled.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RACE CODE REVIEW (GPT + Antigravity)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Step 1] Parallel review execution...
  ├─ GPT Codex: Reviewing...
  └─ Antigravity: Reviewing...

[Step 2] Cross-validation results:
  ┌──────────────────────────────────────────────────────────────────┐
  │ Issue                          │ GPT │ Antigravity │ Codex │ Confidence│
  │────────────────────────────────│─────│────────│───────│───────────│
  │ Timing attack in password      │     │        │       │ 100% → P1 │
  │ Rate limiting missing          │     │        │       │ 100% → P1 │
  │ Magic number usage             │     │        │       │ 50% → P2  │
  └──────────────────────────────────────────────────────────────────┘

  Summary: 3 issues (P1: 2, P2: 1)

[Step 3] Auto-fixing P1/P2 issues...
  auth.service.ts:24 - Applied timingSafeEqual (P1)
  auth.controller.ts:15 - Added rate limiter (P1)
  auth.service.ts:42 - Extracted constant (P2)

[Step 4] Re-verifying...
  Build succeeded
  Tests passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Race review complete! 3 improvements (2 P1, 1 P2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Race Review Invocation

**Use --input file to avoid CLI argument length limits and Windows pipe issues.**

1. Save code to review into `[SCRATCHPAD]/review-code.txt` (using Write tool)
2. Write JSON input file `[SCRATCHPAD]/review-input.json` (using Write tool):
   - `{"prompt": "Review this code for security, performance, and best practices. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: [CODE_CONTENT]"}`
3. Script path: `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`
4. Run GPT + Antigravity in PARALLEL (two Bash tool calls at once):

```bash
# GPT review (Bash tool call 1)
node "[LLM_SCRIPT]" gpt orchestrate-json --input "[SCRATCHPAD]/review-input.json"
```

```bash
# Antigravity review (Bash tool call 2 - run in parallel)
node "[LLM_SCRIPT]" antigravity orchestrate-json --input "[SCRATCHPAD]/review-input.json"
```

**Confidence-based Priority:**

| Confidence | Priority | Action |
|------------|----------|--------|
| 100% (3/3 or 2/2) | P1 | Auto-fix immediately |
| 67% (2/3) | P1 | Auto-fix immediately |
| 50% (1/2) or 33% (1/3) | P2 | Auto-fix with review |

**Fallback handling:**
- If one LLM fails → Use remaining LLM results (reduced confidence)
- If all fail → Skip and proceed (log warning)

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

### Codex Code Review (Codex 플러그인 활성화 시)

GPT+Antigravity race와 **동시에** Codex review 실행:

```
/codex:review
```

결과를 race review 교차 검증에 포함 — 3중 리뷰:

```markdown
| Issue | GPT | Antigravity | Codex | Confidence |
|-------|-----|--------|-------|------------|
| {이슈} | ✅/❌ | ✅/❌ | ✅/❌ | {%} |
```

## Implementation Quality Checklist

Before marking any scenario as complete, ALL items must pass:

| Category | Check Item | Weight |
|----------|------------|--------|
| **Functionality** | All Given/When/Then conditions verified | 20% |
| **Functionality** | Edge cases handled per scenario | 10% |
| **Code Quality** | No `any` types in TypeScript | 10% |
| **Code Quality** | Functions ≤50 lines, nesting ≤3 levels | 10% |
| **Code Quality** | No hardcoded values (use constants) | 5% |
| **Security** | Input validation implemented | 10% |
| **Security** | Authentication/authorization checked | 5% |
| **Error Handling** | Try-catch or error states present | 10% |
| **Error Handling** | User-friendly error messages | 5% |
| **Testing** | Unit tests exist for core logic | 10% |
| **Performance** | No N+1 queries or unnecessary loops | 5% |

## Quality Score Calculation

```
Score = Σ(checked items × weight) / 100

Grades:
- 95-100: EXCELLENT - Ready to merge
- 90-94:  GOOD - Minor improvements required before merge
- 80-89:  FAIR - Significant improvements required
- 0-79:   POOR - Major fixes needed
```

## Quality Gate Thresholds

| Gate | Minimum Score | Condition |
|------|---------------|-----------|
| **Scenario Complete** | 95 | Each scenario must score ≥95 |
| **Phase Complete** | 95 | Average of all scenarios ≥95 |
| **Feature Complete** | 95 | All phases complete + Antigravity review |

## Auto-Fix Triggers

| Issue Type | Auto-Fix Action |
|------------|-----------------|
| Missing error handling | Add try-catch wrapper |
| Hardcoded values | Extract to constants file |
| Missing input validation | Add validation schema |
| Function too long | Suggest split points |
| N+1 query detected | Add eager loading |

### Auto-Fix 실패 시 Codex Rescue (Codex 플러그인 활성화 시)

P1 auto-fix가 **3회 실패** 시, Codex에 위임:

```
/codex:rescue "Fix P1 issue: {issue-description}. File: {file-path}. Error: {error-message}"
```

## Forbidden Patterns (Detected — Injected as additionalContext, Block at Commit Gate)

> Detection results are injected as `additionalContext` into the model; commit-level blocking occurs via the auto-commit verify gate and pr-test-gate. These patterns do not block file edits directly.

| Pattern | Why Forbidden | Detection |
|---------|---------------|-----------|
| `console.log` | Debug code in production | Regex scan |
| `// TODO` without issue | Untracked work | Comment scan |
| `any` type | Type safety bypass | TypeScript check |
| `@ts-ignore` | Type error suppression | TypeScript check |
| Empty catch blocks | Silent error swallowing | AST analysis |
| Commented-out code | Dead code | Comment scan |

## Type Safety — Language-Specific Guidelines

### Universal Anti-Patterns (All Languages)

| Forbidden Pattern | Why | Instead |
|---------------------|-----|-----------|
| Type escape hatches (`any`, `Any`, `Object`, `void*`, `interface{}`) | Loses type info, runtime errors | Concrete types or `unknown` + guards |
| Type suppression (`@ts-ignore`, `# type: ignore`, `@SuppressWarnings`) | Hides errors | Fix actual type issues |
| Raw generic types (`List`, `Map` without params) | Loses type safety | `List<User>`, `Map<String, Order>` |
| Excessive casting (`as`, `(Type)`, `unsafe`) | Bypasses compiler | Type guards or pattern matching |

### TypeScript/JavaScript

```typescript
// BAD
function process(data: any): any { return data.foo; }

// GOOD
function process(data: unknown): Result {
  if (isValidData(data)) return data.foo;
  throw new Error('Invalid');
}
```

### Python

```python
# BAD
def process(data: Any) -> Any: return data["key"]

# GOOD
def process(data: UserData) -> str: return data["name"]
```

### Java/Kotlin

```java
// BAD
List items = new ArrayList();  // Raw type

// GOOD
List<User> users = new ArrayList<>();
```

### Go

```go
// BAD
func process(data interface{}) interface{} { ... }

// GOOD
func process(data UserRequest) (UserResponse, error) { ... }
```

### Rust

```rust
// BAD (unnecessary unsafe or Box<dyn Any>)
let data: Box<dyn Any> = get_data();

// GOOD
let data: UserData = get_data()?;
```

### C\#

```csharp
// BAD
object data = GetData();
dynamic result = Process(data);

// GOOD
UserData data = GetData();
Result result = Process(data);
```

### Type Safety Rules

| Rule | Description |
|------|-------------|
| **Boundary Validation** | Validate only at system boundaries (API, JSON, user input) |
| **Internal Trust** | After validation, pass only precise types internally |
| **No Type Escape** | Never use escape hatches to "fix" type errors |
| **Explicit Signatures** | Specify types in function/method signatures |
| **Generics with Params** | Always use generics with type parameters |

### Type Violations — Detection & Escalation

> Type violations are detected by static analysis and injected as `additionalContext` for the model to act on. Commit-level enforcement occurs at the auto-commit verify gate.

| Violation | Detection outcome |
|-----------|--------|
| Type escape hatches (`any`, `Any`, `Object`, `interface{}`, etc.) | Injected as P1 finding |
| Type suppression comments | Injected as P1 finding |
| Raw generic types | Injected as P1 finding |
| Missing function return types | Injected as warning |
| Excessive type casting | Injected as warning |
