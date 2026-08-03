# TODO: 하니스 보완 후속 작업

> 출처: `.vibe/reports/harness-2026-07-15.md` (모델 업그레이드 대응성 평가 + 게이트 복구 3차).
> 게이트 복구(테스트 9개, 카탈로그, 개수 drift, 20/50 충돌)는 2026-07-15 완료. 아래는 잔여 항목.

## P1

- [x] **CI에 validator 3종 편입** — 해소됨. 로컬에서 `test.yml` build job 에 3종을 넣었으나, origin/main `20e5d12` 가 같은 문제를 더 넓게(`sync:agent-models:check`·`validate:mermaid` 포함 5종) test job 에서 해결해 두었다. build/test 둘 다 필수 체크라 머지 차단력은 동일하므로 로컬 중복분은 되돌리고 업스트림 쪽을 SSOT 로 둔다. 추가로 `repo-hygiene-remediation` REQ-002 가 `verify` job(lint·복잡도 라쳇)을 붙였다 — 이 항목이 미해결로 남아 있던 동안 drift 2건(README 의 Cursor 잔존, Node 배지 `>=18`)이 CI 를 통과해 3.2.16 에 실렸고, `validate:counts` 에 하네스·엔진 대조를 추가해 같은 종류를 막았다.
- [x] **agy stdin 전송 전환** — 2026-07-15 완료. 선행 조건이던 agy stdin 지원을 릴리즈 노트로 확인: v1.1.1 "prompt를 플래그로 받으면 stdin을 읽지 않음"(= 플래그 없으면 stdin에서 읽음), v1.1.2 "piped prompt가 stdin을 점유할 때 OAuth 입력을 /dev/tty·CONIN$로 우회". `callAntigravityCli()`를 `['-p']` + stdin pipe로 전환(codex/claude 경로와 동일), `llm-orchestrate-antigravity.test.js` win32 skip 해제 + 멀티라인 프롬프트 단언으로 계약 고정. 전체 스위트 1372 passed / 1 skipped / 0 failed.

## P2

- [ ] **RTM 복구** — SPEC 요구사항 ID 패턴 ↔ 파서 정규식 정합, co-located test + `hooks/**/__tests__` 탐색, split SPEC/Feature 구조 지원. 구조적 작업 — `/vibe.spec`으로 범위 확정 권장.
- [ ] **model-upgrade parity 운영화** — `SkillEvalRunner` → old/new baseline → with-skill → `ParityTester` → `DeprecationDetector`를 실행 가능한 command로 연결. `MIN_EVAL_CASES`/`MIN_IMPROVEMENT`를 `runParityTest()`에 실제 적용. 측정 대상 1순위: `vibe.harness`의 explorer 3개 fan-out, agent low/medium/high 티어 변형, core reviewer.

## P3

- [ ] **위험 기반 routing 축소** — parity 측정 결과가 나온 뒤: 고정 Haiku/Sonnet/Opus 티어를 capability profile로, 12+ reviewer fan-out을 기본 reviewer + 변경 위험 기반 specialist로 교체. **측정 전 가지치기 금지.**
