---
name: vibe-contract
tier: core
description: "API contract drift detection. Extracts HTTP/GraphQL/event/public-function contracts from SPEC into .claude/vibe/contracts/<feature>.md, compares to implementation, and fails loudly on breaking drift (missing endpoints, removed required fields, type changes). P1 drifts auto-register as regressions via vibe-regress. Must use this skill when user runs /vibe.contract, when /vibe.spec completes, when /vibe.verify passes scenarios, or when the user says 'contract', 'API schema', 'breaking change', 'drift', '계약', '스키마 바뀜'."
triggers: [contract, drift, "계약", "API 변경", "breaking change", "schema drift"]
priority: 70
chain-next: []
---

# vibe.contract — API Contract Drift Detection

**Purpose**: SPEC에 적힌 외부 계약과 실제 구현이 어긋나면 즉시 잡는다. 테스트 통과 ≠ 계약 준수.

## Why this exists

바이브코딩의 숨은 약점: 구현이 자라면서 SPEC에 명시된 응답 shape에서 조용히 벗어난다. 시나리오 테스트는 통과해도 **외부 소비자는 깨진다**. 사람이 매번 SPEC을 비교하기엔 마찰이 크므로 기계화.

## Storage Contract

```
.claude/vibe/contracts/
  <feature>.md             # 계약 SSOT (SPEC에서 추출)
  <feature>.snapshot.md    # 구현 스냅샷 (마지막 check 시점)
```

### Contract frontmatter schema

```yaml
---
feature: string
extracted-from: .claude/vibe/specs/<feature>.md
extracted-at: ISO-8601
source-spec-hash: sha256  # SPEC 변경 감지용
endpoints:
  - id: unique-kebab-id         # 예: get-user-by-id
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

### 1. `extract <feature>` — SPEC에서 계약 추출

**단계**:
1. SPEC 파일 로드 (single file or split folder)
2. 다음 섹션을 순서대로 탐색:
   - `## API` / `## Endpoints` / `## Interface` / `## Contract`
   - Markdown 테이블 (method/path/request/response 헤더)
   - 코드 블록 안의 OpenAPI/JSON Schema 스니펫
3. 추출 실패(해당 섹션 없음) → **에러 없이 `no-contract` 상태 기록 후 종료**. 모든 feature가 API를 갖진 않음.
4. 추출 성공 → frontmatter 구조로 변환
5. `source-spec-hash`: SPEC 파일 내용의 sha256 (다음 extract 시 변경 감지)
6. `.claude/vibe/contracts/<feature>.md` 저장 (기존 파일이 있고 hash가 같으면 **no-op**)

**주의**: 추출은 LLM 파싱. 신뢰도 낮은 필드는 `# unconfirmed` 주석 달아서 사용자가 검토 가능하게.

### 2. `check <feature>` — 계약 vs 구현 비교

**단계**:
1. `.claude/vibe/contracts/<feature>.md` 로드. 없으면 **먼저 extract 제안**.
2. 각 endpoint에 대해 구현 탐색:
   - http: 프레임워크 감지 (Express, Fastify, Next.js API routes, Hono, ...)
   - graphql: resolver 파일 찾기
   - event: 프로듀서/컨슈머 코드
   - function: 모듈 export
3. 구현 시그니처/스키마를 추출 → 계약과 비교
4. Drift 분류 (severity 표는 command file 참고)
5. 스냅샷 저장: `.claude/vibe/contracts/<feature>.snapshot.md` (현재 구현 상태)

### 3. `diff <feature>` — 이전 스냅샷 대비 변경만

**단계**:
1. `.snapshot.md`가 없으면 "첫 실행" 안내 후 종료
2. 현재 구현 재추출 vs 기존 스냅샷 비교
3. **변경된 필드만** 출력 (ASCII diff 형식):
   ```
   endpoints/get-user-by-id/response/200:
     - email: string
     + email: string | null   ← nullability 추가 (P1 breaking)
     + phoneNumber: string    ← 신규 필드 (P3 safe)
   ```
4. 드리프트 있으면 `/vibe.regress register --from-contract` 자동 호출

## Drift Severity Matrix

(command file의 표와 동일 — 변경 시 양쪽 갱신)

## Integration Points

### From /vibe.spec

SPEC 작성 완료 직후 자동 호출:
```
Load skill `vibe-contract` with: extract <feature>
```
실패해도 `/vibe.spec`은 계속 진행 (계약 추출은 옵션). 단 성공 시 `/vibe.run`이 이 계약을 참조.

### From /vibe.verify

모든 scenario pass 후 자동 체인:
```
Load skill `vibe-contract` with: check <feature>
```
- drift 없음 → verify 통과 유지
- P1 drift → verify 실패로 강등, regress 자동 등록
- P2/P3 drift → 경고만, verify 통과 유지

### To /vibe.regress

P1 drift 발견 시:
```
Load skill `vibe-regress` with:
  subcommand: register --from-contract
  feature: <feature>
  symptom: "Contract drift: <endpoint-id> <drift-type>"
  root-cause-tag: integration
```

## Framework Detection Rules

HTTP framework 감지 순서:
1. `package.json` dependencies에서: `next` → Next.js API routes
2. `fastify` → Fastify
3. `express` → Express
4. `hono` → Hono
5. `@nestjs/core` → NestJS
6. 감지 실패 → user에게 질문 후 manual mapping

감지 후 각 프레임워크의 **라우트 정의 패턴**을 Grep으로 찾아 endpoint 매핑:
- Next.js: `pages/api/**` or `app/api/**/route.ts`
- Express: `app.get|post|put|delete|patch\(`
- Fastify: `fastify.get|post|...` or route configuration
- Hono: `app.get|post|...`

## Done Criteria

- [ ] `extract`가 API 섹션 없는 SPEC에서 에러 내지 않음
- [ ] `source-spec-hash` 기반 re-extract 스킵
- [ ] `check`는 각 drift에 severity + 위치(file:line) 명시
- [ ] P1 drift는 100% `/vibe.regress` 자동 등록
- [ ] 프레임워크 감지 실패 시 silently skip 금지 — 반드시 user 질문
