---
name: vibe-discover
description: Discover — find the customer's problem and agree on success from evidence. Ask only about consequential unknowns; stop when the scope is sufficient.
user-invocable: false
---

# Discover

## Procedure

Resolve the problem and success criteria before implementation choices. A clear request can need no interview. If the request is to find work AI can take over, read [work-opportunities.md](work-opportunities.md) for that procedure; do not load it for other tasks.

1. Use accessible evidence before asking the customer:
   - on resumption, reuse the intent's compact findings when `vibe intent show --json` reports their `sourceBasis` unchanged; re-evaluate only findings affected by changed or missing sources
   - before asking, scan `docs/`, `README*` and `*.md` for relevant rules even when the brief does not name them; read those documents before deciding what is unknown
   - when a table can resolve a relevant unknown (csv · tsv · jsonl · json · xlsx), use `vibe profile {file} --json` [`--sheet`]: columns, types, missing counts, duplicates, up to three anomalies with numbers
   - document (xlsx · docx · pptx · pdf · hwp · hwpx · html) → `vibe read {file} --json` [`--sheet` · `--pages`]; it says which reader it used (pdf: `pdftotext` when installed, else built-in)
   - long material that only needs an answer ("what does this contract require", "which sheet holds the totals") → `vibe read {files} --ask "{question}"`; a low-reasoning model reads it and only the answer enters your context
   - image → your own file reader; vibe does not read images
   - code or plain text → your file reader, the whole file — never a grep excerpt
   If a required sample is absent, name what cannot be established and request the smallest useful sample. Do not demand a sample for a task already defined and checkable without one.
2. Report relevant observed anomalies first — at most three, each with its number and source. Do not invent a profile finding, duration, saving, probability, or missing requirement.
3. Ask only when the answer changes the problem, success condition, constraint, or permitted action. Bundle at most three high-impact questions per round; explain the decision each resolves. An optional proposal is labelled as a proposal. Silence never answers a material question or authorizes an action; ask a focused follow-up if an important unknown remains. Reports belong in chat, not `vibe ask`.
4. Write the compact intent (`.vibe/intent.md`, in English), retaining source references, the customer's decisions, and explicit unknowns:

```
# {one-line title}

## Why
{the user's words, one or two sentences}

## What counts as success
- {a checkable statement} …

## Constraints
- {existing systems, data, deadlines}
```

5. Move to `vibe-scope` once the selected outcome, evidence basis, material constraints, executable acceptance conditions, and action boundaries are clear. Reuse an existing approved scope unless evidence or the requested outcome changes. Do not expand into another task just to fill a question or scenario quota.

## Message format

- Questions as a short numbered list when there is more than one; attach the decision, not an invented default.
- Anomalies start with "Looking at the sample, …" and carry the number.
- Talk to the user in the user's language; the intent file itself is English.
