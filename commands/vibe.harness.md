---
description: Diagnose project Harness Engineering maturity across 6 axes
argument-hint: (no arguments)
---

# /vibe.harness

Diagnose project Harness Engineering maturity across 6 axes and suggest targeted improvements.

> Harness = the working environment that enables AI to operate effectively on its own.
> Encompasses context, constraints, workflows, verification, and compounding — not just guardrails.

## Process

### 1. Collect Project State (Parallel Agents)

Dispatch 3 explorer agents in a single message:

```text
Agent(subagent_type="explorer-low", model="haiku",
  prompt="Check project scaffolding: 1) Does docs/ exist with business documents? 2) Does .dev/ exist for AI logs? 3) Is src/ organized by role (not flat)? 4) Is tests/ separate from src/? 5) List top-level directory structure.")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Check project context and boundaries: 1) Does CLAUDE.md exist? How many lines? 2) Does .claude/rules/ or .claude/vibe/ exist? How many rule files? 3) Does .claude/settings.local.json exist with hooks? 4) Does .claude/vibe/config.json exist? 5) Are there any .claude/skills/ directories?")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Check project planning, execution, and verification: 1) Are there SPEC files in .claude/vibe/specs/? 2) Are there Feature (BDD) files in .claude/vibe/features/? 3) Are there test files? How many? 4) Is there CI config (.github/workflows, etc.)? 5) Are there .dev/learnings/ files?")
```

### 2. Score Each Axis

#### Axis 1: Scaffolding — /20

| Item | Criteria | Points |
|------|----------|--------|
| Role-based folders | src/ subdivided by role (components/, services/, models/, etc.) | /5 |
| docs/ exists | Business document directory with content | /4 |
| .dev/ exists | AI work log directory | /3 |
| tests/ separated | Tests not co-located with source files | /3 |
| .gitignore complete | Includes out/, .dev/scratch/, settings.local.json | /2 |
| Layer separation | Domain/service/infra or similar architectural layers | /3 |

#### Axis 2: Context — /20

| Item | Criteria | Points |
|------|----------|--------|
| CLAUDE.md exists | Serves as project map | /5 |
| CLAUDE.md is concise | ~100 lines or fewer, pointer-based | /3 |
| Rules defined | Coding rules and test conventions in .claude/rules/ or similar | /4 |
| Progressive disclosure | Skill tier separation or rules loaded via glob patterns | /3 |
| docs/ referenced | CLAUDE.md references docs/ for business context | /3 |
| Language rules | Stack-specific coding standards defined | /2 |

#### Axis 3: Planning — /15

| Item | Criteria | Points |
|------|----------|--------|
| SPEC workflow | System for generating spec/feature files | /5 |
| Requirements gathering | Interview or requirements collection process exists | /4 |
| Approval gates | Confirmation step between planning and implementation | /3 |
| Templates | SPEC/Feature templates available | /3 |

#### Axis 4: Orchestration — /15

| Item | Criteria | Points |
|------|----------|--------|
| Agents or skills | Specialized agents or skills defined | /5 |
| Team composition | Agent teams (architect + implementer + tester, etc.) | /4 |
| Permission model | Per-agent permission separation (read-only vs write) | /3 |
| Non-code workflows | Support for documentation, research, and other non-code tasks | /3 |

#### Axis 5: Verification — /15

| Item | Criteria | Points |
|------|----------|--------|
| Automated quality checks | PostToolUse hooks for code inspection | /4 |
| Tests exist | Test files present and executable | /4 |
| CI/CD | Automated build/test pipeline configured | /4 |
| Traceability | SPEC → code → test mapping (RTM) | /3 |

#### Axis 6: Compounding — /15

| Item | Criteria | Points |
|------|----------|--------|
| Learnings recorded | Troubleshooting records in .dev/learnings/ | /4 |
| Pattern accumulation | Repeated tasks codified as skills or rules | /4 |
| Auto-improvement | Evolution Engine or similar self-improvement mechanism | /4 |
| Memory | Cross-session learning persistence mechanism | /3 |

### 3. Generate Report

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

### 4. Save Report

Save results to `.claude/vibe/reports/harness-{date}.md` for historical tracking.

### 5. Self-Repair Chain

After scoring, if actionable gaps are detected:

| Condition | Auto-Suggestion |
|-----------|-----------------|
| Scaffolding < 10/20 | Suggest `/vibe.scaffold` to generate missing directories |
| Context < 10/20 | Suggest `vibe update` to regenerate CLAUDE.md |
| Planning < 8/15 | Suggest `/vibe.spec` to establish SPEC workflow |
| Verification < 8/15 | Suggest `vibe init` to install quality hooks |
| Compounding < 8/15 | Suggest creating `.dev/learnings/` and enabling evolution engine |

If user approves auto-fix, execute the suggested commands in sequence, then re-run `/vibe.harness` to verify improvement.

---

## Principles

1. **Score honestly** — never inflate scores
2. **Suggest specific actions** — executable commands, not vague advice like "improve structure"
3. **Focus on top 3** — don't try to fix everything at once
4. **Track over time** — enable score comparison across runs via saved reports

---

ARGUMENTS: $ARGUMENTS
