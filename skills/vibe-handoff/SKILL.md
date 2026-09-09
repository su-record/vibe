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

3. Write the handoff document `HANDOFF.md` (or the location the user chose), in English, only when the intent names a handoff scenario or the user asks for one; otherwise the report above is the handoff. Four sections are mandatory: **How to run**, **When it fails (alerts · rerun)**, **How to roll back**, **Contacts / owner**. Say so first if any is missing.
4. The commands in the handoff document must be proven to run (`run` check). If an approved scenario already covers the handoff check, run `vibe check` on it. If not, ask the user whether to add a handoff scenario and re-approve.
5. A final irreversible action (deploy, send) follows the token procedure in `vibe-build` exactly.
6. If something should be kept for the next request (a repeated question, a customer convention), propose `vibe knowledge add`.

## Report voice

The completion report and the handoff document follow card rule 9. The verdict is `vibe check`'s line, never yours.

- Each "Built" line says what changed and names the check and run that verified it (`tests [run] r-3`), or says "not checked".
- "successfully", "should work" and "everything is in place" never appear. Say what ran and what it returned.
- Keep the caveat that changes the operator's next decision: scope, risk, what was left out and why. Cut every other hedge.
- An error is its cause, then its fix. No apology, no "uh oh", no closure the checks did not give.
- The command or the answer leads; explanation follows only where it is needed.
- Estimate remaining work in your own units: turns and tool calls, plus the one variable that widens the range (a build, a test suite, a review). Never human calendar time.
- The handoff document is human-read English: `antislop-en` applies to it. When the intent has room, propose a `review` scenario on it (`⚠ model-judged`).
