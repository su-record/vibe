# 에이전틱 패러다임 공백 — 개선 로드맵

- **작성**: 2026-09-02
- **출처**: "The End of Software Engineering" (Zhenfeng Cao, 2026-06-05) 초록 + 한국어 요약 포스트를 vibe 실제 설계와 대조
- **읽은 범위**: 논문 **1페이지(초록)만**. 본문의 4단계 로드맵·EvoClaw 등 개별 근거는 확인하지 못했고 판정 대상에서 제외했다

> 1번 항목(역방향 의도 드리프트)은 `.vibe/specs/reverse-contract-drift.md` 로 착수했다.
> 이 문서는 나머지와 **하지 않기로 한 것**을 남긴다 — 결정이 컨텍스트에만 있으면 사라진다.

## 대조 결과 요약

이미 있는 것: SPEC 승인 = 유일한 의무 게이트(의도 설계자) · ANCHOR→ACT→JUDGE→RECORD(조율 루프) ·
run-ledger/evidence/인박스(결과 감사) · 팬아웃 비용 게이트와 worktree 격리(다중 에이전트 조율 한계).

정면으로 어긋나는 것 두 가지 — **의도적 선택이며 뒤집지 않는다**:

1. **무엇이 일회성인가가 반대다.** 논문은 코드가 일회성이고 LLM 추론이 상수라고 본다.
   vibe 는 컨텍스트가 일회성이고 디스크 아티팩트가 상수다 (loop-contract ANCHOR).
2. **AaaS 는 복잡성을 제공자로 옮기지만 vibe 는 저장소로 되돌린다.** 훅이 프로젝트 로컬인
   이유가 관측 가능성이다 — "조용히 죽은 가드는 없는 가드보다 나쁘다".

## 남은 항목

### 2. 루프 경제성 계측 (다음 착수 후보)

지금 vibe 는 효율을 **주장할 수 없다** — 금지되어서가 아니라 잴 것이 없어서다.
주장이 아니라 계측만 먼저 넣는다.

- `loop-ledger.js iteration` 에 세 번째 축: 회전당 경과 시간 · 도구 호출 수 · 서브에이전트 수
- 토큰은 하네스가 주면 쓰고 안 주면 쓰지 않는다 (환경마다 달라지는 값 하드코딩 금지 — constitution §3.5)
- run-ledger 스키마에 필드를 **먼저** 추가한다. JUDGE 절제 경고가 갈 곳 없는 지시가 된 전례가 있다
- 규율: 이 수치로 "N% 절감" 을 쓰지 않는다. 비교 가능한 형태로 쌓기만 한다

### 3. 벤치마크 자세 — **착수 완료** (`.vibe/specs/loop-bench-selfcompare.md`)

- 배치는 `vibe.test bench` 가 아니라 **`vibe.loop bench`** 로 바꿨다. `vibe.test` 본문이
  "No subcommands / 설치 표면 점검" 으로 정체성을 못박았고, 벤치는 루프 설정을 비교하며
  `loop-history.jsonl` 을 읽는다 — 루프 엔지니어링 관심사다
- 핵심은 비교기가 아니라 **판정 불가를 코드가 내는 것**: `insufficient-runs` ·
  `mixed-task-sets` · `inconclusive` · `difference-observed` 4종, `winner` 없음
- 비율·퍼센트·배수 필드를 만들지 않는다. 필드가 있으면 쓰이고, 쓰이면 §3.5 가 금지하는
  문구가 그 자리에서 만들어진다
- **남은 일**: 실제로 돌려 표본을 쌓는 것. 첫 대상은 `per-iteration` vs `continuous` —
  loop-contract 가 "측정한 바 없다" 고 적어둔 자리이고, 그 문장은 벤치가
  `difference-observed` 를 낸 뒤에 지운다

### 4. 런타임 축 — **착수 완료** (`.vibe/specs/agent-contract-runtime.md`)

논문의 연구 대상은 배포되어 도는 에이전트인데 vibe 는 빌드타임만 다룬다.
loop-contract 의 push·release 금지는 **유지하고**, 런타임 게이트를 빌드타임에 생성하는 형태로 잡는다.

- `vibe.spec` 템플릿에 `## Agent Contract`: 허용 도구 · 금지 행동 · 에스컬레이션 조건 · 되돌릴 수 없는 작업
- `vibe.contract` 가 이를 계약으로 추출 (기존 "interface shape" 정의를 에이전트 계약까지 확장)
- 생성하는 테스트는 **결정론이어야 한다** — LLM 이 에이전트 출력을 채점하는 형태는 Model Judge 이고
  완료 권한이 없다. 단언 대상은 도구 호출 로그다
- **구현하며 하나를 덜어냈다**: "에스컬레이션 조건에서 실제로 멈췄는가" 는 도구 로그만으로
  판정할 수 없다 — 조건 충족 여부가 로그에 없다. 선언은 받되 advisory 로 사람에게 넘긴다.
  판정할 수 없는 것을 게이트에 넣으면 통과 의식이 되고, 그건 없는 게이트보다 나쁘다
- 위반 3종(`forbidden-tool` · `unlisted-tool` · `unapproved-irreversible`)은 **차단한다** —
  `reverse` 가 절대 차단하지 않는 것과 반대 방향이며, 그 차이가 곧 Judge 권한 경계다
  (판정 주체가 LLM 추출이냐 로그냐)
- vibe 를 런타임에 넣지 않았다. loop-contract 의 push·release·배포 금지는 그대로다

### 5. 일회성 코드 레인 — **사용자 지시로 착수 완료** (`.vibe/specs/ephemeral-code-lane.md`)

`lifetime: durable | ephemeral` 축 신설안. 보류 사유 둘:

- 이 저장소에 **실수요 사례가 없다.** 사례 없이 축을 늘리는 것은 restraint 위반이고,
  vibe 는 이미 stakes · automationLevel · session · isolation 축을 갖고 있다
- 게이트 회피 구멍이 된다. "이건 일회성이라 린트 면제" 를 모델이 판정하면 축이 아니라 뒷문이다

보류 사유 둘 중 **첫째(실수요 0건)는 그대로 남아 있다** — 사용자 지시로 열었으므로 기록해 둔다.
**둘째(게이트 회피 구멍)는 설계로 막았다**, 미리 정해둔 방법 그대로:

- 판정을 모델이 아니라 **경로가** 한다 (`.vibe/ephemeral/`). 설정으로 열지 않는다
- `path.resolve`/`path.relative` 로 판정한다 — `.vibe/ephemeral/../src/x.ts` 로 면제를 훔칠 수 없다
- 방어 순서를 과장하지 않는다: gitignore 가 **1차**, `pre-tool-guard` 는 `git add -f` 하나를 막는 **심층 방어**
  (훅은 프로젝트 로컬이라 미설치가 흔하다)
- 면제 범위는 `code-check` 품질 검사뿐. 라쳇·린트·테스트는 커밋된 소스를 보므로 이 경로를 애초에 안 본다
- 판정 실패는 fail-safe — 모르면 면제하지 않는다

**남은 위험**: 실수요가 끝내 생기지 않으면 이 레인은 쓰이지 않는 축으로 남는다. 그때는 지우는 것이
맞다 — 안 쓰는 면제 경로는 언젠가 다른 용도로 쓰인다.

## 하지 않기로 한 것

| 논문이 함의하는 것 | 거부 사유 |
|---|---|
| 복잡도 상한 폐기 | 코드가 커밋되는 한 사람이 읽는다 (constitution "Readable: Code is for humans"). 라쳇을 푸는 것은 부채를 늘리는 방향 |
| 게이트를 원격 서비스로 (AaaS) | 훅이 프로젝트 로컬인 이유가 관측 가능성이다 |
| 자기진화 가속 | `trial_iterations` + `trial-approve` 유지. 정의가 검증 안 된 루프는 틀린 채로 성실하게 반복한다 |
