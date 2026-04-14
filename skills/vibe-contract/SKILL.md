---
name: vibe-contract
tier: core
description: "API contract drift detection. Extracts HTTP/GraphQL/event/public-function contracts from SPEC into .claude/vibe/contracts/<feature>.md, compares to implementation, and fails loudly on breaking drift (missing endpoints, removed required fields, type changes). P1 drifts auto-register as regressions via vibe-regress. Must use this skill when user runs /vibe.contract, when /vibe.spec completes, when /vibe.verify passes scenarios, or when the user says 'contract', 'API schema', 'breaking change', 'drift', '계약', '스키마 바뀜'."
triggers: [contract, drift, "계약", "API 변경", "breaking change", "schema drift"]
priority: 70
chain-next: []
---

# vibe.contract — API Contract Drift Detection

**Purpose**: catch divergence between the SPEC's external contract and the actual implementation. Passing tests ≠ contract preserved.

## Why this exists

Hidden vibe-coding weakness: as the implementation grows, response shapes drift away from what the SPEC documents. Scenario tests still pass — but **external consumers break**. Manual SPEC-vs-code review is high-friction, so mechanize it.

## Storage Contract

```
.claude/vibe/contracts/
  <feature>.md             # contract SSOT (extracted from SPEC)
  <feature>.snapshot.md    # implementation snapshot (last check)
```

### Contract frontmatter schema

```yaml
---
feature: string
extracted-from: .claude/vibe/specs/<feature>.md
extracted-at: ISO-8601
source-spec-hash: sha256  # for change detection
endpoints:
  - id: unique-kebab-id         # e.g. get-user-by-id
    kind: http | graphql | event | function
    # http
    method: GET | POST | PUT | DELETE | PATCH
    path: /users/:id
    request:
      params: { name: type, ... }
      query: { name: type, ... }
      body: { field: type, ... } | null
      required: [field, ...]
    response:
      statusCodes:
        200: { schema }
        404: { error: string }
      required-fields:
        200: [id, email]
    # graphql
    operation: query | mutation
    name: string
    args: { ... }
    returns: { ... }
    # event
    topic: string
    payload: { ... }
    # function
    signature: "(a: string, b: number) => Promise<User>"
    module: path/to/file.ts
---
```

## Subcommands

### 1. `extract <feature>` — pull contract out of the SPEC

**Steps**:
1. Load SPEC file (single file or split folder)
2. Search sections in this order:
   - `## API` / `## Endpoints` / `## Interface` / `## Contract`
   - Markdown tables (method/path/request/response headers)
   - OpenAPI/JSON Schema snippets inside code blocks
3. Extraction failure (no such section) → **exit cleanly with `no-contract` state**. Not every feature has an API.
4. Success → convert to the frontmatter structure
5. `source-spec-hash`: sha256 of SPEC content (for next extract to detect change)
6. Save to `.claude/vibe/contracts/<feature>.md` (no-op if file exists with the same hash)

**Caveat**: extraction is LLM-driven. Mark low-confidence fields with `# unconfirmed` so the user can review.

### 2. `check <feature>` — contract vs implementation

**Steps**:
1. Load `.claude/vibe/contracts/<feature>.md`. If missing → **suggest extract first**.
2. For each endpoint, find implementation:
   - http: detect framework (Express, Fastify, Next.js API routes, Hono, ...)
   - graphql: locate resolver files
   - event: producer/consumer code
   - function: module export
3. Extract implementation signature/schema → compare against contract
4. Classify drift (severity table in command file)
5. Persist snapshot at `.claude/vibe/contracts/<feature>.snapshot.md` (current implementation state)

### 3. `diff <feature>` — changes since last snapshot

**Steps**:
1. If `.snapshot.md` does not exist → say "first run" and exit
2. Re-extract current implementation; compare to existing snapshot
3. Output **only changed fields** in ASCII diff form:
   ```
   endpoints/get-user-by-id/response/200:
     - email: string
     + email: string | null   ← nullability added (P1 breaking)
     + phoneNumber: string    ← new field (P3 safe)
   ```
4. On any drift, auto-call `/vibe.regress register --from-contract`

## Drift Severity Matrix

(matches command file — keep both in sync on edits)

## Integration Points

### From /vibe.spec

Auto-invoke right after the SPEC is written:
```
Load skill `vibe-contract` with: extract <feature>
```
Failure does not stop `/vibe.spec` (extraction is optional). On success, `/vibe.run` references this contract.

### From /vibe.verify

After all scenarios pass:
```
Load skill `vibe-contract` with: check <feature>
```
- no drift → verify still passes
- P1 drift → demote verify to fail; auto-register
- P2 / P3 drift → warning only; verify still passes

### To /vibe.regress

On P1 drift:
```
Load skill `vibe-regress` with:
  subcommand: register --from-contract
  feature: <feature>
  symptom: "Contract drift: <endpoint-id> <drift-type>"
  root-cause-tag: integration
```

## Framework Detection Rules

HTTP framework detection order:
1. `package.json` dependencies: `next` → Next.js API routes
2. `fastify` → Fastify
3. `express` → Express
4. `hono` → Hono
5. `@nestjs/core` → NestJS
6. None detected → ask user for manual mapping

After detection, grep for each framework's **route definition pattern** to map endpoints:
- Next.js: `pages/api/**` or `app/api/**/route.ts`
- Express: `app.get|post|put|delete|patch\(`
- Fastify: `fastify.get|post|...` or route configuration
- Hono: `app.get|post|...`

## Done Criteria

- [ ] `extract` does not error on SPEC without an API section
- [ ] `source-spec-hash`-based re-extract is a no-op when unchanged
- [ ] `check` reports each drift with severity + location (file:line)
- [ ] P1 drift always invokes `/vibe.regress`
- [ ] On framework detection failure, ask the user — do not silently skip
