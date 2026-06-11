# VIBE

**바이브 코딩은 쉽게. 최소 품질은 보장.**

[![npm](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Vibe는 AI 코딩 도구를 위한 품질 하네스입니다. Claude Code, Codex, Cursor, Antigravity CLI를 감싸고, 타입 안전성, 코드 품질, 보안을 자동으로 강제합니다. 빠르게 바이브 코딩하되, 엉망인 코드가 나가지 않게.

```bash
npm install -g @su-record/vibe
vibe init
```

> Codex CLI에서는 Vibe가 slash command가 아니라 skill로 노출됩니다. `/vibe`가 보이지 않으면 `$vibe`, `$vibe.spec`처럼 호출하거나 `/skills`에서 `vibe`를 선택하세요. Claude Code에서는 기존 `/vibe.*` slash command 흐름을 사용합니다.

---

## 워크플로우

**진입점 하나.** 자연어 요구사항만 던지세요. vibe가 의도를 분석해서 파이프라인을 설계하고, 한 번만 승인받고, 자동 실행합니다.

```
/vibe "커피 브랜드 랜딩 페이지" [+ 📎 figma URL / 이미지 / PDF / 파일]
     |
     v
  Intent 분류  ─── new feature? figma-driven? clone? resume? review? regress? ...
     |
     v
  Smart Resume ─── .vibe/{interviews,plans,specs,features}/ 감지
     |
     v
  파이프라인 설계 ─── /vibe.spec → /vibe.figma → /vibe.run → /vibe.verify → /vibe.trace
     |
     v
  SPEC 확정 1회 승인 ─── 유일한 의무 개입 (Done의 정의 확정)
     |
     v
  루프 ─── ANCHOR→ACT→JUDGE→RECORD (게이트 통과까지 자동 반복)
```

**예시:**

```bash
/vibe "패럴랙스 웹사이트 만들어줘"
/vibe "https://figma.com/file/abc 로 로그인 페이지"
/vibe "로그인 회귀 테스트 다시 통과시켜줘"
/vibe "이 SPEC 리뷰만" + 📎 .vibe/specs/login.md
/vibe "결제 API" ultrawork           # automationLevel: autonomous (deprecated alias)
```

**Smart Resume** — 아무 단계에서나 멈추고 나중에 돌아오세요. `/vibe`는 `.vibe/` 디렉토리에서 진행 상황을 감지하고 "이어서?" 제안합니다.

**루프 기본 실행** — SPEC 확정 1회 승인 후 게이트 통과까지 자동 루프합니다. `--interactive`로 단계별 확인 모드, `--max-iter N`으로 반복 상한 설정. `ultrawork`는 `automationLevel: autonomous` + 병렬 실행의 deprecated 별칭으로 동작합니다.

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

**READ 동작**: Figma REST API로 노드 트리 + 30개 CSS 속성 추출. Auto Layout → Flexbox 1:1 기계적 매핑. 스크린샷은 검증용 — 트리가 원천.

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
- `/vibe.run` — UI 작업 진입 시 DESIGN.md 없으면 1 회 권유 (ultrawork silent skip, 절대 블록 X)
- `/vibe.verify` — `### 3.2 Visual Drift Detection` 으로 hex 하드코딩 P1 검출
- `/vibe.review` — `#### Visual P1 Baseline` — DESIGN.md 우선, 없으면 WCAG AA 폴백
- `/vibe.figma` — `--emit-design-md` 로 READ 산출물을 DESIGN.md 로 출력, WRITE 는 DESIGN.md 톤·팔레트 1 차 입력

> v1 범위: hex 컬러 드리프트. spacing / font 드리프트는 Phase 2+

---

## 품질 게이트

탐지는 편집 시점에, 차단은 결정론적 게이트에서 — 3계층 방어:

| 계층 | 동작 |
|------|------|
| 편집 훅 (Edit/Write) | `any` 타입, `@ts-ignore`, `console.log`, 50줄 초과 함수 **탐지** → 모델에 즉시 주입(additionalContext) + verify-required 상태 기록 |
| 결정론 게이트 | **auto-commit verify 게이트**(verify 통과 전 커밋 거부) · **Stop 훅** verify-skip 경고/차단 · **PR 테스트 게이트**(`gh pr create` 포함) · **scope-guard**(SPEC 범위 밖 편집 감시) |
| 리뷰 + 수렴 루프 | 12개 전문 리뷰어 병렬 실행 → findings P1=0까지 루프. 라운드 캡 없음. run/verify 상태는 `.vibe/metrics/run-ledger.json`에 추적. Stuck이면 사용자에게 질문, 절대 조용히 넘어가지 않음. |

---

## 주요 기능

**42+ 에이전트** — 탐색, 구현, 아키텍처, 병렬 코드 리뷰, UI/UX 분석, 보안 감사, Figma 분석/빌드. UI·Figma·Event 그룹(18개)은 전역 설치에서 제외되고, `vibe init`이 스택/capability가 맞는 프로젝트에만 로컬(`.claude/agents/`)로 설치 — 비해당 프로젝트의 컨텍스트를 점유하지 않습니다.

**70개 스킬** — 한 번에 다 로드되지 않음. 3-tier 시스템으로 컨텍스트 과부하 방지:

| 티어 | 로드 시점 | 용도 | 예시 |
|------|----------|------|------|
| **Core** | 항상 활성 | 버그 방지, 워크플로 진입 | 품질 게이트, 인터뷰, 기획 |
| **Standard** | `vibe init`이 스택별 선택 | 스택/역할 지원 | figma, design-audit, techdebt |
| **Optional** | 명시적 `/skill` 호출만 | 레퍼런스, 래퍼 | chub-usage, context7 |

**멀티 LLM** — Claude Code 또는 Codex가 하네스를 실행하고, GPT가 추론, Antigravity가 리서치. 가용 모델에 따라 자동 라우팅.

**스택 감지** — 24개 프레임워크 자동 감지 (Next.js, Django, Rails, Go, Rust, Flutter 등) 후 프레임워크별 규칙과 스킬 적용.

**세션 메모리** — 결정, 제약, 목표가 SQLite + FTS5 검색으로 세션 간 유지.

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
| `/vibe` | **메인 진입점** — 자연어 요구사항 → 동적 파이프라인 설계 → 1회 승인 → 자동 체인 실행 |
| `/vibe.spec` | (advanced) 인터뷰, 기획, SPEC, 리뷰 phase 명시적 호출 |
| `/vibe.run` | (advanced) SPEC 기반 구현 |
| `/vibe.figma` | (advanced) Figma ↔ 코드 (읽기 또는 쓰기, 3가지 모드) |
| `/vibe.design` | (advanced) DESIGN.md 시각 품질 SSOT — init / lint / verify / sync |
| `/vibe.verify` | (advanced) 구현이 SPEC에 맞는지 검증 |
| `/vibe.trace` | (advanced) 요구사항 추적 매트릭스 |

---

## 문서

상세 가이드, 스킬 레퍼런스, 설정 방법은 [Wiki](https://github.com/su-record/vibe/wiki)를 참고하세요.

- [README (English)](README.en.md)
- [릴리스 노트](RELEASE_NOTES.md)

---

## 요구사항

- Node.js >= 18.0.0
- Claude Code 또는 Codex CLI 중 하나
- GPT, Antigravity (선택)

## 라이선스

MIT — Copyright (c) 2025 Su
