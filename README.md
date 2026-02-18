# VIBE — AI Coding Framework for Claude Code

[![npm version](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**설치 한 줄로 Claude Code에 49개 에이전트, 41+ 도구, 멀티 LLM을 더합니다.**

49개 에이전트 · 41+ 내장 도구 · 멀티 LLM 오케스트레이션 · 25개 프레임워크 지원

---

## Quick Start

```bash
npm install -g @su-record/vibe
vibe init
```

---

## 목차

- [왜 Vibe인가](#왜-vibe인가)
- [동작 원리](#동작-원리)
- [모듈 서브패스 Export](#모듈-서브패스-export)
- [멀티 LLM 오케스트레이션](#멀티-llm-오케스트레이션)
- [에이전트 시스템](#에이전트-시스템)
- [오케스트레이터](#오케스트레이터)
- [Session RAG](#session-rag--세션-간-컨텍스트-유지)
- [훅 시스템](#훅-시스템)
- [슬래시 명령어](#슬래시-명령어)
- [41+ 내장 도구](#41-내장-도구)
- [스킬](#스킬)
- [25개 프레임워크 지원](#25개-프레임워크-지원)
- [품질 보장 시스템](#품질-보장-시스템)
- [CLI 명령어](#cli-명령어)
- [설정](#설정)
- [매직 키워드](#매직-키워드)
- [프로젝트 구조](#프로젝트-구조)
- [시스템 아키텍처](#시스템-아키텍처)

---

## 왜 Vibe인가

AI에게 "로그인 기능 만들어줘"라고 던지면 동작은 하지만 품질은 운에 맡기게 됩니다.
Vibe는 이 문제를 구조로 해결합니다.

| 문제 | Vibe의 해결 |
|------|-----------|
| AI가 `any` 타입을 남발 | Quality Gate가 `any`/`@ts-ignore` 차단 |
| 한 번에 완성된 코드를 기대 | SPEC → 구현 → 검증 단계별 워크플로우 |
| 코드 리뷰 없이 머지 | 13개 에이전트 병렬 리뷰 (보안, 성능, 아키텍처 등) |
| AI 결과를 그대로 수용 | GPT + Gemini 교차 검증 |
| 컨텍스트 소실 | Session RAG로 결정사항/목표 자동 저장 및 복원 |
| 복잡한 작업에서 길을 잃음 | SwarmOrchestrator가 자동 분해 + 병렬 실행 |

### 설계 철학

| 원칙 | 설명 |
|------|------|
| **Easy Vibe Coding** | 빠른 흐름, 직관적 개발, AI와 협업하며 생각하기 |
| **Minimum Quality Guaranteed** | 타입 안전성, 코드 품질, 보안 — 자동으로 하한선 확보 |
| **Iterative Reasoning** | AI에게 답을 맡기지 말고, 문제를 쪼개고 질문하며 함께 추론 |

---

## 동작 원리

```mermaid
flowchart LR
    A["/vibe.spec"] --> B["/vibe.spec.review"]
    B --> C["/vibe.run"]
    C --> D["자동 리뷰"]
    D --> E["완료"]
```

1. **`/vibe.spec`** — 요구사항을 SPEC 문서로 정의 (GPT + Gemini 병렬 리서치)
2. **`/vibe.spec.review`** — SPEC 품질 리뷰
3. **`/vibe.run`** — SPEC 기반으로 구현 실행 + 병렬 코드 리뷰
4. **자동 리뷰** — 13개 전문 에이전트가 병렬 검토
5. **P1/P2 자동 수정** — 심각한 이슈는 자동으로 고침

`ultrawork` 키워드를 붙이면 전 과정이 자동화됩니다:
```bash
/vibe.run "기능" ultrawork
```

---

## 모듈 서브패스 Export

`@su-record/vibe`는 런타임 모듈을 서브패스 export로 제공합니다.

| 서브패스 | 설명 | 주요 export |
|---------|------|------------|
| `@su-record/vibe/agent` | 에이전트 시스템 | Agent 관련 클래스 및 타입 |
| `@su-record/vibe/memory` | 메모리 시스템 | `MemoryStorage`, `KnowledgeGraph`, `SessionRAGStore` 등 |
| `@su-record/vibe/orchestrator` | 오케스트레이터 | `SwarmOrchestrator`, `PhasePipeline`, `BackgroundManager` |
| `@su-record/vibe/tools` | 41+ 내장 도구 | `findSymbol`, `validateCodeQuality`, `saveMemory` 등 |

```typescript
import { MemoryStorage, SessionRAGStore } from '@su-record/vibe/memory';
import { SwarmOrchestrator, PhasePipeline } from '@su-record/vibe/orchestrator';
import { findSymbol, validateCodeQuality } from '@su-record/vibe/tools';
```

---

## 멀티 LLM 오케스트레이션

복수의 LLM 프로바이더를 통합하여 작업 유형별 최적의 모델에 자동 라우팅합니다.

| 프로바이더 | 역할 | 인증 |
|-----------|------|------|
| **Claude** | 오케스트레이션, 코드 생성 | 내장 (Claude Code) |
| **GPT** | 아키텍처, 디버깅, 교차 리뷰 | OAuth / API Key |
| **Gemini** | UI/UX, 웹 검색, 음성, 리서치 | OAuth / API Key |

```bash
vibe gpt auth          # GPT OAuth (Plus/Pro)
vibe gemini auth       # Gemini OAuth
```

### SmartRouter — 작업 유형별 자동 라우팅

| 작업 유형 | 우선순위 (폴백 체인) |
|----------|---------------------|
| 코드 분석, 리뷰, 추론, 아키텍처 | GPT → Gemini → Claude |
| UI/UX, 웹 검색 | Gemini → GPT → Claude |

- 프로바이더별 30초 타임아웃, 최대 3회 재시도 (지수 백오프)
- 5분 가용성 캐시 — 실패한 프로바이더는 5분간 스킵

### LLMCluster — 병렬 멀티 LLM 호출

```mermaid
flowchart TD
    A["사용자 요청"] --> B["LLMCluster.multiQuery"]
    B --> C["GPT 응답"]
    B --> D["Gemini 응답"]
    C --> F["교차 검증"]
    D --> F
    F --> G["최종 결과"]
```

### ReviewRace — 병렬 코드 리뷰

GPT/Gemini가 동시에 코드를 리뷰하고, Jaccard 유사도로 교차 검증하여 우선순위를 산출합니다.

| 우선순위 | 조건 |
|----------|------|
| **P1 (긴급)** | 신뢰도 >= 0.9 AND 심각도 critical/high |
| **P2 (중요)** | 신뢰도 >= 0.6 OR 심각도 medium |
| **P3 (참고)** | 신뢰도 < 0.6 OR 심각도 low |

P1/P2 이슈는 자동으로 수정됩니다.

---

## 에이전트 시스템

49개 전문 에이전트가 각자의 역할에 맞게 작업을 수행합니다.

### 메인 에이전트 (19)

| 에이전트 | 등급 | 역할 |
|----------|------|------|
| **Explorer** | High/Medium/Low | 코드베이스 탐색 |
| **Implementer** | High/Medium/Low | 코드 구현 |
| **Architect** | High/Medium/Low | 아키텍처 설계 |
| **Searcher** | - | 코드 검색 |
| **Tester** | - | 테스트 생성 |
| **Simplifier** | - | 코드 단순화 |
| **Refactor Cleaner** | - | 리팩토링 정리 |
| **Build Error Resolver** | - | 빌드 에러 수정 |
| **Compounder** | - | 복합 작업 처리 |
| **Diagrammer** | - | 다이어그램 생성 |
| **E2E Tester** | - | E2E 테스트 실행 |
| **UI Previewer** | - | UI 미리보기 |
| **Junior Mentor** | - | 주니어 개발자 멘토링 |

### 리뷰 에이전트 (12)

| 에이전트 | 전문 분야 |
|----------|----------|
| Security Reviewer | OWASP Top 10 보안 취약점 |
| Performance Reviewer | 성능 병목 (N+1, 메모리 누수) |
| Architecture Reviewer | 아키텍처 패턴, SOLID 원칙 |
| Complexity Reviewer | 순환 복잡도, 중첩 깊이 |
| Simplicity Reviewer | 과도한 추상화 탐지 |
| Data Integrity Reviewer | 트랜잭션, 데이터 무결성 |
| Test Coverage Reviewer | 누락된 테스트 식별 |
| Git History Reviewer | 커밋 히스토리 위험 패턴 |
| TypeScript/Python/Rails/React | 언어/프레임워크별 전문 리뷰 |

### UI/UX 에이전트 (8)

CSV 데이터 기반 디자인 인텔리전스. 24개 CSV에서 산업별 디자인 전략을 자동 생성합니다.

| 단계 | 에이전트 | 역할 |
|------|---------|------|
| SPEC | ui-industry-analyzer | 산업 분석 + 디자인 전략 |
| SPEC | ui-design-system-gen | MASTER.md 디자인 시스템 생성 |
| SPEC | ui-layout-architect | 페이지 구조/섹션/CTA 설계 |
| RUN | ui-stack-implementer | 프레임워크별 컴포넌트 가이드 |
| RUN | ui-dataviz-advisor | 차트/시각화 라이브러리 추천 |
| REVIEW | ux-compliance-reviewer | UX 가이드라인 준수 검증 |
| REVIEW | ui-a11y-auditor | WCAG 2.1 AA 접근성 감사 |
| REVIEW | ui-antipattern-detector | UI 안티패턴 검출 |

### 리서치 에이전트 (4)

Best Practices, Framework Docs, Codebase Patterns, Security Advisory

### QA & 기획 에이전트 (6)

Requirements Analyst, UX Advisor, Acceptance Tester, Edge Case Finder, API Documenter, Changelog Writer

### 에이전트 팀 (9팀)

에이전트들이 팀을 구성하여 공유 태스크 리스트로 협업합니다.

| 팀 | 워크플로우 | 멤버 |
|-----|-----------|------|
| Lite | `/vibe.run` 일반 | architect, implementer, tester |
| Dev | `/vibe.run` ULTRAWORK | + security-reviewer |
| Research | `/vibe.spec` | 4개 리서치 에이전트 |
| Review Debate | `/vibe.review` | security, architecture, performance, simplicity |
| SPEC Debate | `/vibe.spec.review` | 동일 |
| Debug | `/vibe.run` 실패 | architect, implementer, tester |
| Security | `/vibe.run` 보안 | security, data-integrity, security-advisory, tester |
| Migration | `/vibe.run` 마이그레이션 | + build-error-resolver |
| Fullstack | `/vibe.run` 풀스택 | frontend + backend implementer |

---

## 오케스트레이터

### SwarmOrchestrator — 자동 작업 분해

```mermaid
flowchart TD
    A["인증 시스템 구현해줘"] --> B{"복잡도 분석"}
    B -->|"15점 이상"| C["자동 분해"]
    C --> D["DB 스키마 설계"]
    C --> E["API 엔드포인트"]
    C --> F["프론트엔드 폼"]
    C --> G["테스트 작성"]
    D --> H["결과 병합"]
    E --> H
    F --> H
    G --> H
```

최대 깊이 2단계, 동시 실행 5개, 기본 타임아웃 5분

### PhasePipeline — 단계별 실행

각 Phase는 `prepare()` → `execute()` → `cleanup()` 생명주기. ULTRAWORK 모드에서는 다음 Phase의 `prepare()`를 병렬 실행합니다.

### BackgroundManager — 비동기 에이전트 실행

- 모델별/프로바이더별 동시 실행 제한
- 타임아웃 시 kill이 아닌 retry (최대 3회, 지수 백오프)
- 24시간 이상 된 완료 태스크 자동 정리

### AgentRegistry — 실행 추적

SQLite WAL 모드 기반. 고아 프로세스 감지, 통계 조회, 24시간 TTL 자동 정리.

---

## Session RAG — 세션 간 컨텍스트 유지

SQLite + FTS5 하이브리드 검색으로 세션 간 결정사항, 목표, 제약조건을 유지합니다.

### 4가지 엔티티

| 엔티티 | 설명 | 주요 필드 |
|--------|------|-----------|
| **Decision** | 사용자가 확인한 결정사항 | title, rationale, alternatives, priority |
| **Constraint** | 명시적 제약조건 | type(technical/business/resource/quality), severity |
| **Goal** | 현재 목표 (계층 지원) | status, priority, progressPercent, parentId |
| **Evidence** | 검증/테스트 결과 | type(test/build/lint/coverage), status, metrics |

### 하이브리드 검색

```
최종 점수 = BM25 × 0.4 + 최신성 × 0.3 + 우선순위 × 0.3
```

세션 시작 시 활성 Goals, 중요 Constraints, 최근 Decisions 자동 주입.

---

## 훅 시스템

| 이벤트 | 스크립트 | 역할 |
|--------|---------|------|
| **SessionStart** | `session-start.js` | 세션 컨텍스트 복원, 메모리 로드 |
| **PreToolUse** | `pre-tool-guard.js` | 파괴적 명령어 차단, 스코프 보호 |
| **PostToolUse** | `code-check.js` | 타입 안전성/복잡도 검증 |
| **PostToolUse** | `post-edit.js` | Git 인덱스 업데이트 |
| **UserPromptSubmit** | `prompt-dispatcher.js` | 명령어 라우팅 |
| **UserPromptSubmit** | `keyword-detector.js` | 매직 키워드 감지 |
| **Notification** | `context-save.js` | 컨텍스트 80/90/95% 자동 저장 |

추가 훅: `llm-orchestrate.js`, `code-review.js`, `recall.js`, `complexity.js`, `compound.js`, `stop-notify.js`

---

## 슬래시 명령어

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능"` | SPEC 작성 + GPT/Gemini 병렬 리서치 |
| `/vibe.spec.review "기능"` | SPEC 품질 리뷰 |
| `/vibe.run "기능"` | SPEC 기반 구현 실행 + Race Review |
| `/vibe.verify "기능"` | SPEC 대비 BDD 검증 |
| `/vibe.review` | 13개 에이전트 병렬 코드 리뷰 |
| `/vibe.trace "기능"` | 요구사항 추적성 매트릭스 |
| `/vibe.reason "문제"` | 체계적 추론 프레임워크 |
| `/vibe.analyze` | 프로젝트 분석 |
| `/vibe.voice` | 음성 → 코딩 명령 (Gemini + sox) |
| `/vibe.utils` | 유틸리티 (E2E, 다이어그램, UI, 세션 복원) |

### 권장 워크플로우

```mermaid
flowchart TD
    A["/vibe.spec"] --> B["/new"]
    B --> C["/vibe.spec.review"]
    C --> D["/vibe.run"]
    D --> E["/vibe.trace"]
    E --> F["자동 13+ 에이전트 리뷰"]
    F --> G{"P1/P2?"}
    G -->|"Yes"| H["자동 수정"]
    G -->|"No"| I["완료"]
    H --> I
```

---

## 41+ 내장 도구

### 메모리 & 세션 (21)

| 도구 | 역할 |
|------|------|
| `save_session_item` | Decision/Constraint/Goal/Evidence 저장 |
| `retrieve_session_context` | 하이브리드 검색 (BM25 + 최신성 + 우선순위) |
| `manage_goals` | Goal 생명주기 관리 |
| `core_save_memory` | 중요 결정사항 메모리 저장 |
| `core_recall_memory` | 저장된 메모리 회상 |
| `core_search_memories` | 메모리 검색 |
| `core_start_session` | 이전 세션 컨텍스트 복원 |
| `core_auto_save_context` | 현재 상태 자동 저장 |
| 그 외 12개 | 메모리 그래프, 타임라인, 우선순위, 관찰 기록 등 |

### 코드 품질 & 분석 (8)

`core_find_symbol`, `core_find_references`, `core_analyze_dependency_graph`, `core_analyze_complexity`, `core_validate_code_quality`, `core_check_coupling_cohesion`, `core_suggest_improvements`, `core_apply_quality_rules`

### SPEC & 테스트 (9)

`core_spec_generator`, `core_prd_parser`, `core_traceability_matrix`, `core_e2e_test_generator`, `core_preview_ui_ascii`, `core_get_current_time` 등

### UI/UX 도구 (4)

`core_ui_search`, `core_ui_stack_search`, `core_ui_generate_design_system`, `core_ui_persist_design_system`

---

## 스킬

에이전트가 특정 도메인 지식을 활용할 수 있는 스킬 모듈입니다.

**코어**: Brand Assets, Commerce Patterns, Commit Push PR, Context7, Core/Vibe Capabilities, E2E Commerce, Frontend Design, Git Worktree, Handoff, Parallel Research, Priority Todos, SEO Checklist, Tech Debt, Tool Fallback, TypeScript Advanced Types, Vercel React Best Practices, UI/UX Pro Max

**언어별**: TypeScript-Next.js, TypeScript-React, TypeScript-React Native, Python-FastAPI, Dart-Flutter

**품질/표준**: Checklist, Testing Strategy, Anti-Patterns, Code Structure, Complexity Metrics, Naming Conventions

---

## 25개 프레임워크 지원

프로젝트의 기술 스택을 자동 감지하고 프레임워크별 코딩 규칙을 적용합니다.
모노레포 지원 (pnpm-workspace, npm workspaces, Lerna, Nx, Turborepo).

- **TypeScript (12)** — Next.js, React, Angular, Vue, Svelte, Nuxt, NestJS, Node, Electron, Tauri, React Native, Astro
- **Python (2)** — Django, FastAPI
- **Java/Kotlin (2)** — Spring Boot, Android
- **기타** — Rails, Go, Rust, Swift (iOS), Unity (C#), Flutter (Dart), Godot (GDScript)

자동 감지: DB (PostgreSQL, MySQL, MongoDB, Redis, Prisma, Drizzle 등), 상태 관리 (Redux, Zustand, Jotai 등), CI/CD (GitHub Actions 등), 호스팅 (Vercel, Docker 등)

---

## 품질 보장 시스템

| 가드레일 | 메커니즘 |
|----------|---------|
| **타입 안전성** | Quality Gate — `any`, `@ts-ignore` 차단 |
| **코드 리뷰** | ReviewRace — GPT + Gemini 교차 검증 |
| **완성도** | Ralph Loop — 100%까지 반복 (범위 축소 없음) |
| **스코프 보호** | pre-tool-guard — 요청 범위 외 수정 방지 |
| **컨텍스트 보호** | context-save — 80/90/95% 자동 저장 |
| **합리화 방지** | Anti-Rationalization — AI 변명 패턴 차단 |
| **증거 게이트** | Evidence Gate — 증거 없는 완료 주장 금지 |

### 코드 복잡도 제한

| 메트릭 | 제한 |
|--------|------|
| 함수 길이 | ≤30줄 (권장), ≤50줄 (허용) |
| 중첩 깊이 | ≤3단계 |
| 매개변수 | ≤5개 |
| 순환 복잡도 | ≤10 |

---

## CLI 명령어

```bash
# 셋업
vibe setup                # 셋업 위자드 (인증, 채널, 설정)
vibe init [project]       # 프로젝트 초기화
vibe update               # 설정 업데이트
vibe upgrade              # 최신 버전으로 업그레이드
vibe status               # 상태 확인
vibe remove               # 제거

# LLM 인증
vibe gpt auth / key / status / logout
vibe gemini auth / key / status / logout
vibe claude key / status / logout

# 외부 채널
vibe telegram setup / chat / status
vibe slack setup / channel / status

# 기타
vibe env import [path]    # .env → config.json 마이그레이션
vibe help                 # 도움말
vibe version              # 버전
```

### 인증 우선순위

| 프로바이더 | 우선순위 |
|-----------|---------|
| **GPT** | OAuth → API Key → Azure OpenAI |
| **Gemini** | gemini-cli 자동감지 → OAuth → API Key |

---

## 설정

### 전역: `~/.vibe/config.json`

모든 인증, 채널, 모델 설정을 하나의 파일에 통합 관리합니다 (파일 권한 0o600).

```json
{
  "credentials": {
    "gpt": { "apiKey": "sk-...", "oauthRefreshToken": "..." },
    "gemini": { "apiKey": "AIza...", "oauthRefreshToken": "..." }
  },
  "channels": {
    "telegram": { "botToken": "123:ABC", "allowedChatIds": ["-100..."] },
    "slack": { "botToken": "xoxb-...", "appToken": "xapp-...", "allowedChannelIds": ["C01..."] }
  },
  "models": {
    "gpt": "gpt-5.2",
    "gemini": "gemini-3-pro-preview"
  }
}
```

### 프로젝트: `.claude/vibe/config.json`

프로젝트별 설정 (language, quality, stacks, details, references).

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

## 프로젝트 구조

```
your-project/
├── .claude/
│   └── vibe/
│       ├── config.json        # 프로젝트 설정 (모델, 스택)
│       ├── constitution.md    # 프로젝트 원칙
│       ├── specs/             # SPEC 문서
│       ├── features/          # 기능 추적
│       ├── todos/             # 이슈 추적 (P1/P2/P3)
│       └── reports/           # 리뷰 리포트
├── CLAUDE.md                  # 프로젝트 가이드 (자동 생성)
└── ...
```

전역 설정:
```
~/.vibe/
├── config.json                # 전역 설정 (인증, 채널, 모델)
├── hooks/scripts/             # 훅 스크립트
└── node_modules/@su-record/vibe/  # 패키지 복사본

~/.claude/
├── vibe/
│   ├── rules/                 # 코딩 규칙
│   ├── skills/                # 스킬 정의
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

    L["Session RAG"] -.-> M["Decision/Constraint/Goal/Evidence"]
    L -.-> N["BM25 × 0.4 + 최신성 × 0.3 + 우선순위 × 0.3"]

    O["품질 게이트"] -.-> P["pre-tool-guard → 차단"]
    O -.-> Q["code-check → 검증"]
```

---

## 요구사항

- **Node.js** >= 18.0.0
- **Claude Code** (필수)
- GPT, Gemini는 선택사항 (멀티 LLM 기능용)
- sox는 선택사항 (`/vibe.voice` 음성 입력용)

## 라이선스

MIT License - Copyright (c) 2025 Su
