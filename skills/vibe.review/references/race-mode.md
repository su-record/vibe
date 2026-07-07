# Race Mode — Full Reference

> Loaded by vibe.review SKILL.md when Race Mode (`--race`, Multi-LLM competitive review) is invoked.

### How It Works

```
/vibe.review --race

security-review:
├─ GPT Codex  → [SQL injection, XSS]
└─ Antigravity     → [SQL injection, CSRF]
         ↓
   Cross-validation:
   - SQL injection (2/2) → 🔴 P1 (100% confidence)
   - XSS (1/2) → 🟡 P2 (50% confidence)
   - CSRF (1/2) → 🟡 P2 (50% confidence)
```

### Confidence-Based Priority

| Confidence | Priority | Meaning |
|------------|----------|---------|
| 100% (2/2) | P1 | Both models agree - high confidence |
| 50% (1/2) | P2 | One model found - needs verification |

### Race Mode Options

```
/vibe.review --race                  # All review types
/vibe.review --race security         # Security only
/vibe.review --race performance      # Performance only
/vibe.review --race architecture     # Architecture only
```

### Race Mode Output

```
## SECURITY Review (Race Mode)

**Duration**: 3420ms
**Models**: GPT Codex, Antigravity

### Model Results

| Model | Issues Found | Duration | Status |
|-------|--------------|----------|--------|
| gpt | 3 | 1823ms | OK |
| antigravity | 2 | 2156ms | OK |

### Cross-Validated Issues

**Summary**: 3 issues (P1: 1, P2: 2)
**Consensus Rate**: 67%

#### 🔴 P1 - SQL Injection in user query

- **Confidence**: 100% (gpt, antigravity)
- **Severity**: critical
- **Location**: `src/api/users.ts:42`
- **Suggestion**: Use parameterized queries

#### 🟡 P2 - XSS vulnerability in render

- **Confidence**: 50% (gpt)
- **Severity**: high
- **Location**: `src/components/Comment.tsx:15`
```

### Codex Review (Codex 플러그인 활성화 시)

Race Mode에서 GPT+Antigravity와 **동시에** Codex review 실행하여 3중 교차 검증:

```
/codex:review
```

교차 검증 테이블:

```markdown
| Issue | GPT | Antigravity | Codex | Confidence |
|-------|-----|--------|-------|------------|
| {이슈} | ✅/❌ | ✅/❌ | ✅/❌ | {%} |
```

- 3개 모델 중 2개 이상 동의 → **High Confidence** (P1 자동 수정)
- Codex만 발견 → **Medium Confidence** (P2 수동 검토)

### When to Use Race Mode

| Scenario | Recommended |
|----------|-------------|
| Critical security review | ✅ `--race security` |
| Pre-production audit | ✅ `--race` |
| Quick iteration | ❌ Standard review |
| API cost concerns | ❌ Standard review |

### Tool Invocation (Race Mode - GPT + Antigravity in parallel via Bash)

**🚨 Use --input file to avoid CLI argument length limits and Windows pipe issues.**

1. Save code to review into `[SCRATCHPAD]/review-code.txt` (using Write tool)
2. Write JSON input file `[SCRATCHPAD]/review-input.json` (using Write tool):
   - `{"prompt": "Review this code for [REVIEW_TYPE]. Return JSON: {issues: [{id, title, description, severity, suggestion}]}. Code: [CODE_CONTENT]"}`
   - Where `[CODE_CONTENT]` is the code text (properly JSON-escaped inside the prompt string)
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
