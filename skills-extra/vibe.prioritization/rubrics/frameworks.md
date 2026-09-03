# Prioritization Frameworks Rubric

## RICE

**Formula**: `(Reach × Impact × Confidence) / Effort`

| Factor | Scale | Example |
|--------|-------|---------|
| Reach | Users/month (absolute) | 5,000 users |
| Impact | Opportunity Score 0.0–1.0 | 0.7 |
| Confidence | 0–100% | 80% = 0.8 |
| Effort | Person-months | 2 |

**Example**: `(5000 × 0.7 × 0.8) / 2 = 1400` — higher score = prioritize first.

**When to use**: Large teams with data. Separates audience size (Reach) from value per user (Impact).

**Watch out for**: Effort estimates are often optimistic — apply a 1.5x buffer.

---

## ICE

**Formula**: `Impact × Confidence × Ease`

| Factor | Scale | Example |
|--------|-------|---------|
| Impact | 1–10 (or Opportunity Score × Users) | 8 |
| Confidence | 1–10 | 7 |
| Ease | 1–10 (inverse of effort) | 5 |

**Example**: `8 × 7 × 5 = 280` — higher score = prioritize first.

**When to use**: Quick ranking of ideas/initiatives. Faster than RICE, good for early-stage decisions.

**Watch out for**: "Ease" is subjective — calibrate across team before scoring.

---

## MoSCoW

**Categories**:

| Category | Meaning | Guideline |
|----------|---------|-----------|
| **Must** | Cannot launch without | Max 60% of scope |
| **Should** | High value, not critical | Next priority after Must |
| **Could** | Nice to have | Include only if capacity allows |
| **Won't** | Explicitly deferred | Documents what is NOT in scope |

**When to use**: Scoping a release. Good for stakeholder alignment conversations.

**Watch out for**: Stakeholders inflate "Must" — challenge each Must with "What happens if we skip this for V1?". MoSCoW is a scoping tool, not a discovery tool.

---

## Opportunity Score

**Formula**: `Importance × (1 − Satisfaction)` (normalize both to 0–1 scale)

**Example**:
- Importance: 0.9, Satisfaction: 0.3 → Score: `0.9 × 0.7 = 0.63` (high opportunity)
- Importance: 0.9, Satisfaction: 0.9 → Score: `0.9 × 0.1 = 0.09` (already solved)

**When to use**: Prioritizing customer problems before deciding on solutions. Prevents building features customers already find satisfactory.

**Watch out for**: Survey sample must be representative. Low sample size inflates confidence.

---

## Choosing the Right Framework

| Situation | Recommended Framework |
|-----------|----------------------|
| "Which customer problems matter most?" | Opportunity Score |
| "Which features should we build this sprint?" | ICE |
| "How do we rank initiatives across a large team?" | RICE |
| "What goes into V1 vs. later?" | MoSCoW |
| "Stakeholders disagree on priorities?" | Weighted Decision Matrix |
