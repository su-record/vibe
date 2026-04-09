---
description: Create SPEC document — thin wrapper for vibe.spec skill
argument-hint: "feature name or plan file path"
---

# /vibe.spec

AI 실행용 PTCF 구조 SPEC 문서 생성. 대화형 요구사항 수집 → 병렬 리서치 → SPEC 작성 → 품질 게이트(95점) → `/vibe.spec.review` 핸드오프.

## Usage

```
/vibe.spec "feature-name"                    # 대화 모드 (요구사항 수집)
/vibe.spec "feature-name" ultrawork          # 자동 체인: SPEC → Review → Run
/vibe.spec ".claude/vibe/plans/{feature}.md" # 기획서 입력 (vibe.plan 결과)
/vibe.spec "docs/login-prd.md"               # 외부 파일 입력
/vibe.spec + 📎 첨부                          # 첨부 파일 활용
```

## Execution

Load skill `vibe.spec` — full SPEC creation workflow:

- Phase 0: Git branch setup (MANDATORY)
- Phase 1: Project analysis (explorer agent)
- Phase 2: Requirements gathering (conversation + askUser for critical)
- Phase 2.5: config.json references load
- Phase 3: Parallel research (4 Bash LLM calls + 4 Task agents)
- Phase 3.2: UI/UX Design Intelligence (auto-triggered for UI keywords)
- Phase 4: SPEC writing (PTCF structure, auto-split for large scope)
- Phase 5: Feature file (BDD) creation — matching SPEC structure
- Phase 6: Ambiguity scan
- Phase 7: Quality validation (95-point gate)
- Phase 8: Handoff to `/vibe.spec.review`

**ultrawork mode** auto-chains:

```
/vibe.spec "{feature}" ultrawork
    ↓ SPEC complete
/vibe.spec.review "{feature}"
    ↓ Review passes
/vibe.run "{feature}" ultrawork
```

No manual intervention between steps.

## Output

- `.claude/vibe/specs/{feature-name}.md` (single) or `.claude/vibe/specs/{feature-name}/_index.md` (split)
- `.claude/vibe/features/{feature-name}.feature` (single) or `.claude/vibe/features/{feature-name}/_index.feature` (split)

## Next Step

```
/vibe.spec.review "{feature-name}"
# or (ultrawork mode) → auto-chains to /vibe.run
```

---

ARGUMENTS: $ARGUMENTS
