# Vibe 전 시스템 진단 리포트 (병목·오버헤드 + 고도화 백로그)

- 진단일: 2026-07-07 15:39–15:52 UTC
- 범위: skills 59 · hooks/scripts 43 · agents 15 · src/ (229 modules, ~45.7k LOC) · 설치 배선
- 방법: 병렬 감사 에이전트 5기 (skills / hooks / agents / src / wiring), 파일 전문 리드 기반

## A. P1 — 깨진 배선 (기능 결함)

| # | 발견 | 근거 | 조치 |
|---|---|---|---|
| A1 | `skills/contract`, `skills/regress` 가 어떤 설치 상수에도 없음 → npm 패키지에 실리지만 **어느 하네스에도 설치되지 않음**. 그런데 설치되는 entry 스킬들이 체인 호출 (`vibe.contract:33`, `vibe.regress:31,35`, `vibe.verify:98,102`, `contract:106`) → 실설치에서 `/vibe.contract`·`/vibe.regress`·verify drift 경로 **런타임 깨짐** | constants.ts (ENTRY/CORE/STANDARD/OPTIONAL/STACK/CAPABILITY 전수 확인), `grep -rniE "'(contract\|regress)'" src/` = 0 | `GLOBAL_SKILLS_CORE` 에 두 스킬 추가 (entry→body 페어 패턴의 유일한 누락) |
| A2 | `step-counter.js:50-58` — 64KB 단일버퍼 stdin 리드. 대형 Write payload(파일 전체 내용 포함) 침묵 절단 | 자체 구현 vs 정본 `lib/hook-context.js:50-97` (청크/EAGAIN-safe) | hook-context 의 `readStdinSync` 로 교체 |
| A3 | `package.json` `files` 의 `commands/` 항목 — 디렉토리가 repo 에 존재하지 않음 (installer 는 legacy command 를 삭제하는 쪽) | `ls commands/` 실패, `removeLegacyVibeCommands` main.ts:85-94 | `files` 에서 제거 |

## B. P1 — 죽은 자산 (제거)

| # | 대상 | 근거 |
|---|---|---|
| B1 | `hooks/scripts/hud-status.js` (321L) | repo 전체 참조 0 |
| B2 | `hooks/scripts/evolution-engine.js` (91L) | 훅 등록 없음. 기능은 `prompt-dispatcher.js:196-234` 에 인라인 재구현됨. 존재확인 테스트만 물고 있음 |
| B3 | `hooks/scripts/skill-injector.js` (83L) | 훅 등록 없음 (실 SessionStart 는 session-start.js). 존재확인 테스트만 물고 있음 |
| B4 | `agents/acceptance-tester.md` (글로벌 설치됨) | 어느 스킬/훅도 호출 안 함. 기능은 vibe.review/vibe.verify 가 자체 수행 |
| B5 | `agents/figma/figma-engineer.md` (TS/Flutter 프로젝트 조건부 설치됨) | 호출 0. figma 파이프라인은 skills 가 전담. `STACK_TO_AGENT_GROUPS` 의 `figma` 그룹 매핑도 함께 정리 |
| B6 | `src/cli/setup/GlobalInstaller.ts` 죽은 함수 4: `installGlobalCorePackage`(:50) `copyHookScripts`(:115) `registerMcpServers`(:141, no-op) `cleanupGlobalSettingsHooks`(:150, `global-config.ts:103` 이 라이브 정본) — 라이브는 `writeHookPackageJson` 하나 | 호출부 grep 0. main.ts 가 동일 로직 인라인 보유 (설치 알고리즘 2벌 상태 해소) |
| B7 | 죽은 barrel: `src/cli/setup/index.ts`, `src/cli/postinstall/index.ts` | importer 0 (소비자는 flat shim `setup.ts`/`postinstall.ts`) |
| B8 | 죽은 테스트: `integration.test.ts:155-227` 의 evolution-engine/skill-injector 존재확인 절 | B2/B3 제거와 동반 삭제 |

## C. P2 — 핫패스 오버헤드 (매 이벤트 비용)

| # | 발견 | 조치 |
|---|---|---|
| C1 | `code-check.js:254-262` — **매 Edit 마다** better-sqlite3 `addObservation` 기록 + `validateCodeQuality` 전체 실행. 관측 데이터 소비처 희박 | addObservation 을 위반 발생 시에만 기록(또는 제거), validate 는 관련 확장자만 조기 반환 |
| C2 | `step-counter.js:220-257` — 매 액션 이벤트마다 current-run.jsonl (최대 2MB) **풀리드 2회** | stat + tail 윈도우 리드로 교체 |
| C3 | Stop 시 spawn 4자식 유지 — 스펙 의도이므로 유지하되, 각 자식의 조기 no-op 리턴 보장 확인 | 현상 유지 (heavy 는 auto-commit git 캐스케이드, by design) |

## D. P2 — 중복 로직 (공유화)

| # | 발견 | 조치 |
|---|---|---|
| D1 | `globToRegExp`: `code-check.js:50-72` = `scope-guard.js:55-77` 문자 그대로 복사 | `lib/` 로 승격, 양쪽 import |
| D2 | `readStdinSync` 3벌 (정본 hook-context.js vs step-counter/hook-payload) | hook-context 로 통일 (A2 와 동일 작업) |
| D3 | file_path 추출 인라인 ~7벌 (auto-format:27 · auto-test:36 · post-edit:26 · code-check:112 · scope-guard:90 · step-counter:68 · sentinel-guard:36) | `buildCtx` 에 `ctx.filePath` 추가, 전 훅 교체 |
| D4 | clone-* vs figma-* 5단 파이프라인 구조적 복붙 ~1900L (`parseScss` vs `parseSCSS`, `compareValue` vs `compareCSSValues` 등 이름 드리프트) | 콜드패스이므로 급하지 않음 — `lib/scss-compare.js` + `lib/design-validate.js` 공유화는 별도 트랙 권장 (clone-quality-overhaul 직후라 회귀 리스크) |
| D5 | `constants.ts` 스택 해석 루프 3벌 복붙 (resolveLocalSkills:131 / resolveExternalSkills:159 / resolveLocalAgentGroups:214) | 제네릭 `resolveByStack(map, stacks)` 하나로 통합 |
| D6 | `cli/index.ts` 프로바이더 스위치 4벌 클론 (claude:138 / gpt:171 / antigravity:206 / zai:260) | 테이블 기반 라우팅으로 통합 (433L switch 해소와 동일 트랙) |

## E. P2 — 컨텍스트 오버헤드 (SKILL.md 비대)

references/ 분리 없이 전문 인라인인 대형 스킬 (호출 시 전량 컨텍스트 로드):

| 스킬 | 규모 | 선례 |
|---|---|---|
| vibe.review | 629L / 22.7KB | figma 는 rubrics/·templates/ 분리, docs 는 templates/ 분리 완료 |
| vibe.figma | 614L / 28.3KB | |
| vibe.analyze | 533L / 16.4KB | |
| clone | 502L / 25.1KB | |
| vibe.utils | 415L / 12KB | |
| vibe.reason | 333L / 10KB | |

→ 각 스킬의 rubric·출력 템플릿·워크드 예시를 `references/` 로 이동, SKILL.md 는 프로세스 골격만.

## F. P3 — 정리 후보 (판단 필요)

| # | 대상 | 근거 |
|---|---|---|
| F1 | `chub-usage`(140L), `context7-usage`(107L) | 외부 도구 래퍼, 이미 OPTIONAL(글로벌서 제거), 교차참조 0 — 삭제해도 영향 없음 |
| F2 | `video-production`, `seo-checklist`, `vercel-react-best-practices`, `event-comms` | 외부참조 0 인 capability/stack 잎새 — 유지 비용도 0 에 가까우므로 보류 가능 |
| F3 | diagrammer/documenter 에이전트 | thin (haiku 기계 추출) — 유지 권장 (출력 포맷 규약 가치) |
| F4 | spec 잔여물: `.vibe/specs/vibe-design.md` frontmatter `status: pending` (실제 DONE) · post-task-curation 의 미생성 산출물 `skills/vibe-learn/` | frontmatter 갱신 + vibe-learn 은 스펙에서 의도 재확인 |

## G. 고도화 백로그 (유지 시스템 강화)

| 순위 | 항목 | 내용 |
|---|---|---|
| G1 | 훅 컨텍스트 공유층 강화 | D1–D3 통합으로 lib/hook-context 를 훅 표준 런타임으로 승격 — 신규 훅 작성 비용·버그면 축소 |
| G2 | SKILL.md 다이어트 (E) | 6개 스킬 references/ 분리 — 호출당 컨텍스트 ~40% 절감 추정 |
| G3 | 설치 경로 단일화 | B6 제거로 postinstall main.ts 가 유일한 설치 알고리즘이 됨 + main() 180L 분해 |
| G4 | constants.ts SSOT 강화 | "entry 스킬이 체인 호출하는 body 는 반드시 설치 목록에 존재" 를 vitest 정적 테스트로 강제 (A1 재발 방지) |
| G5 | 죽은 자산 재발 방지 | 훅/에이전트 참조 무결성 테스트 (hooks.json·dispatcher·skills 에서 참조되지 않는 scripts 검출) |
| G6 | 테스트 공백 (별도 트랙) | codex-proxy(1139L)·cli/index.ts·postinstall/main.ts·ProjectSetup(862L)·cursor-skills(798L, 단일함수 785L) — 대형·무테스트. 이번 스코프에선 리팩토링 금지, 특성화 테스트부터 |

## 종합

- 시스템은 이미 1차 다이어트 완료 상태 (agents 71→15, 훅 in-process 평탄화 구현 확인). 남은 것은 **잔여 죽은 자산 8건 + 깨진 설치 체인 1건 + 핫패스 2건 + 중복 6건 + 컨텍스트 비대 6건**.
- 리스크 주의: clone-* 계열은 직전 릴리즈(3.1.x) 에서 대수술 직후 — D4 공유화는 이번 스코프에서 제외 권장.
