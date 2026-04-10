---
name: vibe.spec.review
tier: core
description: "Review and enhance an existing SPEC with GPT/Gemini cross-validation. Runs 100-point quality gate (loop until perfect or stuck), Race Review with convergence-based termination (no round cap), optional Codex adversarial review, Review Debate Team, and final user checkpoint. Must use this skill after vibe.spec completes, or when the user says 'review spec', '스펙 리뷰'."
triggers: ["spec review", "review spec", "SPEC 리뷰", "명세 리뷰", race review]
priority: 80
chain-next: []
---

# vibe.spec.review — SPEC Quality Review

Review and enhance SPEC with GPT/Gemini cross-validation.

**Purpose:** Run this skill after `vibe.spec` to ensure accurate review execution. For large contexts, invoke in a new session.

---

## Usage

이 스킬은 `/vibe.spec` 오케스트레이터의 Phase 4에서 자동 호출된다. 직접 호출이 필요한 경우:

```
Load skill `vibe.spec.review` with feature: "feature-name"
```

또는 자연어 트리거: "스펙 리뷰", "review spec", "명세 리뷰".

**Prerequisites:**
- SPEC file exists: `.claude/vibe/specs/{feature-name}.md` (single) or `.claude/vibe/specs/{feature-name}/_index.md` (split)
- Feature file exists: `.claude/vibe/features/{feature-name}.feature` (single) or `.claude/vibe/features/{feature-name}/_index.feature` (split)

---

## Codex Plugin Integration

> **Codex 플러그인 감지**: 워크플로우 시작 시 아래 명령으로 자동 감지.
>
> ```bash
> CODEX_AVAILABLE=$(node "{{VIBE_PATH}}/hooks/scripts/codex-detect.js" 2>/dev/null || echo "unavailable")
> ```
>
> `available`이면 `/codex:adversarial-review` 자동 호출. `unavailable`이면 기존 GPT+Gemini 워크플로우로 동작.

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

**`.last-feature` 포인터 갱신** (Timer 직후):

```
Write ".claude/vibe/.last-feature" ← feature-name (한 줄)
이미 같은 값이면 no-op.
```

## Workflow

```
/vibe.spec "feature" → SPEC created (Phase 3)
        ↓
Phase 4: vibe.spec.review skill (this) → Quality validation + GPT/Gemini review
        ↓
    /vibe.run "feature"
```

**대용량 컨텍스트인 경우**: `/new` 후 `/vibe.spec "feature"` 재진입 → Smart Resume이 Phase 4부터 시작.

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

## Step 2: Quality Validation (100-Point Gate)

**🚨 MANDATORY: Score must reach 100 to proceed. Loop until perfect or stuck.**

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

### 2.2 Quality Gate Loop (No Round Cap)

```python
iteration = 0
prev_score = -1

while True:
    iteration += 1
    score = calculate_quality_score(spec, feature)

    print(f"━━━ Quality Check [{iteration}] ━━━")
    print(f"Score: {score}/100")

    if score >= 100:
        print("✅ Quality Gate PASSED (100/100)")
        break

    # Auto-fixer hit a wall → ask the user (prevents runaway AND respects 100 target)
    if score == prev_score:
        missing_items = identify_missing_items(spec)
        print(f"⚠️ Auto-fixer limit reached: stuck at {score}/100")
        print(f"Remaining items require human input:")
        for item in missing_items:
            print(f"  ❌ {item}")

        if ultrawork_mode:
            # ultrawork: no user intervention, record TODO and proceed
            print("ℹ️ ultrawork mode — recording gaps to TODO and proceeding")
            record_todo(missing_items)
            break

        # Interactive: ask the user to fill in or explicitly approve
        user_input = ask_user(
            "Please either:\n"
            "  1. Provide values for the remaining items (I'll apply them)\n"
            "  2. Type 'proceed' to accept current score and continue\n"
            "  3. Type 'abort' to stop the workflow"
        )

        if user_input == "abort":
            raise WorkflowAborted("User aborted at Quality Gate")
        if user_input == "proceed":
            record_todo(missing_items)
            break
        # otherwise: apply user-provided values → re-evaluate
        apply_user_values(user_input)
        continue

    prev_score = score

    # Auto-fix missing items
    missing_items = identify_missing_items(spec)
    for item in missing_items:
        auto_fix(item)
        update_spec()
        update_feature()

    print(f"✅ Applied {len(missing_items)} fixes - Re-evaluating...")
```

**Termination conditions:**
- `score == 100` → pass (primary success)
- `score == prev_score` (auto-fixer stuck) → **ask the user**:
  - User provides values → re-evaluate (loop continues, may reach 100)
  - User says "proceed" → record gaps as TODO and continue to Step 3
  - User says "abort" → stop entire workflow
  - `ultrawork` mode → skip prompt, auto-record TODO and continue
- No iteration cap — the only way to exit without 100 is explicit user approval or ultrawork.

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [1]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 87/100 ⚠️ BELOW 100

Missing items:
  ❌ Error handling scenarios (10%)
  ❌ Performance targets (5%)

Auto-fixing...
  ✅ Added network error handling scenario
  ✅ Added response time targets (<500ms)

Re-evaluating...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [2]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 96/100 ⚠️ BELOW 100

Missing items:
  ❌ Concurrent session policy (4%)

Auto-fixing...
  ✅ Added concurrent session policy

Re-evaluating...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [3]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 100/100 ✅ PASSED

✅ Quality Gate PASSED - proceeding to GPT/Gemini review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Stuck case (auto-fixer limit reached):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUALITY GATE [4]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 87/100 ⚠️ STUCK (same as previous iteration)

Auto-fixer hit a wall. These items need human input:
  ❌ Business rule: monthly subscription renewal grace period (days?)
  ❌ Target latency for search API (<?ms)
  ❌ Data retention policy for audit logs (how many days?)

어떻게 진행할까요?
  1. 직접 값을 알려주세요 (예: "grace period 7일, 검색 500ms, 감사로그 90일")
     → 반영 후 재평가 (100 도달 가능)
  2. "proceed" — 현재 점수로 수락, 남은 항목은 TODO로 기록 후 Step 3 진행
  3. "abort" — 워크플로 중단

(ultrawork 모드에서는 이 프롬프트 없이 자동으로 TODO 기록 + 진행)
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

## Step 3: Race Review (GPT + Gemini Cross-Validation) - Convergence-Based (No Round Cap)

**RULES FOR RACE REVIEW:**

1. **YOU MUST** use the Bash tool to call `llm-orchestrate.js` directly
2. **DO NOT** simulate or fake review results
3. Run rounds sequentially (each round uses updated SPEC)
4. **No hard round cap** — loop until P1=0 AND no new findings (convergence)

> Race Mode reviews SPEC with GPT and Gemini in parallel, then cross-validates findings for higher confidence. The loop continues until quality converges naturally.

### Termination Rules

- **P1 = 0 AND no new findings this round** → converged, stop (primary success)
- **Round 1 with P1 = 0 AND no P2/P3** → perfect on first try, stop (early success)
- **Round N findings == Round N-1 findings** → **stuck**: LLMs keep flagging same issues that auto-applier can't resolve → **ask the user** (see 3.2.1)

### Stuck Handling (3.2.1)

When the same findings repeat across rounds, the auto-apply loop has hit a wall. This typically means:
- The fix requires human judgment (architectural trade-off, domain rule, etc.)
- The LLMs are producing a false positive that the auto-applier can't dismiss
- The suggested fix conflicts with an existing constraint

**Interactive mode** — prompt the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ RACE REVIEW STUCK at Round {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Same findings repeated from Round {N-1}. Auto-applier cannot resolve:

| # | Issue | Severity | GPT | Gemini | Reason it's stuck |
|---|-------|----------|-----|--------|-------------------|
| 1 | {issue title} | P1 | ✅ | ✅ | {e.g., "fix requires domain decision"} |
| 2 | {issue title} | P2 | ✅ | ❌ | {e.g., "conflicts with existing constraint"} |

어떻게 진행할까요?
  1. 직접 해결책을 알려주세요 (예: "이슈 1은 retry 5회로, 이슈 2는 무시")
     → 반영 후 다음 라운드 재실행
  2. "proceed" — 현재 이슈를 TODO로 기록하고 Step 4로 진행
  3. "abort" — 워크플로 중단

(ultrawork 모드에서는 이 프롬프트 없이 자동으로 TODO 기록 + 진행)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Pseudocode:**

```python
if current_findings == prev_findings:
    if ultrawork_mode:
        print("ℹ️ ultrawork mode — recording stuck issues to TODO and proceeding")
        record_todo(current_findings)
        break

    user_input = ask_user(
        "Race Review stuck. Please either:\n"
        "  1. Provide resolution for the listed issues\n"
        "  2. Type 'proceed' to record as TODO and continue to Step 4\n"
        "  3. Type 'abort' to stop the workflow"
    )

    if user_input == "abort":
        raise WorkflowAborted("User aborted at Race Review")
    if user_input == "proceed":
        record_todo(current_findings)
        break
    # otherwise: apply user-provided resolutions → next round
    apply_user_resolutions(user_input)
    continue  # re-run the round with updated SPEC
```

### Narrowing Scope (Noise Reduction)

To prevent LLM cosmetic noise from causing infinite loops while still reaching 100% quality:

| Round | Scope |
|-------|-------|
| 1 | Full scope (P1 + P2 + P3) |
| 2 | P1 + P2 only |
| 3+ | P1 only (until P1=0 or convergence) |

### 3.1 Review Loop (No Round Cap)

**Run GPT + Gemini in PARALLEL via Bash tool for each round. Stop when termination rules trigger.**

**🚨 IMPORTANT: SPEC content is too large for CLI arguments. Use --input file method (no pipe needed).**

**Procedure for each round:**

**Step A: Save SPEC content + prompt as JSON to scratchpad temp file (using Write tool):**
- Write JSON to `[SCRATCHPAD]/spec-review-input.json` with content:
```json
{"prompt": "Review this SPEC for completeness, specificity, testability, security, and performance. Round [N] (scope: [SCOPE]). Find issues and improvements. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. SPEC content: [SPEC_CONTENT]"}
```
- Where `[SPEC_CONTENT]` is the full SPEC text (properly JSON-escaped inside the prompt string)
- `[SCOPE]` is `P1+P2+P3` for round 1, `P1+P2` for round 2, `P1` for rounds 3+

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
**🚨 Replace `[N]` with the current round number (1, 2, 3, ...).**
**🚨 Replace `[LLM_SCRIPT]` with the resolved absolute path from Step B.**
**🚨 Run GPT and Gemini calls in PARALLEL (two separate Bash tool calls at once).**

- Round 1: Write SPEC → Run GPT + Gemini in parallel (full scope) → Cross-validate → Apply fixes → Update SPEC file
- Round 2: Write updated SPEC → Run (P1+P2 scope) → Cross-validate → Apply fixes → Update SPEC file
- Round 3+: Write updated SPEC → Run (P1-only scope) → Cross-validate → Apply fixes → Continue until P1=0 AND no new findings (or convergence detected)

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

### 3.3 User Decision Checkpoint (수렴 후)

**🚨 MANDATORY: 리뷰 루프가 수렴(convergence)에 도달하면 사용자 판단 체크포인트 실행**

> Type 6 (Iterative-Reasoning) 패턴: AI가 혼자 결정하지 않고, 사용자와 함께 판단

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 USER CHECKPOINT: 리뷰 결과 검토
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{N}라운드 리뷰에서 발견된 주요 변경사항:

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
🏁 SPEC RACE REVIEW - Round 1 (scope: P1+P2+P3)
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
🏁 SPEC RACE REVIEW - Round 2 (scope: P1+P2)
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
🏁 SPEC RACE REVIEW - Round 3 (scope: P1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cross-Validated Issues: None

✅ Converged: P1 = 0 AND no new findings
✅ Consensus Rate: 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> If new P1s appear at round 3, the loop continues to round 4, 5, ... until convergence.

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

> **팀 정의**: `agents/teams/review-debate-team.md` 참조 (SPEC Review 컨텍스트)
> **조건**: Agent Teams 활성화 + 리뷰 루프 수렴 후 P1/P2 이슈 2개 이상 발견 시

**활성화 조건:**

| 상황 | 행동 |
|------|------|
| P1/P2 이슈 2개 이상 | 자동 활성화 |
| P1/P2 이슈 1개 이하 | 스킵 → Step 4로 진행 |
| Agent Teams 비활성화 | 스킵 → Step 4로 진행 |

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

Quality Score: 100/100 ✅
Review Rounds: {N} (converged: P1=0, no new findings) ✅
Total Improvements: {M}
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

For faster iteration (1 round only): pass `--quick` flag when invoking the skill (or via `/vibe.spec "feature-name" --quick` orchestrator).

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
