---
name: vibe.educational-content
description: Create evidence-backed educational content from a subject, curriculum, source document, repository, product, expert interview, or demonstration. Use when Codex needs to research, design, script, verify, assess, or repurpose a lesson, course, tutorial, workshop, explainer, screencast, teaching article, presentation, worksheet, microlearning unit, or educational social content for any domain, including development and technical education. Especially useful when content needs observable learning outcomes, audience-appropriate scaffolding, practice and feedback, valid assessment, source traceability, or clear separation between verified facts and inference.
user-invocable: false
---

# Create Educational Content

Turn a subject into a publishable learning experience whose outcome can be observed. Design the learning before polishing the presentation.

## Set the contract

Infer missing low-risk details and state the assumptions. Ask only when audience, format, or publication constraints would materially change the result.

Capture:

- outcome: what the learner can do afterward
- audience: age or role, prior knowledge, motivation, language, accessibility needs
- context: self-study, classroom, onboarding, reference, campaign, or performance support
- format: lesson, article, workshop, video, course, worksheet, assessment, or short-form
- source: curriculum, document, URL, repository, expert input, dataset, or user notes
- constraints: duration, length, standards, platform, brand, deadline
- proof bar: demonstration, explanation, performance, artifact, quiz, rubric, or observation

Do not begin with a broad topic such as “teach climate change” or “teach Docker.” Rewrite it as an observable outcome such as “a learner distinguishes weather from climate using three examples” or “a frontend developer deploys a two-service Compose app and verifies health checks.”

Read [references/learning-design.md](references/learning-design.md) when selecting objectives, activities, scaffolding, or assessments.

## Choose a teaching path

Prefer a progression from concrete experience to independent performance:

1. Activate relevant prior knowledge or expose a meaningful problem.
2. Model the target performance with a concrete example.
3. Guide practice with prompts, hints, or worked steps.
4. Give feedback against explicit criteria.
5. Remove support and require independent application or transfer.

For technical tool education, the progression may be easy surface → inspectable implementation → power-user surface → automation. Use a different order when prerequisites, domain practice, or safety require it. Avoid fact or feature tours; organize around learner performance.

## Research the claim surface

Build a claim ledger before drafting. For each consequential claim record:

| Claim | Evidence | Status | Content use |
|---|---|---|---|
| What the tool does | primary docs or observed run | verified | state directly |
| Why it behaved that way | code, docs, or controlled test | verified/inferred | label inference |
| What may vary | version, OS, account, UI, network | uncertain | add caveat |

Prefer primary, authoritative, and current sources. Use multiple credible perspectives for contested subjects. Inspect target materials in full before explaining them. Never invent quotations, citations, commands, settings, UI labels, research findings, statistics, benchmark numbers, or results.

For source-video-derived work, read [references/source-method.md](references/source-method.md) to preserve the method without copying the source presentation.

## Build the learning evidence

Create the smallest realistic activity that elicits the promised outcome.

1. Record environment and prerequisites.
2. Establish the initial state.
3. Model one successful performance or worked example.
4. Give the learner a meaningful action, decision, explanation, or creation task.
5. Capture evidence with a criterion-aligned check.
6. Record one likely misconception and corrective feedback path.

For code, tools, experiments, or procedures, keep demonstrations reproducible where possible and verify actual results. For conceptual subjects, require explanation, classification, comparison, prediction, or application instead of relying only on recall. Separate paid, destructive, medical, legal, physical, or external actions from harmless learning checks and require appropriate authorization or supervision.

## Design the narrative

Use this spine:

1. **Promise** — show the concrete end state.
2. **Mental model** — explain only the concepts needed for the next action.
3. **Setup** — connect prior knowledge and define prerequisites.
4. **Model** — demonstrate the target thinking or performance.
5. **Practice** — progress through small, observable attempts.
6. **Feedback** — address a realistic misconception or failure.
7. **Assess** — elicit independent evidence of learning.
8. **Extend** — transfer the idea to a new context.
9. **Recap** — map the evidence back to the learning outcome.

Pair every explanation with evidence:

- explanation establishes what and why
- example or demonstration shows how
- learner activity elicits performance
- assessment shows whether the outcome was reached

Do not confuse exposure with learning. Watching, reading, or clicking is not sufficient evidence unless the stated objective only requires recognition. Explain decisions, relationships, constraints, and changes in understanding.

## Draft the production package

Produce only artifacts the requested format needs. Use the schemas in [references/output-patterns.md](references/output-patterns.md).

At minimum include:

- title and one-sentence learner promise
- audience and prerequisites
- outline with estimated pacing
- model, guided practice, and independent practice
- assessment, answer guidance, or scoring rubric
- evidence or capture plan
- safety and uncertainty notes
- final quality checklist

For video, add scene intent, narration, visual action, learner prompt, and evidence shot. For articles, add reflection or practice prompts and expected reasoning; add runnable code and expected output when technical. For workshops, add checkpoints, facilitator moves, and misconception recovery.

## Apply gates

Stop and repair the artifact when a gate fails.

### Accuracy gate

- Every consequential claim is verified or explicitly labeled as inference.
- Version-sensitive facts are current and sourced.
- Commands and code match the stated environment.

### Learning-evidence gate

- The activity elicits the behavior named in the objective.
- Practice includes timely, actionable feedback.
- Independent assessment does not give away the answer.
- Expected evidence and evaluation criteria are explicit.

### Teaching gate

- Each section advances the learner toward the promise.
- New concepts appear immediately before use.
- Jargon is defined once and then used consistently.
- Cognitive load fits the audience and format.
- Examples are inclusive, relevant, and free of avoidable stereotypes.

### Safety gate

- External writes, destructive actions, and high-stakes activities have an approval or supervision boundary.
- Secrets, personal data, and account details are absent from captures.
- Minor learners and sensitive subjects receive appropriate privacy and safeguarding treatment.

### Production gate

- Claims, narration, captions, visuals, activities, and assessments agree.
- No placeholder, fabricated output, or unsupported superlative remains.
- The final artifact names limitations and the next useful action.

## Handle failure

- If the source cannot be accessed, report the missing evidence and request an artifact or alternate source; do not fabricate an analysis.
- If a live tool is unavailable, use a recorded fixture and label it as simulated.
- If a technical demonstration fails, reproduce once, state one root-cause hypothesis, add a failing check, then fix.
- If learners cannot complete an activity, distinguish missing prerequisite knowledge, unclear instruction, excessive load, and a flawed assessment before adding more explanation.
- If behavior is nondeterministic, show the invariant acceptance criteria instead of promising identical output.
- If evidence is contested or culturally situated, present the source context and credible disagreement rather than manufacturing certainty.
- If the requested scope exceeds the format, preserve the core learning outcome and move depth into a follow-up resource.

## Finish

Return the production-ready artifact, the verification evidence, and a short list of assumptions or unresolved uncertainties. Keep research notes out of the final content unless they help the learner judge a claim.
