# Coverage Loop — RTM 기반 완료 판정

> vibe.run SKILL.md 에서 RTM/커버리지 검증이 필요할 때 로드한다.
>
> **루프 시맨틱(ANCHOR/ACT/JUDGE/RECORD/stuck/max_iterations)의 SSOT 는
> `vibe/rules/loop-contract.md` 다.** 이 파일은 vibe.run 의 JUDGE 를 RTM 커버리지로
> 구체화하는 방법만 다룬다.

## 문제와 해법

모델은 구현이 부분적일 때도 "완료"라고 보고한다. 그래서 완료 판정을 자기보고가 아니라
**RTM 커버리지 수치**에 맡긴다 — JUDGE 기준은 `coveragePercent === 100`.

> ⚠️ **"루프 종료" ≠ "feature 완료".** stuck·max_iterations 로 루프가 끝나도 커버리지가
> 100% 미만이면 **미달로 기록**한다. 미달을 완료로 표기하는 것은 이 게이트의 존재 이유를
> 무효화한다 — 그게 바로 막으려던 자기보고다.

```
모든 phase 종료
   ↓
   (stuck 판정은 커버리지 수치가 아니라 **발견 해시**로 한다 — 커버리지가 그대로여도
    남은 항목이 달라졌으면 진전이 있는 것이고, 반대로 커버리지가 올라도 같은 발견이
    반복되면 막힌 것이다. SSOT: loop-contract stuck 절)
   ↓
RTM 생성 → coveragePercent, uncoveredRequirements[]
   ↓
100%? ──YES──→ 완료 (최종 RTM 보고)
   │
   NO
   ↓
uncoveredRequirements 를 구현 → RTM 재생성
   ↓
stuck? (연속 2회 동일 발견(discover/findings) 해시 — loop-ledger.js check-stuck)
   ├─ confirm    → 루프 종료 + 사용자 질문 (값 제공 / sub-100 승인 / 중단)
   └─ autonomous → 루프 종료 + 미달 커버리지를 TODO 로 기록 (질문 없음)
   ↓
max_iterations(기본 10) 도달 → 잔여 인박스 이월
```

## RTM 생성

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/spec/index.js').then(t => { const r = t.generateTraceabilityMatrix('{feature-name}', {projectPath: process.cwd()}); console.log(JSON.stringify(r, null, 2)); })"
```

`generateTraceabilityMatrix` 는 동기 함수다 — 반환값에 `.then()` 을 쓰지 않는다.

> SPEC 기본 경로는 `.vibe/specs/<feature>.md` (레거시 프로젝트는 `.claude/vibe/specs/`
> → `.claude/specs/` 로 폴백).
> **`status === 'empty'` 는 게이트 실패/판정불가로 취급한다 — 절대 100% 통과로 읽지 않는다.**

## RTM 지표

| 지표 | 의미 |
|---|---|
| `totalRequirements` | SPEC 의 REQ-* 총 개수 |
| `specCovered` | SPEC 매핑이 있는 요구사항 |
| `featureCovered` | Feature 시나리오가 있는 요구사항 |
| `testCovered` | 테스트 파일이 있는 요구사항 |
| `coveragePercent` | 전체 커버리지 |
| `uncoveredRequirements` | 누락된 REQ-* 목록 |

## 루프 규칙

| 규칙 | 내용 |
|---|---|
| 범위 축소 금지 | "간단히 구현했다"/"기본 버전" 으로 끝내지 않는다 — 요청 전체를 구현한다 |
| 갭 목록은 RTM 이 준다 | `uncoveredRequirements` 배열을 쓴다. 수동 대조하지 않는다 |
| 반복 표시 | 진행 상황에 회전 번호를 표시한다 |
| 수확 체감 | 3회전 이후는 핵심 요구사항(REQ-*-001~003) 우선, P2/P3 는 계속하되 후순위 |

## 금지 표현

커버리지 미달을 완료로 포장하는 문장들 — 발견하면 그 자리에서 구현으로 대체한다.

| 쓰지 않는다 | 대신 |
|---|---|
| "기본 버전을 구현했다" | 전체 버전을 구현한다 |
| "단순화된 접근이다" | 명세대로 구현한다 |
| "X 는 나중에 추가할 수 있다" | X 를 지금 추가한다 |
| "데모 목적으로는" | 프로덕션 수준으로 구현한다 |
| "핵심 기능은 완료됐다" | 모든 기능이 완료돼야 한다 |

## 출력 형식

회전마다 아래를 보고한다 (RTM 원본을 그대로 덤프하지 않는다):

```
Coverage [회전 N]: {coveragePercent}%  (spec {specCovered}/{total} · feature {featureCovered}/{total} · test {testCovered}/{total})
Uncovered: REQ-login-004, REQ-login-007
→ 미달 — uncovered 구현 진행
```

100% 도달 시 build/test 결과를 함께 붙이고 RTM 저장 경로를 보고한다.
