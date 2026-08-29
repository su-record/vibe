# SPEC: SPEC 설계 시 되돌림 비용 표면화

- **Created**: 2026-08-29
- **Status**: VERIFIED (2026-08-29 — run-ledger verifyPassed=true, 게이트 7건 exit 0)
- **Stakes**: production — 배포되는 스킬 본문 계약을 바꾼다. 잘못되면 모든 SPEC 작성 경로에 영향
- **Tech Stack**: TypeScript (ESM), Vitest, Markdown 스킬 본문

---

## 1. Overview / Goal

`vibe.spec` 의 커버리지 스윕(3-a)은 결정 지점을 전부 열거하면서도 **사용자에게 아무것도 보여주지 않는다**. 묻지 않은 항목은 SPEC 하단 Assumptions 로 흡수되고, 비개발자는 그 목록을 읽지 않는다. 결과적으로 데이터 모델·아키텍처처럼 **나중에 바꾸기 비싼 결정**이 조용히 기본값으로 확정된다.

이 SPEC 은 스윕에 **되돌림 비용** 축을 도입해, 질문 수를 늘리지 않고도 (a) 3개의 질문 기회를 가장 비싼 결정으로 라우팅하고 (b) 되돌릴 수 없는 결정만 승인 직전에 평문으로 노출한다.

### Context Sources

| 등급 | 뜻 |
|---|---|
| `[확인]` | 코드·문서에서 직접 읽었다 |
| `[해석]` | 읽은 것에서 추론했다 |
| `[모름]` | 확인하지 못했다 |

- [확인] `skills/vibe.spec/SKILL.md:180-201` — 3-a 는 "개수 제한 없이" 열거하고 "이 목록 자체는 출력하지 않는다". 3-b 는 `갈라짐: yes` 중 "영향 범위가 큰 순으로 3개"
- [확인] `skills/vibe.spec/SKILL.md:188` — 훑을 축(최소) 10종: 범위 경계 · 데이터 모델의 필수 필드 · 외부 연동 · 인증/권한 · 오류 처리 · 수치 파라미터 · 하위 호환 · 기존 테스트/계약 영향 · 산출물 위치 · 언어·표기 규약. **운영·확장·데이터 보존 축이 없다**
- [확인] `skills/vibe.spec/SKILL.md:244-258` — Step 6 승인 메시지 블록. 현재 `Assumptions: {3개 이하면 전부 · 초과면 핵심 3개}` 만 노출
- [확인] `src/__tests__/spec-clarify-contract.test.ts` — 이 스킬 본문 규칙을 순수 fs 검사로 고정하는 정적 계약 테스트. D3(3-a/3-b 구조) · D4(Step 5 체크리스트) · D5(Step 6 선택지) 가 이미 존재
- [확인] `vibe/templates/spec-template.md` — `### Assumptions` 섹션이 `### Constraints` 앞에 있다
- [확인] `src/tools/spec/validateSpecDocument.ts` — Done Criteria 섹션만 헤딩으로 강제한다. Assumptions 계열 섹션명을 강제하지 않으므로 신규 섹션 추가가 P1 을 유발하지 않는다
- [확인] `package.json:43` — `validate:plugin-tree` 가 `build-plugin.ts` 재생성 후 `git diff --exit-code`. `plugins/vibe/skills/vibe.spec/SKILL.md` 는 생성물이므로 직접 편집하지 않는다
- [확인] `skills/vibe.spec/SKILL.md` 다이어그램 조항 — "해당 없는 기능에까지 강제하면 비용만 오르고 통과 의식이 된다". 이 SPEC 의 노출 게이트를 좁게 잡는 근거
- [해석] 3-b 의 현행 선정 기준 "영향 범위가 큰 순" 은 판정자가 모델이라 재현되지 않는다 — 되돌림 등급은 항목마다 셋 중 하나로 확정되므로 정렬이 재현된다
- [모름] 실제 비개발자 사용자가 Assumptions 섹션을 읽는 비율 — 측정 수단이 없다. 이 SPEC 은 "읽지 않는다"를 전제로 증명하지 않고, **노출 위치를 승인 메시지로 옮기는 것 자체**를 Done 으로 삼는다

### Assumptions

3-a 스윕에서 열거했으나 사용자에게 묻지 않고 기본값을 채택한 항목 전부:

1. 되돌림 등급 어휘는 `싸다 | 비싸다 | 못 되돌린다` 3단계로 고정한다 (2단계는 "비싸다"를 표현하지 못하고, 4단계 이상은 판정이 흔들린다)
2. 3-b 선정 우선순위는 `못 되돌린다` > `비싸다` > `싸다`, 동률이면 기존 기준(영향 범위)을 유지한다
3. 승인 메시지 노출 게이트는 `못 되돌린다` **하나뿐**이다. `비싸다` 는 3-b 정렬에만 쓰고 노출하지 않는다
4. 노출 상한은 3줄. 초과분은 SPEC 참조로 접는다 (Assumptions 접기 임계 3과 같은 값을 쓴다 — 서로 다른 두 상한이 공존하지 않게)
5. `못 되돌린다` 가 0건이면 노출 블록을 **통째로 생략**한다. 빈 블록·"없음" 표기 금지
6. SPEC 문서에는 `### Assumptions` 다음에 `### 되돌리기 어려운 결정` 섹션으로 분리 기록한다 (Assumptions 안의 하위 목록이 아니라 별도 섹션 — 하류가 헤딩으로 찾을 수 있어야 한다)
7. 해당 항목이 없으면 템플릿 지시대로 그 섹션을 지운다 (Structure 절과 같은 조건부 규약)
8. 훑을 축에 3종을 추가한다: 데이터 보존·마이그레이션 경로 · 실패했을 때 사용자에게 보이는 것 · 부하가 늘면 먼저 깨지는 곳
9. `automationLevel: autonomous` 는 3-b 질문 생략 규칙을 그대로 유지한다. 등급 판정과 섹션 기록은 계속하되 승인 메시지 자체가 없으므로 노출도 없다
10. 노출 문구는 `· {결정} → {나중에 치를 비용}` 평문 1줄. 전문용어를 쓰지 않는다 (대상 독자가 비개발자다)
11. Step 5 셀프 리뷰 체크리스트에 귀결 점검 항목 1개를 추가한다 (기존 "누락 0건" 항목과 같은 형식)
12. `CLAUDE.md` / `AGENTS.md` 는 수정하지 않는다 — `커버리지 스윕 → 최대 3개 인라인 질문` 서술이 여전히 정확하고, D7 계약 테스트가 그 문구를 고정한다
13. `skills/vibe/SKILL.md` (디스패처) 는 수정하지 않는다 — 라우팅이 아니라 SPEC 작성 내부 절차의 변경이다
14. 회귀 테스트는 신규 파일이 아니라 `src/__tests__/spec-clarify-contract.test.ts` 에 `D8` describe 로 추가한다
15. Structure 다이어그램 절은 생략한다 — 새 모듈 경계·데이터 흐름 변경·3개 모듈 횡단 중 어느 트리거에도 해당하지 않는다

### 되돌리기 어려운 결정

없음 — 이 변경은 스킬 본문 텍스트와 계약 테스트다. 되돌리려면 커밋을 되돌리면 되고, 남는 데이터도 마이그레이션 대상도 없다.

> 이 섹션이 비어 있는 것이 **정상 동작의 증거**다. 도입하는 메커니즘이 문서 변경 SPEC 에서 침묵하지 않으면 통과 의식이 된다 (DC-6 이 이를 게이트로 고정한다).

### Constraints

- 이 저장소 파일만 수정한다 (`~/.claude`, `~/.codex`, `~/.vibe` 설치본 금지)
- **질문 상한 3개를 늘리지 않는다** — 이 SPEC 은 질문을 늘리는 것이 아니라 3번의 기회를 재배치한다
- 기존 계약 문구를 깨지 않는다: `질문 수가 아니라` · `개수 제한 없이` · `출력하지 않는다` · `최대 3개` · `3-b 로 묻지 않은 3-a 항목은 전부` · `누락 0건` · `3개 초과면 핵심 3개` · Step 6 선택지 4개 고정 — 전부 D3/D5 가 이미 단언하고 있다
- `plugins/vibe/` 는 직접 편집하지 않고 `npm run build:plugin` 으로 재생성한다
- 판정 기준은 "베이스라인 대비 신규 실패 0건" (로컬 Windows 는 EPERM symlink·CRLF 로 기존 실패가 존재한다)

---

## 2. Requirements

| REQ ID | 요구사항 | Done Criteria |
|---|---|---|
| REQ-spec-reversibility-surface-001 | 3-a 스윕 항목 형식에 되돌림 등급 칸을 추가한다 | DC-1 |
| REQ-spec-reversibility-surface-002 | 3-a 의 훑을 축에 운영·데이터 보존 3종을 추가한다 | DC-2 |
| REQ-spec-reversibility-surface-003 | 3-b 선정 기준을 되돌림 등급 우선으로 바꾼다 | DC-3 |
| REQ-spec-reversibility-surface-004 | Step 6 승인 메시지에 조건부 노출 블록을 추가한다 | DC-4 |
| REQ-spec-reversibility-surface-005 | SPEC 템플릿에 되돌리기 어려운 결정 섹션을 추가한다 | DC-5 |
| REQ-spec-reversibility-surface-006 | 해당 없으면 노출하지 않는다는 규칙을 본문에 명시한다 | DC-6 |
| REQ-spec-reversibility-surface-007 | Step 5 셀프 리뷰에 귀결 점검 항목을 추가한다 | DC-7 |
| REQ-spec-reversibility-surface-008 | 기존 스윕 계약이 회귀하지 않는다 | DC-8 |
| REQ-spec-reversibility-surface-009 | 배포 트리가 소스와 일치한다 | DC-9 |

### Done Criteria

| ID | 판정 | Evidence Required |
|---|---|---|
| DC-1 | `skills/vibe.spec/SKILL.md` 의 3-a 항목 형식 줄에 `되돌림` 과 세 등급 어휘 `싸다`·`비싸다`·`못 되돌린다` 가 모두 존재한다 | `npx vitest run src/__tests__/spec-clarify-contract.test.ts` exit 0 |
| DC-2 | 3-a 의 훑을 축 문장에 `데이터 보존`·`실패`·`부하` 3개 축이 존재한다 | 동일 테스트 exit 0 |
| DC-3 | 3-b 절에 `못 되돌린다` 우선 정렬 규칙이 명시되고, 기존 `영향 범위` 기준이 동률 처리로 남아 있다 | 동일 테스트 exit 0 |
| DC-4 | Step 6 승인 메시지 블록에 되돌림 노출 라인이 있고, 노출 게이트가 `못 되돌린다` 로 한정됨이 명시된다 | 동일 테스트 exit 0 |
| DC-5 | `vibe/templates/spec-template.md` 에 `### 되돌리기 어려운 결정` 헤딩이 `### Assumptions` 뒤·`### Constraints` 앞에 있다 | 동일 테스트 exit 0 |
| DC-6 | 본문에 0건이면 블록을 생략한다는 규칙과 그 근거(통과 의식 방지)가 명시된다 | 동일 테스트 exit 0 |
| DC-7 | Step 5 체크리스트에 되돌림 등급 귀결 항목이 `- [ ]` 로 존재한다 | 동일 테스트 exit 0 |
| DC-8 | D3/D4/D5 기존 단언이 전부 통과한다 (질문 상한 3, 누락 0건, 선택지 4개 고정) | 동일 테스트 exit 0 |
| DC-9 | `npm run validate:plugin-tree` exit 0 | 명령 출력 |

### Evidence Required

- `npm run build` exit 0
- `npx vitest run src/__tests__/spec-clarify-contract.test.ts` — 신규 D8 포함 전부 통과
- `npx vitest run` — 베이스라인 대비 신규 실패 0건
- `npm run validate:plugin-tree` exit 0
- `git diff --stat` — 수정 파일이 `skills/vibe.spec/SKILL.md` · `vibe/templates/spec-template.md` · `src/__tests__/spec-clarify-contract.test.ts` · `plugins/vibe/**` · `.vibe/**` 로 한정

### Human Taste (Non-Blocking)

- 노출 문구가 비개발자에게 실제로 읽히는가 — 전문용어 없이 "무엇을 정했고 나중에 무엇을 치르는가" 가 한 줄로 전달되는지
- 노출 블록이 뜨는 빈도가 체감상 과하지 않은가 (통과 의식화 조기 신호)

---

## 3. Scenarios

### S-1 (DC-1, DC-2) — 스윕이 되돌림 등급과 운영 축을 갖는다
- **Given** `skills/vibe.spec/SKILL.md` 의 3-a 절
- **When** 항목 형식과 훑을 축 문장을 읽는다
- **Then** 형식에 `되돌림` 칸과 세 등급이 있고, 축에 데이터 보존·실패 노출·부하 3종이 포함된다

### S-2 (DC-3) — 질문 3개가 되돌림 등급으로 라우팅된다
- **Given** 3-b 절
- **When** 선정 기준 문장을 읽는다
- **Then** `못 되돌린다` 가 최우선이고 동률일 때만 영향 범위를 쓴다고 명시되며, 상한 3개는 그대로다

### S-3 (DC-4) — 승인 직전에 되돌릴 수 없는 결정이 노출된다
- **Given** Step 6 승인 메시지 블록
- **When** 블록 템플릿과 그 아래 규칙을 읽는다
- **Then** 되돌림 노출 라인이 존재하고, 노출 대상이 `못 되돌린다` 로만 한정됨이 규칙으로 적혀 있다

### S-4 (DC-6) — 해당 없으면 아무것도 뜨지 않는다
- **Given** Step 6 의 되돌림 노출 규칙
- **When** 0건인 경우의 처리를 읽는다
- **Then** 블록을 통째로 생략한다고 명시되고, 통과 의식 방지가 근거로 적혀 있다

### S-5 (DC-5) — SPEC 문서가 등급을 담을 자리를 갖는다
- **Given** `vibe/templates/spec-template.md`
- **When** `### Assumptions` 이후를 읽는다
- **Then** `### 되돌리기 어려운 결정` 섹션이 `### Constraints` 앞에 있고, 해당 없으면 지우라는 조건부 지시가 붙어 있다

### S-6 (DC-8) — 기존 스윕 계약이 살아 있다
- **Given** 변경된 `skills/vibe.spec/SKILL.md`
- **When** D3/D4/D5 계약 테스트를 실행한다
- **Then** 질문 상한 3 · 누락 0건 · 선택지 4개 고정 단언이 전부 통과한다

---

## 4. Out of Scope

- 되돌림 등급을 코드로 판정하는 것 — 등급은 모델 판단이고, 이 SPEC 은 **판정을 요구하는 계약**만 고정한다
- `skills/vibe/SKILL.md` 디스패처 변경 — 라우팅이 아니라 SPEC 작성 내부 절차다
- `CLAUDE.md` / `AGENTS.md` 문구 변경 — 기존 서술이 여전히 정확하다
- `validateSpecDocument` 에 되돌리기 어려운 결정 섹션 필수화 — 조건부 섹션을 필수로 만들면 그 자체가 통과 의식이 된다
- 3-b 질문 상한을 3에서 늘리는 것
- npm 배포·태그·릴리즈 실행

---

## 5. Rejected Alternatives (Traps)

| 기각안 | 기각 사유 |
|---|---|
| 질문 상한을 3 → 5 로 늘려 더 묻는다 | 상한은 인지 예산이지 임의값이 아니다. `spec-clarify-contract.test.ts` 의 "옛 최대 5개 상한 문구가 남아있지 않다" 단언이 과거에 5였다가 3으로 내려온 결정을 이미 고정하고 있다 — 되돌리려면 그 테스트를 지워야 하는데, 지울 근거가 없다 |
| 3-a 스윕 전체를 사용자에게 출력한다 | 3-a 는 개수 제한이 없다. 전량 출력하면 수십 줄이 뜨고, 읽히지 않는다는 원래 문제가 위치만 바꿔 재발한다 |
| Assumptions 안에 `(되돌리기 어려움)` 태그만 붙인다 | 하류가 헤딩으로 찾을 수 없다. 별도 섹션이어야 정적 검사·후속 스킬이 위치로 참조할 수 있다 |
| `비싸다` 도 승인 메시지에 노출한다 | 노출 대상이 넓어지면 거의 모든 SPEC 에서 블록이 뜬다. 매번 뜨는 경고는 읽히지 않는다 — 다이어그램 조항이 같은 이유로 조건부다 |
| 등급 판정을 코드로 한다 | "되돌릴 수 있는가" 는 도메인 판단이다. 정규식이 판정하면 오탐이 계약을 무력화한다 (`browser-ladder.test.ts` 가 선택을 고정해 유지보수를 막았던 선례) |
