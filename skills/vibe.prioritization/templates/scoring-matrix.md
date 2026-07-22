# Prioritization Scoring Matrix Template

## Project / Sprint: {{PROJECT_OR_SPRINT_NAME}}

**Framework selected**: {{FRAMEWORK}} (RICE / ICE / MoSCoW / Opportunity Score)
**Date**: {{DATE}}
**Scored by**: {{SCORER_NAMES}}

---

## RICE Scoring Matrix

| Item | Reach (users/mo) | Impact (0–1) | Confidence (%) | Effort (person-mo) | RICE Score | Priority |
|------|-----------------|--------------|----------------|--------------------|------------|----------|
| {{ITEM_1}} | {{R}} | {{I}} | {{C}} | {{E}} | `=(R×I×C)/E` | — |
| {{ITEM_2}} | {{R}} | {{I}} | {{C}} | {{E}} | `=(R×I×C)/E` | — |
| {{ITEM_3}} | {{R}} | {{I}} | {{C}} | {{E}} | `=(R×I×C)/E` | — |

---

## ICE Scoring Matrix

| Item | Impact (1–10) | Confidence (1–10) | Ease (1–10) | ICE Score | Priority |
|------|---------------|-------------------|-------------|-----------|----------|
| {{ITEM_1}} | {{I}} | {{C}} | {{E}} | `=I×C×E` | — |
| {{ITEM_2}} | {{I}} | {{C}} | {{E}} | `=I×C×E` | — |
| {{ITEM_3}} | {{I}} | {{C}} | {{E}} | `=I×C×E` | — |

---

## MoSCoW Categorization

| Item | Category | Rationale | Owner |
|------|----------|-----------|-------|
| {{ITEM_1}} | Must / Should / Could / Won't | {{REASON}} | {{OWNER}} |
| {{ITEM_2}} | Must / Should / Could / Won't | {{REASON}} | {{OWNER}} |
| {{ITEM_3}} | Must / Should / Could / Won't | {{REASON}} | {{OWNER}} |

**Must count**: {{X}} / {{TOTAL}} — keep Must ≤ 60% of total scope.

---

## Opportunity Score Matrix

| Customer Need | Importance (0–1) | Satisfaction (0–1) | Opportunity Score | Action |
|--------------|------------------|---------------------|-------------------|--------|
| {{NEED_1}} | {{I}} | {{S}} | `=I×(1-S)` | Invest / Monitor / Maintain |
| {{NEED_2}} | {{I}} | {{S}} | `=I×(1-S)` | Invest / Monitor / Maintain |
| {{NEED_3}} | {{I}} | {{S}} | `=I×(1-S)` | Invest / Monitor / Maintain |

Score > 0.5 = strong opportunity. Score < 0.1 = already solved.

---

## Final Ranked Backlog

| Rank | Item | Framework Score | Decision | Notes |
|------|------|-----------------|----------|-------|
| 1 | {{ITEM}} | {{SCORE}} | Build / Defer / Drop | {{NOTES}} |
| 2 | {{ITEM}} | {{SCORE}} | Build / Defer / Drop | {{NOTES}} |
| 3 | {{ITEM}} | {{SCORE}} | Build / Defer / Drop | {{NOTES}} |

---

## Scoring Notes

- {{ASSUMPTION_OR_CAVEAT_1}}
- {{ASSUMPTION_OR_CAVEAT_2}}
- Next review date: {{REVIEW_DATE}}
