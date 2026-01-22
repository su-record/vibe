# /vibe.spec.review - SPEC Quality Review

Review and enhance SPEC with GPT/Gemini cross-validation.

**Purpose:** Run this command in a NEW session after `/vibe.spec` to ensure accurate review execution.

---

## Usage

```bash
/vibe.spec.review "feature-name"
```

**Prerequisites:**
- SPEC file exists: `.claude/vibe/specs/{feature-name}.spec.md`
- Feature file exists: `.claude/vibe/features/{feature-name}.feature`

---

## Workflow

```
/vibe.spec "feature" → SPEC 생성 완료
        ↓
    /new (새 세션)
        ↓
/vibe.spec.review "feature" → 품질 검증 + GPT/Gemini 리뷰
        ↓
    /vibe.run "feature"
```

---

## Step 1: Load SPEC Files

Read the existing SPEC and Feature files:

```
.claude/vibe/specs/{feature-name}.spec.md
.claude/vibe/features/{feature-name}.feature
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPEC REVIEW: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Loading files...
  ✅ SPEC: .claude/vibe/specs/{feature-name}.spec.md
  ✅ Feature: .claude/vibe/features/{feature-name}.feature

Extracted info:
  - Feature: {feature description}
  - Stack: {tech stack}
  - Phases: {number of phases}
  - Scenarios: {number of scenarios}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 2: Quality Validation (95-Point Gate)

**🚨 MANDATORY: Score must be ≥ 95 to proceed**

### 2.1 Quality Checklist

| Category | Check Item | Weight |
|----------|------------|--------|
| **Completeness** | All user flows included in Task | 15% |
| **Completeness** | All ACs converted to Feature scenarios | 10% |
| **Completeness** | Error handling scenarios defined | 10% |
| **Specificity** | All numbers specified (timeout, limits, etc.) | 15% |
| **Specificity** | No ambiguous terms ("appropriate", "proper", etc.) | 10% |
| **Testability** | Each AC is verifiable | 10% |
| **Testability** | Feature scenarios have concrete Given/When/Then | 10% |
| **Security** | Auth/permission requirements specified | 10% |
| **Performance** | Response time/load requirements specified | 10% |

### 2.2 Quality Gate Loop

```python
max_iterations = 3
iteration = 0

while iteration < max_iterations:
    iteration += 1
    score = calculate_quality_score(spec, feature)

    print(f"━━━ Quality Check [{iteration}/{max_iterations}] ━━━")
    print(f"Score: {score}/100")

    if score >= 95:
        print("✅ Quality Gate PASSED")
        break

    # Auto-fix missing items
    missing_items = identify_missing_items(spec)
    for item in missing_items:
        auto_fix(item)
        update_spec()
        update_feature()

    print(f"✅ Applied {len(missing_items)} fixes - Re-evaluating...")

if score < 95:
    print(f"❌ BLOCKED: Score {score} < 95 after {max_iterations} iterations")
    print("Manual intervention required.")
```

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [1/3]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 87/100 ⚠️ BELOW THRESHOLD (95)

Missing items:
  ❌ Error handling scenarios (10%)
  ❌ Performance targets (5%)

Auto-fixing...
  ✅ Added network error handling scenario
  ✅ Added response time targets (<500ms)

Re-evaluating...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [2/3]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 96/100 ✅ PASSED

✅ Quality Gate PASSED - proceeding to GPT/Gemini review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.3 Auto-Fix Rules

| Missing Item | Auto-Fix Method |
|--------------|-----------------|
| Missing AC | Auto-generate AC based on Task |
| Numbers not specified | Apply project defaults (timeout 30s, etc.) |
| Missing error handling | Add common error scenarios |
| Missing performance targets | Apply industry standard criteria |
| Missing security | Add auth/data protection requirements |
| Ambiguous terms | Replace with specific values |

---

## Step 3: GPT/Gemini Review (3-Round Mandatory)

**🚨 CRITICAL: Execute ALL 3 rounds. DO NOT skip.**

### 3.1 Path Configuration

**🚨 MANDATORY: Copy the EXACT path below. DO NOT modify or use alternative paths.**

```bash
# Cross-platform path (works on Windows/macOS/Linux)
# ⚠️ COPY THIS EXACTLY - DO NOT USE ~/.claude/ or any other path!
VIBE_SCRIPTS="$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts"
```

### 3.2 Review Loop (3 Rounds)

For each round (1 to 3):

**Run GPT and Gemini in PARALLEL (2 Bash calls simultaneously):**

```bash
# GPT review
node "$VIBE_SCRIPTS/llm-orchestrate.js" gpt orchestrate-json "Review SPEC for {feature-name}. Stack: {stack}. Summary: {spec-summary}. Round {N}/3. Check: completeness, error handling, security, edge cases, performance."

# Gemini review
node "$VIBE_SCRIPTS/llm-orchestrate.js" gemini orchestrate-json "Review SPEC for {feature-name}. Stack: {stack}. Summary: {spec-summary}. Round {N}/3. Check: completeness, error handling, security, edge cases, performance."
```

**After each round:**
1. Parse JSON responses from both GPT and Gemini
2. Merge feedback (deduplicate, prioritize)
3. Auto-apply improvements to SPEC and Feature files
4. Continue to next round

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SPEC REVIEW - Round 1/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GPT] 2 issues found:
  1. Missing retry logic for API calls
  2. Token refresh flow not specified

[Gemini] 1 issue found:
  1. Missing rate limiting specification

Merged: 3 unique issues
Auto-applying...
  ✅ Added retry logic (3 attempts, exponential backoff)
  ✅ Added token refresh flow to auth section
  ✅ Added rate limiting (100 req/min)

✅ Round 1 complete - 3 improvements applied
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SPEC REVIEW - Round 2/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GPT] 1 issue found:
  1. Concurrent session handling unclear

[Gemini] 0 issues found

Auto-applying...
  ✅ Added concurrent session policy

✅ Round 2 complete - 1 improvement applied
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SPEC REVIEW - Round 3/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[GPT] 0 issues found
[Gemini] 0 issues found

✅ No changes needed - SPEC is complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 4: Final Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPEC REVIEW COMPLETE: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quality Score: 96/100 ✅
Review Rounds: 3/3 ✅
Total Improvements: 4

Updated files:
  📋 .claude/vibe/specs/{feature-name}.spec.md
  📋 .claude/vibe/features/{feature-name}.feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Next Step

/vibe.run "{feature-name}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Error Handling

### SPEC Not Found
```
❌ ERROR: SPEC file not found

Expected: .claude/vibe/specs/{feature-name}.spec.md

Please run /vibe.spec "{feature-name}" first to create the SPEC.
```

### Feature Not Found
```
❌ ERROR: Feature file not found

Expected: .claude/vibe/features/{feature-name}.feature

Please run /vibe.spec "{feature-name}" first to create the Feature file.
```

### GPT/Gemini Call Failed
```
⚠️ WARNING: {GPT|Gemini} call failed

Error: {error message}

Continuing with {other model} results only...
```

---

## Quick Mode

For faster iteration (1 round only):

```bash
/vibe.spec.review "feature-name" --quick
```

---

ARGUMENTS: $ARGUMENTS
