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

## Codex Plugin Integration

> **Codex 플러그인 활성화 여부**: Codex Claude Code 플러그인(`codex-plugin-cc`) 설치 시 자동 활용.
> 미설치 시 Codex 관련 단계는 자동 스킵 — 기존 GPT+Gemini 워크플로우로 동작.

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Workflow

```
/vibe.spec "feature" → SPEC created
        ↓
    /new (new session)
        ↓
/vibe.spec.review "feature" → Quality validation + GPT/Gemini review
        ↓
    /vibe.run "feature"
```

---

## File Reading Policy (Mandatory)

- **Delegate SPEC reading to sub-agents** — Do NOT read all SPEC/Feature files in main session
- **Split structure (3+ phases)**: Use `Task(subagent_type="explorer-medium")` to read and summarize
- **Single file structure**: Main session may Read directly (small enough)
- **Never use Grep** for content analysis — Grep is for file location only
- **Agent spawn rule**: Include "Read target files FULLY with Read tool" in agent prompts

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
.claude/vibe/specs/{feature-name}/phase-*.md     (phase-1-xxx.md, phase-2-xxx.md, ...)
.claude/vibe/features/{feature-name}/_index.feature (+ phase files)
.claude/vibe/features/{feature-name}/phase-*.feature
```

**Detection logic:**
1. Check if `.claude/vibe/specs/{feature-name}/` directory exists → Split mode
2. Otherwise check `.claude/vibe/specs/{feature-name}.md` → Single mode
3. If neither exists → Error

**Split mode file loading:**
1. Read `_index.md` for master SPEC overview
2. Glob `phase-*.md` files and read all phase SPECs
3. Read corresponding `_index.feature` and `phase-*.feature` files

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
    print(f"⚠️ Score {score} < 95 after {max_iterations} iterations")
    print("Remaining gaps added to TODO. Proceeding with current quality.")
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

## Step 3: Race Review (GPT + Gemini Cross-Validation) - Max 3 Rounds (v2.6.9)

**RULES FOR RACE REVIEW:**

1. **YOU MUST** use the Bash tool to call `llm-orchestrate.js` directly
2. **DO NOT** simulate or fake review results
3. Run rounds sequentially (each round uses updated SPEC)

> Race Mode reviews SPEC with GPT and Gemini in parallel, then cross-validates findings for higher confidence.

### Convergence Rule (Early Exit)

- **Round N findings == Round N-1 findings** → converged, stop immediately (no need to reach Round 3)
- **Round 1 with P1 = 0** → skip Round 2 and stop
- **Max 3 rounds** — if new P1s still appear after 3 rounds, record as TODO and stop

### 3.1 Review Loop (Max 3 Rounds)

**For EACH round (1, 2, 3), run GPT + Gemini in PARALLEL via Bash tool. Stop early if converged.**

**🚨 IMPORTANT: SPEC content is too large for CLI arguments. Use --input file method (no pipe needed).**

**Procedure for each round:**

**Step A: Save SPEC content + prompt as JSON to scratchpad temp file (using Write tool):**
- Write JSON to `[SCRATCHPAD]/spec-review-input.json` with content:
```json
{"prompt": "Review this SPEC for completeness, specificity, testability, security, and performance. Round [N]/3. Find issues and improvements. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. SPEC content: [SPEC_CONTENT]"}
```
- Where `[SPEC_CONTENT]` is the full SPEC text (properly JSON-escaped inside the prompt string)

**Step B: Script path:**
- `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`

**Step C: Run GPT + Gemini in PARALLEL (two separate Bash tool calls at once):**

```bash
# GPT review (Bash tool call 1)
node "[LLM_SCRIPT]" gpt orchestrate-json --input "[SCRATCHPAD]/spec-review-input.json"
```

```bash
# Gemini review (Bash tool call 2 - run in parallel with GPT)
node "[LLM_SCRIPT]" gemini orchestrate-json --input "[SCRATCHPAD]/spec-review-input.json"
```

**🚨 MANDATORY: Replace `[SCRATCHPAD]` with the actual scratchpad directory path.**
**🚨 Replace `[N]` with the current round number (1, 2, or 3).**
**🚨 Replace `[LLM_SCRIPT]` with the resolved absolute path from Step B.**
**🚨 Run GPT and Gemini calls in PARALLEL (two separate Bash tool calls at once).**

- Round 1: Write SPEC → Run GPT + Gemini in parallel → Cross-validate → Apply fixes → Update SPEC file
- Round 2: Write updated SPEC → Run → Cross-validate → Apply fixes → Update SPEC file
- Round 3: Write final SPEC → Run → Cross-validate → Confirm no issues remain

### 3.2 Cross-Validation Rules

| Agreement | Priority | Action |
|-----------|----------|--------|
| Both models agree (100%) | P1 | Auto-apply immediately |
| 1 model only (50%) | P2 | Auto-apply with note |

**After each round:**

1. Cross-validate findings (issues found by 2+ models → P1, single model → P2)
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
| Issue                    | GPT | Gemini | Codex | Confidence |
|--------------------------|-----|--------|-------|------------|
| Missing retry logic      | ✅  | ✅     | ✅    | 100% → P1  |
| Missing rate limiting    | ✅  | ✅     | ✅    | 100% → P1  |
| Token refresh unclear    | ✅  | ❌     | ❌    | 50% → P2   |

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
| Issue                       | GPT | Gemini | Codex | Confidence |
|-----------------------------|-----|--------|-------|------------|
| Concurrent session unclear  | ✅  | ❌     | ❌    | 50% → P2   |

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

### Step 3.1: Codex Adversarial Review (Codex 플러그인 활성화 시)

> **활성화 조건**: Codex 플러그인 설치 시 자동 실행. 미설치 시 스킵.
> GPT+Gemini Race Review와 **동시에** 실행하여 3중 교차 검증.

Codex adversarial review는 SPEC의 **설계 결정에 도전**합니다:
- 대안적 아키텍처가 더 나은지 검증
- 오버엔지니어링 또는 과소 설계 여부
- 누락된 엣지케이스 및 비기능 요구사항

**실행 (GPT+Gemini Race와 병렬):**

```
/codex:adversarial-review
```

**결과 통합**: Race Review 교차 검증 테이블에 Codex 열 추가:

```markdown
| Issue | GPT | Gemini | Codex | Confidence |
|-------|-----|--------|-------|------------|
| {이슈} | ✅/❌ | ✅/❌ | ✅/❌ | {%} |
```

- 3개 모델 중 2개 이상 동의 → **High Confidence**
- Codex만 발견한 이슈 → **P2** (설계 관점 검토 필요)
- 3개 모두 동의 → **P1** (즉시 수정)

---

## Step 3.5: Review Debate Team (Agent Teams)

> **조건**: Agent Teams 활성화 + 3라운드 완료 후 P1/P2 이슈 2개 이상 발견 시
> 여러 관점에서 교차 검증하여 오탐 제거 및 우선순위 조정

**팀 구성:**

| 팀원 | 역할 |
|------|------|
| security-reviewer (리더) | 보안 관점 우선순위 결정, 교차 검증 주도 |
| architecture-reviewer | 구조적 영향 평가, 설계 일관성 확인 |
| performance-reviewer | 성능 영향 평가, 불필요한 최적화 식별 |
| simplicity-reviewer | 과잉 설계 여부, YAGNI 위반 식별 |

**활성화 조건:**

| 상황 | 행동 |
|------|------|
| P1/P2 이슈 2개 이상 | 자동 활성화 |
| P1/P2 이슈 1개 이하 | 스킵 → Step 4로 진행 |
| Agent Teams 비활성화 | 스킵 → Step 4로 진행 |

**spawn 패턴:**

```text
TeamCreate(team_name="spec-debate-{feature}", description="SPEC review debate for {feature}")

Task(team_name="spec-debate-{feature}", name="security-reviewer", subagent_type="security-reviewer",
  mode="bypassPermissions",
  prompt="SPEC 리뷰 팀 리더. GPT/Gemini가 발견한 P1/P2 이슈를 교차 검증하세요.
  SPEC: {spec_content}
  발견된 이슈: {p1_p2_issues}
  역할: 각 이슈가 진짜인지(오탐 아닌지) 검증. 실제 영향도 기준으로 우선순위 조정.
  분쟁이 있는 이슈는 해당 리뷰어에게 SendMessage로 확인 요청하세요.")

Task(team_name="spec-debate-{feature}", name="architecture-reviewer", subagent_type="architecture-reviewer",
  mode="bypassPermissions",
  prompt="SPEC 리뷰 팀 아키텍처 전문가. 아키텍처 관련 이슈를 검증하세요.
  SPEC: {spec_content}
  역할: 구조적 일관성, SOLID 원칙, 레이어 경계 검증.
  우선순위 변경 필요 시 security-reviewer에게 SendMessage로 알리세요.")

Task(team_name="spec-debate-{feature}", name="performance-reviewer", subagent_type="performance-reviewer",
  mode="bypassPermissions",
  prompt="SPEC 리뷰 팀 성능 전문가. 성능 관련 이슈를 검증하세요.
  SPEC: {spec_content}
  역할: 성능 요구사항 현실성 평가, 불필요한 최적화 식별.
  P2→P1 승격이 필요하면 security-reviewer에게 SendMessage로 알리세요.")

Task(team_name="spec-debate-{feature}", name="simplicity-reviewer", subagent_type="simplicity-reviewer",
  mode="bypassPermissions",
  prompt="SPEC 리뷰 팀 단순성 전문가. 과잉 설계 여부를 검증하세요.
  SPEC: {spec_content}
  역할: YAGNI 위반, 불필요한 복잡성 식별.
  P1→P2 강등이 필요하면 security-reviewer에게 SendMessage로 알리세요.")
```

**결과 통합:**
- 팀 합의 결과를 SPEC에 반영 (P1 즉시 적용, P2 노트 추가)
- 팀원 shutdown_request → TeamDelete로 정리
- Step 4 (Final Summary)로 진행

---

## Step 4: Final Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPEC REVIEW COMPLETE: {feature-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quality Score: 96/100 ✅
Review Rounds: 3/3 ✅
Total Improvements: 4
⏱️ Started: {start_time}
⏱️ Completed: {getCurrentTime 결과}

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
If no issues, proceed with /vibe.run "{feature-name}".
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Important:**

- List ALL Phases, Scenarios, and Constraints from SPEC without omission
- Keep it concise for quick user review
- Wait for user confirmation after review (unless ultrawork mode)
- In ultrawork mode: output summary then auto-proceed to `/vibe.run`

### 5.1 Final User Checkpoint

**🚨 MANDATORY: `/vibe.run` 진행 전 최종 사용자 확인**

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
