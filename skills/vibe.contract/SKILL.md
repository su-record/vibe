---
name: vibe.contract
description: Use when a SPEC API contract may differ from implementation or endpoint and schema drift must be detected.
argument-hint: "extract | check | diff [feature-name]"
user-invocable: true
---

# /vibe.contract

**API Contract Drift Detection** — when implementation diverges from the SPEC's API contract, catch it immediately.

> The SPEC is the source of truth. If the implementation silently leaves the SPEC, tests can pass while the contract breaks.

## Usage

```
/vibe.contract extract <feature>       # SPEC → contract record at .vibe/contracts/<feature>.md
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

Execute the bundled implementation below with subcommand: `$ARGUMENTS`

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

계약 파일의 저장 위치와 frontmatter 스키마는 아래 **Storage Contract** 절이 SSOT다.
이 문서 안에서 스키마를 두 번 정의하지 않는다 — 과거 이 자리에 있던 축약본은 `id`·`kind`·
`source-spec-hash` 가 빠진 손실 버전이었다.

## Integration

`/vibe.spec` 직후 `extract`, `/vibe.verify` 시나리오 통과 후 `check` 로 자동 연결된다.
호출 계약과 drift 등급별 처리(P1 강등 / P2·P3 경고)는 아래 **Integration Points** 절이 SSOT다 —
이 자리에 있던 요약본은 P1/P2/P3 구분이 빠진 손실 버전이었다.

## Done Criteria

아래 **Done Criteria** 절(Bundled implementation 안)이 SSOT다 — 이 자리에 있던 축약본은
`source-spec-hash` 재추출 no-op, drift 위치(file:line), 프레임워크 감지 실패 처리가 빠진
손실 버전이었다.

---

ARGUMENTS: $ARGUMENTS

## Bundled implementation


# vibe.contract — API Contract Drift Detection

**Purpose**: catch divergence between the SPEC's external contract and the actual implementation. Passing tests ≠ contract preserved.

## Why this exists

Hidden vibe-coding weakness: as the implementation grows, response shapes drift away from what the SPEC documents. Scenario tests still pass — but **external consumers break**. Manual SPEC-vs-code review is high-friction, so mechanize it.

## Storage Contract

```
.vibe/contracts/
  <feature>.md             # contract SSOT (extracted from SPEC)
  <feature>.snapshot.md    # implementation snapshot (last check)
```

### Contract frontmatter schema

```yaml
---
feature: string
extracted-from: .vibe/specs/<feature>.md
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
6. Save to `.vibe/contracts/<feature>.md` (no-op if file exists with the same hash)

**Caveat**: extraction is LLM-driven. Mark low-confidence fields with `# unconfirmed` so the user can review.

### 2. `check <feature>` — contract vs implementation

**Steps**:
1. Load `.vibe/contracts/<feature>.md`. If missing → **suggest extract first**.
2. For each endpoint, find implementation:
   - http: detect framework (Express, Fastify, Next.js API routes, Hono, ...)
   - graphql: locate resolver files
   - event: producer/consumer code
   - function: module export
3. Extract implementation signature/schema → compare against contract
4. Classify drift (severity table in command file)
5. Persist snapshot at `.vibe/contracts/<feature>.snapshot.md` (current implementation state)

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

## Integration Points

### From /vibe.spec

Auto-invoke right after the SPEC is written:
```
Load skill `vibe.contract` with: extract <feature>
```
Failure does not stop `/vibe.spec` (extraction is optional). On success, `/vibe.run` references this contract.

### From /vibe.verify

After all scenarios pass:
```
Load skill `vibe.contract` with: check <feature>
```
- no drift → verify still passes
- P1 drift → demote verify to fail; auto-register
- P2 / P3 drift → warning only; verify still passes

### To /vibe.regress

On P1 drift:
```
Load skill `vibe.regress` with:
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
