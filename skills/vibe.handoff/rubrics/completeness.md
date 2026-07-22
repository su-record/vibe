# Handoff Completeness Rubric

A HANDOFF.md is complete only when all required items are present and accurate.

## Required Sections (all must be filled)

### Status Block
- [ ] Build status is current (run `npm run build` immediately before writing)
- [ ] Test status is current (run `npx vitest run` immediately before writing)
- [ ] Branch name matches `git branch --show-current`
- [ ] Last commit hash is correct (`git log --oneline -1`)

### Completed Work
- [ ] At least one item listed (even if just "initial exploration")
- [ ] Each item is specific enough to be verifiable
- [ ] No vague entries like "worked on auth"

### In Progress
- [ ] The single task currently active is identified
- [ ] The exact next step is described (not "continue working on X")
- [ ] Any blocking question is explicitly stated or marked "none"
- [ ] At least one "where to look first" file is listed

### Remaining Tasks
- [ ] All known remaining tasks are listed
- [ ] Each task has a P1/P2/P3 priority label
- [ ] Tasks are ordered by priority

### Decisions Made
- [ ] Any architectural or design decisions from this session are recorded
- [ ] Rationale is included (not just "we decided X")
- [ ] Rejected alternatives noted where non-obvious

### Modified Files
- [ ] `git status` output or equivalent is included
- [ ] Every modified file is present (no omissions)

### Resume Instructions
- [ ] The exact command to restore context is present
- [ ] The exact point to resume from is described

## Optional but Strongly Recommended

- Known issues / workarounds (if any discovered this session)
- "Do not touch" warnings (if any fragile areas identified)
- Memory keys saved via `core_save_memory`

## Quality Bar

| Criterion | Pass |
|-----------|------|
| A new session can start without asking any clarifying questions | Required |
| The next developer can find the relevant files within 60 seconds | Required |
| Build/test status reflects reality at time of handoff | Required |
| Handoff written within 5 minutes of session end | Recommended |

## Failure Modes to Avoid

- Writing completed tasks from memory instead of `git log` — use actual git output
- Listing "in progress" without a concrete next step — be specific
- Omitting the current branch — always include
- Skipping the status block — it expires; run commands fresh
