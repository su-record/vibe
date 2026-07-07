---
name: system-lean-hardening
status: approved
created: 2026-07-07
source: .vibe/reports/analysis-2026-07-07-system-audit.md
---

# SPEC: system-lean-hardening — 전 시스템 병목·오버헤드 제거 + 고도화

## 목표 (Done 의 정의)

진단 리포트의 P1/P2 항목을 해소하고, 동종 결함의 재발을 정적 테스트로 봉쇄한다.
완료 판정 = 아래 수용 기준 전부 통과 + `npm run build && npx vitest run` 그린 + hooks 테스트 그린.

## 범위

### A. 깨진 배선 수리 (P1)

- **A1** `contract`, `regress` 를 `GLOBAL_SKILLS_CORE` (`src/cli/postinstall/constants.ts`) 에 추가.
  - 근거: 설치되는 entry 스킬(`vibe.contract:33`, `vibe.regress:31,35`, `vibe.verify:98,102`)이 체인 호출하는 body 가 어떤 설치 목록에도 없음 → 실설치에서 런타임 깨짐.
- **A2** `hooks/scripts/step-counter.js:50-58` 자체 stdin 리더(64KB 단일버퍼, 절단 버그) 를 `lib/hook-context.js` 의 `readStdinSync` 로 교체.
- **A3** `package.json` `files` 에서 존재하지 않는 `commands/` 항목 제거.

### B. 죽은 자산 제거 (P1)

- **B1** `hooks/scripts/hud-status.js` 삭제 (참조 0).
- **B2** `hooks/scripts/evolution-engine.js` 삭제 (훅 미등록, prompt-dispatcher.js:196-234 에 기능 인라인 존재).
- **B3** `hooks/scripts/skill-injector.js` 삭제 (훅 미등록, 실 SessionStart 는 session-start.js).
- **B4** `src/infra/lib/evolution/__tests__/integration.test.ts` 의 B2/B3 존재확인 절 삭제.
- **B5** `agents/acceptance-tester.md` 삭제 + `constants.ts` 매핑(CLAUDE_MODEL_MAPPING 등)·`remove.ts` 목록에서 제거 (호출자 0).
- **B6** `agents/figma/figma-engineer.md` 삭제 + `STACK_TO_AGENT_GROUPS` 의 `figma` 그룹 정리 (그룹 내 유일 에이전트) + 관련 상수·remove 목록 정리.
- **B7** `src/cli/setup/GlobalInstaller.ts` 죽은 함수 삭제: `installGlobalCorePackage`, `copyHookScripts`, `registerMcpServers`, `cleanupGlobalSettingsHooks` (라이브 정본은 `global-config.ts:103`). `writeHookPackageJson` 만 존치. `setup.ts`/`setup/index.ts` 재수출 정리.
- **B8** 죽은 barrel 삭제: `src/cli/setup/index.ts`, `src/cli/postinstall/index.ts` (importer 0).

### C. 핫패스 최적화 (P2)

- **C1** `hooks/scripts/code-check.js:254-262` — 매 Edit 마다 실행되는 SQLite `addObservation` 을 **위반 검출 시에만** 기록하도록 조건화. `validateCodeQuality` 는 대상 확장자 아닌 경우 import 전에 조기 반환.
- **C2** `hooks/scripts/step-counter.js:220-257` — current-run.jsonl 풀리드 2회를 stat + 단일 tail 윈도우 리드로 교체 (동일 판정 결과 유지).

### D. 중복 통합 (P2)

- **D1** `globToRegExp` 를 `hooks/scripts/lib/` 로 승격, `code-check.js:50-72`·`scope-guard.js:55-77` 양쪽 교체.
- **D2** stdin 리더를 `lib/hook-context.js` 정본으로 통일 (A2 포함; hook-payload.js 는 codex 어댑터 경로라 검토 후 가능하면 통일).
- **D3** `buildCtx` 에 `ctx.filePath` 정규화 추가, 인라인 추출 7곳(auto-format:27 · auto-test:36 · post-edit:26 · code-check:112 · scope-guard:90 · step-counter:68 · sentinel-guard:36) 교체.
- **D5** `constants.ts` 의 동일 스택해석 루프 3벌(resolveLocalSkills:131 / resolveExternalSkills:159 / resolveLocalAgentGroups:214)을 제네릭 헬퍼 1개로 통합 (공개 API 시그니처 유지).
- **D6** `src/cli/index.ts` 프로바이더 커맨드 4벌 클론(claude:138 / gpt:171 / antigravity:206 / zai:260)을 테이블 기반 디스패치로 통합.

### E. 컨텍스트 다이어트 (P2)

대상 6개 SKILL.md 의 rubric·출력 템플릿·워크드 예시를 `references/` 로 이동, SKILL.md 는 프로세스 골격 + 참조 포인터만 유지 (figma/docs 선례 패턴):

- **E1** `skills/vibe.review/SKILL.md` (629L → 목표 ≤300L)
- **E2** `skills/vibe.figma/SKILL.md` (614L → ≤300L)
- **E3** `skills/vibe.analyze/SKILL.md` (533L → ≤300L)
- **E4** `skills/clone/SKILL.md` (502L → ≤300L)
- **E5** `skills/vibe.utils/SKILL.md` (415L → ≤250L)
- **E6** `skills/vibe.reason/SKILL.md` (333L → ≤200L)

제약: frontmatter·트리거·체인 호출 계약은 불변. 이동만 하고 내용 요약·삭제 금지.

### F. 재발 방지 고도화

- **F1** 정적 무결성 테스트 신설 (vitest): entry 스킬 SKILL.md 가 체인 호출(`Load skill \`X\``)하는 body 스킬은 반드시 설치 목록(GLOBAL_SKILLS ∪ STACK ∪ CAPABILITY)에 존재해야 함 — A1 재발 방지.
- **F2** 훅 참조 무결성 테스트 신설: `hooks/scripts/*.js` 각각이 hooks.json·antigravity-hooks.json·dispatcher·skills·src 어딘가에서 참조되어야 함 (lib/·__tests__ 제외) — B1~B3 재발 방지.
- **F3** 에이전트 참조 무결성 테스트 신설: `agents/**/*.md` 각각이 skills/ 또는 vibe/rules/ 에서 호출 근거를 가져야 함 — B5/B6 재발 방지.
- **F4** `.vibe/specs/vibe-design.md` frontmatter `status: pending` → `implemented` 갱신 (구현 완료 확인됨).

## 명시적 제외 (이번 스코프 아님)

- clone-* ↔ figma-* 공유 lib 화 (~1900L): 3.1.x clone 대수술 직후 회귀 리스크 — 별도 트랙.
- capability/stack 잎새 스킬 제거 (video-production 등): 유지 비용 ≈ 0, 보류.
- chub-usage/context7-usage 삭제: 사용자 판단 항목으로 유보 (기본: 유지).
- G6 테스트 공백 트랙 (codex-proxy 등 대형 무테스트 파일): 특성화 테스트 선행 필요 — 별도 트랙.
- Stop 디스패처 spawn 구조 변경: 스펙 의도대로 유지.

## 수용 기준 (JUDGE 게이트)

1. `npx vitest run` 전체 그린 (신설 F1–F3 포함).
2. `npm run build` 성공, `node --check` 전 훅 스크립트 통과.
3. `grep -rn "hud-status\|evolution-engine\|skill-injector\|acceptance-tester\|figma-engineer" src/ hooks/ skills/ agents/` = 0 (문서·리포트 제외).
4. `constants.ts` 에 `contract`·`regress` 존재, F1 테스트가 이를 검증.
5. E1–E6 각 SKILL.md 줄수 목표 달성 + `references/` 파일 생성 + 원문 내용 보존 (diff 검증).
6. step-counter: 64KB 초과 payload 테스트 케이스 통과 (신규 단위 테스트).
7. code-check: 무위반 Edit 경로에서 SQLite write 미발생 (신규 단위 테스트).
8. 기존 hooks `__tests__` 전체 그린.

## 작업 순서 (병렬 ACT 플랜)

- Track 1 (hooks): A2, B1–B4, C1, C2, D1–D3 — 상호 의존, 단일 트랙 순차
- Track 2 (src): A1, A3, B5–B8, D5, D6, F4 — Track 1 과 독립
- Track 3 (skills): E1–E6 — 완전 독립, 파일별 병렬 가능
- Track 4 (tests): F1–F3 — Track 1·2 완료 후
