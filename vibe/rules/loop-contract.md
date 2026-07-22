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
  → 종료(EXIT): 게이트 전부 통과 │ stuck │ max_iterations │ 예산 상한
```

### ANCHOR가 컨텍스트 오염 방어인 이유
루프 상태는 컨텍스트가 아니라 디스크에 산다. 매 회전이 아티팩트에서 다시 시작하므로 컨텍스트가 오염되거나 compact로 소실돼도 루프는 깨지지 않으며, 회전마다 fresh 컨텍스트(서브에이전트)로 돌려도 된다.

### Judge 권한 경계
종료 권한은 테스트 exit code·run-ledger·RTM 같은 **결정론적 Judge**에만 있다. Model Judge는 누락·모순·위험을 발견하는 보조 수단이며, 발견을 테스트나 관측 가능한 기준으로 내리기 전에는 차단 근거가 아니다. Human Taste는 공개·배포 시점의 사람 판단으로 남고 루프의 완료 상태를 변경하지 않는다.

### stuck (결정론)
연속 2회 회전의 발견(discover/findings) 해시가 동일 → 중단하고 사람에게 (`loop-ledger.js check-stuck`이 판정·기록). "다시 해보면 될 것 같다"는 모델 판단으로 무시 금지.

## 파라미터 (기본값)

| 파라미터 | 기본 | 의미 |
|---|---|---|
| `max_iterations` | 10 | 회전 상한. 도달 시 잔여를 인박스로 이월 |
| `exit` | 게이트 통과 (P1=0 ∧ verifyPassed) | 종료 기준. coverage 100% 등으로 상향 가능 |
| `--interactive` | off | 단계별 확인 모드 (회전마다 사람 승인 — 과거의 기본값) |
| `--max-iter N` | — | 회전 상한 명시 (N=1이면 1회 시도) |
| `automationLevel` | `confirm` | `confirm`(SPEC·stuck에서 질문) / `autonomous`(기록 후 계속, 비대화형) — `.vibe/config.json` |
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

JUDGE는 이번 feature의 **신규 생성 파일** 기준으로 검증 코드 총량(테스트·검증 스크립트)과 구현 코드 총량을 `git diff --numstat` 로 비교한다. 검증 코드 바이트 합 > 구현 코드 바이트 합이면 **P2 경고**를 run-ledger 에 기록한다 (restraint 원칙의 프로세스 적용). 경고는 advisory — 게이트 통과 여부를 바꾸지 않는다.

## 금지 (루프 권한 경계)

루프는 push·release·배포·버전 범프를 수행하지 않는다. 커밋은 auto-commit verify 게이트 통과 시만. 결과는 인박스(사람 리뷰 큐)로.

## Deprecated 별칭 (하위 호환 매핑 — 새 문서에서 가르치지 않는다)

| 별칭 | 환원 |
|---|---|
| `ralph` | 기본 동작과 동일 (no-op). 굳이 구분하면 `exit: coverage-100` |
| `verify` | 기본 동작과 동일 (no-op) — JUDGE는 항상 결정론 검증 |
| `quick` | `--max-iter 1` + 최소 JUDGE |
| `ralplan` | 같은 계약을 계획 단계에 적용 |
| `ultrawork` / `ulw` | `automationLevel: autonomous` + 병렬 ACT — 루프 시맨틱이 아니라 자율성·병렬성 축 |
