---
description: SPEC Quality Review — thin wrapper for vibe.spec.review skill
argument-hint: "feature name"
---

# /vibe.spec.review

기존 SPEC을 GPT/Gemini 교차 검증으로 리뷰/보강. 품질 게이트(95점) → Race Review(최대 3라운드, 수렴 감지) → (옵션) Codex adversarial → Review Debate Team → 사용자 최종 체크포인트.

## Usage

```
/vibe.spec.review "feature-name"          # 표준 모드 (최대 3라운드)
/vibe.spec.review "feature-name" --quick  # 빠른 모드 (1라운드만)
```

**Prerequisites:**

- SPEC file: `.claude/vibe/specs/{feature-name}.md` (single) or `.claude/vibe/specs/{feature-name}/_index.md` (split)
- Feature file: `.claude/vibe/features/{feature-name}.feature` (single) or `.claude/vibe/features/{feature-name}/_index.feature` (split)

**Recommended**: Run in a `/new` session after `/vibe.spec` when context > 50%.

## Execution

Load skill `vibe.spec.review` — full review workflow:

- Step 1: Load SPEC files (single/split detection, explorer-medium for large)
- Step 2: Quality Validation (95-point gate, max 3 auto-fix iterations)
- Step 3: Race Review (GPT + Gemini parallel, max 3 rounds with convergence early-exit)
- Step 3.1: Codex Adversarial Review (if Codex plugin available)
- Step 3.5: Review Debate Team (if 2+ P1/P2 issues found)
- Step 4: Final summary
- Step 5: SPEC summary for user review + final checkpoint

**Codex detection** runs automatically at start:

```bash
CODEX_AVAILABLE=$(node "{{VIBE_PATH}}/hooks/scripts/codex-detect.js" 2>/dev/null || echo "unavailable")
```

## Output

- Updated `.claude/vibe/specs/{feature-name}.md` (or split folder)
- Updated `.claude/vibe/features/{feature-name}.feature` (or split folder)
- Quality score ≥ 95
- User-facing SPEC summary

## Next Step

```
/vibe.run "{feature-name}"
```

---

ARGUMENTS: $ARGUMENTS
