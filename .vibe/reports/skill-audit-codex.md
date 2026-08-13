# CC ↔ Codex 스킬·에이전트 감사 보고서

> ⚠️ **이후 변경 (v3.2.22, 2026-08-09)**: 이 문서가 언급하는 `OrchestrateWorkflow` 는 참조 0건으로 확인돼 삭제됐다. 아래 본문은 **작성 시점의 사실**이며 수정하지 않는다 — 당시 판단의 근거를 남기기 위함이다.


## 1. 결론

- **목표 A — 하네스 동등성: 미달.** 동일한 Markdown 자산을 양쪽에 복사하는 수준의 배포는 있으나, 다수 스킬이 Claude Code의 `SlashCommand`, `Task/Agent(subagent_type=...)`, `Read/Write/Glob/WebFetch/AskUserQuestion`, Stop/PostToolUse hook을 실행 계약으로 사용한다. 특히 `vibe/SKILL.md`는 `SlashCommand({command: "/vibe..."})`를 직접 지시하고, agent 설치기는 Codex에도 CC용 model/tool/permission frontmatter를 변환해 넣으므로 “100% supported”를 입증하지 못한다.
- **목표 B — 모델 오버헤드: 미달.** 51개 `SKILL.md`는 총 **10,073줄, 371,076 bytes**다. 호출 시 전문이 로드되는 조건에서 250줄 초과 12개는 총 **4,661줄**, 그중 250줄 이후만 **1,661줄 / 약 15,898 tokens**다(UTF-8 bytes÷4 근사). `vibe.run`과 `vibe.figma` 두 파일만 호출당 약 8.3k/8.6k tokens이며, 250줄 이후가 약 5.0k/6.1k tokens다.
- **권고 판정 분포:** keep 18, slim 21, merge 9, split 3, delete 0. 공개 스킬 자체의 즉시 삭제보다는 중복 병합과 progressive disclosure가 우선이다.
- **빈 core 디렉터리 7개는 삭제 가능.** 2026-07-22의 namespace 통합 뒤 `vibe.{spec,test,contract,regress,figma,clone,docs}`에 본문이 흡수되었다. 테스트도 `vibe.core.*` 공개 이름이 없어야 한다고 강제하며 설치 상수에도 없다. Git은 빈 디렉터리를 추적하지 않으므로 런타임 자산이 아니라 로컬 잔재다.
- **agents 11개 중 완전 orphan은 없다.** 다만 `build-error-resolver`는 실질 dispatch가 거의 없고 자동 발견에 기대는 준-dead 정의다. 더 큰 문제는 Codex 전용 agent 변환/등록 경로가 없다는 점이다.

## 2. 조사 방법과 범위

- `skills/*/SKILL.md` 51개와 `agents/**/*.md` 11개를 각 파일 EOF까지 실제 판독했다. 줄 수는 `wc -l`, 크기는 `wc -c`, 참조는 저장소 전체 `rg`, 배선은 설치 상수·설치기·무결성 테스트·Git 이력으로 교차확인했다.
- 토큰 수는 tokenizer가 아니라 **UTF-8 bytes÷4 근사치**다. 한국어/코드/표 비율에 따라 실제 토큰과 차이가 있으므로 상대적 컨텍스트 비용 지표로 사용했다.
- 사용자가 작업 중인 `skills/vibe.test/SKILL.md`, `skills/vibe.clone/`는 읽기만 했고 수정하지 않았다. 감사 시작 시 확인된 해당 변경과 신규 reference 파일도 보존했다.
- 분석 소요 시간: 약 **175초**.

## 3. 250줄 초과 비용

| 스킬 | 전체 줄 | 250줄 초과 | 전체 근사 tokens | 250줄 이후 근사 tokens | 판정 |
|---|---:|---:|---:|---:|---|
| vibe.run | 845 | 595 (70.4%) | 8,291 | 5,049 | split |
| vibe.figma | 839 | 589 (70.2%) | 8,589 | 6,101 | split |
| vibe.clone | 451 | 201 (44.6%) | 5,429 | 2,175 | slim |
| vibe | 306 | 56 (18.3%) | 3,746 | 478 | slim |
| vibe.review | 302 | 52 (17.2%) | 3,289 | 437 | slim |
| vibe.analyze | 296 | 46 (15.5%) | 2,607 | 353 | split |
| vibe.docs | 292 | 42 (14.4%) | 2,615 | 411 | slim |
| vibe.capability-loop | 274 | 24 (8.8%) | 2,591 | 280 | slim |
| vibe.trace | 270 | 20 (7.4%) | 2,317 | 165 | merge |
| vibe.contract | 268 | 18 (6.7%) | 2,208 | 184 | slim |
| vibe.test | 263 | 13 (4.9%) | 2,775 | 184 | slim |
| vibe.regress | 255 | 5 (2.0%) | 2,389 | 81 | slim |
| **합계** | **4,661** | **1,661** | **46,846** | **15,898** | |

`vibe.run`은 arch-guard, exec-plan, restraint 세 내부 구현을 모든 호출에 번들한다. `vibe.figma`는 READ/WRITE와 세 branch, 추출·정제·SCSS·검증을 함께 싣는다. 두 파일은 라우터를 100줄 안팎으로 남기고 조건부 reference/body로 분리할 때 절감 폭이 가장 크다. `vibe.clone`은 이미 references 분리가 진행 중이므로 중복 router/execution plan을 줄이는 편이 안전하다.

## 4. 51개 스킬 파일별 판정

| # | 스킬 | 줄 | 판정 | 근거 |
|---:|---|---:|---|---|
| 1 | vibe.agents-md | 170 | **slim** | discoverable 정보 제거 원칙은 유효하지만 긴 표·보고 템플릿을 매번 로드한다. `Glob:`과 “Claude Code follows @docs”를 하네스 중립 탐색/참조 규칙으로 바꿔야 한다. |
| 2 | vibe.analyze | 296 | **split** | 코드·문서·웹·Figma 네 실행기를 한 번에 로드한다. `Agent(subagent_type=...)`, `Read(pages)`, `WebFetch`가 CC 전용이므로 얇은 mode router와 조건부 references로 분리한다. |
| 3 | vibe.brand-assets | 148 | **slim** | 멀티사이즈 자산 배선은 `vibe.image`와 구별되지만 산출물·prompt·flow가 반복된다. hook script 경로와 `/vibe.run` 자동호출 전제를 portable CLI 계약으로 축약한다. |
| 4 | vibe.capability-loop | 274 | **slim** | failure→capability 개념은 독립적이나 진단표·의사코드·결정트리가 반복된다. `save_memory`, hook 및 deprecated alias 의존과 자동 trigger의 약한 배선을 제거한다. |
| 5 | vibe.chub-usage | 140 | **merge** | `vibe.context7-usage`와 최신 외부 문서 조회→격리 요약→fallback 업무가 같다. provider adapter 하나로 합치고 `Task/Explore/haiku` 및 자동 plugin 설치 지시를 제거한다. |
| 6 | vibe.clone | 451 | **slim** | 앞 router/execution plan과 뒤 bundled Phase 0–5가 중복된다. 이미 분리 중인 references를 활용하되 현재 사용자 작업 파일은 건드리지 않는다. |
| 7 | vibe.commerce-patterns | 65 | **keep** | 결제 idempotency·재고 예약·상태 머신의 비자명 guardrail이 짧고 응집돼 있다. `e2e-commerce`는 구현이 아닌 검증 역할이라 분리가 타당하다. |
| 8 | vibe.commit-push-pr | 77 | **slim** | shipping workflow와 중첩되고 무조건 `Co-Authored-By: Claude`가 Codex parity를 깬다. 외부 push/PR 확인 gate와 하네스 중립 attribution만 남긴다. |
| 9 | vibe.context7-usage | 107 | **merge** | chub wrapper와 동일 목적이다. `/context7:docs`, `/plugin install`, Task/Explore는 CC/plugin 전용이므로 공통 documentation-provider skill로 병합한다. |
| 10 | vibe.continue | 32 | **slim** | 진입점은 필요하지만 `core_start_session`과 `/new`가 Codex callable 계약이 아니다. portable checkpoint/memory 탐색과 재호출 절차만 유지한다. |
| 11 | vibe.contract | 268 | **slim** | 앞 command 설명과 bundled implementation이 schema/integration/done을 약 1/3 반복한다. 단일 구현과 `Load skill vibe.*` 형태의 하네스 중립 chain만 남긴다. |
| 12 | vibe.create-prd | 91 | **keep** | 8-section PRD라는 독립 산출물이고 personas/prioritization과 역할이 다르다. 다만 `chain-next` 순환의 재진입 방지는 dispatcher에서 보장해야 한다. |
| 13 | vibe.design-refine | 140 | **keep** | distill/normalize/polish 수정 패스가 명확하며 read-only review와 겹치지 않는다. slash 표기만 Codex skill 호출로 번역하면 된다. |
| 14 | vibe.design-review | 143 | **keep** | 기술 audit와 UX critique를 read-only로 수행하고 refine과 발견↔수정 관계가 명확하다. 병렬 auditor 호출에 Codex collaboration adapter가 필요하다. |
| 15 | vibe.design-teach | 184 | **merge** | audience/brand/aesthetic 인터뷰가 `vibe.design init --from=interview`와 이중 SSOT를 만든다. design init에 흡수하고 호환 alias만 둔다. |
| 16 | vibe.design | 205 | **keep** | DESIGN.md parser/tests와 연결된 실제 lint/verify 진입점이다. `getCurrentTime`과 SlashCommand 호출을 중립화하고 미구현 sync 설명은 reference로 내린다. |
| 17 | vibe.devlog | 144 | **slim** | 생성 규칙은 유효하지만 post-commit hook과 `devlog-gen.js`에 전적으로 기대 Codex notify 동등성이 없다. autoPush는 명시 확인 뒤에만 허용해야 한다. |
| 18 | vibe.docs | 292 | **slim** | 7개 문서 mode의 머리말·pipeline·subcommand 설명이 반복된다. router만 남기고 기존 references로 세부 구현을 이동한다. |
| 19 | vibe.e2e-commerce | 63 | **keep** | 결제·재고·환불 E2E 시나리오가 작고 명확하다. 본문 링크 `commerce-patterns`의 namespace만 바로잡을 대상이다. |
| 20 | vibe.educational-content | 157 | **keep** | 학습성과→근거→연습→평가 gate가 독립적이고 세부 schema도 references로 분리됐다. CC 전용 실행 문법이 없다. |
| 21 | vibe.event-comms | 173 | **merge** | SMS/BCC/SNS 규칙이 event umbrella와 event-ops에 중복된다. 독립 auto skill 대신 event의 comms reference로 흡수한다. |
| 22 | vibe.event-ops | 208 | **merge** | ops뿐 아니라 speaker research/outreach/intro까지 planning/comms 경계를 침범한다. event umbrella 아래 materials/operations reference로 재구획한다. |
| 23 | vibe.event-planning | 145 | **merge** | D-Day 표·state·safety가 `vibe.event`에 거의 그대로 중복된다. 단일 timeline reference로 합친다. |
| 24 | vibe.event | 165 | **slim** | umbrella router는 필요하지만 planning 표와 state schema를 재수록한다. 라우팅·승인 경계만 남기고 named CC agent dispatch는 adapter로 표현한다. |
| 25 | vibe.figma | 839 | **split** | READ/WRITE와 세 branch를 모두 로드해 250줄 이후만 약 6.1k tokens다. 얇은 router와 read/write 조건부 본문으로 분리하고 CC/plugin 고유 tool명을 capability 기반으로 바꾼다. |
| 26 | vibe.git-worktree | 74 | **keep** | 표준 git 명령과 두 workflow만 담은 짧고 하네스 중립적인 참조다. |
| 27 | vibe.handoff | 112 | **merge** | `vibe.continue`와 세션 상태 저장/복원 목적이 겹친다. 존재하지 않는 `core_*memory` 호출 대신 portable HANDOFF fallback을 continue에 병합한다. |
| 28 | vibe.harness | 179 | **slim** | `Agent(...Explore, haiku)`와 CLAUDE/.claude/PostToolUse 중심 점수 때문에 Codex를 공정하게 측정하지 못한다. AGENTS/hooks-notify 대칭 항목과 native delegation으로 고친다. |
| 29 | vibe.image | 62 | **keep** | 단일 CLI script 계약으로 작고 양 하네스에서 shell 실행 가능하다. 설치 시 `{{VIBE_PATH}}` 치환 검증만 필요하다. |
| 30 | vibe.llm | 50 | **keep** | 실제 `vibe llm list|refresh` CLI를 가리키는 얇은 wrapper로 오버헤드가 최소다. |
| 31 | vibe.loop | 116 | **keep** | 완료를 ledger/test exit로 판정하고 CC schedule과 Codex Automations를 명시적으로 분기한다. 내부 `/vibe.*` 표기만 `$vibe.*` adapter가 필요하다. |
| 32 | vibe.parallel-research | 92 | **slim** | 모든 복잡 과제에 4 worker+합성을 강제해 모델 호출 병목을 만든다. 2개 기본 렌즈와 위험 기반 선택 렌즈로 줄이고 CC Task/WebSearch 명칭을 제거한다. |
| 33 | vibe.presentation | 83 | **keep** | 16:9 HTML/PDF deck 계약이 짧고 자체 포함이다. educational-content의 교수설계와 산출 목적이 달라 병합 실익이 없다. |
| 34 | vibe.prioritization | 88 | **keep** | 9개 프레임워크 선택 기준과 수식이 작고 하네스 의존이 없다. |
| 35 | vibe.priority-todos | 66 | **merge** | `vibe.review` Phase 6가 같은 P1/P2/P3 todo 생성·index 흐름을 소유한다. review의 reference로 흡수한다. |
| 36 | vibe.react-best-practices | 61 | **keep** | React/Next 고신호 성능 gotcha가 짧고 stack mapping도 명확하다. 일반 review-performance보다 구체적이다. |
| 37 | vibe.reason | 153 | **slim** | 9단계 추론 틀은 유효하지만 timer, 긴 node 예시와 점수식이 본문을 부풀린다. 이미 있는 references로 이동한다. |
| 38 | vibe.regress | 255 | **slim** | 앞 wrapper가 뒤 bundled implementation을 재진술한다. 250줄 초과 자체는 작지만 중복 wrapper를 제거해야 한다. |
| 39 | vibe.review | 302 | **slim** | references가 있는데 템플릿/예시와 CC `Task(subagent_type=...)`, `/codex:*` 호출이 본문에 남아 있다. 하네스 중립 reviewer delegation과 핵심 gate만 둔다. |
| 40 | vibe.run | 845 | **split** | arch-guard/exec-plan/restraint를 매번 로드하는 최대 병목이다. 조건부 internal references로 분리하고 CC tools/hooks를 명시적 dual-harness adapter로 바꾼다. |
| 41 | vibe.scaffold | 197 | **slim** | stack별 tree와 출력 예시가 장황하다. templates/references로 옮기고 CLAUDE/.claude 및 Glob 중심 표현을 중립화한다. |
| 42 | vibe.seo-checklist | 59 | **keep** | 짧고 독립된 public-web checklist이며 auto trigger와 완료조건이 명확하다. |
| 43 | vibe.spec | 209 | **slim** | 얇은 entry라고 선언하지만 wrapper와 bundled spec이 반복된다. Task/Read/SlashCommand 대신 단일 구현과 skill-load chain만 남긴다. |
| 44 | vibe.test | 263 | **slim** | 긴 JSON/Markdown template를 reference로 내릴 수 있다. 더 중요하게 agent probe가 `<install>/agents/*.md`만 봐 ui/event 하위 디렉터리를 누락하며, 현재 사용자 수정 중이므로 이번에는 제안만 한다. |
| 45 | vibe.tool-fallback | 105 | **slim** | Claude/GPT/Antigravity 고정 순서와 Claude built-in fallback이 provider SSOT와 충돌한다. 공통 circuit-breaker 정책만 유지한다. |
| 46 | vibe.trace | 270 | **merge** | run이 같은 RTM을 만들고 verify가 최종 ledger를 기록한다. verify의 trace mode/reference로 합쳐 상태 삭제와 hook 책임 분산을 없앤다. |
| 47 | vibe.ui-ux-pro-max | 238 | **slim** | 유효한 DB/script capability지만 quick reference·common rules·checklist가 반복되고 references 7개가 이미 있다. 세부를 조건부 로드한다. |
| 48 | vibe.user-personas | 76 | **keep** | 짧은 PM 산출물이고 create-prd/prioritization과 역할이 독립적이다. 완료조건을 보강할 여지는 있다. |
| 49 | vibe.verify | 149 | **keep** | deterministic ledger/JUDGE의 핵심 진입점이다. named agents와 Stop/auto-commit hook에 대해 Codex notify fallback을 명시해야 한다. |
| 50 | vibe.video-production | 53 | **keep** | 짧은 도메인 gotcha와 capability mapping, 완료조건이 분명하다. |
| 51 | vibe | 306 | **slim** | dispatcher는 필요하지만 routing 예시가 반복되고 `SlashCommand({command:"/vibe..."})`가 Codex에서 직접 깨진다. 하네스별 invocation adapter를 최상단 실행 계약으로 둔다. |

## 5. 중복 스킬 지도

| 중복군 | 판정 | 실제 중복 |
|---|---|---|
| `vibe.chub-usage` ↔ `vibe.context7-usage` | merge | 최신 문서 검색, 격리된 요약, provider fallback |
| `vibe.design-teach` ↔ `vibe.design init --from=interview` | merge | audience/brand/aesthetic/constraints 인터뷰와 SSOT 생성 |
| `vibe.event` ↔ `event-planning` ↔ `event-comms` ↔ `event-ops` | umbrella slim + 3 merge | D-Day/state/safety, SMS/email/SNS, outreach와 materials 경계 중복 |
| `vibe.handoff` ↔ `vibe.continue` | merge | 세션 상태 저장·복원·다음 세션 진입 |
| `vibe.priority-todos` ↔ `vibe.review` Phase 6 | merge | P1/P2/P3 todo와 index 생성 |
| `vibe.trace` ↔ `vibe.run` RTM ↔ `vibe.verify` ledger | merge into verify | 요구사항 trace 생성과 최종 verified 상태 기록 |
| `vibe.contract/spec/regress` 각 앞 wrapper ↔ 같은 파일 bundled body | slim | usage/schema/integration/done을 파일 안에서 두 번 설명 |
| `vibe.clone` router plan ↔ bundled Phase flow | slim | 같은 capture/refine/spec/SCSS/validate 명령 반복 |

병합하지 않을 유사쌍은 `commerce-patterns`↔`e2e-commerce`(구현 guardrail vs 검증), `educational-content`↔`presentation`(교수설계 vs deck 제작), `design-review`↔`design-refine`(읽기 vs 수정), `react-best-practices`↔일반 review performance(프레임워크 지식 vs 범용 lens)다.

## 6. Codex에서 깨지거나 약화되는 실행 계약

1. **SlashCommand 직접 실행:** `vibe` 163–168행이 `SlashCommand({command: "/vibe..."})`를 규정한다. Codex의 실제 표면은 `$vibe.*`/skills이므로 dispatcher 핵심 chain이 실행 불가능하다. 대부분의 entry skill 내부 `/vibe.*` 자동 chain도 같은 adapter가 필요하다.
2. **CC subagent 문법:** `vibe.analyze`, `vibe.harness`, `vibe.review`, `vibe.run`, `vibe.spec`가 `Task(...)` 또는 `Agent(subagent_type=..., model=haiku)`를 직접 쓴다. Codex native collaboration 호출과 이름·동시성·모델 상속 규칙이 다르다.
3. **CC tool 이름 고정:** `Glob`, `Read/Write tool`, `WebFetch`, `AskUserQuestion`, WebSearch 등의 이름이 여러 본문에 박혀 있다. capability 설명과 하네스별 adapter가 없으면 Codex가 문자 그대로 따라 실패한다.
4. **hook을 correctness 전제로 사용:** `vibe.run`, `verify`, `trace`, `devlog`, `harness`, `capability-loop`는 Stop/PostToolUse/pre-commit/post-commit 또는 additionalContext 주입을 전제한다. Codex `notify`는 turn-complete lifecycle만 대응하며 Stop 차단·PostToolUse 동작과 동등하지 않다. deterministic gate는 hook이 없어도 명시 CLI/JUDGE 단계로 실행돼야 한다.
5. **미등록 core/tool 호출:** `vibe.continue/handoff`의 `core_start_session`, `core_auto_save_context`, `core_*memory`와 `vibe.design`의 `getCurrentTime`은 Codex callable surface로 확인되지 않았다.
6. **고정 모델 라우팅:** 여러 스킬/agent가 Haiku/Sonnet/Opus를 강제하지만 CLAUDE.md의 최신 원칙은 “inherit by default”다. Codex 가용 모델명과도 일치하지 않아 품질 저하 또는 dispatch 실패가 가능하다.

## 7. `skills/vibe.core.*/` 7개 빈 디렉터리

실제 디렉터리는 다음 7개다: `vibe.core.clone`, `vibe.core.contract`, `vibe.core.docs`, `vibe.core.figma`, `vibe.core.regress`, `vibe.core.spec`, `vibe.core.test`. 파일은 모두 0개이며 일부에 빈 `references/`, `templates/`, `rubrics/` 하위 디렉터리만 남았다.

- 2026-07-22 commit `331711a`가 내장 스킬을 `vibe.*` namespace로 통합했다.
- `src/__tests__/skill-namespace.test.ts`는 former wrapper 7종의 공개 이름이 `vibe.{name}` 하나뿐이고 `vibe.core.*`가 하나도 없어야 한다고 검증한다.
- `GLOBAL_SKILLS_*`, `STACK_TO_SKILLS`, `CAPABILITY_SKILLS` 어디에도 core 이름이 없다. Git은 빈 디렉터리를 배포하지 않으므로 현재 폴더는 설치/실행 배선이 아니다.
- **판정: delete.** 로컬 빈 디렉터리 7개와 빈 하위 디렉터리를 제거해도 패키지 동작에 영향이 없다. 이번 요청은 보고서 전용이므로 실제 삭제는 하지 않았다.

## 8. AGENTS.md ↔ CLAUDE.md 드리프트

단순 하네스별 표기 차이를 제외해도 의미 드리프트가 있다.

| 항목 | CLAUDE.md | AGENTS.md | 영향 |
|---|---|---|---|
| scope guard 기본값 | default off, CLI/hooks 공통이라고 명시 | on/off만 표기 | Codex가 기본 활성으로 오해 가능 |
| TypeScript gate 설명 | hook detection과 deterministic gate 책임 분리 | “blocked by auto-commit/Stop/pr-test” | 실제 강제 지점 해석 불일치 |
| complexity | model-judged, regex 미강제 | 제한만 기재 | Codex가 기계 gate로 오해 가능 |
| model routing | **inherit by default**, 구 Haiku/Sonnet 라우팅 폐기 | Exploration→Haiku, Implementation→Sonnet, Architecture→Opus | 현재 agent/skill 고정 모델과 함께 직접 충돌 |
| workflow 호출 | CC `/vibe`, Codex `$vibe`를 병기 | Codex만 기재 | 생성물로서는 정상이나 공통 SSOT 추적이 어려움 |
| Git/경로 | Claude include/exclude | Codex include/exclude | 의도된 차이이나 `.claude/settings.local.json`이 Codex exclude에도 남아 경로 혼합 |

`AGENTS.md`가 `CLAUDE.md`에서 생성된다고 선언하지만 핵심 정책 네 항목이 뒤처졌다. 특히 model inheritance와 scopeGuard default는 실행 비용·행동을 직접 바꾸므로 P1 수준의 문서 동기화 문제다.

## 9. agents/ 참조성과 오버헤드

| agent | 줄 | 참조/dispatch 근거 | 판정 |
|---|---:|---|---|
| architect | 38 | `vibe.run/references/parallel-agents.md`, OrchestrateWorkflow | keep |
| build-error-resolver | 46 | run의 3회 실패 debug 표에만 제한적으로 등장 | keep, **준-dead: 명시 dispatch 보강** |
| code-reviewer | 89 | `vibe.review`가 focus별 다중 직접 호출 | keep |
| e2e-tester | 63 | `vibe.verify --e2e` 직접 참조 | keep |
| event/event-ops | 61 | `vibe.event`, `vibe.event-ops`, capability 조건부 설치 | keep |
| event/event-planner | 63 | `vibe.event` 직접 참조, capability 조건부 설치 | keep |
| implementer | 39 | run parallel-agents, OrchestrateWorkflow | keep |
| security-reviewer | 56 | `vibe.review` 직접 호출 | keep |
| tester | 53 | run parallel-agents, verify/harness | keep |
| ui/design-reviewer | 62 | review에서 세 focus instance 직접 호출 | keep |
| ui/design-system-gen | 63 | run 및 design-teach 직접 참조 | keep |

완전한 죽은 정의는 없지만 다음 구조 문제가 있다.

- `postinstall/main.ts`는 Claude와 Codex 대상 모두에 `installClaudeAgents()`를 사용한다. 생성 frontmatter의 `model: sonnet|opus|haiku`, `tools: Read, Glob, Grep, Write, Edit, Bash`, `permissionMode`, `disallowedTools`, `memory`는 CC schema다. Codex 전용 변환/등록/도구명 mapping이 없어 파일 존재와 실행 가능성이 동일하지 않다.
- UI/event 4개는 조건부로 프로젝트 로컬 설치된다. 그런데 `vibe.test` probe는 `<install>/agents/*.md`만 검사해 재귀 하위 `agents/ui/*.md`, `agents/event/*.md`를 놓친다. 현재 self-test로는 parity를 증명할 수 없다.
- agent description은 tool schema에 상시 노출될 수 있으므로 조건부 그룹 분리는 올바르다. 반면 `vibe.review`가 code-reviewer 8개+security 1개+UI 3개를 한 번에 요구하고 `parallel-research`가 4 worker를 고정하면 모델 호출 수와 합성 비용이 병목이 된다. 위험 기반 lens 선택과 현재 동시성 한도 인지가 필요하다.

## 10. 우선순위 권고

1. **P1 parity:** `vibe`의 SlashCommand chain을 하네스별 invocation adapter로 교체하고, Codex 전용 agent 변환/등록 경로를 만든다. CC hook이 없어도 deterministic CLI gate가 실행되도록 한다.
2. **P1 검증:** `vibe.test` agent 탐색을 재귀화하고 CC/Codex별 frontmatter schema와 실제 invocation smoke test를 분리한다. 사용자 수정 중이므로 충돌 없이 후속 작업으로 잡는다.
3. **P2 컨텍스트:** `vibe.run`과 `vibe.figma`를 router+조건부 body로 split한다. 그 다음 clone/analyze/docs/review/vibe를 slim한다.
4. **P2 중복:** documentation provider, design interview, event 군, continue/handoff, review/todos, verify/trace를 병합한다.
5. **P3 청소:** `vibe.core.*` 빈 디렉터리 7개를 삭제하고 `build-error-resolver`에 실제 dispatch를 추가한다.

## 11. 품질 게이트

- 대상 식별: 51/51 SKILL.md, 11/11 agents 완료.
- 파일 경로/줄 수: 실제 filesystem 기준 검증.
- 하네스 판단: 본문 문법뿐 아니라 설치 상수, installer, wiring tests, Git 이력으로 교차검증.
- 결과 깊이: L3(실행 흐름·배선·비용·실패 지점).
- 보고서 외 코드/스킬/agent 변경: 없음.
