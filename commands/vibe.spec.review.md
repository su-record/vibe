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

## Step 3: Race Review (GPT + Gemini Cross-Validation) - 3 Rounds (v2.6.9)

**🚨 CRITICAL: Execute ALL 3 rounds with cross-validation. DO NOT skip.**

> Race Mode reviews SPEC with both GPT and Gemini in parallel, then cross-validates findings for higher confidence.

### 3.1 Race Review Invocation

```bash
# Via vibe tools (recommended)
node -e "import('@su-record/vibe/tools').then(t => t.raceReview({reviewType: 'general', code: '[SPEC content]', context: 'SPEC review round N/3'}).then(r => console.log(t.formatRaceResult(r))))"
```

### 3.2 Review Loop (3 Rounds with Cross-Validation)

For each round (1 to 3):

**Run GPT and Gemini in PARALLEL with cross-validation:**

```javascript
// Race review - both models run simultaneously
import('@su-record/vibe/tools').then(async t => {
  const result = await t.raceReview({
    reviewType: 'general',
    code: specContent,
    context: `SPEC review for ${featureName}. Stack: ${stack}. Round ${N}/3.`
  });
  console.log(t.formatRaceResult(result));
});
```

**Cross-validation rules:**

| Agreement | Priority | Action |
|-----------|----------|--------|
| Both agree (100%) | P1 | Auto-apply immediately |
| One model (50%) | P2 | Auto-apply with note |

**After each round:**

1. Cross-validate findings (issues found by both → P1, single model → P2)
2. Merge feedback with confidence scores
3. Auto-apply P1/P2 improvements to SPEC and Feature files
4. Continue to next round

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 SPEC RACE REVIEW - Round 1/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Model Results:
| Model  | Issues | Duration |
|--------|--------|----------|
| GPT    | 2      | 1823ms   |
| Gemini | 2      | 2156ms   |

Cross-Validated Issues:
| Issue                    | GPT | Gemini | Confidence |
|--------------------------|-----|--------|------------|
| Missing retry logic      | ✅  | ✅     | 100% → P1  |
| Missing rate limiting    | ✅  | ✅     | 100% → P1  |
| Token refresh unclear    | ✅  | ❌     | 50% → P2   |

Auto-applying...
  ✅ [P1] Added retry logic (3 attempts, exponential backoff)
  ✅ [P1] Added rate limiting (100 req/min)
  ✅ [P2] Added token refresh flow

✅ Round 1 complete - 3 improvements (2 P1, 1 P2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 SPEC RACE REVIEW - Round 2/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cross-Validated Issues:
| Issue                       | GPT | Gemini | Confidence |
|-----------------------------|-----|--------|------------|
| Concurrent session unclear  | ✅  | ❌     | 50% → P2   |

Auto-applying...
  ✅ [P2] Added concurrent session policy

✅ Round 2 complete - 1 improvement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 SPEC RACE REVIEW - Round 3/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cross-Validated Issues: None

✅ No changes needed - SPEC is complete
✅ Consensus Rate: 100%
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
