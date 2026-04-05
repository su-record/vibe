# CLAUDE.md Anti-Patterns

## Anti-pattern 1: Discoverable Content

**Symptom**: Listing things the agent can find by reading the repo.

```markdown
# Bad
- Components are in src/components/
- Uses React 18 with TypeScript
- Run tests with npm test
```

```markdown
# Good
(delete these — they're in package.json and the repo structure)
```

## Anti-pattern 2: Instruction Overload

**Symptom**: 300+ line CLAUDE.md full of best practices.

LLM compliance drops to ~5% after 15+ instructions. Every line competes for attention.

Fix: Keep under 150 lines. Move feature-specific rules to SPEC files.

## Anti-pattern 3: Emphasis Inflation

**Symptom**: IMPORTANT, CRITICAL, MUST on every other line.

When everything is critical, nothing is. Reserve emphasis words for P1 rules only.

## Anti-pattern 4: Past-Tense History

**Symptom**: Phase tables, progress logs, "we decided to..." narratives.

```markdown
# Bad
## Progress
- Phase 1 ✅ Auth
- Phase 2 ✅ Dashboard
- Phase 3 🚧 Payments
```

This is context noise, not guidance. Delete it.

## Anti-pattern 5: Technology Anchoring

**Symptom**: Listing what you use instead of what to avoid.

```markdown
# Bad
We use Zod for validation, Prisma for ORM, Tailwind for styling.
```

```markdown
# Good
Never use joi or yup — Zod is the only validation library.
```

Naming a technology biases the agent toward it. Only name tech in prohibitions.

## Anti-pattern 6: Vague Prohibitions

**Symptom**: Rules without specific triggers.

```markdown
# Bad
- Write clean, readable code
- Follow best practices
- Keep functions small
```

The agent already knows these. They consume tokens and provide no new signal.

## Anti-pattern 7: Missing Boundaries

**Symptom**: No section on what the agent should never touch.

Without explicit boundaries, agents will "helpfully" refactor generated files, edit lock files, or push to main.

Always include: what's off-limits, what requires human approval first.

## Anti-pattern 8: Stale Secrets/Keys

**Symptom**: API keys or connection strings in CLAUDE.md.

These belong in `.env` only. CLAUDE.md is committed to version control.
