---
description: API contract drift detection — extract contracts from SPEC, compare to implementation, fail on drift
argument-hint: "extract | check | diff [feature-name]"
---

# /vibe.contract

**API Contract Drift Detection** — SPEC에 적힌 API 계약과 실제 구현이 어긋나면 즉시 잡는다.

> SPEC은 진실의 원천이다. 구현이 SPEC을 소리 없이 떠나면 테스트는 통과해도 계약은 깨진다.

## Usage

```
/vibe.contract extract <feature>       # SPEC에서 API 계약 추출 → .claude/vibe/contracts/<feature>.md
/vibe.contract check <feature>         # 계약 vs 구현 비교, 드리프트 리포트
/vibe.contract diff <feature>          # 마지막 check 이후 변경된 필드만 요약
```

## What counts as an "API contract"

계약 = 외부(클라이언트, 다른 서비스)가 의존하는 **모든 인터페이스 형태**:

- HTTP endpoint: method + path + request schema + response schema + status codes
- GraphQL: query/mutation name + args + return shape
- 이벤트/메시지: topic + payload schema
- 내보내진 TypeScript 함수 시그니처 (public API로 명시된 경우)

## Process

Load skill `vibe-contract` with subcommand: `$ARGUMENTS`

**핵심 단계**:

1. **extract**: SPEC(.claude/vibe/specs/\<feature\>.md)의 "API" / "Endpoints" / "Interface" 섹션을 파싱, 구조화된 계약 레코드로 저장
2. **check**: 실제 구현(코드)에서 동일 엔드포인트를 찾아 시그니처/스키마 비교 — 드리프트 발견 시 P1 리포트
3. **diff**: 이전 check 스냅샷과 비교, **변경된 필드만** 노출 (노이즈 최소화)

## Drift severity

| Drift type | Severity | 예시 |
|---|---|---|
| Missing endpoint | P1 | SPEC에는 `GET /users/:id` 있는데 구현 없음 |
| Missing required field in response | P1 | SPEC response에 `email` 있는데 구현에서 빠짐 |
| Type change (breaking) | P1 | `userId: number` → `userId: string` |
| Added required request field | P1 | 기존 클라이언트 호환성 깨짐 |
| Added optional field | P3 | 확장은 허용 |
| Status code added | P2 | 클라이언트가 처리해야 할 새 케이스 |
| Status code removed | P1 | 예상 응답이 사라짐 |

**P1 드리프트 발견 시**: `/vibe.verify` 통과 여부와 무관하게 실패로 간주. 테스트는 통과해도 계약은 깨질 수 있기 때문.

## Storage Format

```
.claude/vibe/contracts/
  <feature>.md           # 추출된 계약 (SSOT)
  <feature>.snapshot.md  # 마지막 check 시점의 구현 스냅샷 (diff 비교용)
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

`/vibe.verify <feature>` 흐름 끝에 자동 체인:

```
scenarios pass → /vibe.contract check <feature>
  ├─ no drift → ✅ complete
  └─ drift found → ❌ report + auto-register to /vibe.regress (tag: integration)
```

## Integration with /vibe.spec

`/vibe.spec` 작성 완료 직후 자동으로 `/vibe.contract extract` 호출하여 계약을 미리 뽑아둠. 이후 `/vibe.run` 구현 시 이 계약이 참조점.

## Done Criteria

- [ ] `extract`는 SPEC에 API 섹션이 없으면 **에러 없이 스킵** (모든 feature가 API를 갖진 않음)
- [ ] `check`는 드리프트 없으면 조용히 통과, 있으면 severity별 분류 출력
- [ ] P1 드리프트는 반드시 `/vibe.regress register --from-contract` 자동 호출
- [ ] `diff`는 이전 스냅샷이 없으면 "첫 실행"이라 안내

---

ARGUMENTS: $ARGUMENTS
