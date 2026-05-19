# VIBE

**바이브 코딩은 쉽게. 최소 품질은 보장.**

[![npm](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Vibe는 AI 코딩 도구를 위한 품질 하네스입니다. Claude Code, Codex, Cursor, Gemini CLI를 감싸고, 타입 안전성, 코드 품질, 보안을 자동으로 강제합니다. 빠르게 바이브 코딩하되, 엉망인 코드가 나가지 않게.

```bash
npm install -g @su-record/vibe
vibe init
```

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
  1회 승인 게이트 (ultrawork 키워드 있으면 skip)
     |
     v
  순차 실행 ─── 각 phase 완료 시 다음으로
```

**예시:**

```bash
/vibe "패럴랙스 웹사이트 만들어줘"
/vibe "https://figma.com/file/abc 로 로그인 페이지"
/vibe "로그인 회귀 테스트 다시 통과시켜줘"
/vibe "이 SPEC 리뷰만" + 📎 .vibe/specs/login.md
/vibe "결제 API" ultrawork           # 승인 게이트 skip
```

**Smart Resume** — 아무 단계에서나 멈추고 나중에 돌아오세요. `/vibe`는 `.vibe/` 디렉토리에서 진행 상황을 감지하고 "이어서?" 제안합니다.

**ultrawork** — `ultrawork` 키워드를 붙이면 승인 게이트와 모든 중단점을 skip하고 자동 실행합니다.

**Advanced** — 정확히 어느 phase 실행할지 알면 `/vibe.spec`, `/vibe.figma`, `/vibe.run`, `/vibe.verify`, `/vibe.trace` 등을 직접 호출할 수 있습니다.

---

## 빠른 시작

```bash
# 설치
npm install -g @su-record/vibe

# 프로젝트 초기화 (스택 자동 감지)
cd your-project
vibe init

# AI 코딩 도구 시작
claude

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

## 품질 게이트

모든 도구 호출마다 3계층 방어:

| 계층 | 차단 대상 |
|------|----------|
| Pre-commit 훅 | `any` 타입, `@ts-ignore`, `console.log`, 50줄 초과 함수 |
| 리뷰 에이전트 | 12개 전문 리뷰어 병렬 실행 (보안, 성능, 접근성, 복잡도, ...) |
| 수렴 루프 | 리뷰 findings P1=0까지 루프. 라운드 캡 없음. Stuck이면 사용자에게 질문, 절대 조용히 넘어가지 않음. |

---

## 주요 기능

**40+ 에이전트** — 탐색, 구현, 아키텍처, 병렬 코드 리뷰, UI/UX 분석, 보안 감사, Figma 분석/빌드.

**44개 스킬** — 한 번에 다 로드되지 않음. 3-tier 시스템으로 컨텍스트 과부하 방지:

| 티어 | 로드 시점 | 용도 | 예시 |
|------|----------|------|------|
| **Core** | 항상 활성 | 버그 방지, 워크플로 진입 | 품질 게이트, 인터뷰, 기획 |
| **Standard** | `vibe init`이 스택별 선택 | 스택/역할 지원 | figma, design-audit, techdebt |
| **Optional** | 명시적 `/skill` 호출만 | 레퍼런스, 래퍼 | chub-usage, context7 |

**멀티 LLM** — Claude가 오케스트레이션, GPT가 추론, Gemini가 리서치. 가용 모델에 따라 자동 라우팅. 기본값은 Claude 단독. coco 환경(GPT 주관)에서는 Claude CLI가 보조로 전환되어 cross-validation 수행 — `~/.coco/` 감지로 역할 자동 역전.

**스택 감지** — 24개 프레임워크 자동 감지 (Next.js, Django, Rails, Go, Rust, Flutter 등) 후 프레임워크별 규칙과 스킬 적용.

**세션 메모리** — 결정, 제약, 목표가 SQLite + FTS5 검색으로 세션 간 유지.

**Smart Resume** — `.last-feature` 포인터가 마지막 작업을 추적. 인자 없이 `/vibe`를 호출하면 중단된 위치를 보여주거나 진행 중 feature 목록을 제시.

---

## 지원 도구

| CLI | 상태 |
|-----|------|
| [Claude Code](https://claude.ai/code) | 전체 지원 |
| coco (`~/.coco/`) | 전체 지원 (자동 감지) |
| [Codex](https://github.com/openai/codex) | 플러그인 |
| [Cursor](https://cursor.sh) | 에이전트 + 룰 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | 에이전트 + 스킬 |

---

## 명령어

| 명령어 | 용도 |
|--------|------|
| `/vibe` | **메인 진입점** — 자연어 요구사항 → 동적 파이프라인 설계 → 1회 승인 → 자동 체인 실행 |
| `/vibe.spec` | (advanced) 인터뷰, 기획, SPEC, 리뷰 phase 명시적 호출 |
| `/vibe.run` | (advanced) SPEC 기반 구현 |
| `/vibe.figma` | (advanced) Figma ↔ 코드 (읽기 또는 쓰기, 3가지 모드) |
| `/vibe.verify` | (advanced) 구현이 SPEC에 맞는지 검증 |
| `/vibe.trace` | (advanced) 요구사항 추적 매트릭스 |

---

## 문서

상세 가이드, 스킬 레퍼런스, 설정 방법은 [Wiki](https://github.com/su-record/vibe/wiki)를 참고하세요.

- [README (English)](README.md)
- [릴리스 노트](RELEASE_NOTES.md)

---

## 요구사항

- Node.js >= 18.0.0
- Claude Code (필수)
- GPT, Gemini (선택)

## 라이선스

MIT — Copyright (c) 2025 Su
