# TODO Board: {{PROJECT_OR_FEATURE_NAME}}

**Updated**: {{DATE}}
**Branch**: {{GIT_BRANCH}}
**Total open**: {{TOTAL_OPEN}} | P1: {{P1_COUNT}} | P2: {{P2_COUNT}} | P3: {{P3_COUNT}}

---

## P1 — Blocks Merge ({{P1_COUNT}} open)

> All P1 items must be resolved before this branch can be merged.

| ID | Title | File:Line | Assigned | Status |
|----|-------|-----------|----------|--------|
| P1-{{ID_1}} | {{TITLE_1}} | `{{FILE_1}}:{{LINE_1}}` | {{ASSIGNEE_1}} | {{STATUS_1}} |
| P1-{{ID_2}} | {{TITLE_2}} | `{{FILE_2}}:{{LINE_2}}` | {{ASSIGNEE_2}} | {{STATUS_2}} |

{{#if P1_EMPTY}}
_No P1 items. Merge is unblocked._
{{/if}}

---

## P2 — Fix Before PR ({{P2_COUNT}} open)

> P2 items should be resolved before PR review. Warning only — does not block merge.

| ID | Title | File:Line | Assigned | Status |
|----|-------|-----------|----------|--------|
| P2-{{ID_1}} | {{TITLE_1}} | `{{FILE_1}}:{{LINE_1}}` | {{ASSIGNEE_1}} | {{STATUS_1}} |
| P2-{{ID_2}} | {{TITLE_2}} | `{{FILE_2}}:{{LINE_2}}` | {{ASSIGNEE_2}} | {{STATUS_2}} |

---

## P3 — Backlog ({{P3_COUNT}} open)

> P3 items do not block merge. Address during scheduled cleanup sessions.

| ID | Title | File:Line | Notes |
|----|-------|-----------|-------|
| P3-{{ID_1}} | {{TITLE_1}} | `{{FILE_1}}:{{LINE_1}}` | {{NOTES_1}} |
| P3-{{ID_2}} | {{TITLE_2}} | `{{FILE_2}}:{{LINE_2}}` | {{NOTES_2}} |

---

## Completed (archived)

| ID | Title | Resolved | PR/Commit |
|----|-------|----------|-----------|
| {{DONE_ID_1}} | {{DONE_TITLE_1}} | {{DONE_DATE_1}} | {{DONE_REF_1}} |

---

## Merge Checklist

- [ ] P1 count = 0
- [ ] P2 items reviewed (resolved or documented)
- [ ] index.md reflects current state
- [ ] Completed items archived to `done/`
