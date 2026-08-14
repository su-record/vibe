# Output patterns

Select one primary pattern and omit unused fields.

## Article or tutorial

```markdown
# Title: learner-visible outcome
Audience:
Prerequisites:
Tested with:

## What you will build
## Mental model
## Worked example
## Step 1 — action
Exact input:
Expected result:
Verification:
## Common failure and recovery
## Independent practice
## Assessment and answer guidance
## Extension
## Recap
## Sources and limitations
```

## Screencast or course chapter

| Time | Learning beat | Narration intent | Visual action | Learner prompt | Evidence shot | Asset |
|---|---|---|---|---|---|---|
| 00:00 | Promise | Name the outcome | Show final state | Predict or notice | Working result | capture |

Add a capture manifest:

```yaml
- id: proof-final
  state: exact prerequisite state
  action: command, prompt, or UI action
  evidence: expected visible result
  privacy: crop or redact requirements
  retry: recovery action
```

## Lesson or workshop

```markdown
Outcome:
Duration:
Starting repository/state:
Prior-knowledge check:

Checkpoint 1:
- learner action
- facilitator proof
- likely misconception
- feedback or recovery

Independent task:
Acceptance criteria:
Answer guidance or rubric:
Cleanup or rollback:
```

## Short-form educational content

```markdown
Hook: surprising observable result
Context: one sentence
Teach: one model, contrast, or no more than three actions
Retrieve: one prediction, decision, or recall prompt
Proof: answer, demonstration, or comparison
Caveat: scope, evidence, safety, or limitation
CTA: reproducible next step, not engagement bait
```

## Assessment item

```yaml
objective: "observable learning outcome"
prompt: "task that elicits the outcome"
evidence: "what a valid response must demonstrate"
criteria:
  - name: "criterion"
    levels: ["not yet", "developing", "meets", "extends"]
answer_guidance: "reasoning and acceptable variants"
misconceptions:
  - signal: "common wrong pattern"
    feedback: "specific corrective prompt"
fairness_check: "language, accessibility, cultural, or prerequisite issue"
```

## Verification appendix

```yaml
environment:
  context: ""
  versions: []
claims:
  - claim: ""
    status: verified | inferred | uncertain
    evidence: ""
    checked_at: "YYYY-MM-DD"
checks:
  - learner_action: ""
    expected: ""
    observed: ""
unresolved: []
```
