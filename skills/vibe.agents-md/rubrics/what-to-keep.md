# What to Keep vs Remove in AGENTS.md

## The One-Line Test

> "Can the agent discover this by reading the code?" → Yes = delete.

## Keep (Non-discoverable Gotchas)

| Type | Example | Why Keep |
|------|---------|----------|
| Runtime trap | "Bun runtime, not Node" | Not visible in package.json |
| Forbidden pattern | "Never use `require()` — ESM only" | Agent will default to CJS without this |
| SSOT location | "Edit only `constants.ts` for stack mapping" | Agent will create duplicates |
| Ordering invariant | "Build before test — always" | Violating silently breaks things |
| Non-standard convention | "Exports need `.js` extension" | Counterintuitive in TS projects |
| Tool choice | "Zod only — no joi or yup" | Agent picks any validation lib |
| Boundary | "Never edit `dist/` directly" | Agent may "fix" generated files |
| Response directive | "Respond in Korean" | Claude-specific, not in code |

## Remove (Discoverable)

| Type | Why Remove | Where to Find Instead |
|------|------------|----------------------|
| Directory structure | `ls` or Glob reveals it | The repo itself |
| Tech stack list | Listed in `package.json` | `package.json` |
| Build/test commands | Listed in `scripts` | `package.json` |
| Phase progress tables | Historical record, not actionable | Git history |
| API endpoint list | Readable from router code | Source files |
| Architecture diagrams | Visual aid, no mistake prevention | Readme or separate doc |
| Feature descriptions | Code speaks for itself | Source files |
| General best practices | LLM already knows them | Unnecessary |

## Anchoring Warning

Mentioning any technology name biases the agent toward it:
- "We use React" → unnecessary (visible in package.json) and creates anchoring
- "Never use jQuery, even for legacy modules" → useful (prevents a specific mistake)

Rule: Only name a technology when saying **don't use it** or when it's a **hidden runtime detail**.

## Size Target

| Outcome | Lines |
|---------|-------|
| Ideal | Under 50 |
| Acceptable | 50-80 |
| Warning | 80+ |

If over 80 lines, almost certainly contains discoverable content. Audit again.
