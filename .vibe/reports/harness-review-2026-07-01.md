# VIBE 하네스 전면 리뷰 — 모델 급성장 시대의 병목 진단과 개선 방향

> 작성일: 2026-07-01 · 대상: @su-record/vibe v2.16.4 (npm 5만+ 다운로드)
> 방법: 훅 / 스킬 / 에이전트·모델 라우팅 / 루프 계약 / TS 인프라 5개 영역 병렬 전수 분석

---

## 0. TL;DR

VIBE의 **결정론적 척추(run-ledger, discover-hash, 테스트 게이트, sentinel-guard)는 모델이 강해질수록 오히려 더 가치 있다** — 똑똑한 모델일수록 "다 됐다"는 자기보고가 설득력 있어지므로, 코드가 판정하는 ground truth는 유일하게 낡지 않는 자산이다. 이 척추는 전부 합쳐 **~500줄**이다.

문제는 그 척추를 감싼 나머지: **약한 모델을 전제로 한 지시·재교육·2차 검증 스캐폴딩이 이제 성능·비용·유지보수 3중 병목**이 됐다.

| 병목 | 규모 | 핵심 증상 |
|---|---|---|
| 스킬 과잉 처방 | 73개 / 본문 563KB (~140k tok) | `/vibe` 기능 1개에 지시문 30–40k 토큰 로드, priority 90 트리거 남발 |
| 파이프라인 세리머니 | 기능 1개 = 스킬 8회 + 승인 게이트 2중 + 산출물 최대 10개 | 강한 모델이 1패스로 하는 계획을 4단계 아티팩트로 강제 |
| 에이전트 인플레 | 71개 (Opus 배정은 단 1개) | 24개가 네이티브 Explore/Plan의 얇은 래퍼, 마이크로 매니징 프롬프트 |
| 훅 잔소리 | 매 편집 정규식 품질 주입 + 매 프롬프트 자식 스폰 | false-positive가 커밋까지 게이트, deprecated 별칭이 여전히 프로세스 소비 |
| 인프라 중복 | src 68k LOC 중 오케스트레이터 6.2k + 에볼루션 5k + 메모리 3.7k + LLM 프로바이더 4.9k | Claude Code 네이티브(서브에이전트·컴팩션·메모리)와 정면 중복, 모델 테이블 수동 드리프트 |
| 라우팅 독트린 | "탐색→Haiku·Claude는 최후 폴백" | 약한 모델 시대 비용 회피가 정책 SSOT(`types.ts:273`)에 박제 |

**방향: "지시하는 하네스"에서 "검증하는 하네스"로.** 모델에게 *어떻게* 일하는지 가르치는 층을 걷어내고, 모델이 스스로 증명할 수 없는 것(테스트 통과, 스코프 준수, 회귀 기억, 수렴 판정)만 남긴다. 이것이 v3의 정체성이다.

---

## 1. 무엇이 바뀌었나 (전제 조건의 붕괴)

VIBE 설계 당시의 암묵적 전제 vs 2026년 현재:

| 설계 당시 전제 | 현재 |
|---|---|
| 모델은 의도 분류를 못 한다 → 키워드 테이블 | NL에서 라우팅은 네이티브 능력. 14행 intent 테이블 스스로도 "닫힌 화이트리스트 아님" 명시 |
| 모델은 계획을 못 세운다 → interview→plan→spec→review 4단계 | 1패스 계획 + 네이티브 Plan 모드/서브에이전트 |
| 모델은 검증 본능이 없다 → 강제 verify 스킬 28KB | 검증은 기본 행동. **단, 판정의 ground truth는 여전히 코드가 가져야 함** (이건 유지) |
| Claude는 약하고 비싸다 → GPT/GLM 우선, Claude 최후 폴백 | 역전됨. 외부 LLM 레이스 리뷰는 45–50s 동기 블로킹 + 컨텍스트 오염 비용만 남음 |
| 컨텍스트는 작고 잘 썩는다 → SPEC 디스크 재앵커, Phase 격리, /new 세리머니 | 대용량 컨텍스트 + 네이티브 컴팩션. 수동 save/restore 의식은 네이티브와 충돌 |
| 플랫폼에 오케스트레이션이 없다 → 자체 Swarm/Router/BackgroundManager | 서브에이전트·Workflow·병렬 툴콜 네이티브 제공. 자체 구현은 Anthropic이 유지하는 움직이는 타깃과 경쟁 |

---

## 2. 영역별 병목 상세

### 2.1 훅 — 결정론 게이트는 금, 정규식 잔소리는 부채

**유지 (모델이 자기 증명 불가능한 것):**
- `sentinel-guard.js` — 하네스 자기 파괴 차단 (exit 2 hard block)
- `pre-tool-guard.js`의 critical 패턴 — `rm -rf /`, fork bomb 등 파괴 명령 차단
- `pr-test-gate.js` — PR 전 실제 테스트 실행. "테스트 통과했다"는 주장 ≠ 통과
- `auto-test.js`(debounce) / `auto-format.js` — 실제 도구 출력 관찰
- verify-ledger + scope-guard — 워크플로 불변식의 외부 울타리

**정리 대상 (약한 모델 전제):**
1. **`keyword-detector.js` (226줄)** — 매 프롬프트 자식 `node` 스폰. `ralph/ultrawork/ralplan/quick` 전부 deprecated no-op인데 여전히 정규식+스폰+`[deprecated]` 배너 비용. `[PLAN MODE] Enter planning interview mode` 같은 배너는 모델이 프롬프트에서 스스로 선택하는 행동을 재지시하는 것.
2. **`code-check.js` (464줄)** — 매 Write/Edit마다 `any`/console.log/50줄/중첩/매직넘버 정규식 탐지 → additionalContext 주입. 중괄호 세기(`:196,:225`) 수준의 휴리스틱이라 false-positive 패치(`:241,:259,:264`)가 누적됐고, **정규식 오탐이 `recordVerifyRequired`를 태워 auto-commit까지 차단**(`code-check.js:415-419` → `auto-commit.js:41-46`). "Modify only requested scope" 규칙과 정면 충돌하는 리팩토링 압박도 문서화된 문제.
3. **SessionStart 대형 덤프 (`session-start.js:83-201`)** — 메모리+레시피+안티패턴+autonomy+evolution 8–10블록을 매 세션 주입. 자체 감사(2026-06-04)에서 P2로 지적됐으나 미해결.
4. **외부 LLM 동기 오케스트레이션** (`prompt-dispatcher.js:104-153` + `llm-orchestrate.js`) — 최대 50s 블로킹 + 외부 응답 전문 주입.
5. scope-guard 기본값 불일치 — `scope-from-spec.js:39-52`/`session-start.js:129`는 기본 ON, `src/cli/utils.ts:127`/`init.ts:493`/`update.ts:51`은 "기본 off". SSOT 위반.

### 2.2 스킬 — 73개 중 살아남을 것은 "지식"과 "제약", 죽어야 할 것은 "교육"

- 항상 로드되는 것은 frontmatter(~3.4k 토큰)뿐이지만, **priority 90 광폭 트리거**(`implement, bug, fail, faster, helper…`)가 본문 로드를 남발 — "implement a helper to fix the broken login and make it faster" 한 문장이 yagni-ladder+systematic-debugging+rob-pike+techdebt 4개(~10k 토큰) 동시 발화. 스킬 트리거 간 dedup/debounce 없음.
- `/vibe` 신규 기능 파이프라인 1회 = spec(33KB)+spec-review(28KB)+run+verify(28KB)+trace/contract 체인으로 **지시문만 30–40k 토큰**.
- **재교육 스킬** (2026 모델이 네이티브로 하는 것): `systematic-debugging`(금지 변명 목록), `techdebt`(grep 패턴 손잡기), `typescript-advanced-types`(제네릭 강의). 삭제 후보.
- **중복 클러스터**: rob-pike+yagni-ladder / characterization-test+arch-guard+regress / design-* 5형제 / figma 4형제 / claude-md-guide+agents-md / vibe.verify vs verify vs vibe.test.
- **고가치 유지**: 훈련 밖 지식(seo-checklist, vercel-react-best-practices, commerce-patterns의 멱등성, video-production FFmpeg, ui-ux-pro-max 데이터셋), 얇은 제약 주입(yagni/rob-pike 원칙 1장), 루프/게이트 오케스트레이션.

### 2.3 에이전트 — 71개 매트릭스는 모델 라우팅 스캐폴딩

- 배정 분포: **haiku ~21 / sonnet ~48 / opus 1**. "Architecture → Opus" 독트린의 실체가 에이전트 1개.
- explorer/implementer/architect × low/medium/base 9종 매트릭스의 유일한 페이로드는 "어떤 모델 문자열을 주입하나".
- **24개 파일이 자기 예시에서 네이티브 `subagent_type: "Explore"/"Plan"/"general-purpose"`를 호출** — 즉 네이티브의 얇은 래퍼임을 스스로 증명.
- review 12종은 네이티브 `/review`·`/security-review`와, compounder/simplifier는 `/simplify`와 중복.
- 프롬프트 스타일: 번호 매긴 Process 5–7단계 + 고정 Output 템플릿 + 금지 목록 = 마이크로 매니징. 목표 위임형으로 전환 필요.
- 프론트매터가 tier alias(`haiku|sonnet|opus`)라 에이전트 층 자체는 버전 드리프트에 안전 — 잘한 설계. 드리프트는 인프라에 있음(§2.5).

### 2.4 루프 계약 — 54줄 계약은 완벽, 그 위 5,000줄이 문제

- **유지**: `loop-contract.md`(54줄) + `run-ledger.js`(169줄) + `loop-ledger.js`의 discover-hash(2라운드 동일 → stuck) + `vibe.regress`(75줄, 검증 실패 자동 등록·클러스터링). 이 조합이 하네스의 존재 이유.
- **병목**:
  - 기능 1개 = 스킬 8회 호출(interview→plan→spec→review→run→verify→contract→trace) + `/vibe` 자체 7 Phase + vibe.spec 내부 Phase 0–7.
  - **승인 게이트 2중화**: Phase 4 pipeline-approval(`skills/vibe/SKILL.md:139-146`)과 SPEC 승인이 별도 존재 — 문서 스스로 인정(`:152`). loop-contract의 "유일한 필수 게이트" 원칙 위반.
  - **무상한 수렴 루프 3중첩**: spec-review 품질 루프(No Round Cap) + GPT/Antigravity 레이스 리뷰(no hard cap) + run의 auto-fix/RTM-100 루프.
  - 템플릿 세리머니: spec-template 221줄(서명란 포함), contract 템플릿 1,125줄 — "vibe coding" 도구에 엔터프라이즈 RFC 무게.
  - SPEC 디스크 재앵커·Phase 메모리 격리(`vibe.run:204-217,237`) — 작은 컨텍스트 시대 우회책.

### 2.5 TS 인프라 — 68k LOC 중 절반이 플랫폼과의 경쟁

| 서브시스템 | LOC | 판정 |
|---|---|---|
| orchestrator (SmartRouter/Swarm/BackgroundManager/PhasePipeline) | 6,247 | 네이티브 서브에이전트·Workflow와 정면 중복. Claude "프로바이더"가 로컬 `claude` CLI 서브프로세스 스폰. `AgentExecutor.ts:92` "(simulated)" 스텁 |
| evolution (자가 진화 스킬/에이전트 엔진) | ~5,000 | 저장소 내 최대 복잡도, 실증 수요 대비 투기적 |
| LLM 프로바이더 4종 (gpt/antigravity/zai/auth/codex-proxy) | ~4,850 | 모델 테이블 수동 드리프트가 상시 유지보수 세금. `constants.ts:31-34`에 `claude-haiku-3-5`, `claude-opus-4-6` 잔존 |
| memory (better-sqlite3 + FTS5 + 벡터) | 3,669 | save→/new→--continue 의식은 네이티브 컴팩션과 충돌. **단, 구조화된 프로젝트 지식 그래프(결정/제약/관찰)는 네이티브 메모리 이상의 가치 — 축소 보존** |
| semantic (Serena 포팅 LSP/ast-grep) | 2,010 | 네이티브 Grep/Explore/LSP에 흡수됨 |
| ContextCompressor / TokenBudgetTracker | — | 네이티브 컴팩션으로 완전 대체 |
| spec/convention/figma/ui-ux/browser 도구 | ~7,000 | **방어 가능한 도메인 자산 — 유지** |
| 문서 동기화 스크립트(gen-skill-docs, validate-counts, sync-agent-models) | — | 73스킬/71에이전트 규모가 만든 자기 유발 세금. 자산 수가 줄면 함께 소멸 |

라우팅 정책 SSOT의 화석: `computeLlmPriority()`가 **항상 Claude를 마지막에 push**(`types.ts:273`), 주석 "keeping Claude as the last-resort fallback (expensive)"(`SmartRouter.ts:168-171`).

---

## 3. 개선 로드맵 (우선순위·효과 순)

### P1 — 컨텍스트 다이어트 + 파이프라인 축소 (코드 삭제 위주, 1–2주 체감)

1. **파이프라인 붕괴: interview→plan→spec→review(4스킬 ~1,500줄) → 단일 SPEC 패스.** 강한 모델은 인터뷰·계획·스펙을 1패스로 낸다. SPEC 승인 게이트 1개만 남기고 Phase 4 pipeline-approval 제거. spec-template를 221줄→핵심 5–6섹션(Done 정의, 시나리오, 검증 게이트)으로.
2. **스킬 정리: 73 → ~35.** 재교육 스킬 삭제(systematic-debugging, techdebt, typescript-advanced-types), 클러스터 병합(rob-pike+yagni→restraint 1개, design 5→2, figma 4→2, 검증 3→1). priority 90 → 60대, 트리거 키워드 협소화, 원칙 스킬은 "1장짜리 제약 주입"으로 재작성.
3. **`keyword-detector.js` 제거.** deprecated 별칭은 CLAUDE.md 표 1행이면 충분. 프롬프트당 스폰 1개 소멸.
4. **`code-check.js` 축소.** 정규식 탐지 → `tsc --noEmit` + lint 실행 결과(결정론적 도구 출력)만 주입. 매직넘버/중첩/함수길이 휴리스틱 삭제. **정규식 오탐의 커밋 게이트 연동 해제.**
5. **SessionStart 덤프 다이어트** — 인덱스(제목+경로)만 주입, 본문은 온디맨드.
6. scope-guard 기본값 SSOT 일치.

### P2 — 에이전트·라우팅 현대화 (2–4주)

1. **에이전트 71 → ~15.** 네이티브 래퍼 24개 삭제, 리뷰 12종 → 관점 파라미터를 받는 1–2개, low/medium/base 매트릭스 폐지. 프롬프트를 Process 스텝 → 목표+제약+Done 기준으로 재작성.
2. **라우팅 독트린 갱신.** "탐색→Haiku" 폐기: 탐색은 네이티브 Explore(모델 상속)로. 모델 tier는 "기본 상속, 명시적 예외만" 원칙으로 단순화.
3. **외부 LLM 레이스 리뷰 opt-in 격하.** SmartRouter의 Claude-최후-폴백 정책 폐기. 멀티 LLM은 "교차 검증 기본"이 아니라 "사용자가 켜는 세컨드 오피니언".
4. 인프라 모델 ID 정리(`constants.ts:31-34`, `types.ts:10-12` 네이밍 비대칭, Cursor 매핑).

### P3 — 인프라 절단 (v3.0 메이저)

1. **orchestrator 6.2k LOC 제거** → 네이티브 서브에이전트/Workflow 호출로 대체. Swarm/BackgroundManager/PhasePipeline 소멸.
2. **ContextCompressor·TokenBudgetTracker·semantic tools 제거** (네이티브 대체 존재).
3. **memory 축소 보존**: 지식 그래프(결정/제약/회귀 기억)만 남기고 세션 save/restore 의식·벡터 스택 제거. better-sqlite3 의존 재평가(JSON+FTS 대안 검토 — 네이티브 컴파일은 설치 실패의 주범).
4. **evolution 엔진 동결/분리** — 별도 실험 패키지로.
5. 설치 풋프린트 축소: 자산 수가 줄면 postinstall 매트릭스·LegacyMigration·count-drift 스크립트가 연쇄 소멸.

### 제품 방향 — v3 정체성: "Verification Harness"

- 피치 전환: "AI에게 일하는 법을 가르친다" → **"AI가 한 일을 기계가 판정한다."** 결정론적 게이트(ledger·테스트·스코프·회귀 기억)는 모델이 강해질수록 차별화가 커지는 유일한 층이다.
- 5만 다운로드 사용자에게 주는 것: 세션당 수만 토큰 절약(= 비용·속도), 프롬프트당 레이턴시 감소, 설치 실패율 감소, 그리고 "모델이 거짓말 못 하는" 신뢰.
- 마이그레이션: v2 자산은 `vibe update`에서 자동 정리(이미 LegacyMigration 인프라 보유 — 이번엔 축소 방향으로 사용).

---

## 4. 정량 효과 추정

| 항목 | 현재 | 개선 후 |
|---|---|---|
| `/vibe` 기능 1개당 지시문 토큰 | 30–40k | ~8–12k |
| 기능 1개당 스킬 호출 / 승인 게이트 | 8회 / 2개 | 3회(spec→run→verify) / 1개 |
| 프롬프트당 훅 스폰 | dispatcher+keyword-detector 상시 | dispatcher만 |
| 스킬 / 에이전트 수 | 73 / 71 | ~35 / ~15 |
| src LOC | ~68k | ~35–40k (orchestrator·evolution·semantic·compressor 제거) |
| 상시 유지보수 세금 | 모델 테이블 4종 + count-drift 스크립트 | 외부 모델 테이블 0–1종 |

## 5. 지켜야 할 것 (변경 금지 목록)

`vibe/rules/loop-contract.md`(54줄) · `hooks/scripts/lib/run-ledger.js` · `hooks/scripts/lib/loop-ledger.js`(discover-hash) · `sentinel-guard.js` · `pre-tool-guard.js` critical 패턴 · `pr-test-gate.js` · `auto-test.js`/`auto-format.js` · `vibe.regress` · 도메인 지식 스킬(seo/vercel/commerce/video/ui-ux-pro-max) · spec/convention/figma/browser 도구 · 에이전트 tier-alias 프론트매터 설계
