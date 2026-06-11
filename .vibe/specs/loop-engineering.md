---
status: completed
---

# SPEC: loop-engineering

> 루프 엔지니어링 리서치(Osmani 2026-06, Steinberger, Cherny)에서 확인된 vibe의 공백 보완.
> vibe는 하네스 계층(비계·게이트·메모리)은 충실하나, **Automations 계층**(스케줄된 발견/분류 → 자율 반복)이 없다.
> 원칙: 루프의 완료 판정은 모델의 자기 보고가 아니라 **run-ledger/verify 게이트가 결정**한다. 루프는 기존 결정론 게이트(scope-guard, verifyGate, auto-commit 게이트) 위에서만 돈다.

## 요구사항

### REQ-loop-engineering-001: 루프 정의 아티팩트 표준
루프는 `.vibe/loops/<name>.md`에 frontmatter로 선언한다: `name`, `trigger`(scheduled|manual|on-event), `schedule`(cron, scheduled일 때), `goal`(사람이 읽는 목표), `discover`(일거리 발견 지시), `pipeline`(vibe.* 스킬 체인), `verify`(ledger|tests|none — 완료 판정 방식), `max_iterations`, `isolation`(worktree|none), `status`(active|paused). Git에 커밋되는 프로젝트 자산이다.

### REQ-loop-engineering-002: 루프 템플릿
`vibe/templates/loop-template.md` — 기존 템플릿(`spec-template.md` 등)과 같은 형식으로 제공한다.

### REQ-loop-engineering-003: 루프 정의 검증 도구
`src/tools/loop/validateLoopDefinition.ts` — frontmatter 필수 필드, enum 값, `max_iterations` 범위(1–50)를 결정론적으로 검증. `dist/tools` 경유로 스킬이 호출한다. 검증 실패 루프는 install/run 금지.

### REQ-loop-engineering-004: /vibe.loop 스킬 (entry tier)
서브커맨드: `design`(인터뷰→정의 생성) · `install`(하네스 프리미티브 매핑) · `run`(1회 반복 실행) · `status`(이력/인박스) · `list`. `GLOBAL_SKILLS_ENTRY`에 등록.

### REQ-loop-engineering-005: 완료 판정의 결정론화
`verify: ledger` 루프의 반복 종료 조건은 `.vibe/metrics/run-ledger.json`의 `verifyPassed === true`다. `verify: tests`는 테스트 명령 exit code다. 모델의 "완료했습니다" 자기 보고는 종료 조건이 될 수 없다.

### REQ-loop-engineering-006: 루프 실행 이력
`hooks/scripts/loop-ledger.js` CLI — `start <name>` / `end <name> <ok|fail|stuck> [summary]`가 `.vibe/metrics/loop-history.jsonl`에 append. 스킬의 run 단계가 의무 호출한다.

### REQ-loop-engineering-007: 하네스 매핑 (install)
루프 정의는 하네스 중립이고, install이 실행 환경별 명령을 생성한다:
- Claude Code: `/loop <interval> "/vibe.loop run <name>"` 또는 스케줄드 루틴, OS cron 폴백(`claude -p "/vibe.loop run <name>"`)
- Codex: Automations 등록 안내(`$vibe.loop run <name>`)

### REQ-loop-engineering-008: 트리아지 인박스 (이해 부채 가드)
루프 실행 결과는 `.vibe/loops/inbox.md`에 사람 리뷰 큐로 누적된다(루프명, 시각, 한 일, 검증 결과, 리뷰 필요 항목). **루프는 push·release·배포를 절대 수행하지 않는다** — 커밋까지만(그것도 auto-commit verify 게이트 통과 시).

### REQ-loop-engineering-009: stuck 감지의 결정론화
연속 2회 반복에서 discover 산출물 해시가 동일하면 루프를 중단하고 인박스에 stuck으로 기록한다. 해시 비교는 loop-ledger가 수행한다(자기 판단 금지).

### REQ-loop-engineering-010: worktree 격리
`isolation: worktree` 루프는 항목별 git worktree에서 실행해 병렬 충돌을 방지한다(기존 git-worktree 스킬 재사용).

### REQ-loop-engineering-011: 내장 트리아지 루프 레시피
`design` 기본 제안으로 nightly-triage 레시피 제공: 회귀 레지스트리 open 항목 + 테스트 실패 + contract drift 스캔 → 우선순위 목록 → 항목별 run/verify 파이프라인 → 인박스 보고.

### REQ-loop-engineering-012: 문서 등록
CLAUDE.md/AGENTS.md 진입점 목록과 Git include 목록(`.vibe/loops/`), README 주요 기능에 1줄, SKILL-CATALOG 재생성.

## 비범위 (후속)
- CC 스케줄드 루틴 API 직접 연동(현재는 명령 생성까지)
- Codex Automations API 연동
- 루프 간 의존성/조합(DAG)
