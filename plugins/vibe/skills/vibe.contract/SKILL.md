---
name: vibe.contract
description: Use when a SPEC API contract may differ from implementation or endpoint and schema drift must be detected.
argument-hint: "extract | check | reverse | diff [feature-name]"
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
/vibe.contract reverse <feature>       # implementation → SPEC, SPEC 결손을 인박스로
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
  <feature>.reverse.md     # 역방향 대조 결과 (구현에만 있는 표면)
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

### 4. `reverse` — implementation → SPEC (역방향)

`check` 가 "SPEC 이 약속한 것을 구현이 지키는가" 를 본다면, `reverse` 는 **"구현이 가진 표면을 SPEC 이
알고 있는가"** 를 본다. 둘을 합치지 않는 이유는 방향이 아니라 **귀결이 반대**이기 때문이다.

> SPEC 은 승인 시점에 얼어붙는다. 구현이 알아낸 사실이 돌아오는 경로가 없으면
> "의도 설계자" 의 산출물은 시간이 지날수록 실제 시스템과 멀어진다.

**대상**: `구현 ⊃ SPEC` 인 경우만. 구현이 SPEC 보다 **좁은** 것(약속한 필드가 없다 등)은
`check` 의 관할이다 — 여기서 다시 보지 않는다.

**Steps**:
1. `.vibe/contracts/<feature>.md` 로드. 없으면 → `extract` 를 먼저 제안하고 종료
2. 구현 표면을 수집한다 — **탐지기를 새로 만들지 않고** 아래 Framework Detection Rules 를 그대로 쓴다
3. 계약에 없는 표면을 4종으로 분류한다 (아래 등급표)
4. `.vibe/contracts/<feature>.reverse.md` 로 기록 — **발견 0건이어도 파일을 낸다**
   ("아직 안 돌렸다" 와 "돌렸는데 깨끗하다" 는 구분되어야 한다)
5. 발견이 있으면 인박스에 올린다 (아래 명령)

**등급 매핑은 정방향과 반대다** — 구현에만 있는 표면은 코드 실패가 아니라 **SPEC 결손**이다:

| 종류 | 등급 | 예 |
|---|---|---|
| `unspecified-endpoint` | P2 | 구현에 `GET /users/:id/avatar` 가 있는데 SPEC 에 없다 |
| `unspecified-field` | P3 | 응답에 `phoneNumber` 가 있는데 계약에 없다 |
| `unspecified-status-code` | P3 | 구현이 `429` 를 내는데 SPEC 에 없다 |
| `unspecified-parameter` | P3 | 문서화되지 않은 쿼리 파라미터 |

⛔ **역방향은 차단하지 않는다. P1 을 만들지 않는다.** 판정 주체가 LLM 추출이므로
loop-contract 의 Judge 권한 경계상 "판정된 P1" 이고, 그것은 단독으로 차단 근거가 아니다.
verify 를 강등하지 않고, `vibe.regress` 에 등록하지 않으며, SPEC 을 자동으로 고쳐 쓰지 않는다
(SPEC 확정은 유일한 의무적 사람 개입 지점이다 — 자동 갱신은 그 게이트를 우회한다).

등급·목적지와 출력 형식은 산문이 아니라 코드가 고정한다 (`src/tools/contract/reverseDrift.ts`) —
`blocking: false` 와 `destination: 'inbox'` 가 리터럴 타입이라 차단하는 분류를 만들 수 없다:

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => {
  const findings = [{ kind: 'unspecified-endpoint', surface: '<GET /path>', location: '<file:line>' }];
  console.log(t.formatReverseReport({ feature: '<feature>', specPath: '<.vibe/specs/x.md>', comparedAt: new Date().toISOString(), findings }));
  console.log(JSON.stringify(t.formatReverseInboxLines('<feature>', findings)));
})"
```

인박스 기록 (발견 0건이면 줄이 빈 배열로 나오므로 **호출하지 않는다**):

```bash
node "$HOOKS_DIR/loop-ledger.js" inbox <feature> ok "<line 1>" "<line 2>" …
```

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

이어서 역방향도 한 번 돌린다:
```
Load skill `vibe.contract` with: reverse <feature>
```
- 결과와 **무관하게 verify 판정은 바뀌지 않는다** — 발견은 인박스로만 간다
- 인박스에 올린 뒤 파이프라인을 계속 진행한다 (사람을 세우지 않는다)

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
- [ ] `reverse` 는 어떤 발견에도 verify 판정을 바꾸지 않는다
- [ ] `reverse` 는 발견 0건이어도 `.reverse.md` 를 남긴다
- [ ] `reverse` 는 발견 0건이면 인박스를 호출하지 않는다
