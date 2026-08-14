---
name: vibe.harness
description: 프로젝트의 Claude Code·Codex 하네스 품질과 병목을 진단하거나 6축 성숙도 점수가 필요할 때 사용한다.
argument-hint: (no arguments)
user-invocable: true
---

# /vibe.harness

## 완료 기준

- [ ] 6개 평가 축에 각각 점수와 파일 근거가 있다.
- [ ] 적용할 수 없는 하네스 항목은 감점 대신 N/A로 기록되어 있다.
- [ ] P1 finding마다 검사 명령 또는 파일 위치가 있다.
- [ ] harness 보고서가 지정 경로에 존재한다.

Diagnose project Harness Engineering maturity across 6 axes and suggest targeted improvements.

> Harness = the working environment that enables AI to operate effectively on its own.
> Encompasses context, constraints, workflows, verification, and compounding — not just guardrails.

## Step 0: Detect Project Type

Before scoring, read `CLAUDE.md` and `package.json` to determine project type:

| Type | Signal | Effect |
|------|--------|--------|
| **Application** (webapp, api, fullstack, mobile) | `type` in config, app-like structure | Full rubric applies |
| **Package/Library** | `"main"` or `"exports"` in package.json, "npm package" in CLAUDE.md | Skip docs/, .dev/ items (mark N/A), adjust total denominator |
| **Monorepo** | `workspaces` in package.json, `apps/` or `packages/` dirs | Score each workspace separately |

When items are N/A, **remove their points from the total** rather than scoring 0. A library scoring 65/80 (N/A items excluded) = 81%, not 65%.

---

## Process

### 1. Collect Project State (Parallel Delegation)

Delegate the three independent inspections through the harness's native
collaboration capability. Claude Code maps each worker to Task/Agent; Codex
maps each worker to native collaboration. Inherit the session model by default
and dispatch concurrently when capacity permits:

```text
- Worker: check scaffolding, docs/.dev presence, source organization, test separation, and top-level structure.
- Worker: check `CLAUDE.md`/`AGENTS.md`, harness rules, lifecycle configuration, `.vibe/config.json`, and installed skills.
- Worker: check SPEC/Feature files, tests, CI configuration, and learning records.
```

### 2. Score Each Axis

#### Axis 1: Scaffolding — /20

| Item | Criteria | Points |
|------|----------|--------|
| Role-based folders | src/ subdivided by role (components/, services/, models/, etc.) | /5 |
| docs/ exists | Business document directory with content (N/A for packages/libraries) | /4 |
| .dev/ exists | AI work log directory (N/A for packages/libraries) | /3 |
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
| Parallel composition | Parallel native subagents (architect + implementer + tester, etc.) | /4 |
| Permission model | Per-agent permission separation (read-only vs write) | /3 |
| Non-code workflows | Support for documentation, research, and other non-code tasks | /3 |

#### Axis 5: Verification — /15

| Item | Criteria | Points |
|------|----------|--------|
| Automated quality checks | Explicit lint/type/test/JUDGE commands; lifecycle hooks may accelerate them | /4 |
| Tests exist | Test files present and executable | /4 |
| CI/CD | Automated build/test pipeline configured | /4 |
| Traceability | SPEC → code → test mapping (RTM) | /3 |

#### Axis 6: Compounding — /15

| Item | Criteria | Points |
|------|----------|--------|
| Learnings recorded | Troubleshooting records in .dev/learnings/ (N/A for packages/libraries) | /4 |
| Pattern accumulation | Repeated tasks codified as skills or rules | /4 |
| Auto-improvement | Evolution Engine or similar self-improvement mechanism | /4 |
| Memory | Cross-session learning persistence mechanism | /3 |

### 3. Generate Report

형식: `references/report-template.md` (Step 3 호출 시에만 읽는다).

### 4. Save Report

Save results to `.vibe/reports/harness-{date}.md` for historical tracking.

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
