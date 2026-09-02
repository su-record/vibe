---
name: vibe.loop
description: 반복 작업을 자율 goal loop로 설계·설치·실행하고 결정론적 gate로 완료를 판정해야 할 때 사용한다.
argument-hint: "design | install | run | status | list | bench [loop-name]"
user-invocable: true
---

# /vibe.loop

## 완료 기준

- [ ] loop 정의에 ANCHOR, ACT, JUDGE, RECORD가 모두 있다.
- [ ] JUDGE가 exit code, 파일 상태 또는 ledger 값으로 판정된다.
- [ ] stuck 조건과 max_iterations가 명시되어 있다.
- [ ] 실행 결과가 pass, stuck, max_iterations 중 하나로 기록된다.

**Loop Engineering** — 사람이 프롬프트하는 대신, 에이전트에게 프롬프트하는 루프를 설계한다.

> 루프의 완료 판정은 모델의 자기 보고가 아니라 **결정론적 게이트**(run-ledger `verifyPassed`, 테스트 exit code)가 내린다.
> 루프는 push·release·배포를 절대 수행하지 않는다 — 결과는 항상 사람 리뷰 큐(인박스)로 간다.

## Usage

```
/vibe.loop design [name]        # 인터뷰 → .vibe/loops/<name>.md 정의 생성
/vibe.loop install <name>       # 실행 환경(CC/Codex/cron)에 스케줄 연결
/vibe.loop run <name>           # 1회 반복 실행 (스케줄러가 호출하는 진입점)
/vibe.loop status [name]        # 실행 이력 + 인박스 요약
/vibe.loop list                 # 정의된 루프 목록과 상태
/vibe.loop bench <name>         # 루프 설정 자기 대조 — 조건만 바꿔 돌린 실행을 비교
```

## 경로 상수 (모든 서브커맨드 공통)

```bash
HOOKS_DIR="${VIBE_PATH:-$(npm root -g 2>/dev/null)/@su-record/vibe}/hooks/scripts"
LOOPS_DIR=".vibe/loops"
INBOX="$LOOPS_DIR/inbox.md"
HISTORY=".vibe/metrics/loop-history.jsonl"
```

---

## design — 루프 정의 생성

1. 다음 5가지를 사용자에게 묻는다 (이미 인자로 답이 있으면 생략):
   - **목표(goal)**: 루프가 0으로 만들려는 것 (예: "open 회귀 0건", "P1 lint 0건")
   - **트리거**: `scheduled`(cron) / `manual` / `on-event`
   - **발견(discover)**: 일거리를 어떻게 찾는가 — 명령 또는 지시
   - **검증(verify)**: `ledger`(vibe.verify 경유, 기본) / `tests`(테스트 명령 exit code) /
     `visual`(렌더 결과 검사 exit code + `artifact_dir` 에 증거) / `none`(보고만)
   - **격리(isolation)**: 병렬 항목이 파일을 수정하면 `worktree`, 아니면 `none`
   - **세션(session)**: `continuous`(기본, 한 호출에서 여러 바퀴) / `per-iteration`
     (한 바퀴만 — 반복은 스케줄러가 만든다, `max_iterations: 1` 필수)
2. `{{VIBE_PATH}}/vibe/templates/loop-template.md`를 읽어 `.vibe/loops/<name>.md`를 생성한다.
3. **생성 직후 반드시 검증한다** — 실패 시 정의를 고치고 재검증, 통과 전에는 install/run 금지:

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/loop/index.js').then(t => { const fs = require('fs'); const r = t.validateLoopDefinition(fs.readFileSync('.vibe/loops/<name>.md', 'utf-8')); console.log(JSON.stringify(r.errors.length ? r.errors : 'valid')); })"
```

**기본 제안 레시피 — nightly-triage** (사용자가 목표를 정하지 못하면 이것을 제안):
- discover: ① `.vibe/regressions/`에서 `status: open` 항목 ② `npx vitest run` 실패 ③ `.vibe/contracts/` drift 의심 항목 → 우선순위 목록(P1 먼저)
- pipeline: `[vibe.run, vibe.verify]` — 항목별로 SPEC 범위 내 수정 → 검증
- verify: `ledger` / trigger: `scheduled` / schedule: `0 6 * * *` / isolation: `worktree`

## install — 스케줄 연결

`install` 호출에서만 `references/install-adapters.md`를 읽어 현재 하네스의 명령을 제시한다. `design`, `run`, `status`, `list` 호출은 읽지 않는다. `trigger: manual` 루프는 install 없이 run만 안내한다.

## run — 1회 반복 실행 (핵심)

`status: paused` 루프는 즉시 종료. 실행 순서는 **전부 의무**이며 생략 불가:

```
0. ANCHOR   node "$HOOKS_DIR/loop-ledger.js" anchor [feature]
             → missing[] 이 비어 있지 않으면 없는 아티팩트를 기억으로 메우지 않는다.
               재고정 실패를 인박스에 남기고 종료한다.
1. 검증     validateLoopDefinition 통과 확인 (위 design 3의 명령) — 실패 시 인박스에 기록 후 종료
1-b. 시운전   node "$HOOKS_DIR/loop-ledger.js" trial <name> [trial_iterations]
             → `inTrial: true` 면 이 실행의 회전 상한은 `cap` 이다 (max_iterations 아님).
               `exhausted: true` 면 **한 바퀴도 돌지 않고** 종료한다 — 6-c 참조.
2. 시작 기록  node "$HOOKS_DIR/loop-ledger.js" start <name>
3. DISCOVER  정의의 discover 지시 실행 → 일거리 목록 산출
4. STUCK 검사 DISCOVER_HASH=$(node -e "...hashDiscoverOutput...")   # 발견 목록 텍스트의 해시
             node "$HOOKS_DIR/loop-ledger.js" check-stuck <name> "$DISCOVER_HASH"
             → 'stuck'이면: end <name> stuck 기록 + 인박스에 "동일 발견 2회 연속 — 사람 개입 필요" 후 종료.
               stuck 판단은 이 명령의 출력만 따른다. 모델이 "다시 해보면 될 것 같다"고 무시하는 것 금지.
5. ACT       발견 항목을 우선순위순으로, max_iterations 한도 내에서 pipeline 체인 실행.
             isolation: worktree면 항목별 worktree에서 (git-worktree 스킬 패턴).
             scope-guard·verifyGate 등 기존 게이트는 그대로 적용된다 — 루프라고 우회하지 않는다.
6. VERIFY    완료 판정 — verify 모드별 결정론 기준:
             · ledger: cat .vibe/metrics/run-ledger.json → verifyPassed === true 만 성공
             · tests:  정의의 test_command 실행 → exit 0 만 성공
             · visual: 정의의 visual_command 실행 → **exit 0 만 성공**.
                       산출물(스크린샷·diff)을 artifact_dir 에 남기고 그 경로를
                       종료 기록·인박스에 적는다 — 나중에 사람이 눈으로 확인할 것.
                       ⛔ 모델이 스크린샷을 보고 "괜찮아 보인다"고 판정하는 것은
                       금지다. 그건 자기보고이고 게이트가 아니다. 판정은 exit code,
                       이미지는 증거 — 둘의 역할을 섞지 않는다.
             · none:   판정 생략(보고만). "코드를 보니 잘 된 것 같다"는 판정이 아니다.
6-b. 회전 기록  node "$HOOKS_DIR/loop-ledger.js" iteration <name> <verified|unverified>
             VERIFY 결과를 그대로 넣는다. 이어서 예산을 확인한다:
             node "$HOOKS_DIR/loop-ledger.js" budget <name> <max_iterations>
             → exhausted 면 잔여를 인박스로 이월하고 종료한다. 회전 수를 모델이
               세지 않는다 — 폭주 방어는 코드가 판정한다 (loop-contract 예산 절).
6-c. 시운전 확인 시운전 중이면(1-b 의 `inTrial`) 매 회전 뒤 다시 확인한다:
             node "$HOOKS_DIR/loop-ledger.js" trial <name> [trial_iterations]
             → exhausted 면 **거기서 멈춘다.** 인박스에 아래를 남기고 종료:
               · 무엇을 발견했고 무엇을 고쳤는지 (회전별 한 줄)
               · 확인할 것: `.vibe/metrics/loop-history.jsonl` 과 실제 변경 diff
               · 이어서 돌리려면: loop-ledger.js trial-approve <name>
               승인 없이 계속 도는 것 금지 — 정의가 맞는지 아직 아무도 모른다.
6-d. 세션 판정 `session: per-iteration` 이면 **여기서 끝낸다.** 남은 발견 항목이
             있어도 다음 회전으로 넘어가지 않는다 — 반복은 스케줄러의 몫이다.
             잔여 항목은 7·8 의 종료 기록과 인박스에 남겨 다음 호출이 집게 한다.
             넘길 것을 파일에 적기 전에 끝내지 않는다. per-iteration 의 전제는
             "맥락이 파일로만 넘어간다" 이고, 안 적으면 그냥 유실이다.
7. 종료 기록  node "$HOOKS_DIR/loop-ledger.js" end <name> <ok|fail|stuck> "<한 줄 요약>"
8. 인박스    node "$HOOKS_DIR/loop-ledger.js" inbox <name> <ok|fail|stuck> \
               "발견: N건 / 처리: M건 / 검증: <기준과 결과>" \
               "리뷰 필요: <항목들 — 없으면 없음>"
             → 블록 형식과 최신순 정렬은 명령이 보장한다. 손으로 마크다운을 쓰지 않는다.
```

**금지**: `git push`, `gh pr merge`, `npm publish`, 버전 범프, 릴리즈 — 루프는 커밋까지만 가며(auto-commit verify 게이트 통과 시), 그 이상은 인박스를 본 사람이 한다.

## status / list

- `list`: `$LOOPS_DIR/*.md`의 frontmatter(name, trigger, status, goal) 테이블.
- `status [name]`: `$HISTORY`에서 해당 루프(생략 시 전체)의 최근 10개 이벤트 + 인박스의 미처리 블록 수.

## bench — 자기 대조 벤치마크

`loop-contract.md` 는 `per-iteration` vs `continuous` 를 두고 **"어느 쪽이 결과가 나은지는 vibe 가
측정한 바 없다"** 고 적어두었다. 축만 열고 기본값을 바꾸지 않은 이유가 그것이다. `bench` 는 그
문장을 지울 수 있게 하는 도구다 — 외부 벤치마크(SWE-bench 등)와 겨루는 것이 아니라 **같은 루프를
조건만 바꿔 돌린 결과끼리** 비교한다.

**핵심은 비교가 아니라 판정 불가다.** 벤치 산출물은 곧 문서의 수치가 되므로, 판정을 절제에
맡기면 constitution §3.5 가 금지하는 배수·퍼센트가 그 자리에서 만들어진다. 그래서 코드가 낸다.

**Steps**:
1. 벤치 정의를 만든다 — `name` · `taskSet`(모든 arm 이 동일하게 수행할 과제 id) ·
   `arms`(비교할 조건 2개 이상, **이 축만 다르고 나머지는 같아야 한다**) · `minRunsPerArm`(기본 5)
2. `validateBenchDefinition` 으로 검사한다. P1 이 있으면 실행하지 않는다
3. arm 마다 `taskSet` 을 `minRunsPerArm` 회 이상 돌린다. 각 실행은 `loop-ledger.js budget` 산출물에서
   `{armId, taskSetHash, gatesPassed, iterations, cost}` 를 남긴다
4. `summarizeArm` → `compareArms` → `formatBenchReport`
5. 리포트를 `~/.vibe/test-reports/<YYYYMMDD-HHmm>-bench-<name>.md` 에 쓴다 (**프로젝트 로컬 금지**)

**판정 어휘 4종 — `winner` 는 없다**:

| verdict | 뜻 |
|---|---|
| `insufficient-runs` | arm 당 사용 가능 실행이 `minRunsPerArm` 미만 — 어떤 차이든 우연과 구분되지 않는다 |
| `mixed-task-sets` | 두 arm 이 같은 과제 셋을 돌지 않았다 — 다른 일을 시킨 결과는 비교가 아니다 |
| `inconclusive` | 관측 범위(min~max)가 겹친다 — 이 표본으로는 차이를 말할 수 없다 |
| `difference-observed` | 범위가 겹치지 않는다. **"차이가 관측됐다" 이지 "A 가 낫다" 가 아니다** |

⛔ **비율·퍼센트·배수를 만들지 않는다.** 차이는 절대 단위 `delta` 로만 나오고, 게이트 통과도
"3/5 회" 로 적지 "60%" 로 적지 않는다. 판정 규칙은 범위 겹침이며 **유의성 검정이 아니다** —
표본이 한 자릿수인데 t-검정을 붙이면 정밀해 *보이는* 숫자가 나온다.

⛔ **bench 는 아무것도 차단하지 않고, 기본값을 자동으로 바꾸지 않는다.** 리포트다.
어느 조건을 고를지는 지표의 방향을 아는 사람이 정한다.

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => {
  const runs = JSON.parse(process.env.BENCH_RUNS);   // 위 3단계에서 모은 실행 기록
  const a = t.summarizeArm('<arm-a>', runs), b = t.summarizeArm('<arm-b>', runs);
  const cmp = t.compareArms(a, b, 'iterations');
  console.log(t.formatBenchReport({ name: '<bench-name>', ranAt: new Date().toISOString(), comparison: cmp }));
})"
```

## Auto-integration

- `/vibe.regress`의 open 항목, `/vibe.contract`의 drift는 nightly-triage discover의 1차 입력이다.
- 루프 안에서 verify 실패 시 기존 규칙대로 회귀 자동 등록(vibe.verify 경유)이 그대로 동작한다.

## 설계 원칙 (요약)

| 원칙 | 구현 |
|------|------|
| 완료는 게이트가 판정 | run-ledger `verifyPassed` / 테스트 exit code (REQ-005) |
| stuck은 해시가 판정 | loop-ledger check-stuck, 동일 발견 2회 연속 (REQ-009) |
| 회전 수도 코드가 판정 | loop-ledger iteration/budget — iterations(폭주 방어) 와 verified(전진량) 를 분리 |
| 판정 불가도 코드가 판정 | bench — 표본 부족·과제 셋 불일치·범위 겹침이면 차이를 말하지 않는다 (§3.5) |
| 이해 부채 가드 | 인박스 리뷰 큐 + push/release 금지 (REQ-008) |
| 기록 없는 실행 없음 | loop-history.jsonl start/end 의무 (REQ-006) |

SPEC: `.vibe/specs/loop-engineering.md`
