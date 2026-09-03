---
name: vibe.discover
description: Discover — turn a vague request into "what counts as success". At most three questions, each with a default. Surface anomalies in the sample before being asked.
user-invocable: false
---

# Discover

## Procedure

1. If the user attached a sample or file, run `vibe profile {file} --json` first (csv · tsv · jsonl · json; ask for a CSV export of a spreadsheet). It returns columns, types, missing counts, duplicates and up to three anomalies with numbers. If there is no sample, ask for one that the success condition can be checked against.
2. Ask **at most three questions**, each with a default. No answer means the default applies. Every question must serve one purpose: deciding what counts as success.
3. Say the profile's anomalies before the user asks — at most three, each with its number. Do not add anomalies the profile did not find.
4. With the answers, write the intent draft (`.vibe/intent.md`, in English):

```
# {one-line title}

## Why
{the user's words, one or two sentences}

## What counts as success
- {a checkable statement} …

## Constraints
- {existing systems, data, deadlines}
```

5. Once at least one success condition is a checkable statement, move to `vibe.scope`.

## Message format

- Questions as a numbered list, each ending with `(default: …)`.
- Anomalies start with "Looking at the sample, …" and carry the number.
- Talk to the user in the user's language; the intent file itself is English.
