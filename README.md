# VIBE — AI Coding Framework for Claude Code

[![npm version](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**설치 한 줄로 Claude Code에 49개 에이전트, 41+ 도구, 멀티 LLM 오케스트레이션을 더합니다.**

```bash
npm install -g @su-record/vibe
vibe init
```

---

## 왜 Vibe인가

AI에게 "로그인 기능 만들어줘"라고 던지면 동작은 하지만 품질은 운에 맡기게 됩니다.
Vibe는 구조로 해결합니다.

| 문제 | 해결 |
|------|------|
| AI가 `any` 타입 남발 | Quality Gate가 `any`/`@ts-ignore` 차단 |
| 한 번에 완성 기대 | SPEC → 구현 → 검증 단계별 워크플로우 |
| 리뷰 없이 머지 | 13개 에이전트 병렬 리뷰 |
| AI 결과를 그대로 수용 | GPT + Gemini 교차 검증 |
| 컨텍스트 소실 | Session RAG로 자동 저장/복원 |
| 복잡한 작업에서 길을 잃음 | SwarmOrchestrator 자동 분해 + 병렬 실행 |

### 설계 철학

| 원칙 | 설명 |
|------|------|
| **Easy Vibe Coding** | 빠른 흐름, AI와 협업하며 생각하기 |
| **Minimum Quality Guaranteed** | 타입 안전성, 코드 품질, 보안 — 자동 하한선 |
| **Iterative Reasoning** | 문제를 쪼개고 질문하며 함께 추론 |

---

## 워크플로우

```mermaid
flowchart LR
    A["/vibe.spec"] --> B["/vibe.spec.review"]
    B --> C["/vibe.run"]
    C --> D["자동 리뷰"]
    D --> E["완료"]
```

1. **`/vibe.spec`** — 요구사항을 SPEC 문서로 정의 (GPT + Gemini 병렬 리서치)
2. **`/vibe.spec.review`** — SPEC 품질 리뷰
3. **`/vibe.run`** — SPEC 기반 구현 + 병렬 코드 리뷰
4. **자동 리뷰** — 13개 전문 에이전트 병렬 검토, P1/P2 자동 수정

`ultrawork` 키워드를 붙이면 전 과정이 자동화됩니다:

```bash
/vibe.run "기능" ultrawork
```

---

## 에이전트 (49개)

### 메인 에이전트 (19)

| 카테고리 | 에이전트 |
|----------|---------|
| **탐색** | Explorer (High/Medium/Low) |
| **구현** | Implementer (High/Medium/Low) |
| **설계** | Architect (High/Medium/Low) |
| **유틸** | Searcher, Tester, Simplifier, Refactor Cleaner, Build Error Resolver, Compounder, Diagrammer, E2E Tester, UI Previewer, Junior Mentor |

### 리뷰 에이전트 (12)

Security, Performance, Architecture, Complexity, Simplicity, Data Integrity, Test Coverage, Git History, TypeScript, Python, Rails, React

### UI/UX 에이전트 (8)

24개 CSV 기반 디자인 인텔리전스. 산업 분석 → 디자인 시스템 생성 → 구현 가이드 → 접근성 감사.

| 단계 | 에이전트 |
|------|---------|
| SPEC | ui-industry-analyzer, ui-design-system-gen, ui-layout-architect |
| RUN | ui-stack-implementer, ui-dataviz-advisor |
| REVIEW | ux-compliance-reviewer, ui-a11y-auditor, ui-antipattern-detector |

### 리서치 & QA (10)

Best Practices, Framework Docs, Codebase Patterns, Security Advisory, Requirements Analyst, UX Advisor, Acceptance Tester, Edge Case Finder, API Documenter, Changelog Writer

### 에이전트 팀 (9팀)

에이전트가 팀을 구성하여 공유 태스크 리스트로 협업합니다.

| 팀 | 트리거 | 멤버 |
|----|--------|------|
| Lite | `/vibe.run` 일반 | architect, implementer, tester |
| Dev | `/vibe.run` ULTRAWORK | + security-reviewer |
| Research | `/vibe.spec` | 4개 리서치 에이전트 |
| Review Debate | `/vibe.review` | security, architecture, performance, simplicity |
| Debug | `/vibe.run` 실패 | architect, implementer, tester |
| Security | `/vibe.run` 보안 | security, data-integrity, security-advisory, tester |
| Migration | `/vibe.run` 마이그레이션 | + build-error-resolver |
| Fullstack | `/vibe.run` 풀스택 | frontend + backend implementer |
| SPEC Debate | `/vibe.spec.review` | 동일 |

---

## 멀티 LLM 오케스트레이션

| 프로바이더 | 역할 | 인증 |
|-----------|------|------|
| **Claude** | 오케스트레이션, 코드 생성 | 내장 (Claude Code) |
| **GPT** | 아키텍처, 디버깅, 교차 리뷰 | OAuth / API Key |
| **Gemini** | UI/UX, 웹 검색, 음성, 리서치 | OAuth / API Key |

### SmartRouter

작업 유형별 자동 라우팅 + 폴백 체인. 프로바이더별 30초 타임아웃, 최대 3회 재시도, 5분 가용성 캐시.

| 작업 유형 | 우선순위 |
|----------|---------|
| 코드 분석, 리뷰, 추론, 아키텍처 | GPT → Gemini → Claude |
| UI/UX, 웹 검색 | Gemini → GPT → Claude |

### ReviewRace

GPT/Gemini가 동시에 리뷰 → Jaccard 유사도 교차 검증 → 우선순위 산출.

| 우선순위 | 조건 | 처리 |
|---------|------|------|
| **P1** | 신뢰도 >= 0.9 AND critical/high | 자동 수정 |
| **P2** | 신뢰도 >= 0.6 OR medium | 자동 수정 |
| **P3** | 나머지 | 참고 |

---

## 오케스트레이터

### SwarmOrchestrator

복잡도 15점 이상인 작업을 자동 분해하여 병렬 실행합니다.
최대 깊이 2단계, 동시 실행 5개, 기본 타임아웃 5분.

### PhasePipeline

`prepare()` → `execute()` → `cleanup()` 생명주기.
ULTRAWORK 모드에서 다음 Phase의 `prepare()`를 병렬 실행.

### BackgroundManager

모델별/프로바이더별 동시 실행 제한. 타임아웃 시 retry (최대 3회, 지수 백오프). 24시간 TTL 자동 정리.

---

## Session RAG

SQLite + FTS5 하이브리드 검색으로 세션 간 컨텍스트를 유지합니다.

**4가지 엔티티**: Decision, Constraint, Goal, Evidence

```
최종 점수 = BM25 × 0.4 + 최신성 × 0.3 + 우선순위 × 0.3
```

세션 시작 시 활성 Goals, 중요 Constraints, 최근 Decisions 자동 주입.

---

## 스킬

### 내장 스킬

에이전트가 활용하는 도메인별 스킬 모듈입니다. 스택 감지 결과에 따라 자동 설치됩니다.

**코어**: Core Capabilities, Parallel Research, Commit Push PR, Git Worktree, Handoff, Priority Todos, Tool Fallback, Context7, Tech Debt, Characterization Test, Agents MD, Exec Plan, Arch Guard, Capability Loop

**프론트엔드**: Frontend Design, UI/UX Pro Max, Brand Assets, SEO Checklist, Vercel React Best Practices

**도메인**: Commerce Patterns, E2E Commerce, Video Production, TypeScript Advanced Types

### 외부 스킬 (skills.sh)

[skills.sh](https://skills.sh) 에코시스템의 외부 스킬을 설치할 수 있습니다.

```bash
# 수동 설치
vibe skills add vercel-labs/next-skills
```

`vibe init`/`vibe update` 시 감지된 스택에 맞는 외부 스킬이 자동 설치됩니다.

| 스택 | 자동 설치 패키지 |
|------|-----------------|
| `typescript-react` | `vercel-labs/agent-skills` |
| `typescript-nextjs` | `vercel-labs/agent-skills`, `vercel-labs/next-skills` |

설치된 패키지는 `.claude/vibe/config.json`의 `installedExternalSkills`로 추적되어 중복 설치를 방지합니다.

---

## 25개 프레임워크 지원

프로젝트의 기술 스택을 자동 감지하고 프레임워크별 코딩 규칙을 적용합니다.
모노레포 지원 (pnpm-workspace, npm workspaces, Lerna, Nx, Turborepo).

- **TypeScript (12)** — Next.js, React, Angular, Vue, Svelte, Nuxt, NestJS, Node, Electron, Tauri, React Native, Astro
- **Python (2)** — Django, FastAPI
- **Java/Kotlin (2)** — Spring Boot, Android
- **기타** — Rails, Go, Rust, Swift (iOS), Unity (C#), Flutter (Dart), Godot (GDScript)

자동 감지: DB (PostgreSQL, MySQL, MongoDB, Redis, Prisma, Drizzle 등), 상태 관리 (Redux, Zustand, Jotai 등), CI/CD, 호스팅

---

## 41+ 내장 도구

### 메모리 & 세션 (21)

`save_session_item`, `retrieve_session_context`, `manage_goals`, `core_save_memory`, `core_recall_memory`, `core_search_memories`, `core_start_session`, `core_auto_save_context` 등

### 코드 품질 & 분석 (8)

`core_find_symbol`, `core_find_references`, `core_analyze_dependency_graph`, `core_analyze_complexity`, `core_validate_code_quality`, `core_check_coupling_cohesion`, `core_suggest_improvements`, `core_apply_quality_rules`

### SPEC & 테스트 (9)

`core_spec_generator`, `core_prd_parser`, `core_traceability_matrix`, `core_e2e_test_generator`, `core_preview_ui_ascii` 등

### UI/UX (4)

`core_ui_search`, `core_ui_stack_search`, `core_ui_generate_design_system`, `core_ui_persist_design_system`

---

## 품질 보장

| 가드레일 | 메커니즘 |
|----------|---------|
| **타입 안전성** | Quality Gate — `any`, `@ts-ignore` 차단 |
| **코드 리뷰** | ReviewRace — GPT + Gemini 교차 검증 |
| **완성도** | Ralph Loop — 100%까지 반복 (범위 축소 없음) |
| **스코프 보호** | pre-tool-guard — 요청 범위 외 수정 방지 |
| **컨텍스트 보호** | context-save — 80/90/95% 자동 저장 |
| **합리화 방지** | Anti-Rationalization — AI 변명 패턴 차단 |
| **증거 게이트** | Evidence Gate — 증거 없는 완료 주장 금지 |

**복잡도 제한**: 함수 ≤50줄 | 중첩 ≤3단계 | 매개변수 ≤5 | 순환 복잡도 ≤10

---

## 훅 시스템

| 이벤트 | 스크립트 | 역할 |
|--------|---------|------|
| SessionStart | `session-start.js` | 세션 컨텍스트 복원, 메모리 로드 |
| PreToolUse | `pre-tool-guard.js` | 파괴적 명령어 차단, 스코프 보호 |
| PostToolUse | `code-check.js` | 타입 안전성/복잡도 검증 |
| PostToolUse | `post-edit.js` | Git 인덱스 업데이트 |
| UserPromptSubmit | `prompt-dispatcher.js` | 명령어 라우팅 |
| UserPromptSubmit | `keyword-detector.js` | 매직 키워드 감지 |
| Notification | `context-save.js` | 컨텍스트 80/90/95% 자동 저장 |

추가: `llm-orchestrate.js`, `code-review.js`, `recall.js`, `complexity.js`, `compound.js`, `stop-notify.js`

---

## 슬래시 명령어

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능"` | SPEC 작성 + GPT/Gemini 병렬 리서치 |
| `/vibe.spec.review` | SPEC 품질 리뷰 |
| `/vibe.run "기능"` | SPEC 기반 구현 + Race Review |
| `/vibe.verify "기능"` | SPEC 대비 BDD 검증 |
| `/vibe.review` | 13개 에이전트 병렬 코드 리뷰 |
| `/vibe.trace "기능"` | 요구사항 추적성 매트릭스 |
| `/vibe.reason "문제"` | 체계적 추론 프레임워크 |
| `/vibe.analyze` | 프로젝트 분석 |
| `/vibe.voice` | 음성 → 코딩 명령 (Gemini + sox) |
| `/vibe.utils` | 유틸리티 (E2E, 다이어그램, UI, 세션 복원) |

---

## CLI

```bash
# 프로젝트
vibe init [project]       # 프로젝트 초기화
vibe update               # 설정 업데이트 (스택 재감지)
vibe upgrade              # 최신 버전으로 업그레이드
vibe setup                # 셋업 위자드
vibe status               # 상태 확인
vibe remove               # 제거

# LLM 인증
vibe gpt auth|key|status|logout
vibe gemini auth|key|status|logout
vibe claude key|status|logout

# 외부 스킬
vibe skills add <owner/repo>   # skills.sh 스킬 설치

# 채널
vibe telegram setup|chat|status
vibe slack setup|channel|status

# 기타
vibe env import [path]    # .env → config.json 마이그레이션
vibe help / version
```

### 인증 우선순위

| 프로바이더 | 우선순위 |
|-----------|---------|
| **GPT** | OAuth → API Key → Azure OpenAI |
| **Gemini** | gemini-cli 자동감지 → OAuth → API Key |

---

## 매직 키워드

| 키워드 | 효과 |
|--------|------|
| `ultrawork` / `ulw` | 병렬 처리 + Phase 파이프라이닝 + 자동 계속 + Ralph Loop |
| `ralph` | 100% 완성까지 반복 (범위 축소 없음) |
| `ralplan` | 반복적 계획 수립 + 영속화 |
| `verify` | 엄격 검증 모드 |
| `quick` | 빠른 모드, 최소 검증 |

---

## 설정

### 전역: `~/.vibe/config.json`

인증, 채널, 모델 설정 통합 관리 (파일 권한 0o600).

```json
{
  "credentials": {
    "gpt": { "oauthRefreshToken": "..." },
    "gemini": { "oauthRefreshToken": "..." }
  },
  "channels": {
    "telegram": { "botToken": "...", "allowedChatIds": ["..."] },
    "slack": { "botToken": "...", "appToken": "...", "allowedChannelIds": ["..."] }
  },
  "models": { "gpt": "gpt-5.2", "gemini": "gemini-3-pro-preview" }
}
```

### 프로젝트: `.claude/vibe/config.json`

프로젝트별 설정 — language, quality, stacks, details, references, installedExternalSkills.

---

## 모듈 서브패스 Export

런타임 모듈을 서브패스 export로 제공합니다.

```typescript
import { MemoryStorage, SessionRAGStore } from '@su-record/vibe/memory';
import { SwarmOrchestrator, PhasePipeline } from '@su-record/vibe/orchestrator';
import { findSymbol, validateCodeQuality } from '@su-record/vibe/tools';
```

| 서브패스 | 주요 export |
|---------|------------|
| `@su-record/vibe/agent` | Agent 클래스 및 타입 |
| `@su-record/vibe/memory` | `MemoryStorage`, `KnowledgeGraph`, `SessionRAGStore` |
| `@su-record/vibe/orchestrator` | `SwarmOrchestrator`, `PhasePipeline`, `BackgroundManager` |
| `@su-record/vibe/tools` | `findSymbol`, `validateCodeQuality`, `saveMemory` 등 |

---

## 프로젝트 구조

```
your-project/
├── .claude/
│   ├── vibe/
│   │   ├── config.json        # 프로젝트 설정
│   │   ├── constitution.md    # 프로젝트 원칙
│   │   ├── specs/             # SPEC 문서
│   │   ├── features/          # 기능 추적
│   │   ├── todos/             # P1/P2/P3 이슈
│   │   └── reports/           # 리뷰 리포트
│   └── skills/                # 로컬 + 외부 스킬
├── CLAUDE.md                  # 프로젝트 가이드 (자동 생성)
└── ...

~/.vibe/config.json            # 전역 설정 (인증, 채널, 모델)
~/.claude/
├── vibe/
│   ├── rules/                 # 코딩 규칙
│   ├── skills/                # 전역 스킬
│   ├── ui-ux-data/            # UI/UX CSV 데이터
│   ├── session-rag.db         # Session RAG (SQLite + FTS5)
│   └── memories.json          # 저장된 메모리
├── commands/                  # 슬래시 명령어 (10개)
└── agents/                    # 에이전트 정의 (49개)
```

---

## 시스템 아키텍처

```mermaid
flowchart TD
    A["사용자 요청"] --> B["keyword-detector"]
    B --> C["prompt-dispatcher"]
    C --> D["SmartRouter"]

    D --> E["LLMCluster"]
    E --> E1["GPT"]
    E --> E2["Gemini"]

    D --> F["PhasePipeline"]
    F --> G["SwarmOrchestrator"]
    G --> H["BackgroundManager"]
    H --> I["AgentRegistry"]

    D --> J["ReviewRace"]
    J --> J1["GPT 리뷰"]
    J --> J2["Gemini 리뷰"]
    J1 --> K["교차 검증 → P1/P2/P3"]
    J2 --> K

    L["Session RAG"] -.-> M["Decision / Constraint / Goal / Evidence"]
    O["품질 게이트"] -.-> P["pre-tool-guard → 차단"]
    O -.-> Q["code-check → 검증"]
```

---

## 요구사항

- **Node.js** >= 18.0.0
- **Claude Code** (필수)
- GPT, Gemini (선택 — 멀티 LLM 기능용)
- sox (선택 — `/vibe.voice` 음성 입력용)

## 라이선스

MIT License - Copyright (c) 2025 Su
