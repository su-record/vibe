# TODO: 하니스 보완 후속 작업

> 출처: `.vibe/reports/harness-2026-07-15.md` (모델 업그레이드 대응성 평가 + 게이트 복구 3차).
> 게이트 복구(테스트 9개, 카탈로그, 개수 drift, 20/50 충돌)는 2026-07-15 완료. 아래는 잔여 항목.

## P1

- [x] **CI에 validator 3종 편입** — 2026-08-03 완료 (`repo-hygiene-remediation` REQ-002). `.github/workflows/test.yml` 의 `verify` job 이 lint·ratchet 포함 6종을 실행한다. 이 항목이 미해결로 남아 있던 동안 drift 2건(README 의 Cursor 잔존, Node 배지 `>=18`)이 또 CI를 통과해 3.2.16 에 실렸다 — `validate:counts` 에 하네스·엔진 대조를 추가해 같은 종류를 막았다.
- [ ] **agy stdin 전송 전환** — `hooks/scripts/llm-orchestrate.js` `callAntigravityCli()`가 argv로 프롬프트를 전달하는데, Windows `cmd.exe /c`는 인자 내 LF에서 명령을 절단해 멀티라인 프롬프트가 구조적으로 깨진다. agy CLI의 stdin 지원 확인 후 codex/claude 경로처럼 stdin 전송으로 전환하고, `llm-orchestrate-antigravity.test.js`의 win32 skip을 해제한다.

## P2

- [ ] **RTM 복구** — SPEC 요구사항 ID 패턴 ↔ 파서 정규식 정합, co-located test + `hooks/**/__tests__` 탐색, split SPEC/Feature 구조 지원. 구조적 작업 — `/vibe.spec`으로 범위 확정 권장.
- [ ] **model-upgrade parity 운영화** — `SkillEvalRunner` → old/new baseline → with-skill → `ParityTester` → `DeprecationDetector`를 실행 가능한 command로 연결. `MIN_EVAL_CASES`/`MIN_IMPROVEMENT`를 `runParityTest()`에 실제 적용. 측정 대상 1순위: `vibe.harness`의 explorer 3개 fan-out, agent low/medium/high 티어 변형, core reviewer.

## P3

- [ ] **위험 기반 routing 축소** — parity 측정 결과가 나온 뒤: 고정 Haiku/Sonnet/Opus 티어를 capability profile로, 12+ reviewer fan-out을 기본 reviewer + 변경 위험 기반 specialist로 교체. **측정 전 가지치기 금지.**
