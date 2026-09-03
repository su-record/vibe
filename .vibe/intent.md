# vibe 4 · phase 1 — CLI core + Claude Code

## Why
vibe 3 rested its verdicts on the model's self-report and tried to teach quality with sixty thousand lines of instructions. vibe 4 keeps only five harness duties — verdict, memory, permission, ledger, speaking first — and makes itself its own first user.

## What counts as success
- Build and tests pass as `run` checks executed by the harness.
- The always-on card stays within 1KB.
- Source stays within 5,000 lines.
- Tests prove the model cannot make DONE without `check`.
- Tests prove APPROVED cannot happen without a human token.

## Constraints
- Dependencies: yaml and ajv only. Zero agents, six common skills.
- State lives in `.vibe/` as plain files. The model never writes evidence (only the CLI does).
- Every record is English; the model talks to the user in the user's language.
