---
name: vibe-handoff
description: Report and hand off — say what was built and which checks passed when, and leave a document the operator can run alone. The harness actually runs the commands in that document.
user-invocable: false
---

# Report + handoff

## Procedure

1. Confirm `vibe state --json` is DONE. Otherwise go back to `vibe-prove`.
2. Write the completion report (to the user, in the user's language):

```
Done: {intent title}
- Built: {one line per file/feature}
- Checks passed: {id} [{type}] {at} …   (evidence: vibe evidence {run})
- Left for human confirmation: {human scenarios and inbox ids}
- Deliberately not done: {…}
- Proposals: {from `vibe state --json` proposals[] — e.g. an operator skill for an irreversible step, at most 3}
```

3. Write the handoff document `HANDOFF.md` (or the location the user chose), in English. Four sections are mandatory: **How to run**, **When it fails (alerts · rerun)**, **How to roll back**, **Contacts / owner**. Say so first if any is missing.
4. The commands in the handoff document must be proven to run (`run` check). If an approved scenario already covers the handoff check, run `vibe check` on it. If not, ask the user whether to add a handoff scenario and re-approve.
5. A final irreversible action (deploy, send) follows the token procedure in `vibe-build` exactly.
6. If something should be kept for the next request (a repeated question, a customer convention), propose `vibe knowledge add`.
