# /vibe.spec.review - SPEC Quality Review

Review and enhance SPEC with GPT/Gemini cross-validation.

**Purpose:** Run this command in a NEW session after `/vibe.spec` to ensure accurate review execution.

---

## Usage

```bash
/vibe.spec.review "feature-name"
```

**Prerequisites:**
- SPEC file exists: `.claude/vibe/specs/{feature-name}.md` (single) or `.claude/vibe/specs/{feature-name}/_index.md` (split)
- Feature file exists: `.claude/vibe/features/{feature-name}.feature` (single) or `.claude/vibe/features/{feature-name}/_index.feature` (split)

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

Detect SPEC structure (single file or split folder) and read files:

**Single file structure:**
```
.claude/vibe/specs/{feature-name}.md
.claude/vibe/features/{feature-name}.feature
```

**Split folder structure:**
```
.claude/vibe/specs/{feature-name}/_index.md      (+ phase files)
.claude/vibe/features/{feature-name}/_index.feature (+ phase files)
```

**Detection logic:**
1. Check if `.claude/vibe/specs/{feature-name}/` directory exists → Split mode
2. Otherwise check `.claude/vibe/specs/{feature-name}.md` → Single mode
3. If neither exists → Error

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPEC REVIEW: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Loading files...
  Mode: {single|split}
  ✅ SPEC: .claude/vibe/specs/{feature-name}.md (or _index.md + N phase files)
  ✅ Feature: .claude/vibe/features/{feature-name}.feature (or _index.feature + N phase files)

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

**🚨🚨🚨 CRITICAL: YOU MUST EXECUTE ALL 3 ROUNDS. DO NOT SKIP THIS STEP. 🚨🚨🚨**

**🚨 ABSOLUTE RULES FOR RACE REVIEW:**

1. **YOU MUST** use the Bash tool to call `llm-orchestrate.js` directly
2. **DO NOT** skip GPT/Gemini calls
3. **DO NOT** simulate or fake review results
4. **YOU MUST** run all 3 rounds sequentially (each round uses updated SPEC)

> Race Mode reviews SPEC with both GPT and Gemini in parallel, then cross-validates findings for higher confidence.

### 3.1 Review Loop (3 Rounds)

**For EACH round (1, 2, 3), run GPT + Gemini in PARALLEL via Bash tool:**

**🚨 MANDATORY: Copy the EXACT path below. DO NOT modify or use alternative paths.**

```bash
# Cross-platform path (works on Windows/macOS/Linux)
# ⚠️ COPY THIS EXACTLY - DO NOT USE ~/.claude/ or any other path!
VIBE_SCRIPTS="$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/vibe/hooks/scripts"

# GPT review (Bash tool call 1)
node "$VIBE_SCRIPTS/llm-orchestrate.js" gpt orchestrate-json "Review this SPEC for completeness, specificity, testability, security, and performance. Round [N]/3. Find issues and improvements. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. SPEC content: [SPEC_CONTENT]"

# Gemini review (Bash tool call 2 - run in parallel with GPT)
node "$VIBE_SCRIPTS/llm-orchestrate.js" gemini orchestrate-json "Review this SPEC for completeness, specificity, testability, security, and performance. Round [N]/3. Find issues and improvements. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. SPEC content: [SPEC_CONTENT]"
```

**🚨 MANDATORY: Use the Bash tool to run BOTH commands above for EACH round.**
**🚨 Run GPT and Gemini calls in PARALLEL (two separate Bash tool calls at once).**

- Round 1: Run GPT + Gemini in parallel → Cross-validate → Apply fixes → Update SPEC file
- Round 2: Run with updated SPEC → Cross-validate → Apply fixes → Update SPEC file
- Round 3: Run with final SPEC → Cross-validate → Confirm no issues remain

### 3.2 Cross-Validation Rules

| Agreement | Priority | Action |
|-----------|----------|--------|
| Both GPT + Gemini agree (100%) | P1 | Auto-apply immediately |
| One model only (50%) | P2 | Auto-apply with note |

**After each round:**

1. Cross-validate findings (issues found by both → P1, single model → P2)
2. Merge feedback with confidence scores
3. Auto-apply P1/P2 improvements to SPEC and Feature files (use Edit tool)
4. Continue to next round with updated SPEC content

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
  📋 .claude/vibe/specs/{feature-name}.md (or split folder)
  📋 .claude/vibe/features/{feature-name}.feature (or split folder)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 5: SPEC Summary for User Review

**🚨 MANDATORY: Always output this summary before proceeding to `/vibe.run`.**

After all review rounds, present the finalized SPEC to the user in a readable format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPEC SUMMARY: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 기능 개요
{SPEC의 <role>과 <context>에서 추출한 기능 목적 1-2줄 요약}

## 기술 스택
{<context>에서 추출한 기술 스택 목록}

## 구현 단계
| Phase | 이름 | 주요 작업 |
|-------|------|----------|
| 1 | {phase name} | {핵심 작업 1줄 요약} |
| 2 | {phase name} | {핵심 작업 1줄 요약} |
| ... | ... | ... |

## 핵심 시나리오 ({N}개)
{Feature 파일에서 Scenario 이름 목록}
- Scenario: {name1}
- Scenario: {name2}
- ...

## 주요 제약사항
{<constraints>에서 핵심 항목 3-5개}

## 검증 기준
{<acceptance>에서 핵심 항목 요약}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 위 내용에 잘못된 부분이 있으면 수정을 요청하세요.
   문제가 없으면 /vibe.run "{feature-name}" 으로 진행합니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Important:**

- SPEC의 모든 Phase, Scenario, Constraint를 빠짐없이 나열
- 사용자가 빠르게 검수할 수 있도록 핵심만 간결하게
- 검토 후 사용자 확인 대기 (ultrawork 모드가 아닌 경우)
- ultrawork 모드인 경우: 요약 출력 후 자동으로 `/vibe.run` 진행

---

## Next Step

```
/vibe.run "{feature-name}"
```

---

## Error Handling

### SPEC Not Found
```
❌ ERROR: SPEC file not found

Expected (single): .claude/vibe/specs/{feature-name}.md
Expected (split):  .claude/vibe/specs/{feature-name}/_index.md

Please run /vibe.spec "{feature-name}" first to create the SPEC.
```

### Feature Not Found
```
❌ ERROR: Feature file not found

Expected (single): .claude/vibe/features/{feature-name}.feature
Expected (split):  .claude/vibe/features/{feature-name}/_index.feature

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

**File Detection (execute before Step 1):**

```
Feature name: $ARGUMENTS

1. Check split folder: .claude/vibe/specs/$ARGUMENTS/_index.md
   - If exists → Split mode (read all files in folder)
2. Check single file: .claude/vibe/specs/$ARGUMENTS.md
   - If exists → Single mode
3. Neither exists → Show error with both expected paths
```
