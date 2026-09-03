---
name: rice-scoring
type: framework
applies-to: [create-prd]
---

# RICE Scoring — Reference Card

## Formula

```
RICE Score = (Reach × Impact × Confidence) / Effort
```

## Factor Definitions

### Reach
How many users affected per time period (e.g., per quarter)?

| Scale | Example |
|-------|---------|
| 1,000 | Affects ~1,000 users/quarter |
| 5,000 | Affects ~5,000 users/quarter |
| 50,000 | Affects most of the user base |

Use actual user counts when available. Use relative estimates otherwise.

### Impact
How much does this move the needle for each user?

| Score | Meaning |
|-------|---------|
| 3 | Massive — core workflow improvement |
| 2 | High — significant UX enhancement |
| 1 | Medium — noticeable improvement |
| 0.5 | Low — minor convenience |
| 0.25 | Minimal — rarely noticed |

### Confidence
How confident are you in the Reach and Impact estimates?

| Score | Meaning |
|-------|---------|
| 100% | Data-backed (user research, analytics) |
| 80% | Some evidence (interviews, comparable features) |
| 50% | Gut feeling, limited data |
| 20% | Pure hypothesis, no data |

### Effort
Total person-weeks to design, build, and ship.

| Score | Meaning |
|-------|---------|
| 0.5 | Half a week or less |
| 1 | About 1 week |
| 2 | ~2 weeks |
| 5 | ~1 month |
| 10 | Multi-month project |

## Calculation Examples

| Feature | Reach | Impact | Confidence | Effort | RICE Score |
|---------|-------|--------|------------|--------|------------|
| One-click checkout | 8,000 | 3 | 80% | 3 | **6,400** |
| Dark mode toggle | 5,000 | 0.5 | 50% | 1 | **1,250** |
| Export to CSV | 2,000 | 2 | 100% | 0.5 | **8,000** |
| AI search | 10,000 | 2 | 50% | 10 | **1,000** |

Higher score = higher priority.

## Prioritization Tiers

| RICE Score | Tier | Action |
|------------|------|--------|
| >5,000 | P0 — Must Ship | Schedule immediately |
| 1,000–5,000 | P1 — High Priority | Include in next cycle |
| 200–999 | P2 — Medium Priority | Backlog, revisit quarterly |
| <200 | P3 — Low Priority | Won't do / nice to have |

## When Data is Unavailable

Use relative RICE (rank order, not absolute scores):
- Assign all factors on 1–10 scale relative to each other
- Note confidence as Low/Medium/High instead of percentages
- Mark scores as estimates in PRD: `~2,400 (estimated)`

## PRD Integration

In the PRD, present RICE scores in the requirements table:

```markdown
| Story | Reach | Impact | Confidence | Effort | Score | Priority |
|-------|-------|--------|------------|--------|-------|----------|
| ...   | 5,000 | 2      | 80%        | 2      | 4,000 | P1       |
```

Always document assumptions used in scoring under the table.
