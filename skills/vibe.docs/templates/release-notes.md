# Release Notes: {{PROJECT_NAME}}

---

## [{{VERSION}}] — {{RELEASE_DATE}}

> {{ONE_SENTENCE_SUMMARY_OF_THIS_RELEASE}}

### Breaking Changes

> If none, remove this section.

- **{{CHANGE_DESCRIPTION}}** — {{MIGRATION_GUIDE}}
  - Before: `{{OLD_USAGE}}`
  - After: `{{NEW_USAGE}}`

### Features

- `feat`: {{FEATURE_DESCRIPTION}} ([#{{PR_NUMBER}}]({{PR_URL}}))
- `feat`: {{FEATURE_DESCRIPTION}} ([#{{PR_NUMBER}}]({{PR_URL}}))

### Bug Fixes

- `fix`: {{BUG_DESCRIPTION}} — {{WHAT_WAS_WRONG_AND_HOW_FIXED}} ([#{{PR_NUMBER}}]({{PR_URL}}))

### Performance

- `perf`: {{IMPROVEMENT_DESCRIPTION}} — {{BEFORE}} → {{AFTER}}

### Other

- `refactor`: {{DESCRIPTION}}
- `docs`: {{DESCRIPTION}}
- `chore`: {{DESCRIPTION}}

---

## Upgrade Guide

### From {{PREVIOUS_VERSION}} to {{VERSION}}

```bash
{{UPGRADE_COMMAND}}
```

**Required config changes:**
1. {{CONFIG_CHANGE_1}}
2. {{CONFIG_CHANGE_2}}

---

## [{{PREVIOUS_VERSION}}] — {{PREVIOUS_DATE}}

> Past release notes continue below in reverse chronological order.

---

<!-- GENERATION NOTES (remove before publishing)

Run to generate draft:
  git log {{PREVIOUS_TAG}}..HEAD --oneline --no-merges

Classify commits:
  feat:     → Features
  fix:      → Bug Fixes
  perf:     → Performance
  refactor/docs/chore/test: → Other
  BREAKING CHANGE in footer: → Breaking Changes

Version bump guidance:
  Breaking changes → major (x.0.0)
  New features      → minor (0.x.0)
  Bug fixes only    → patch (0.0.x)
-->
