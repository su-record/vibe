# /su.spec.review - SPEC Quality Review

Review and enhance SPEC with GPT/Gemini cross-validation.

**Purpose:** Run this command in a NEW session after `/su.spec` to ensure accurate review execution.

---

## Usage

```bash
/su.spec.review "feature-name"
```

**Prerequisites:**
- SPEC file exists: `.claude/core/specs/{feature-name}.md` (single) or `.claude/core/specs/{feature-name}/_index.md` (split)
- Feature file exists: `.claude/core/features/{feature-name}.feature` (single) or `.claude/core/features/{feature-name}/_index.feature` (split)

---

## Workflow

```
/su.spec "feature" → SPEC created
        ↓
    /new (new session)
        ↓
/su.spec.review "feature" → Quality validation + GPT/Gemini review
        ↓
    /su.run "feature"
```

---

## Step 1: Load SPEC Files

Detect SPEC structure (single file or split folder) and read files:

**Single file structure:**
```
.claude/core/specs/{feature-name}.md
.claude/core/features/{feature-name}.feature
```

**Split folder structure:**
```
.claude/core/specs/{feature-name}/_index.md      (+ phase files)
.claude/core/features/{feature-name}/_index.feature (+ phase files)
```

**Detection logic:**
1. Check if `.claude/core/specs/{feature-name}/` directory exists → Split mode
2. Otherwise check `.claude/core/specs/{feature-name}.md` → Single mode
3. If neither exists → Error

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPEC REVIEW: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Loading files...
  Mode: {single|split}
  ✅ SPEC: .claude/core/specs/{feature-name}.md (or _index.md + N phase files)
  ✅ Feature: .claude/core/features/{feature-name}.feature (or _index.feature + N phase files)

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

**For EACH round (1, 2, 3), run GPT + Gemini in PARALLEL via Bash tool.**

**🚨 IMPORTANT: SPEC content is too large for CLI arguments. Use stdin pipe method.**

**Procedure for each round:**

**Step A: Save SPEC content to scratchpad temp file (using Write tool):**
- Write the SPEC content to `[SCRATCHPAD]/spec-content.txt`

**Step B: Run GPT + Gemini in PARALLEL (two separate Bash tool calls at once):**

```bash
# GPT review (Bash tool call 1)
node -e "const fs=require('fs');const p=JSON.stringify({prompt:'Review this SPEC for completeness, specificity, testability, security, and performance. Round [N]/3. Find issues and improvements. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. SPEC content: '+fs.readFileSync('[SCRATCHPAD]/spec-content.txt','utf8')});process.stdout.write(p)" | node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/core/hooks/scripts/llm-orchestrate.js" gpt orchestrate-json
```

```bash
# Gemini review (Bash tool call 2 - run in parallel with GPT)
node -e "const fs=require('fs');const p=JSON.stringify({prompt:'Review this SPEC for completeness, specificity, testability, security, and performance. Round [N]/3. Find issues and improvements. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. SPEC content: '+fs.readFileSync('[SCRATCHPAD]/spec-content.txt','utf8')});process.stdout.write(p)" | node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/core/hooks/scripts/llm-orchestrate.js" gemini orchestrate-json
```

**🚨 MANDATORY: Replace `[SCRATCHPAD]` with the actual scratchpad directory path.**
**🚨 Replace `[N]` with the current round number (1, 2, or 3).**
**🚨 Run GPT and Gemini calls in PARALLEL (two separate Bash tool calls at once).**

- Round 1: Write SPEC → Run GPT + Gemini in parallel → Cross-validate → Apply fixes → Update SPEC file
- Round 2: Write updated SPEC → Run → Cross-validate → Apply fixes → Update SPEC file
- Round 3: Write final SPEC → Run → Cross-validate → Confirm no issues remain

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

### 3.3 User Decision Checkpoint (Round 3 이후)

**🚨 MANDATORY: 3라운드 완료 후 사용자 판단 체크포인트 실행**

> Type 6 (Iterative-Reasoning) 패턴: AI가 혼자 결정하지 않고, 사용자와 함께 판단

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 USER CHECKPOINT: 리뷰 결과 검토
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3라운드 리뷰에서 발견된 주요 변경사항:

| # | 변경 내용 | 출처 | 신뢰도 |
|---|----------|------|--------|
| 1 | {변경1} | GPT+Gemini | 100% |
| 2 | {변경2} | GPT only | 50% |
| ... | ... | ... | ... |

질문:
1. 위 변경사항 중 제외하고 싶은 항목이 있나요?
2. 추가로 명시해야 할 요구사항이 있나요?
3. 기술적 접근 방식에 동의하시나요?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Checkpoint 행동 규칙:**

| 상황 | 행동 |
|------|------|
| `ultrawork` 모드 | 체크포인트 스킵, 자동 진행 |
| 일반 모드 | 반드시 사용자 응답 대기 |
| 사용자가 변경 요청 | 수정 후 다시 체크포인트 |
| 사용자가 승인 | Step 4로 진행 |

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
  📋 .claude/core/specs/{feature-name}.md (or split folder)
  📋 .claude/core/features/{feature-name}.feature (or split folder)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 5: SPEC Summary for User Review

**🚨 MANDATORY: Always output this summary before proceeding to `/su.run`.**

After all review rounds, present the finalized SPEC to the user in a readable format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPEC SUMMARY: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Feature Overview
{1-2 line summary of feature purpose from SPEC's <role> and <context>}

## Tech Stack
{Tech stack list extracted from <context>}

## Implementation Phases
| Phase | Name | Key Tasks |
|-------|------|-----------|
| 1 | {phase name} | {1-line summary of core task} |
| 2 | {phase name} | {1-line summary of core task} |
| ... | ... | ... |

## Key Scenarios ({N} total)
{Scenario name list from Feature file}
- Scenario: {name1}
- Scenario: {name2}
- ...

## Key Constraints
{3-5 key items from <constraints>}

## Acceptance Criteria
{Summary of key items from <acceptance>}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If anything above is incorrect, please request changes.
If no issues, proceed with /su.run "{feature-name}".
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Important:**

- List ALL Phases, Scenarios, and Constraints from SPEC without omission
- Keep it concise for quick user review
- Wait for user confirmation after review (unless ultrawork mode)
- In ultrawork mode: output summary then auto-proceed to `/su.run`

### 5.1 Final User Checkpoint

**🚨 MANDATORY: `/su.run` 진행 전 최종 사용자 확인**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPEC 리뷰 완료 - 최종 확인
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

다음 질문에 답변해 주세요:

1. **요구사항 정확성**: 위 SPEC이 원래 의도한 기능을 정확히 설명하고 있나요?
2. **범위 적절성**: 구현 범위가 너무 크거나 작지 않나요?
3. **기술 스택**: 선택된 기술 스택에 동의하시나요?
4. **우선순위**: Phase 순서와 우선순위가 맞나요?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 "ok" 또는 "진행"으로 승인 / 수정 사항이 있으면 말씀해 주세요
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Why This Checkpoint Matters:**

> AI가 더 많이 해준다고 좋은 게 아닙니다.
> 사용자가 AI와 함께 생각하고 판단할 때 최고의 결과가 나옵니다.
> 이 체크포인트는 Type 6 (Iterative-Reasoning) 패턴을 유도합니다.

---

## Next Step

```
/su.run "{feature-name}"
```

---

## Error Handling

### SPEC Not Found
```
❌ ERROR: SPEC file not found

Expected (single): .claude/core/specs/{feature-name}.md
Expected (split):  .claude/core/specs/{feature-name}/_index.md

Please run /su.spec "{feature-name}" first to create the SPEC.
```

### Feature Not Found
```
❌ ERROR: Feature file not found

Expected (single): .claude/core/features/{feature-name}.feature
Expected (split):  .claude/core/features/{feature-name}/_index.feature

Please run /su.spec "{feature-name}" first to create the Feature file.
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
/su.spec.review "feature-name" --quick
```

---

ARGUMENTS: $ARGUMENTS

**File Detection (execute before Step 1):**

```
Feature name: $ARGUMENTS

1. Check split folder: .claude/core/specs/$ARGUMENTS/_index.md
   - If exists → Split mode (read all files in folder)
2. Check single file: .claude/core/specs/$ARGUMENTS.md
   - If exists → Single mode
3. Neither exists → Show error with both expected paths
```
