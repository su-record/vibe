---
description: API contract drift detection — extract contracts from SPEC, compare to implementation, fail on drift
argument-hint: "extract | check | diff [feature-name]"
---

# /vibe.contract

**API Contract Drift Detection** — when implementation diverges from the SPEC's API contract, catch it immediately.

> The SPEC is the source of truth. If the implementation silently leaves the SPEC, tests can pass while the contract breaks.

## Usage

```
/vibe.contract extract <feature>       # SPEC → contract record at .claude/vibe/contracts/<feature>.md
/vibe.contract check <feature>         # contract vs implementation, drift report
/vibe.contract diff <feature>          # changed fields since last check
```

## What counts as an "API contract"

A contract = any **interface shape** that external consumers (clients, other services) depend on:

- HTTP endpoint: method + path + request schema + response schema + status codes
- GraphQL: query/mutation name + args + return shape
- Event/message: topic + payload schema
- Exported TypeScript function signature (when explicitly marked as public API)

## Process

Load skill `vibe-contract` with subcommand: `$ARGUMENTS`

**Core steps**:

1. **extract**: parse SPEC sections like `## API` / `## Endpoints` / `## Interface` and persist as a structured contract record
2. **check**: locate matching endpoints in the implementation, compare signature/schema, report drift as P1 findings
3. **diff**: compare against the previous snapshot, surface only **changed fields** (noise minimized)

## Drift severity

| Drift type | Severity | Example |
|---|---|---|
| Missing endpoint | P1 | SPEC says `GET /users/:id`, implementation has none |
| Missing required field in response | P1 | SPEC response includes `email`, implementation drops it |
| Type change (breaking) | P1 | `userId: number` → `userId: string` |
| Added required request field | P1 | breaks existing clients |
| Added optional field | P3 | extension is allowed |
| Status code added | P2 | client must handle a new case |
| Status code removed | P1 | expected response disappeared |

**On any P1 drift**: treat as failure regardless of `/vibe.verify` outcome — tests can pass while the contract breaks.

## Storage Format

```
.claude/vibe/contracts/
  <feature>.md           # extracted contract (SSOT)
  <feature>.snapshot.md  # implementation snapshot at last check (for diff)
```

### Contract schema (frontmatter)

```yaml
---
feature: string
extracted-from: path/to/spec.md
extracted-at: ISO timestamp
endpoints:
  - method: GET | POST | PUT | DELETE | PATCH
    path: /users/:id
    request:
      params: { id: string }
      body: null
    response:
      200: { id: string, email: string, ... }
      404: { error: string }
      required: [id, email]
  - ...
---
```

## Integration with /vibe.verify

After `/vibe.verify <feature>` scenarios pass, auto-chain:

```
scenarios pass → /vibe.contract check <feature>
  ├─ no drift → ✅ complete
  └─ drift found → ❌ report + auto /vibe.regress register (tag: integration)
```

## Integration with /vibe.spec

Right after `/vibe.spec` finishes writing the SPEC, auto-invoke `/vibe.contract extract`. The resulting contract becomes the reference for the subsequent `/vibe.run`.

## Done Criteria

- [ ] `extract` exits cleanly when SPEC has no API section (not every feature has one)
- [ ] `check` is silent when no drift; otherwise prints findings grouped by severity
- [ ] Every P1 drift triggers `/vibe.regress register --from-contract`
- [ ] `diff` says "first run" when no prior snapshot exists

---

ARGUMENTS: $ARGUMENTS
