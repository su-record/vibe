# Design Token Consistency Audit: {{TARGET}}

**Date**: {{DATE}}
**Token Source**: {{TOKEN_SOURCE}} (MASTER.md / design-context.json / auto-detected)
**Scope**: {{SCOPE_DESCRIPTION}}

---

## Token Coverage Summary

| Category | Total Found | Tokenized | Hardcoded | Coverage % |
|----------|-------------|-----------|-----------|------------|
| Colors | {{COLOR_TOTAL}} | {{COLOR_TOKEN}} | {{COLOR_HARD}} | {{COLOR_PCT}}% |
| Typography sizes | {{TYPO_TOTAL}} | {{TYPO_TOKEN}} | {{TYPO_HARD}} | {{TYPO_PCT}}% |
| Spacing | {{SPACE_TOTAL}} | {{SPACE_TOKEN}} | {{SPACE_HARD}} | {{SPACE_PCT}}% |
| Border radius | {{RADIUS_TOTAL}} | {{RADIUS_TOKEN}} | {{RADIUS_HARD}} | {{RADIUS_PCT}}% |
| Shadows | {{SHADOW_TOTAL}} | {{SHADOW_TOKEN}} | {{SHADOW_HARD}} | {{SHADOW_PCT}}% |
| **Overall** | **{{GRAND_TOTAL}}** | **{{GRAND_TOKEN}}** | **{{GRAND_HARD}}** | **{{GRAND_PCT}}%** |

---

## Hardcoded Values Found

### Colors

| File | Line | Value | Nearest Token | Action |
|------|------|-------|---------------|--------|
{{#COLOR_FINDINGS}}
| `{{FILE}}` | {{LINE}} | `{{VALUE}}` | `{{TOKEN}}` | {{ACTION}} |
{{/COLOR_FINDINGS}}
{{#NO_COLOR_FINDINGS}}
| — | — | None found | — | — |
{{/NO_COLOR_FINDINGS}}

### Typography

| File | Line | Value | Nearest Token | Action |
|------|------|-------|---------------|--------|
{{#TYPO_FINDINGS}}
| `{{FILE}}` | {{LINE}} | `{{VALUE}}` | `{{TOKEN}}` | {{ACTION}} |
{{/TYPO_FINDINGS}}
{{#NO_TYPO_FINDINGS}}
| — | — | None found | — | — |
{{/NO_TYPO_FINDINGS}}

### Spacing

| File | Line | Value | Nearest Token | Action |
|------|------|-------|---------------|--------|
{{#SPACE_FINDINGS}}
| `{{FILE}}` | {{LINE}} | `{{VALUE}}` | `{{TOKEN}}` | {{ACTION}} |
{{/SPACE_FINDINGS}}
{{#NO_SPACE_FINDINGS}}
| — | — | None found | — | — |
{{/NO_SPACE_FINDINGS}}

---

## New Tokens Suggested

These values appear 3+ times with no matching token. Candidates for addition to MASTER.md.

| Suggested Token Name | Value | Usage Count | Category |
|----------------------|-------|-------------|----------|
{{#SUGGESTED_TOKENS}}
| `{{NAME}}` | `{{VALUE}}` | {{COUNT}} | {{CATEGORY}} |
{{/SUGGESTED_TOKENS}}
{{#NO_SUGGESTED_TOKENS}}
| — | — | — | — |
{{/NO_SUGGESTED_TOKENS}}

---

## Skipped (Intentional / Not Replaceable)

{{#SKIPPED}}
- `{{FILE}}:{{LINE}}` — `{{VALUE}}` — {{REASON}}
{{/SKIPPED}}
{{#NO_SKIPPED}}
- None
{{/NO_SKIPPED}}

---

## Next Steps

1. {{#HAS_SUGGESTED_TOKENS}}Add suggested tokens to MASTER.md, then re-run `/design-normalize`{{/HAS_SUGGESTED_TOKENS}}
2. {{#HAS_HARDCODED}}Run `/design-normalize` to apply replacements{{/HAS_HARDCODED}}
3. {{#ALL_TOKENIZED}}Token coverage complete — proceed to `/design-polish`{{/ALL_TOKENIZED}}
