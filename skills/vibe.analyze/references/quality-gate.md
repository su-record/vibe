# Analyze Quality Gate — Full Reference

> Loaded by vibe.analyze SKILL.md for the mode-specific weighted checklists, score calculation, depth levels, forbidden-patterns table, and quality thresholds.

### Mode-Specific Checklists

**Code/Feature Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| Completeness | All related files identified | 20% |
| Completeness | All API endpoints documented | 15% |
| Completeness | All data models mapped | 15% |
| Accuracy | File paths verified to exist | 10% |
| Accuracy | Line numbers accurate | 10% |
| Depth | Business logic explained | 10% |
| Depth | Dependencies mapped | 10% |
| Actionability | Next steps clearly defined | 10% |

**Document Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| Completeness | Full document read | 20% |
| Completeness | All key concepts extracted | 20% |
| Structure | Section structure identified | 15% |
| Depth | Project relevance analyzed | 15% |
| Depth | Gap analysis performed | 15% |
| Actionability | Specific follow-up actions suggested | 15% |

**Website Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| Completeness | HTML fetched and parsed | 15% |
| Tech | Tech stack identified | 15% |
| UX | UX/UI patterns analyzed | 15% |
| SEO | SEO elements inspected | 15% |
| A11y | Accessibility checked | 15% |
| Performance | Performance hints analyzed | 10% |
| Actionability | Improvements suggested | 15% |

### Score Calculation

```
Score = sum(checked items * weight) / 100

Grades:
- 95-100: EXCELLENT — comprehensive analysis
- 90-94:  GOOD — minor gaps, additional exploration recommended
- 80-89:  FAIR — needs deeper exploration
- 0-79:   POOR — incomplete, re-analyze
```

### Depth Levels

| Level | Scope | Output |
|-------|-------|--------|
| L1: Surface | File names, basic structure | File list |
| L2: Structure | Functions, classes, imports | Structure map |
| L3: Logic | Business logic, data flow | Flow analysis |
| L4: Deep | Edge cases, dependencies, risks | Full analysis |

**Minimum**: L3 for feature analysis, L2 for project overview.

### Forbidden Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| "and more..." | Incomplete | List all items |
| "etc." | Vague | Be specific |
| "related files" without paths | Missing detail | Provide file paths |
| Missing line numbers | Hard to navigate | Use `:L10-50` format |
| No auth info on endpoints | Security gap | Always specify auth |

### Quality Thresholds

**Code (`--code`):**

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Avg Complexity | ≤10 | 11-15 | >15 |
| Max Function Length | ≤30 | 31-50 | >50 |
| High Complexity Files | 0 | 1-3 | >3 |
| Circular Dependencies | 0 | 1 | >1 |

**Dependencies (`--deps`):**

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Outdated Packages | 0-3 | 4-10 | >10 |
| Security Vulnerabilities | 0 | 1-2 (low) | Any high/critical |
| Major Version Behind | 0 | 1-2 | >2 |
