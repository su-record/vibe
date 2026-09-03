---
name: vibe.discover
description: Discover — turn a vague request into "what counts as success". At most three questions, each with a default. Surface anomalies in the sample before being asked.
user-invocable: false
---

# Discover

## Procedure

1. If the user attached a sample or file, read it first and write a profile: column names, types, counts of empty values, duplicates, format mismatches. If there is no sample, ask for one that the success condition can be checked against.
2. Ask **at most three questions**, each with a default. No answer means the default applies. Every question must serve one purpose: deciding what counts as success.
3. Say the anomalies you saw in the sample (empties, duplicates, outliers) before the user asks — at most three, each backed by a number from the profile.
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
