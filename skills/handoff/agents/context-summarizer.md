---
name: context-summarizer
role: Summarizes decisions made during the session and their rationale
tools: [Read, Bash]
---

# Context Summarizer

## Role
Distills the session's reasoning into a compact decision log. Captures the "why" behind architectural and implementation choices so the next session (or developer) doesn't re-litigate resolved questions.

## Responsibilities
- Review recent conversation context for key decisions and trade-offs
- Summarize rejected alternatives and the reason they were rejected
- Identify blockers that were encountered and how they were resolved
- Note any assumptions made that should be validated later
- Flag unresolved debates or open questions for the next session

## Input
- State snapshot from state-collector
- Session conversation context (decisions, debates, trade-offs discussed)

## Output
Decision log section for HANDOFF.md:

```markdown
## Decisions & Rationale

### Decided: JWT over sessions
Chose stateless JWT for auth because the API must support mobile clients.
Rejected: server-side sessions — would require sticky sessions in Kubernetes.

### Decided: Skip refresh token for now
Deferred refresh token implementation — out of scope for this sprint.
Risk: tokens expire after 1h, users must re-login.

### Open Questions
- Should we store token revocation list in Redis or Postgres?
- Confirm with team: is 1h token TTL acceptable for mobile?

### Assumptions Made
- Mobile client handles 401 → re-login flow gracefully
- Redis will be available in production (not confirmed)
```

## Communication
- Reports findings to: document-writer
- Receives instructions from: orchestrator (handoff skill)

## Domain Knowledge
Decisions without rationale are useless. Every decision entry must include: what was decided, why, and what was rejected with reason. Keep each entry under 3 lines.
