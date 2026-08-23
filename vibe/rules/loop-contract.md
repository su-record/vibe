# Loop Contract — vibe 실행의 기본 계약 (SSOT)

> `/vibe`의 기본 동작은 **단계별 1회 실행이 아니라 완성까지의 루프**다.
> 루프가 기본이 될 수 있는 이유: 폭주 방어가 모델의 양심이 아니라 결정론적 가드(코드)이기 때문.
> 이 문서가 루프 시맨틱의 유일한 정의다 — ralph/Boulder/Convergence 등 과거 명칭은 전부 이 계약의 파라미터로 환원된다.

## 적용 범위

- **적용**: 검증 가능한 목표가 있는 실행 — `vibe.run`, `vibe.verify`, `vibe.review`, `vibe.loop` 및 이들을 체인하는 `/vibe` 파이프라인
- **제외**: 단발 조회·생성 작업 (`vibe.docs`, `vibe.analyze`, `vibe.scaffold` 등) — 루프 의례를 강제하지 않는다

## 계약

```
/vibe {요구사항}
  → SPEC 확정  ← 유일한 의무적 사람 개입 지점 (DONE의 정의 = REQ-ID + 수용 기준 승인)
  → 루프:
      ANCHOR   디스크에서 재고정: SPEC + run-ledger + scope.json (+ 직전 인박스)
      ACT      파이프라인 실행 (스킬 체인)
      JUDGE    Deterministic Judge(blocking): run-ledger verifyPassed │ 테스트 exit code │ RTM status
               Model Judge(advisory-only): 발견을 제안하지만 완료 권한 없음
               Human Taste(release-only): UX·브랜드·제품 감각을 판단하지만 루프 완료 권한 없음
      RECORD   run-ledger + `.vibe/runs/{run-id}/evidence.json` + loop-history.jsonl
  → 종료(EXIT): 게이트 전부 통과 │ stuck │ max_iterations │ 예산 상한 │ 실행 실패(error)
```

### ANCHOR가 컨텍스트 오염 방어인 이유
루프 상태는 컨텍스트가 아니라 디스크에 산다. 매 회전이 아티팩트에서 다시 시작하므로 컨텍스트가 오염되거나 compact로 소실돼도 루프는 깨지지 않으며, 회전마다 fresh 컨텍스트(서브에이전트)로 돌려도 된다.

**재고정은 명령으로 한다** — 모델의 기억이 아니라 디스크가 답한다:

```bash
node "$HOOKS_DIR/loop-ledger.js" anchor [feature]
# → { feature, spec, scope, ledger, latestInbox, missing[] }
```

`missing` 이 비어 있지 않으면 그 회전은 재고정에 실패한 것이다 — 없는 아티팩트를 기억으로 메우지 않는다. JUDGE·RECORD·stuck 이 전부 명령으로 판정되는데 ANCHOR만 산문 지시로 남아 있으면, 정작 오염 방어의 근거가 되는 단계가 가장 약해진다.

### Judge 권한 경계
종료 권한은 테스트 exit code·run-ledger·RTM 같은 **결정론적 Judge**에만 있다. Model Judge는 누락·모순·위험을 발견하는 보조 수단이며, 발견을 테스트나 관측 가능한 기준으로 내리기 전에는 차단 근거가 아니다. Human Taste는 공개·배포 시점의 사람 판단으로 남고 루프의 완료 상태를 변경하지 않는다.

#### P1 은 출처가 둘이다 — exit 기준은 이를 구분한다

"P1" 이 가리키는 것이 두 가지이고, 위 권한 경계는 그중 하나에만 적용된다.

| 출처 | 예 | 성격 | exit 게이트 |
|---|---|---|---|
| **측정된 P1** | clone Phase 5 `pixelmatch diffRatio > 0.05`, computed CSS delta > 2px, contract drift, 테스트 실패 | 결정론 | **차단한다** — 게이트 통과 = 측정 P1 0 |
| **판정된 P1** | `vibe.review` 리뷰어 findings | Model Judge | **단독으로 차단하지 않는다** — 테스트·관측 기준으로 내려야 게이트가 된다 |

판정된 P1 이 남았는데 내릴 기준이 없으면, 그것은 게이트 실패가 아니라 **인박스로 가는 리뷰 항목**이다. 동일한 판정 P1 이 2회 연속 반복되면 stuck 이며 — 완료가 아니다 (아래 stuck 절).

### stuck (결정론)
연속 2회 회전의 발견(discover/findings) 해시가 동일 → **그 루프는 종료한다** (`loop-ledger.js check-stuck`이 판정·기록). "다시 해보면 될 것 같다"는 모델 판단으로 무시 금지.

**stuck 은 루프 종료이고, 그 다음 행동은 `automationLevel` 이 결정한다** — 이 둘을 섞지 말 것:

| | 루프 | 사람에게 질문 | 그 다음 |
|---|---|---|---|
| `confirm` | 종료 | **한다** (값 채우기 / sub-100 승인 / 중단) | 사용자 응답에 따름 |
| `autonomous` | 종료 | 하지 않음 | TODO 기록 후 **다음 독립 작업 단위로** 진행 (비대화형) |

> `autonomous` 의 "계속" 은 **stuck 난 루프를 더 돌린다는 뜻이 아니다** — 2회 연속 동일 발견은 정의상 재시도가 무의미하다. 같은 목표를 붙잡지 않고 다음 단위로 넘어간다는 뜻이며, 미달은 TODO/인박스에 남는다. 미달 상태를 **완료로 기록하지 않는다.**

### 예산 — 회전은 코드가 세고, 전진과 헛돎을 구분한다

이 문서는 서두에서 "폭주 방어가 모델의 양심이 아니라 결정론적 가드(코드)" 라고 선언한다. 그런데 정작 폭주 방어인 `max_iterations` 에는 런타임 계수가 없었다 — stuck 만 명령으로 판정되고 회전 수는 모델이 스스로 셌다. 선언과 구현이 어긋난 지점이었다 (감사 2026-08-10).

```bash
node "$HOOKS_DIR/loop-ledger.js" iteration <name> <verified|unverified>   # 회전 종료 시 1회
node "$HOOKS_DIR/loop-ledger.js" budget <name> [max]                      # → {iterations, verified, remaining, exhausted}
```

**두 축을 따로 센다:**

| 축 | 의미 | 쓰임 |
|---|---|---|
| `iterations` | 모든 회전 | `max_iterations` 와 비교하는 **폭주 방어** |
| `verified` | JUDGE 결정론 게이트를 통과한 회전만 | 실제로 **전진한 양** |

둘을 하나로 뭉치면 "10회를 썼다" 는 알아도 "그중 8회가 헛돌았다" 는 모른다 — 헛도는 루프와 원래 큰 작업을 구분할 수 없다. `exhausted: true` 면 잔여를 인박스로 이월하고 종료한다.

- **실행 실패(error)는 회전을 소비하지 않는다** — 위 실행 실패 절대로 루프가 즉시 종료되므로 예산을 갉아먹지 않는다. 재시도가 예산을 태우는 형태를 만들지 않는다.
- 계수는 직전 `start` 이후만 센다 — 새 실행은 예산도 새로 시작한다.

### 게이트 객체 — 사람을 기다리는 이유는 디스크에 산다

사람 개입 지점의 질문이 컨텍스트에만 있으면, 세션이 죽거나 compact 로 소실될 때 **무엇을 묻고 있었는지가 사라진다.** 사람은 돌아왔는데 답할 대상이 없다. run-ledger·loop-history·인박스가 전부 디스크에 사는데 "지금 왜 멈춰 있는가"만 컨텍스트에 있었다.

```bash
node "$HOOKS_DIR/loop-ledger.js" gate open <id> "<구체적 질문>" "<선택지1>" "<선택지2>" …
node "$HOOKS_DIR/loop-ledger.js" gate list      # 열린 게이트
node "$HOOKS_DIR/loop-ledger.js" gate answer <id> "<답>"
```

- **모호한 상태는 게이트가 아니다.** "승인 대기" 는 질문이 아니다 — 무엇을 묻는지, 선택지가 무엇인지, 답이 무엇을 바꾸는지가 있어야 다음 턴(또는 다음 사람)이 이어받는다. 너무 짧은 문구는 `gate open` 이 거부한다.
- 답한 게이트는 **지우지 않는다** — 무엇을 묻고 무엇으로 답했는지가 증거다 (`status: answered` 로 남는다).
- ANCHOR 가 `openGates` 로 함께 재고정한다. 열린 게이트가 있으면 같은 질문을 다시 만들지 말고 그것을 이어받는다.
- **게이트와 인박스의 경계**: 게이트는 *지금 답을 기다리는 살아 있는 질문*이라 런타임 상태다(`.vibe/gates/` — gitignore). 결정이 끝난 뒤 남길 기록은 인박스가 맡는다(`.vibe/loops/` — 커밋). 진행 중인 질문을 커밋하면 동시 실행마다 충돌한다.

| 게이트 지점 | kind | 질문 |
|---|---|---|
| SPEC 승인 | `spec-approval` | 이 SPEC 으로 진행할지 — 승인 / 수정 / 중단 |
| stuck (`confirm`) | `stuck` | 무엇이 막혔는지 + 값 채우기 / sub-100 승인 / 중단 |
| 비용 게이트 `ask` | `cost` | 무엇을 얼마나 쓸지 — 진행 / 축소 / 중단 |

### 비용 게이트 — 사람은 시작점에만 서지 않는다

SPEC 승인은 **유일한 의무 게이트**로 남는다. 다만 승인 이후 max_iterations 까지 무인이라, 그 안의 되돌릴 수 없는 지출과 이상 규모 팬아웃을 아무도 보지 못했다. 비용 게이트는 그 둘만 잡는다 — 평상시 규모는 그대로 통과시킨다.

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => { const d=t.evaluateCostGate({kind:'agent-fanout',agentCount:N}); console.log(t.formatCostGate({kind:'agent-fanout',agentCount:N}, d)); })"
```

| 작업 | 기본 판정 | 근거 |
|---|---|---|
| `paid-generation` | **묻는다** | 되돌릴 수 없는 지출 |
| `agent-fanout` > 12 | **묻는다** | 위임마다 컨텍스트 재주입 — 비용이 개수에 비례 |
| `agent-fanout` ≤ 12 | 통과 | production 기본 리뷰어 셋(8종)+조건부는 평상시 규모다 |

- 임계값을 기본 셋 아래로 두면 매 리뷰가 멈춘다 — **의례가 된 게이트는 무시당한다.** 조정은 `.vibe/config.json` 의 `costGate.{enabled, maxAgentsWithoutApproval, paidGenerationRequiresApproval}`.
- `autonomous` 는 **묻지 않는다.** 대신 결정을 인박스에 기록한다 (`loop-ledger.js inbox`) — stuck 처리와 같은 원칙: 비대화형이라고 판정을 없애지 않고, 사람이 볼 자리로 옮긴다.

### 노드 가드 — 게이트를 끝에만 두지 않는다

결정론 게이트가 전부 JUDGE(파이프라인 끝)에만 있으면, 쓸 수 없는 산출물이 체인을 끝까지 타고 간 뒤에야 걸린다. 실패는 **만들어진 노드에서** 잡는 것이 싸다.

- 산출물을 내는 노드는 그 산출물이 **하류가 요구하는 형태인지** 코드로 검사한다. 취향이 아니라 계약을 검사한다 — "이게 없으면 하류의 무엇이 깨지는가"로 항목을 정한다.
- 실패하면 다음 노드로 가지 않고 **그 노드로 되돌아간다** (backward edge). 루프 전체를 재시작하지 않는다.
- 되돌린 뒤에도 같은 findings 가 2회 연속이면 stuck 이다 (위 stuck 절).

| 노드 | 가드 | 검사 근거 |
|---|---|---|
| `vibe.spec` | `validateSpecDocument` | RTM 이 게이트로 동작할 REQ-* / JUDGE 입력인 Done Criteria / 디스패처 입력인 Stakes / 직역 하네스가 실데이터로 넣는 placeholder |
| `vibe.run` | 테스트 exit code · run-ledger | 기존 JUDGE |
| `vibe.clone` · `vibe.figma` | pixelmatch diffRatio · computed CSS delta | 측정된 P1 (위 Judge 권한 경계 표) |

### 실행 실패 (error) — stuck 과 다른 종료 사유

stuck 은 **같은 발견이 반복되는** 상태다. 스킬이 로드되지 않거나, 도구가 없거나, 파일이 없거나, 명령이 비정상 종료하는 것은 stuck 이 아니라 **실행 실패**이며 해시 비교로는 잡히지 않는다. 재시도 대상도 아니다 — 환경이 바뀌지 않는 한 결과가 같다.

| | 루프 | 사람에게 질문 | 그 다음 |
|---|---|---|---|
| `confirm` | 종료 | **한다** (원인 제시 + 조치 요청 / 건너뛰기 / 중단) | 사용자 응답에 따름 |
| `autonomous` | 종료 | 하지 않음 | 인박스에 원인 기록 후 **다음 독립 단위로** |

- 실패한 단계를 **같은 방식으로 재시도하지 않는다.** 재시도가 의미 있으려면 무엇이 달라지는지 말할 수 있어야 한다 (`vibe.review` 의 escalation ladder 가 그 예 — 재시도 1회 → 다른 하네스 1회 → TODO).
- 실행 실패도 **완료가 아니다.** stuck 과 동일하게, 미달 상태를 완료로 기록하지 않는다.
- 원인은 인박스에 남긴다: `loop-ledger.js inbox <name> fail "<원인 한 줄>"`.

## 파라미터 (기본값)

| 파라미터 | 기본 | 의미 |
|---|---|---|
| `max_iterations` | 10 | 회전 상한. 도달 시 잔여를 인박스로 이월. **계수는 코드가 한다** — 아래 예산 절 |
| `exit` | 게이트 통과 (**측정된** P1=0 ∧ verifyPassed) | 종료 기준. coverage 100% 등으로 상향 가능. 판정된 P1 은 위 Judge 권한 경계 표를 따른다 |
| `--interactive` | off | 단계별 확인 모드 (회전마다 사람 승인 — 과거의 기본값) |
| `--max-iter N` | — | 회전 상한 명시 (N=1이면 1회 시도) |
| `automationLevel` | `confirm` | `confirm`(SPEC·stuck에서 질문) / `autonomous`(질문 없이 TODO 기록 후 다음 단위로, 비대화형) — `.vibe/config.json`. **어느 값에서도 stuck 은 루프를 종료한다** (위 stuck 절) |
| `stakes` | `production` | 태스크 무게. `demo` / `prototype` / `production` — 아래 매핑이 SSOT |

## Stakes — 태스크 무게 비례 실행 (SSOT)

파이프라인 깊이는 태스크의 무게에 비례해야 한다. 분류는 `/vibe` 디스패처 Phase 1이 수행하고, 매핑 정의는 이 표가 유일하다. **판정이 불확실하면 항상 상향(production)한다.**

| stakes | 판정 신호 | max_iterations | 리뷰 | 검증 스크립트 |
|---|---|---|---|---|
| `demo` | 명시 키워드(데모·일회성·실험·테스트용·throwaway·토이) / 닫힌 표현(그냥·간단히·빠르게·한 줄만·quick·just — 보조 신호, 아래 참조) / 기존 프로젝트 코드와 무관한 신규 폴더 / `.vibe/config.json` 없는 임시 디렉토리 | 1 | 1패스 (리뷰어 스케일링 최소 셋) | **신규 생성 금지** — 기존 테스트 러너·브라우저 게이트만 사용 |
| `prototype` | 검증용 초기 버전 명시 / 유지보수 가능성 있으나 배포 대상 아님 | 1 | 1패스 (리뷰어 스케일링 축소 셋) | 신규 생성 금지 |
| `production` | 기본값 — 신호 없음·상충 포함 | 10 | 수렴 루프 (기본 리뷰어 셋) | 허용 |

- demo/prototype 판정 신호가 상충하면 SPEC 승인 메시지에 stakes 확인 질문 1개를 **편승**시킨다 (별도 왕복 금지) — `vibe.spec` 승인 게이트 참조.
- **닫힌 표현은 보조 신호다** — 사용자가 가벼운 처리를 원한다는 뜻이지 산출물이 일회성이라는 뜻이 아니다. 기존 프로젝트 코드 위 작업에서 닫힌 표현만 있으면(명시 키워드·임시 디렉토리 없음) 단독 하향하지 않고 **상충으로 간주**해 편승 질문으로 확정한다.
- production 행은 기존 기본 동작과 동일하다 — 이 표의 도입으로 기본 동작은 변하지 않는다.

### JUDGE 검증 산출물 절제 (모든 stakes 공통)

검증은 실패 비용보다 싸야 한다 — 검증 코드가 구현 코드보다 커지면 그 루프는 남는 장사가 아니다.

JUDGE는 이번 feature의 **신규 생성 파일** 기준으로 검증 코드 총량(테스트·검증 스크립트)과 구현 코드 총량을 `git diff --numstat` 로 비교하고, 검증 코드 줄 수가 구현 코드 줄 수를 넘으면 **최종 보고에 P2 경고 1줄**을 적는다 (restraint 원칙의 프로세스 적용).

> ⚠️ 이 경고는 **보고용이며 어디에도 적재되지 않는다.** run-ledger 스키마(`runId`·`runStarted`·`runFeature`·`verifyPassed`·`verifyAt`·`stopWarned`·`verifyRequired`·`verifyRequiredReason`)에는 경고 필드가 없다 — 기록을 지시하면 갈 곳 없는 지시가 된다. 게이트 통과 여부를 바꾸지 않는다.

## 금지 (루프 권한 경계)

루프는 push·release·배포·버전 범프를 수행하지 않는다. 커밋은 auto-commit verify 게이트 통과 시만. 결과는 인박스(사람 리뷰 큐)로.

## Deprecated 별칭 (하위 호환 매핑 — 새 문서에서 가르치지 않는다)

| 별칭 | 환원 |
|---|---|
| `ralph` | 기본 동작과 동일 (no-op). 굳이 구분하면 `exit: coverage-100` |
| `verify` | 기본 동작과 동일 (no-op) — JUDGE는 항상 결정론 검증 |
| `quick` | `--max-iter 1` + 최소 JUDGE |
| `ralplan` | 같은 계약을 계획 단계에 적용 |
| `ultrawork` / `ulw` | `automationLevel: autonomous` + 병렬 ACT — 루프 시맨틱이 아니라 자율성·병렬성 축. **병렬 항목이 파일을 수정하면 항목별 worktree 격리 필수** (`vibe.loop` 의 `isolation` 축과 같은 규칙) |

### 시각 검증 (`verify: visual`)
코드가 도는 것과 화면이 맞는 것은 다르다. `tests` 만으로 도는 UI 루프는 **초록불을 켜면서 화면을 망가뜨릴 수 있다.** 그래서 렌더 결과를 완료 기준으로 삼는 모드를 둔다.

| 필드 | 역할 |
|---|---|
| `visual_command` | **게이트** — exit 0 만 성공 |
| `artifact_dir` | **증거** — 스크린샷·diff 를 남길 위치 (필수) |

⛔ **모델이 스크린샷을 보고 판정하는 것이 아니다.** 그건 자기보고이고, 이 문서가 처음부터 배제하는 바로 그것이다. 판정은 명령의 exit code 이고, 이미지는 나중에 사람이 확인할 증거다. 둘의 역할을 섞으면 게이트가 아니라 분위기가 된다.

`visual_command` 는 **임계값으로 떨어지는 검사**여야 한다 — 베이스라인 픽셀 diff(임계 %), 접근성 감사(axe/WCAG), DESIGN.md 토큰 드리프트(`vibe.design verify`). "잘 나왔는지 본다" 는 명령이 될 수 없다.

`artifact_dir` 을 필수로 둔 이유: 증거가 남지 않으면 `tests` 와 기능적으로 같아진다. 이 모드가 존재할 이유가 증거이므로, 없으면 정의를 거부한다.

**비용을 감수하는 선택이다.** 렌더·캡처·비교는 단위 테스트보다 느리고, 검증이 비쌀수록 세션당 도는 루프가 줄어든다(위 사다리 참조). UI 결과물이 완료의 정의인 루프에만 쓴다.

### 세션 축 — 한 호출에서 몇 바퀴를 도는가
| 값 | 동작 | 얻는 것 | 치르는 것 |
|---|---|---|---|
| `continuous` (기본) | `max_iterations` 까지 한 세션에서 계속 | 회전 사이 맥락이 남는다 | 컨텍스트가 단조 증가 |
| `per-iteration` | **한 바퀴만** — 반복은 스케줄러가 | 호출마다 컨텍스트 0에서 시작 | 매번 ANCHOR 재독(고정 비용), 맥락은 파일로만 |

`per-iteration` 은 `max_iterations: 1` 을 요구한다 — 두 필드가 서로 다른 말을 하면 "한 바퀴만" 인지 "열 바퀴까지" 인지 정의가 모호해진다. 검증기가 막는다.

**어느 쪽이 결과가 나은지는 vibe 가 측정한 바 없다.** 컨텍스트 누적이 품질을 떨어뜨린다는 주장은 널리 퍼져 있지만 이 저장소에는 비교 데이터가 없다(수치 출처 규율 §3.5). 그래서 기본값을 바꾸지 않고 **축만 열어둔다** — 긴 무인 운전에서 컨텍스트 상한이 걱정되면 `per-iteration`, 회전 간 연속성이 중요하면 `continuous`.

전제 하나는 반드시 지킨다: `per-iteration` 에서 **넘길 것을 파일에 적기 전에 끝내지 않는다.** 맥락이 파일로만 넘어가는 구조이므로, 안 적으면 이월이 아니라 유실이다.

### 시운전 (처음 거는 루프)
승인 이력이 없는 루프는 **`trial_iterations`(기본 2) 회전만 돌고 멈춘다.** `max_iterations` 와 다른 축이다 — 그건 한 실행의 폭주를 막고, 이건 **정의가 검증되지 않은 루프**를 막는다. 폭주 예산은 매 `start` 마다 초기화되지만 시운전 회전은 실행을 가로질러 누적한다(다시 걸기만 해도 연장되면 게이트가 무의미하다).

| 판정 | 명령 |
|---|---|
| 시운전 상태 | `loop-ledger.js trial <name> [n]` → `{inTrial, cap, iterations, exhausted}` |
| 해제 | `loop-ledger.js trial-approve <name>` — 사람이 기록을 확인한 뒤 |

WHY: 자율 루프의 첫 실행은 정의가 맞는지 아무도 모르는 상태다. discover 가 엉뚱한 것을 긁거나 verify 기준이 틀려 있으면 루프는 그걸 **성실하게 반복한다.** 사람이 안 보는 동안 도는 것이 목적이므로 틀린 채로 도는 것도 안 보인다. 해제 기록을 설정이 아니라 원장에 남기는 이유는 루프별로 다르고 언제 풀렸는지가 감사 대상이기 때문이다.

> **폭이 수십 단위를 넘으면** Claude Code 네이티브 `Workflow`(누적 1000 에이전트 / 동시 min(16, cores-2))를 **제안**한다 — 자동 전환하지 않는다. 옵트인 도구이고, 조율 비용만 절약될 뿐 에이전트 사용량은 그대로 든다. Codex 에는 등가물이 없으므로 루프 계약 자체는 양쪽 동일하게 유지한다. 넘기더라도 위의 격리 규정과 검증자 컨텍스트 규정은 그대로 적용된다. 상세: `CLAUDE.md` "폭이 큰 작업 — 네이티브 workflow 로 라우팅".
