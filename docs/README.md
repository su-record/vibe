# VIBE — AI Coding Framework for Claude Code

[![npm version](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Claude Code 전용 AI 코딩 프레임워크. 49개 에이전트, 41+ 도구, 멀티 LLM 오케스트레이션.

```bash
npm install -g @su-record/vibe
vibe init
```

---

## 목차

- [왜 Vibe인가](#왜-vibe인가)
- [동작 원리](#동작-원리)
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
| AI 결과를 그대로 수용 | 3개 LLM 교차 검증 (Claude + GPT + Gemini) |
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

```
/vibe.spec "기능"  →  /vibe.spec.review  →  /vibe.run  →  자동 리뷰  →  완료
    SPEC 작성         GPT/Gemini 3라운드     구현 실행      13개 에이전트
```

1. **`/vibe.spec`** — 요구사항을 SPEC 문서로 정의 (GPT + Gemini 병렬 리서치)
2. **`/vibe.spec.review`** — GPT와 Gemini가 3라운드 교차 리뷰
3. **`/vibe.run`** — SPEC 기반으로 구현 실행 + Gemini 실시간 리뷰
4. **자동 리뷰** — 보안, 성능, 아키텍처 등 13개 전문 에이전트가 병렬 검토
5. **P1/P2 자동 수정** — 심각한 이슈는 자동으로 고침

`ultrawork` 키워드를 붙이면 전 과정이 자동화됩니다:
```
/vibe.spec "기능" ultrawork
```
Phase 파이프라이닝, 백그라운드 준비, Ralph Loop(100% 완성까지 반복), 자동 저장

---

## 멀티 LLM 오케스트레이션

3개 LLM 프로바이더를 통합하여 작업 유형별 최적의 모델에 자동 라우팅합니다.

### 지원 모델

| 프로바이더 | 역할 | 인증 |
|-----------|------|------|
| **Claude** | 오케스트레이션, 코드 생성 | 내장 (Claude Code) |
| **GPT** | 아키텍처, 디버깅, 교차 리뷰 | OAuth / API Key |
| **Gemini** | UI/UX, 웹 검색, 음성, 리서치 | OAuth / API Key |

```bash
vibe gpt auth          # GPT OAuth (Plus/Pro)
vibe gemini auth       # Gemini OAuth
```

모든 인증 정보는 `~/.vibe/config.json`에 통합 저장됩니다.

### SmartRouter — 작업 유형별 자동 라우팅

| 작업 유형 | 우선순위 (폴백 체인) |
|----------|---------------------|
| 코드 분석, 리뷰, 추론, 아키텍처, 디버깅 | GPT → Gemini → Claude |
| UI/UX, 웹 검색 | Gemini → GPT → Claude |

- 프로바이더별 30초 타임아웃, 최대 2회 재시도 (지수 백오프)
- 5분 가용성 캐시 — 실패한 프로바이더는 5분간 스킵
- 인증/할당량 에러는 즉시 스킵

### LLMCluster — 병렬 멀티 LLM 호출

```
사용자 요청
    ↓
LLMCluster.multiQuery(prompt)
    ├→ GPT    ─→ 응답 A
    └→ Gemini ─→ 응답 B
    ↓
교차 검증 → 최종 결과
```

### ReviewRace — 병렬 코드 리뷰 + 교차 검증

GPT와 Gemini가 동시에 코드를 리뷰하고, Jaccard 유사도로 교차 검증합니다.

리뷰 유형 (7종): 보안, 성능, 아키텍처, 복잡도, 데이터 무결성, 테스트 커버리지, 일반

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
| Security Reviewer | 보안 취약점 (OWASP Top 10) |
| Performance Reviewer | 성능 병목 |
| Architecture Reviewer | 아키텍처 패턴 |
| Complexity Reviewer | 순환 복잡도, 중첩 깊이 |
| Simplicity Reviewer | 불필요한 복잡성 |
| Data Integrity Reviewer | 데이터 무결성 |
| Test Coverage Reviewer | 테스트 커버리지 |
| Git History Reviewer | 커밋 히스토리 품질 |
| TypeScript Reviewer | TS 타입 안전성 |
| Python Reviewer | Python 코드 품질 |
| Rails Reviewer | Rails 규약 |
| React Reviewer | React 패턴 |

### UI/UX 에이전트 (8)

CSV 데이터 기반 디자인 인텔리전스. 24개 CSV 파일에서 산업별 디자인 전략을 자동 생성합니다.

| Phase | 에이전트 | 역할 |
|-------|----------|------|
| SPEC | ui-industry-analyzer | 산업 분석 + 디자인 전략 |
| SPEC | ui-design-system-gen | MASTER.md 디자인 시스템 생성 |
| SPEC | ui-layout-architect | 페이지 구조/CTA 설계 |
| RUN | ui-stack-implementer | 프레임워크별 컴포넌트 가이드 |
| RUN | ui-dataviz-advisor | 차트/시각화 추천 |
| REVIEW | ux-compliance-reviewer | UX 가이드라인 준수 검증 |
| REVIEW | ui-a11y-auditor | WCAG 2.1 AA 접근성 감사 |
| REVIEW | ui-antipattern-detector | UI 안티패턴 탐지 |

### 리서치 에이전트 (4)

best-practices, framework-docs, codebase-patterns, security-advisory

### QA & 기획 에이전트 (6)

requirements-analyst, ux-advisor, acceptance-tester, edge-case-finder, api-documenter, changelog-writer

### 에이전트 팀 (9팀)

에이전트들이 팀을 구성하여 공유 태스크 리스트로 협업합니다.

| 팀 | 워크플로우 | 멤버 | 활성화 조건 |
|-----|----------|------|-----------|
| Lite | `/vibe.run` 일반 | architect, implementer, tester | 3+ 시나리오 |
| Dev | `/vibe.run` ULTRAWORK | + security-reviewer | ULTRAWORK 또는 복잡도 20+ |
| Research | `/vibe.spec` Step 3 | 4개 리서치 에이전트 | 항상 |
| Review Debate | `/vibe.review` | security, architecture, performance, simplicity | P1/P2 2+ |
| SPEC Debate | `/vibe.spec.review` | 동일 | P1/P2 2+ |
| Debug | `/vibe.run` 실패 | architect, implementer, tester | 빌드/테스트 3회 실패 |
| Security | `/vibe.run` 보안 | security, data-integrity, security-advisory, tester | auth/payment 파일 변경 |
| Migration | `/vibe.run` 마이그레이션 | + build-error-resolver | 메이저 의존성 변경 |
| Fullstack | `/vibe.run` 풀스택 | frontend + backend implementer | SPEC에 프론트+백엔드 |

---

## 오케스트레이터

### SwarmOrchestrator — 자동 작업 분해

복잡한 요청을 자동으로 서브태스크로 분해하여 병렬 실행합니다.

```
"인증 시스템 구현해줘"
    ↓ (복잡도 분석, 임계값 15점)
    ├→ 서브태스크 1: DB 스키마 설계
    ├→ 서브태스크 2: API 엔드포인트 구현
    ├→ 서브태스크 3: 프론트엔드 폼
    └→ 서브태스크 4: 테스트 작성
    ↓ (병렬 실행 → 결과 병합)
```

최대 깊이 2단계, 동시 실행 5개, 기본 타임아웃 5분

### PhasePipeline — 단계별 실행

`prepare() → execute() → cleanup()` 생명주기. ULTRAWORK 모드에서는 현재 Phase 실행 중 다음 Phase의 `prepare()`를 병렬 실행합니다.

### BackgroundManager — 비동기 에이전트 실행

- 모델별/프로바이더별 동시 실행 제한
- 타임아웃 시 kill이 아닌 retry (최대 3회, 지수 백오프)
- 24시간 이상 된 완료 태스크 자동 정리

### AgentRegistry — 실행 추적

SQLite WAL 모드 기반. 실행 시작/완료/실패 기록, 고아 프로세스 감지, API 키 자동 마스킹.

---

## Session RAG — 세션 간 컨텍스트 유지

SQLite + FTS5 하이브리드 검색으로 세션 간 결정사항, 목표, 제약조건을 유지합니다.

### 4가지 엔티티

| 엔티티 | 설명 |
|--------|------|
| **Decision** | 사용자가 확인한 결정사항 (title, rationale, alternatives) |
| **Constraint** | 명시적 제약조건 (type, severity) |
| **Goal** | 현재 목표 스택 (progressPercent, parentId) |
| **Evidence** | 검증/테스트 결과 (status, metrics) |

### 하이브리드 검색

```
최종 점수 = BM25 × 0.4 + 최신성 × 0.3 + 우선순위 × 0.3
```

- BM25 (40%) — FTS5 전문 검색
- 최신성 (30%) — 지수 감쇠 (7일 반감기)
- 우선순위 (30%) — 엔티티 유형별 가중치

세션 시작 시 활성 Goals, 중요 Constraints, 최근 Decisions 자동 주입.

---

## 훅 시스템

| 이벤트 | 스크립트 | 역할 |
|--------|---------|------|
| **SessionStart** | `session-start.js` | 세션 컨텍스트 복원, 메모리 로드 |
| **PreToolUse** | `pre-tool-guard.js` | 파괴적 명령어 차단, 스코프 이탈 방지 |
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
| `/vibe.spec.review "기능"` | GPT/Gemini 3라운드 교차 리뷰 |
| `/vibe.run "기능"` | SPEC 기반 구현 실행 |
| `/vibe.verify "기능"` | SPEC 대비 BDD 검증 |
| `/vibe.review` | 13개 에이전트 병렬 코드 리뷰 |
| `/vibe.trace "기능"` | 요구사항 추적성 매트릭스 |
| `/vibe.reason "문제"` | 체계적 추론 프레임워크 |
| `/vibe.analyze` | 프로젝트 분석 |
| `/vibe.voice` | 음성 → 코딩 명령 (Gemini + sox) |
| `/vibe.utils` | 유틸리티 (E2E, 다이어그램, UI 미리보기, 세션 복원) |

---

## 41+ 내장 도구

### 메모리 & 세션 (21)

save/recall/search/link memories, session RAG (save_session_item, retrieve_session_context, manage_goals), start_session, auto_save_context, restore_session_context, prioritize_memory 등

### 코드 품질 & 분석 (8)

find_symbol, find_references, analyze_dependency_graph, analyze_complexity, validate_code_quality, check_coupling_cohesion, suggest_improvements, apply_quality_rules

### SPEC & 테스트 (9)

spec_generator, prd_parser, traceability_matrix, e2e_test_generator, spec_versioning, requirement_id, preview_ui_ascii, get_current_time, ask_user

### 채널

send_slack — Slack 채널 메시지 전송

---

## 스킬

에이전트가 특정 도메인 지식을 활용할 수 있는 스킬 모듈입니다.

**코어**: Brand Assets, Commerce Patterns, Commit Push PR, Context7, Core/Vibe Capabilities, E2E Commerce, Frontend Design, Git Worktree, Handoff, Parallel Research, Priority Todos, SEO Checklist, Tech Debt, Tool Fallback, TypeScript Advanced Types, Vercel React Best Practices, UI/UX Pro Max

**언어별**: TypeScript-Next.js, TypeScript-React, TypeScript-React Native, Python-FastAPI, Dart-Flutter

**품질**: Checklist, Testing Strategy

**표준**: Anti-Patterns, Code Structure, Complexity Metrics, Naming Conventions

---

## 25개 프레임워크 지원

프로젝트의 기술 스택을 자동 감지하고 해당 프레임워크 규칙을 적용합니다.
모노레포 지원 (pnpm-workspace, npm workspaces, Lerna, Nx, Turborepo).

- **TypeScript (12)** — Next.js, React, Angular, Vue, Svelte, Nuxt, NestJS, Node, Electron, Tauri, React Native, Astro
- **Python (2)** — Django, FastAPI
- **Java/Kotlin (2)** — Spring Boot, Android
- **기타** — Rails, Go, Rust, Swift (iOS), Unity (C#), Flutter (Dart), Godot (GDScript)

자동 감지: DB (PostgreSQL, MySQL, MongoDB, Redis, Prisma, Drizzle 등), 상태 관리 (Redux, Zustand, Jotai, Pinia 등), CI/CD (GitHub Actions, GitLab CI 등), 호스팅 (Vercel, Docker 등)

---

## 품질 보장 시스템

| 가드레일 | 메커니즘 |
|----------|---------|
| **타입 안전성** | Quality Gate — `any`, `@ts-ignore` 차단 |
| **코드 리뷰** | ReviewRace — GPT + Gemini 교차 검증 |
| **완성도** | Ralph Loop — `ralph` 키워드 시 100%까지 반복 |
| **스코프 보호** | pre-tool-guard — 요청 범위 외 수정 방지 |
| **컨텍스트 보호** | context-save — 80/90/95% 자동 저장 |

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
# 프로젝트
vibe init [project]      # 프로젝트 초기화
vibe setup               # 인터랙티브 셋업 위자드
vibe update              # 설정 업데이트
vibe upgrade             # 최신 버전으로 업그레이드
vibe status              # 상태 확인
vibe remove              # 제거

# LLM 인증
vibe gpt auth            # GPT OAuth
vibe gpt key <KEY>       # GPT API 키
vibe gemini auth         # Gemini OAuth
vibe gemini key <KEY>    # Gemini API 키
vibe claude key <KEY>    # Claude API 키

# 채널
vibe telegram setup <token>              # Telegram 봇 설정
vibe telegram chat <id>                  # 허용 채팅 ID 추가
vibe slack setup <bot-token> <app-token> # Slack 설정
vibe slack channel <id>                  # 허용 채널 ID 추가

# 기타
vibe env import [path]   # .env → config.json 마이그레이션
vibe help                # 도움말
vibe version             # 버전
```

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
    "gemini": "gemini-3-pro-preview",
    "geminiFlash": "gemini-3-flash-preview"
  }
}
```

CLI 명령어로 설정: `vibe gpt key`, `vibe gemini auth`, `vibe telegram setup` 등

### 프로젝트: `.claude/vibe/config.json`

프로젝트별 설정 (language, quality, stacks, details, references).

---

## 매직 키워드

| 키워드 | 효과 |
|--------|------|
| `ultrawork` / `ulw` | 병렬 처리 + Phase 파이프라이닝 + Ralph Loop + 자동 저장 |
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

```
사용자 요청
    ↓
keyword-detector.js (ultrawork/ralph/quick 감지)
    ↓
prompt-dispatcher.js (명령어 라우팅)
    ↓
SmartRouter (작업 유형별 LLM 선택 + 폴백 체인)
    ↓
    ├→ LLMCluster (병렬 멀티 LLM 리서치)
    │   ├→ GPT
    │   └→ Gemini
    │
    ├→ PhasePipeline (순차 Phase 실행)
    │   ├→ SwarmOrchestrator (복잡도 15+ → 자동 분해)
    │   │   └→ BackgroundManager (비동기 에이전트 큐)
    │   │       └→ AgentRegistry (SQLite WAL 실행 추적)
    │   │
    │   └→ ULTRAWORK: 다음 Phase prepare() 병렬 실행
    │
    └→ ReviewRace (코드 리뷰)
        ├→ GPT 리뷰 + Gemini 리뷰 (병렬)
        └→ 교차 검증 (Jaccard > 0.5 → P1/P2/P3)

Session RAG:
    save_session_item() → retrieve_session_context()
    → BM25×0.4 + 최신성×0.3 + 우선순위×0.3

품질 게이트:
    pre-tool-guard.js → 파괴적 명령어/스코프 이탈 차단
    code-check.js → 타입 안전성/복잡도 검증
```

---

## 요구사항

- **Node.js** >= 18.0.0
- **Claude Code** (필수)
- GPT, Gemini은 선택사항 (멀티 LLM 기능용)
- sox는 선택사항 (`/vibe.voice` 음성 입력용)

## 라이선스

MIT
