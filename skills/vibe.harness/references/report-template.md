# Harness Diagnosis — 리포트 형식

> `vibe.harness` Step 3 이 출력하는 진단 리포트의 형식. 채점 루브릭은 SKILL.md 의
> `### 2. Score Each Axis` 가 SSOT 다 — 점수 기준을 여기에 다시 적지 않는다.

```markdown
## Harness Diagnosis (N/100)

### Score and Grade
- **Score**: N/100
- **Grade**: [S / A / B / C / D]

| Grade | Range | Description |
|-------|-------|-------------|
| S | 90-100 | Production-ready Harness |
| A | 75-89 | Well-structured, minor gaps |
| B | 60-74 | Functional but missing key elements |
| C | 40-59 | Basic setup, significant gaps |
| D | 0-39 | Minimal or no Harness |

### Axis Scores

| Axis | Score | Details |
|------|-------|---------|
| Scaffolding | /20 | [findings] |
| Context | /20 | [findings] |
| Planning | /15 | [findings] |
| Orchestration | /15 | [findings] |
| Verification | /15 | [findings] |
| Compounding | /15 | [findings] |

### Top 3 Improvements

1. **[lowest axis]**: [specific action with command]
2. **[second lowest]**: [specific action with command]
3. **[third lowest]**: [specific action with command]

### Auto-Fixable Items

The following can be improved immediately:
1. [ ] `/vibe.scaffold` — generate missing project directories
2. [ ] `vibe init` — initialize AI configuration
3. [ ] `vibe update` — regenerate CLAUDE.md from project analysis

Proceed with auto-fix? (y/n)
```
