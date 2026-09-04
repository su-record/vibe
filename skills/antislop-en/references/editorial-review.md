# Independent Editorial Review

This procedure applies to English manuscripts bound for a reporter,
columnist, chief editor or outside institution. It does not apply
automatically to routine email, memos and drafts.

## Principles

- The writer and the reviewers must be different agents. The writer does not impersonate a reviewer and self-certify.
- Do not give a reviewer the writing process, the writer's self-assessment, or the answer the writer intended.
- A reviewer does not rewrite the manuscript. It returns only the exact point of rejection, the effect on the reader, and the condition for fixing it.
- Separate style preference from defect. A stylistic difference that cannot be pinned to a location and a reader effect is not grounds for rejection.
- Every properly formatted rejection item must be fixed or escalated to a human. The writing agent may not invalidate an item or apply only some of them at its own discretion.

## Reviewers

The two reviewers live as prompts in the vibe package under `reviewers/en/`,
and the same content is installed as client agents (Claude Code:
`agents/en-copy-editor.md`, `agents/en-chief-editor.md`; Codex: TOML files
under the plugin tree).

| Stage | Reviewer | Role |
|---|---|---|
| 1st | `en-copy-editor` | Copy editor: judges sentence, usage and formatting defects |
| 2nd | `en-chief-editor` | Chief editor: judges whether the piece is fit to publish or submit |

## The harness reviews

Inside vibe, the model does not run the review itself. Bind a `review` check
to the manuscript in a scenario, and `vibe check` has the harness run the two
reviewers in sequence.

```yaml
- id: column-review
  then: the column passes the copy editor and the chief editor
  check: { type: review, path: out/column.md, contract: out/contract.md, evidence: out/evidence.md }
```

- `path` is the full manuscript under review, `contract` is the editorial contract, and `evidence` is the evidence ledger. Both can be omitted, but a manuscript for outside submission should keep both as files. If `lang` is not set, the harness infers it from the manuscript's script.
- The harness runs `reviewers/en/copy-editor.md` first, and only on a pass runs `reviewers/en/chief-editor.md`. A stage passes only when the entire response is exactly one line, `PASS`. Any response that differs from the `REJECT` list format counts as a failure, and the response is kept in evidence's `tail`.
- If the same failure repeats twice, the harness stops at STUCK and asks in the inbox. The writer fixes the `REJECT` items with the smallest possible change and reruns `vibe check`. If an item conflicts with the evidence or only enforces a preference and cannot be fixed, don't discard it — hand it to `vibe ask` along with the conflict.

## Reviewer input bundle

The harness passes each reviewer only the following. It does not include the
writing process or the writer's self-assessment.

1. Editorial contract: outlet, section, reader, purpose, length, register, formatting rules and deadline status.
2. Evidence ledger: facts, figures and quotations with sources, the author's own experience and interpretation, and what remains unconfirmed.
3. The full manuscript under review: title, body, tables, notes and sources, none omitted.

If the input bundle lacks the actual submission specification or key
evidence, the reviewer does not pretend to proceed with review — it returns
`NEEDS-HUMAN`. The harness records that as a failure too.

## Outside vibe

In an environment with this skill but no harness, launch the same two
reviewers directly as separate agents (Claude Code: the Agent tool; Codex:
spawning a subagent). Call the second only after the first returns `PASS`,
and use only completed call results for judgment. If an agent cannot be
launched, do not claim independent review took place — state that human
editorial review is needed.

## Handling delegation failure

- Use only a completed agent call's result for judgment. A background task's start response, progress logs, and an agent's self-report are not a `PASS`.
- `PASS` counts only when the entire response, after trimming surrounding whitespace, is exactly one line, `PASS`. An explanation, warning or condition appended after `PASS` is not a pass. Any other response must be a complete `REJECT` list; a tool error, timeout, empty response, truncated response, or any response with a different format all count as a review failure.
- On a review failure, rerun the same kind of review once with the same input. If the retry also fails, treat it as not having passed independent review and stop at `needs-human`.
- If a `REJECT` item is missing a required field, treat it as a format error. The writer does not guess the intended meaning and fix it anyway.

## Termination conditions

- The manuscript is final only when the first and second stages both PASS the same version in sequence.
- Any edit, even one, voids a prior PASS.
- The writer has no authority to waive a properly formatted `REJECT` item. Even a single item that cannot be fixed stops the process at `needs-human` instead of shipping a final version.
- The full revision cycle runs at most three times. If the third cycle is still `REJECT`, stop at `needs-human` with the unresolved items and the human decision needed.
- Do not comply with a reviewer's demand for a change that conflicts with the evidence. Escalate to `needs-human` with the point of conflict and the source evidence.
- Present the requested manuscript first in the final response. Include the review process and score sheet only when asked for.
