# VIBE

**바이브 코딩은 쉽게. 완료 판정은 기계가.**

[![npm](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Vibe는 AI 코딩을 위한 **검증 하네스(verification harness)** 입니다. 모델은 이미 계획도 구현도 잘합니다 — 부족한 것은 "다 됐다"는 말을 믿을 근거입니다. Vibe는 Claude Code, Codex, Cursor, Antigravity CLI를 감싸고, **완료 판정을 모델의 자기 보고가 아니라 결정론적 게이트(테스트 exit code, run-ledger, 회귀 기억)에 맡깁니다.** 빠르게 바이브 코딩하되, 검증 안 된 코드가 나가지 않게.

```bash
npm install -g @su-record/vibe
vibe init
```

> Codex CLI에서는 Vibe가 slash command가 아니라 skill로 노출됩니다. `/vibe`가 보이지 않으면 `$vibe`, `$vibe.spec`처럼 호출하거나 `/skills`에서 `vibe`를 선택하세요. Claude Code에서는 기존 `/vibe.*` slash command 흐름을 사용합니다.

---

## 철학: 지시하지 않고 검증한다

2026년의 모델에게 "어떻게 일하라"고 가르치는 스캐폴딩은 비용입니다. Vibe v3는 그 층을 걷어냈습니다 — 남긴 것은 **모델이 스스로 증명할 수 없는 것들**뿐입니다:

- **테스트가 실제로 통과했는가** — PR 게이트가 테스트 스위트를 직접 실행
- **verify가 실제로 실행됐는가** — `.vibe/metrics/run-ledger.json`이 코드로 기록
- **리뷰 루프가 수렴하고 있는가** — discover-hash(2라운드 동일 → stuck)가 판정
- **같은 실수가 반복되지 않는가** — verify 실패가 회귀 테스트로 자동 등록

똑똑한 모델일수록 "다 됐다"는 말이 그럴듯해집니다. 그래서 코드가 판정하는 ground truth는 모델이 강해질수록 **더** 가치 있습니다.

---

## 워크플로우

**진입점 하나.** 자연어 요구사항만 던지세요. SPEC 1패스 → 승인 1회 → 게이트 통과까지 자동 루프.

```
/vibe "커피 브랜드 랜딩 페이지" [+ 📎 figma URL / 이미지 / PDF / 파일]
     |
     v
  Intent 분류  ─── new feature? figma-driven? clone? resume? review? regress? ...
     |
     v
  Smart Resume ─── .vibe/{specs,features}/ 감지 ("이어서?")
     |
     v
  SPEC 1패스 ─── 모호할 때만 인라인 질문 → SPEC + BDD 시나리오 생성
     |
     v
  SPEC 확정 1회 승인 ─── 유일한 의무 개입 (Done의 정의 확정)
     |
     v
  루프 ─── ANCHOR→ACT→JUDGE→RECORD (결정론 게이트 통과까지 자동 반복)
```

**예시:**

```bash
/vibe "패럴랙스 웹사이트 만들어줘"
/vibe "https://figma.com/file/abc 로 로그인 페이지"
/vibe "로그인 회귀 테스트 다시 통과시켜줘"
/vibe "이 SPEC 리뷰만" + 📎 .vibe/specs/login.md
```

**SPEC 1패스** — 구세대의 인터뷰→기획→SPEC→리뷰 4단계는 폐지됐습니다. 모델이 한 번에 SPEC을 만들고, 진짜 갈림길에서만 질문합니다. 승인 게이트는 SPEC 확정 단 하나.

**Smart Resume** — 아무 단계에서나 멈추고 나중에 돌아오세요. `/vibe`는 `.vibe/` 디렉토리에서 진행 상황을 감지하고 "이어서?" 제안합니다.

**루프 기본 실행** — 승인 후 게이트 통과까지 자동 루프. `--interactive`로 단계별 확인, `--max-iter N`으로 반복 상한. `automationLevel: autonomous`(`.vibe/config.json`)면 비대화형으로 완주합니다.

**Advanced** — 정확히 어느 phase 실행할지 알면 `/vibe.spec`, `/vibe.figma`, `/vibe.run`, `/vibe.verify`, `/vibe.trace` 등을 직접 호출할 수 있습니다.

---

## 빠른 시작

```bash
# 설치
npm install -g @su-record/vibe

# 프로젝트 초기화 (스택 자동 감지)
cd your-project
vibe init

# AI 코딩 도구 시작 (둘 중 하나)
claude
codex

# 워크플로우 실행
/vibe "사용자 인증 추가"
```

---

## Figma ↔ 코드

양방향. Figma에서 디자인을 읽거나, 기획서에서 Figma에 디자인을 쓰거나.

```bash
# READ — 기존 프로젝트에 UI 추가 (프로젝트 컨벤션 준수)
/vibe.figma <figma-url> <figma-url>

# READ — 신규 독립 페이지 (독립 스타일)
/vibe.figma --new <figma-url>

# WRITE — 기획서에서 Figma 디자인 생성
/vibe.figma plan.md --create                 # Full (와이어 + 비주얼 디자인)
/vibe.figma plan.md --create-storyboard      # 와이어만
/vibe.figma plan.md --create-design          # 비주얼 디자인만
```

**READ 동작**: Figma REST API로 노드 트리 + 30개 CSS 속성 추출. Auto Layout → Flexbox 1:1 기계적 매핑. 스크린샷은 검증용 — 트리가 원천. 렌더링은 pixelmatch 시각 대조로 게이트.

**WRITE 동작**: 기획서의 Look & Feel, 레이아웃, 반응형 전략 섹션을 파싱하여 와이어프레임을 먼저 그리고 (구조 검토), 그 위에 디자인 시스템 컴포넌트로 비주얼 적용. 멱등성 보장 — 기획서 수정 후 재실행하면 변경된 섹션만 갱신.

---

## DESIGN.md — 시각 품질 SSOT

`CLAUDE.md`(코드)·`AGENTS.md`(빌드) 에 이은 **세 번째 SSOT**. Google Stitch 9-섹션 표준으로 프로젝트 루트에 위치하며, 외부 AI 에이전트가 직접 읽을 수 있는 휴먼-리더블 시각 규약입니다. **Figma 종속 X** — Figma 는 4 입력 경로 중 하나일 뿐.

```bash
# 4 가지 init 경로 (Figma 없이도 시작 가능)
/vibe.design init                                  # 인터뷰 (디폴트)
/vibe.design init --from=code                      # 기존 코드 토큰 역추출 (Tailwind/CSS-vars/styled-components)
/vibe.design init --from=reference --reference=linear   # awesome-design-md 시드 12 종
/vibe.design init --from=figma --file=<key>        # /vibe.figma 위임 (옵션)

# 라이프사이클
/vibe.design lint                                  # Stitch 9-섹션 완전성 검증
/vibe.design verify                                # 구현 ↔ DESIGN.md hex 토큰 드리프트 (<1s/100 파일)
```

**자동 통합**:
- `/vibe.run` — UI 작업 진입 시 DESIGN.md 없으면 1 회 권유 (autonomous silent skip, 절대 블록 X)
- `/vibe.verify` — `### 3.2 Visual Drift Detection` 으로 hex 하드코딩 P1 검출
- `/vibe.review` — `#### Visual P1 Baseline` — DESIGN.md 우선, 없으면 WCAG AA 폴백
- `/vibe.figma` — `--emit-design-md` 로 READ 산출물을 DESIGN.md 로 출력, WRITE 는 DESIGN.md 톤·팔레트 1 차 입력

> v1 범위: hex 컬러 드리프트. spacing / font 드리프트는 Phase 2+

---

## 품질 게이트

탐지는 편집 시점에, 차단은 결정론적 게이트에서:

| 계층 | 동작 |
|------|------|
| 편집 훅 (Edit/Write) | 오탐률 낮은 하드룰만 **탐지** — `any`/`@ts-ignore`, `console.log` → 모델에 즉시 주입(additionalContext). 함수 길이·중첩 같은 휴리스틱은 없음 — 모델이 컨텍스트 안에서 더 정확히 판단 |
| 결정론 게이트 | **PR 테스트 게이트**(PR 생성 전 테스트 스위트 직접 실행, `gh pr create` 포함) · **auto-commit verify 게이트**(verify 통과 전 커밋 거부) · **Stop 훅** verify-skip 경고/차단 · **scope-guard**(opt-in, SPEC 범위 밖 편집 감시) · **sentinel**(파괴적 명령·하네스 자기 수정 차단) |
| 리뷰 + 수렴 루프 | `code-reviewer`를 관점(focus)별 병렬 인스턴스로 실행(correctness/architecture/performance/data-integrity/…) + `security-reviewer`. P1=0까지 루프하되 수렴은 discover-hash가 판정 — 2라운드 동일 findings면 stuck으로 확정하고 사람에게 질문. 절대 조용히 넘어가지 않음 |

---

## 주요 기능

**7+ 에이전트** — 전역 7개(architect, implementer, tester, code-reviewer, security-reviewer 등) + 조건부 그룹 4개(UI/Event — 해당 스택 프로젝트에만 로컬 설치, 총 11개). 단계별 지시 스크립트가 아니라 목표+제약+Done 기준으로 위임하고, 탐색·계획·병렬 실행은 하네스의 네이티브 서브에이전트를 그대로 사용합니다.

**60개 스킬** — 한 번에 다 로드되지 않음. 3-tier 시스템으로 컨텍스트 과부하 방지:

| 티어 | 로드 시점 | 용도 | 예시 |
|------|----------|------|------|
| **Core** | 항상 활성 | 게이트 진입, 절제 원칙 | spec, test, restraint, arch-guard |
| **Standard** | `vibe init`이 스택별 선택 | 스택/역할 지원 | figma, design-review, docs |
| **Optional** | 명시적 `/skill` 호출만 | 레퍼런스, 래퍼 | chub-usage, context7 |

스킬이 가르치는 것은 모델이 모르는 것(도메인 gotcha, 최신 API, 프로젝트 규약)뿐입니다. 디버깅하는 법 같은 기본기 재교육 스킬은 v3에서 전부 삭제됐습니다.

**세컨드 오피니언 (opt-in)** — 기본 실행은 세션 모델 단독. 원할 때만 `gpt …`/`agy …` 접두사로 외부 LLM에게 물어보거나 `/vibe.review --race`로 교차 검증합니다. 자동 라우팅으로 외부 모델이 끼어드는 일은 없습니다.

**스택 감지** — 24개 프레임워크 자동 감지 (Next.js, Django, Rails, Go, Rust, Flutter 등) 후 프레임워크별 규칙과 스킬 적용.

**회귀 기억** — verify 실패가 `/vibe.regress`에 자동 등록되고, 반복 패턴은 예방 테스트로 승격. 결정·제약은 SQLite + FTS5로 세션 간 유지.

**Smart Resume** — `.last-feature` 포인터가 마지막 작업을 추적. 인자 없이 `/vibe`를 호출하면 중단된 위치를 보여주거나 진행 중 feature 목록을 제시.

**루프 엔지니어링** — `/vibe.loop`로 자율 목표 루프를 설계·설치(트리아지 → run/verify 파이프라인). 완료 판정은 자기 보고가 아니라 결정론 게이트(run-ledger/테스트)가 내리고, 결과는 사람 리뷰 인박스로 — 루프는 push/release를 하지 않습니다.

---

## 지원 도구

| CLI | 상태 |
|-----|------|
| [Claude Code](https://claude.ai/code) | 전체 지원 |
| [Codex](https://github.com/openai/codex) | 전체 지원 (`~/.codex/`, AGENTS.md, native hooks.json, config.toml notify, codex exec agent fallback) |
| [Cursor](https://cursor.sh) | 에이전트 + 룰 |
| Antigravity CLI (`agy`) | 에이전트 + 스킬 |

---

## 명령어

| 명령어 | 용도 |
|--------|------|
| `/vibe` | **메인 진입점** — 자연어 요구사항 → SPEC 1패스 → 1회 승인 → 게이트 통과까지 루프 |
| `/vibe.spec` | (advanced) SPEC 1패스 명시적 호출 — 인라인 질문 → SPEC + BDD → 승인 |
| `/vibe.run` | (advanced) SPEC 기반 구현 |
| `/vibe.figma` | (advanced) Figma ↔ 코드 (읽기 또는 쓰기, 3가지 모드) |
| `/vibe.design` | (advanced) DESIGN.md 시각 품질 SSOT — init / lint / verify / sync / preview |
| `/vibe.verify` | (advanced) 구현이 SPEC Done 기준에 맞는지 검증 — 결과는 run-ledger에 기록 |
| `/vibe.regress` | (advanced) 회귀 테스트 자동 진화 — verify 실패 자동 등록, 반복 패턴 승격 |
| `/vibe.trace` | (advanced) 요구사항 추적 매트릭스 |
| `/vibe.continue` | 세션 복원 — 85%+ 컨텍스트에서 `save_memory` → `/new` 후 이어서 작업 |
| `/vibe.image` | 이미지 생성 (Antigravity) — 아이콘/배너/목업 |

---

## 문서

상세 가이드, 스킬 레퍼런스, 설정 방법은 [Wiki](https://github.com/su-record/vibe/wiki)를 참고하세요.

- [README (English)](README.en.md)
- [릴리스 노트](RELEASE_NOTES.md)

---

## 요구사항

- Node.js >= 18.0.0
- Claude Code 또는 Codex CLI 중 하나
- GPT, Antigravity (선택 — 세컨드 오피니언 전용)

## 라이선스

MIT — Copyright (c) 2025 Su
