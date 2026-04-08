# VIBE — AI Coding Framework

[![npm version](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**One install adds 56 agents, 45 skills, multi-LLM orchestration, and automated quality gates to your AI coding workflow.**

Works with Claude Code, Codex, Cursor, and Gemini CLI.

```bash
npm install -g @su-record/vibe
vibe init
```

---

## Why Vibe

AI generates working code, but quality is left to chance.
Vibe solves this structurally.

| Problem | Solution |
|---------|----------|
| AI scatters `any` types | Quality Gate blocks `any` / `@ts-ignore` |
| Expecting one-shot perfection | SPEC → Implement → Verify staged workflow |
| Merging without review | 12 agents run parallel code review |
| Accepting AI output blindly | GPT + Gemini cross-validation |
| Losing context between sessions | Session RAG auto-saves and restores |
| Getting lost on complex tasks | SwarmOrchestrator auto-decomposes + parallelizes |

### Design Philosophy

| Principle | Description |
|-----------|-------------|
| **Easy Vibe Coding** | Fast flow — think collaboratively with AI |
| **Minimum Quality Guaranteed** | Type safety, code quality, security — automatic baseline |
| **Iterative Reasoning** | Break down problems, ask questions, reason together |

---

## Workflow

```mermaid
flowchart LR
    A["/vibe.spec"] --> B["/vibe.spec.review"]
    B --> C["/vibe.run"]
    C --> D["Auto Review"]
    D --> E["Done"]
```

1. **`/vibe.spec`** — Define requirements as a SPEC document (GPT + Gemini parallel research)
2. **`/vibe.spec.review`** — SPEC quality review + Codex adversarial review (triple cross-validation)
3. **`/vibe.run`** — Implement from SPEC (Codex rescue parallel delegation) + triple code review
4. **Auto Review** — 12 specialized agents review in parallel + boundary verification, P1/P2 auto-fix

Add `ultrawork` to automate the entire pipeline:

```bash
/vibe.run "feature" ultrawork
```

---

## Multi-CLI Support

| CLI | Install Location | Agents | Skills | Instructions |
|-----|-----------------|--------|--------|-------------|
| **Claude Code** | `~/.claude/agents/` | 56 | `~/.claude/skills/` | `CLAUDE.md` |
| **Codex** | `~/.codex/plugins/vibe/` | 56 | Plugin built-in | `AGENTS.md` |
| **Cursor** | `~/.cursor/agents/` | 56 | `~/.cursor/skills/` | `.cursorrules` |
| **Gemini CLI** | `~/.gemini/agents/` | 56 | `~/.gemini/skills/` | `GEMINI.md` |

### Codex Plugin Integration

When the Codex Claude Code plugin (`codex-plugin-cc`) is installed, Vibe automatically integrates it across every workflow stage:

| Workflow | Codex Usage | Command |
|----------|------------|---------|
| **spec review** | Adversarial SPEC challenge | `/codex:adversarial-review` |
| **run** | Parallel implementation delegation | `/codex:rescue --background` |
| **run / review** | Triple code review (GPT + Gemini + Codex) | `/codex:review` |
| **run / review** | Fallback on auto-fix failure | `/codex:rescue` |
| **verify** | Final review gate | `/codex:review` |
| **Stop hook** | Auto-review on code changes | `codex-review-gate.js` |

Auto-skips when Codex is not installed — existing workflow continues as-is.

---

## Agents (56)

### Core Agents (19)

| Category | Agents |
|----------|--------|
| **Exploration** | Explorer (High / Medium / Low) |
| **Implementation** | Implementer (High / Medium / Low) |
| **Architecture** | Architect (High / Medium / Low) |
| **Utility** | Searcher, Tester, Simplifier, Refactor Cleaner, Build Error Resolver, Compounder, Diagrammer, E2E Tester, UI Previewer, Junior Mentor |

### Review Agents (12)

Security, Performance, Architecture, Complexity, Simplicity, Data Integrity, Test Coverage, Git History, TypeScript, Python, Rails, React

### UI/UX Agents (8)

Design intelligence backed by 48 CSV datasets. Industry analysis → Design system generation → Implementation guide → Accessibility audit.

| Phase | Agents |
|-------|--------|
| SPEC | ui-industry-analyzer, ui-design-system-gen, ui-layout-architect |
| RUN | ui-stack-implementer, ui-dataviz-advisor |
| REVIEW | ux-compliance-reviewer, ui-a11y-auditor, ui-antipattern-detector |

### QA & Research (11)

| Category | Agents |
|----------|--------|
| **QA** | QA Coordinator, Edge Case Finder, Acceptance Tester |
| **Research** | Best Practices, Framework Docs, Codebase Patterns, Security Advisory |
| **Analysis** | Requirements Analyst, UX Advisor, API Documenter, Changelog Writer |

QA Coordinator analyzes changed code and dispatches appropriate QA agents in parallel, then produces a unified QA report.

### Event Agents (6)

Event Content, Event Image, Event Speaker, Event Ops, Event Comms, Event Scheduler

---

## Skills (45)

Domain-specific skill modules auto-installed based on detected stack. Classified into 3 tiers to prevent context overload.

**Core (4):** Tech Debt, Characterization Test, Arch Guard, Exec Plan

**Standard (11):** Parallel Research, Handoff, Priority Todos, Agents MD, Claude MD Guide, Capability Loop, Design Teach, Vibe Figma, Vibe Figma Extract, Vibe Figma Convert, Vibe Docs

**Optional (4):** Commit Push PR, Git Worktree, Tool Fallback, Context7

**Design (8):** UI/UX Pro Max, Design Audit, Design Critique, Design Polish, Design Normalize, Design Distill, Brand Assets, SEO Checklist

**Domain (3):** Commerce Patterns, E2E Commerce, Video Production

**PM (3):** Create PRD, Prioritization Frameworks, User Personas

**Event (3):** Event Planning, Event Comms, Event Ops

**Stack-Specific (2):** TypeScript Advanced Types, Vercel React Best Practices

**Figma Pipeline (7):** Figma Rules, Figma Pipeline, Figma Frame, Figma Style, Figma Analyze, Figma Consolidate, Figma Codegen

### External Skills (skills.sh)

Install community skills from the [skills.sh](https://skills.sh) ecosystem:

```bash
vibe skills add vercel-labs/next-skills
```

Auto-installed by stack during `vibe init` / `vibe update`:

| Stack | Auto-installed Package |
|-------|----------------------|
| `typescript-react` | `vercel-labs/agent-skills` |
| `typescript-nextjs` | `vercel-labs/agent-skills`, `vercel-labs/next-skills` |

---

## Multi-LLM Orchestration

| Provider | Role | Auth |
|----------|------|------|
| **Claude** (Opus / Sonnet / Haiku) | SPEC writing, code review, orchestration | Built-in (Claude Code) |
| **GPT** | Reasoning, architecture, edge-case analysis | Codex CLI / API Key |
| **Gemini** | Research, cross-validation, UI/UX | gemini-cli / API Key |

### Dynamic Model Routing

Auto-switches based on active LLM availability. Defaults to Claude-only operation.

| State | Behavior |
|-------|----------|
| **Claude only** | Opus (design/judgment) + Sonnet (review/implementation) + Haiku (exploration) |
| **+ GPT** | Implementation → GPT, review → GPT, reasoning → GPT |
| **+ Gemini** | Research/review gets parallel Gemini |
| **+ GPT + Gemini** | Full orchestration across all models |

---

## 24 Framework Detection

Auto-detects project stack and applies framework-specific coding rules.
Supports monorepos (pnpm-workspace, npm workspaces, Lerna, Nx, Turborepo).

- **TypeScript (12)** — Next.js, React, Angular, Vue, Svelte, Nuxt, NestJS, Node, Electron, Tauri, React Native, Astro
- **Python (2)** — Django, FastAPI
- **Java/Kotlin (2)** — Spring Boot, Android
- **Other** — Rails, Go, Rust, Swift (iOS), Unity (C#), Flutter (Dart), Godot (GDScript)

Also detects: databases (PostgreSQL, MySQL, MongoDB, Redis, Prisma, Drizzle, etc.), state management (Redux, Zustand, Jotai, Pinia, etc.), CI/CD, and hosting platforms.

---

## Orchestrators

### SwarmOrchestrator

Auto-decomposes tasks with complexity score ≥ 15 into parallel subtasks.
Max depth 2, concurrent limit 5, default timeout 5 min.

### PhasePipeline

`prepare()` → `execute()` → `cleanup()` lifecycle.
In ULTRAWORK mode, the next phase's `prepare()` runs in parallel.

### BackgroundManager

Per-model/provider concurrency limits. Timeout retry (max 3, exponential backoff). 24-hour TTL auto-cleanup.

---

## Infrastructure

### Session RAG

SQLite + FTS5 hybrid search for cross-session context persistence.

**4 entity types:** Decision, Constraint, Goal, Evidence

```
Score = BM25 × 0.4 + Recency × 0.3 + Priority × 0.3
```

On session start, active Goals, critical Constraints, and recent Decisions are auto-injected.

### Structured Telemetry

8 typed span kinds track all operations:

`skill_run` · `agent_run` · `edit` · `build` · `review` · `hook` · `llm_call` · `decision`

Parent-child hierarchy via `parent_id`. All data stays in local JSONL.

### Evolution System

Self-improving agent/skill/rule generation with benchmarking:

- Usage tracking and insight extraction
- Skill gap detection
- Auto-generation with evaluation runners
- Circuit breaker and rollback safety

### Component Registry

Runtime component registration/resolution with metadata:

```typescript
import { ComponentRegistry } from '@su-record/vibe/tools';

const skills = new ComponentRegistry<SkillRunner>();
skills.register('review', () => new ReviewRunner(), { version: '2.0' });
const runner = skills.resolve('review');
```

---

## Hooks (21 scripts)

| Event | Script | Role |
|-------|--------|------|
| SessionStart | `session-start.js` | Restore session context, load memory |
| PreToolUse | `pre-tool-guard.js` | Block destructive commands, scope protection |
| PostToolUse | `code-check.js` | Type safety / complexity verification |
| PostToolUse | `post-edit.js` | Git index update |
| UserPromptSubmit | `prompt-dispatcher.js` | Command routing |
| UserPromptSubmit | `keyword-detector.js` | Magic keyword detection |
| UserPromptSubmit | `llm-orchestrate.js` | Multi-LLM dispatch |
| Notification | `context-save.js` | Auto-save at 80/90/95% context |
| Notification | `stop-notify.js` | Session end notification |

Additional: `codex-review-gate.js`, `codex-detect.js`, `sentinel-guard.js`, `skill-injector.js`, `evolution-engine.js`, `hud-status.js`, `auto-commit.js`, `auto-format.js`, `auto-test.js`, `command-log.js`, `pr-test-gate.js`, `figma-extract.js`

---

## Figma → Code Pipeline

Design-to-code with responsive support and design skill integration.

```bash
# Setup: vibe figma setup <token>
/vibe.figma "https://figma.com/design/ABC/Project?node-id=1-2"

# Responsive (mobile + desktop)
/vibe.figma "mobile-url" "desktop-url"
```

### What It Does

| Phase | Description |
|-------|-------------|
| **Extract** | Figma REST API → node tree + CSS + images (token required) |
| **Analyze** | Image-first analysis → viewport diff table (responsive mode) |
| **Generate** | Stack-aware code (React/Vue/Svelte/SCSS/Tailwind) + design tokens |
| **Integrate** | Maps to project's existing design system (MASTER.md, design-context.json) |

### Responsive Design

Auto-detected when 2+ URLs provided. Generates fluid scaling with `clamp()` for typography/spacing, `@media` only for layout structure changes.

| Config | Default | Description |
|--------|---------|-------------|
| `breakpoint` | 1024px | PC↔Mobile boundary |
| `pcTarget` | 1920px | PC main target resolution |
| `mobileMinimum` | 360px | Minimum mobile viewport |
| `designPc` | 2560px | Figma PC artboard (2x) |
| `designMobile` | 720px | Figma Mobile artboard (2x) |

Customize: `vibe figma breakpoints --set breakpoint=768`

### Design Skill Pipeline

After code generation, chain design skills for quality assurance:

```
/vibe.figma → /design-normalize → /design-audit → /design-polish
```

---

## Quality Gates

| Guard | Mechanism |
|-------|-----------|
| **Type Safety** | Quality Gate — blocks `any`, `@ts-ignore` |
| **Code Review** | 12 Sonnet agents parallel review + Codex triple cross-validation |
| **Boundary Check** | API ↔ Frontend type/routing/state consistency verification |
| **Completeness** | Ralph Loop — iterates until 100% (no scope reduction) |
| **Convergence** | P1=0 means done; scope narrows on repeated rounds |
| **Scope Protection** | pre-tool-guard — prevents out-of-scope modifications |
| **Context Protection** | context-save — auto-saves at 80/90/95% |
| **Evidence Gate** | No completion claims without evidence |

**Complexity limits:** Function ≤ 50 lines | Nesting ≤ 3 | Parameters ≤ 5 | Cyclomatic complexity ≤ 10

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/vibe.spec "feature"` | Write SPEC + GPT/Gemini parallel research |
| `/vibe.spec.review` | SPEC quality review |
| `/vibe.run "feature"` | Implement from SPEC + parallel code review |
| `/vibe.verify "feature"` | BDD verification against SPEC |
| `/vibe.review` | 12-agent parallel code review |
| `/vibe.trace "feature"` | Requirements traceability matrix |
| `/vibe.reason "problem"` | Systematic reasoning framework |
| `/vibe.analyze` | Project analysis |
| `/vibe.event` | Event automation |
| `/vibe.figma "url"` | Figma design → production code (responsive, multi-URL) |
| `/vibe.utils` | Utilities (E2E, diagrams, UI, session restore) |

---

## Magic Keywords

| Keyword | Effect |
|---------|--------|
| `ultrawork` / `ulw` | Parallel processing + phase pipelining + auto-continue + Ralph Loop |
| `ralph` | Iterate until 100% complete (no scope reduction) |
| `ralplan` | Iterative planning + persistence |
| `verify` | Strict verification mode |
| `quick` | Fast mode, minimal verification |

---

## CLI

```bash
# Project
vibe init [project]       # Initialize project
vibe update               # Update settings (re-detect stacks)
vibe upgrade              # Upgrade to latest version
vibe setup                # Interactive setup wizard
vibe status               # Show status
vibe remove               # Uninstall

# LLM Auth
vibe gpt auth|key|status|logout
vibe gemini auth|key|status|logout
vibe claude key|status|logout

# External Skills
vibe skills add <owner/repo>   # Install skills from skills.sh

# Figma
vibe figma breakpoints                # Show/set responsive breakpoints
vibe figma status|logout              # Token management

# Channels
vibe telegram setup|chat|status
vibe slack setup|channel|status

# Diagnostics
vibe config show          # Unified config view (global + project)
vibe stats [--week|--quality]  # Usage telemetry summary

# Other
vibe env import [path]    # Migrate .env → config.json
vibe help / version
```

### Auth Priority

| Provider | Priority |
|----------|----------|
| **GPT** | Codex CLI → API Key |
| **Gemini** | gemini-cli auto-detect → API Key |

---

## Subpath Exports

```typescript
import { MemoryStorage, SessionRAGStore } from '@su-record/vibe/memory';
import { SwarmOrchestrator, PhasePipeline } from '@su-record/vibe/orchestrator';
import { findSymbol, validateCodeQuality } from '@su-record/vibe/tools';
import { InMemoryStorage, ComponentRegistry, createSpan } from '@su-record/vibe/tools';
```

| Subpath | Key Exports |
|---------|-------------|
| `@su-record/vibe/memory` | `MemoryStorage`, `IMemoryStorage`, `InMemoryStorage`, `KnowledgeGraph`, `SessionRAGStore` |
| `@su-record/vibe/orchestrator` | `SwarmOrchestrator`, `PhasePipeline`, `BackgroundManager` |
| `@su-record/vibe/tools` | `findSymbol`, `validateCodeQuality`, `createSpan`, `ComponentRegistry`, etc. |
| `@su-record/vibe/tools/memory` | Memory tools |
| `@su-record/vibe/tools/convention` | Code quality tools |
| `@su-record/vibe/tools/semantic` | Semantic analysis (symbol search, AST, LSP) |
| `@su-record/vibe/tools/ui` | UI/UX tools |
| `@su-record/vibe/tools/interaction` | User interaction tools |
| `@su-record/vibe/tools/time` | Time utilities |

---

## Configuration

### Global: `~/.vibe/config.json`

Auth, channels, and model settings (file permissions `0o600`).

```json
{
  "credentials": {
    "gpt": { "apiKey": "..." },
    "gemini": { "apiKey": "..." }
  },
  "channels": {
    "telegram": { "botToken": "...", "allowedChatIds": ["..."] },
    "slack": { "botToken": "...", "appToken": "...", "allowedChannelIds": ["..."] }
  },
  "models": { "gpt": "gpt-5.4", "gemini": "gemini-3.1-pro-preview" }
}
```

### Project: `.claude/vibe/config.json`

Per-project settings — language, quality, stacks, details, references, installedExternalSkills.

---

## Project Structure

```
your-project/
├── .claude/
│   ├── vibe/
│   │   ├── config.json        # Project config
│   │   ├── constitution.md    # Project principles
│   │   ├── specs/             # SPEC documents
│   │   ├── features/          # Feature tracking
│   │   ├── todos/             # P1/P2/P3 issues
│   │   └── reports/           # Review reports
│   └── skills/                # Local + external skills
├── CLAUDE.md                  # Project guide (auto-generated)
├── AGENTS.md                  # Codex CLI guide (auto-generated)
└── ...

~/.vibe/config.json            # Global config (auth, channels, models)
~/.vibe/analytics/             # Telemetry (local JSONL)
│   ├── skill-usage.jsonl
│   ├── spans.jsonl
│   └── decisions.jsonl
~/.claude/
├── vibe/
│   ├── rules/                 # Coding rules
│   ├── skills/                # Global skills
│   └── ui-ux-data/            # UI/UX CSV datasets (48 files)
├── commands/                  # Slash commands
└── agents/                    # Agent definitions (56)
~/.codex/
└── plugins/vibe/              # Codex plugin
    ├── .codex-plugin/plugin.json
    ├── agents/
    ├── skills/
    └── AGENTS.md
```

---

## Architecture

```mermaid
flowchart TD
    A["User Request"] --> B["keyword-detector"]
    B --> C["prompt-dispatcher"]
    C --> D["SmartRouter"]

    D --> E["LLMCluster"]
    E --> E1["GPT (Reasoning)"]
    E --> E2["Gemini (Research)"]

    D --> F["PhasePipeline"]
    F --> G["SwarmOrchestrator"]
    G --> H["BackgroundManager"]
    H --> I["AgentRegistry"]

    D --> J["Parallel Review"]
    J --> J1["12 Sonnet Review Agents"]
    J --> J2["Codex Review"]
    J1 --> K["Triple Cross-Validation → P1/P2/P3"]
    J2 --> K
    J --> J3["Boundary Verification"]

    L["Session RAG"] -.-> M["Decision / Constraint / Goal / Evidence"]
    N["VibeSpan"] -.-> O["spans.jsonl (Local Telemetry)"]
    P["Quality Gate"] -.-> Q["pre-tool-guard → Block"]
    P -.-> R["code-check → Verify"]
```

---

## 하네스 시스템 (Harness System)

> **Agent = Model + Harness**

하네스는 AI 에이전트에서 **모델을 제외한 모든 것** — AI가 일하는 환경 전체입니다.
`vibe init` 한 번으로 가이드(Guides)와 센서(Sensors)가 설치되어, AI가 올바른 방향으로 일하고 스스로 교정하는 구조를 만듭니다.

| 축 | 역할 | 구성 요소 |
|---|------|----------|
| **Guides** (피드포워드) | 행동 **전에** 방향 설정 | CLAUDE.md, 규칙, 에이전트 56개, 스킬 45개, 커맨드 |
| **Sensors** (피드백) | 행동 **후에** 관찰·교정 | 훅 21개 (품질 게이트, 자동 테스트), 이볼루션 엔진 |

### 구성 요소

| 구성 요소 | 분류 | 역할 |
|-----------|------|------|
| **CLAUDE.md / 규칙** | Guide | 프로젝트 지침, 코딩 표준 — AI가 읽고 따르는 컨텍스트 |
| **에이전트 (56개)** | Guide | 탐색·구현·아키텍처·리뷰·QA·UI/UX 전문 페르소나 |
| **스킬 (45개, 3티어)** | Guide | 도메인별 재사용 워크플로우 모듈 |
| **커맨드** | Guide | 구조화된 작업 인터페이스 (/vibe.spec, /vibe.run 등) |
| **훅 (21개)** | Sensor | 라이프사이클 이벤트 인터셉트 — 위험 차단, 품질 검증 |
| **품질 게이트 (3계층)** | Sensor | 센티넬 가드 → 프리툴 가드 → 코드 체크 |
| **LLM 비용 추적** | Sensor | llm-costs.jsonl — 프로바이더별 토큰·비용·지연 시간 기록 |
| **롤백 체크포인트** | Sensor | 자동 커밋마다 `vibe-checkpoint-N` 태그 생성 (최근 5개 유지) |
| **에스컬레이션** | Sensor | 동일 파일 P1/P2 이슈 3회 반복 → 사용자 개입 요청 |
| **Session RAG / 메모리** | Both | 세션 간 컨텍스트 지속 + 자동 복원 |
| **이볼루션 엔진** | Sensor | 훅 실행 패턴 분석 → 규칙/스킬 자기 개선 |
| **텔레메트리** | Sensor | hook-traces.jsonl, spans.jsonl — 관찰 가능성 |

### 훅 실행 흐름

```
사용자 액션 (Bash / Edit / Write / Prompt)
    ↓
SessionStart ─── session-start.js
    세션 메모리 복원, 컨텍스트 로드, 하네스 버전 체크
    ↓
PreToolUse ──── sentinel-guard.js → pre-tool-guard.js
    파괴적 명령 차단 (rm -rf, force push, DB drop 등)
    ↓
[도구 실행]
    ↓
PostToolUse ─── auto-format.js → code-check.js → auto-test.js
    자동 포맷 → 타입 안전성·복잡도 검증 → 테스트 실행
    ↓
UserPromptSubmit ── prompt-dispatcher.js → keyword-detector.js → llm-orchestrate.js
    커맨드 라우팅 → 매직 키워드 감지 → 외부 LLM 디스패치
    ↓
Notification ─── context-save.js
    컨텍스트 80/90/95%에서 자동 저장
    ↓
Stop ──────── codex-review-gate.js → stop-notify.js → auto-commit.js
    리뷰 게이트 → 세션 종료 알림 → 자동 커밋 + 롤백 체크포인트
```

### 3계층 품질 게이트

| 계층 | 스크립트 | 검증 내용 |
|------|---------|----------|
| **1. 센티넬 가드** | `sentinel-guard.js` | `rm -rf /`, `git reset --hard`, DB drop, fork bomb 등 치명적 명령 원천 차단 |
| **2. 프리툴 가드** | `pre-tool-guard.js` | 위험 패턴 경고 — force push, .env 수정, 시스템 디렉토리 쓰기 |
| **3. 코드 체크** | `code-check.js` | `any` 타입 차단, `@ts-ignore` 차단, 함수 ≤50줄, 중첩 ≤3, 파라미터 ≤5, 순환복잡도 ≤10 |

### 스킬 티어 시스템

컨텍스트 과부하(Curse of Instructions)를 방지하기 위해 스킬을 3단계로 분류합니다.

| 티어 | 로딩 방식 | 목적 | 예시 |
|------|----------|------|------|
| **Core** | 항상 활성 | 버그·실수 방지 안전망 | techdebt, arch-guard, exec-plan |
| **Standard** | 프로젝트 스택에 따라 선택 | 워크플로우 지원 | parallel-research, handoff, design-teach |
| **Optional** | 명시적 `/skill`로만 호출 | 래퍼/참조용 | commit-push-pr, git-worktree, context7 |

### 이볼루션 엔진 (자기 개선)

```
훅 실행 추적 (spans.jsonl)
    ↓
패턴 분석 — 반복 차단 패턴 클러스터링 (7일 히스토리)
    ↓
인사이트 생성 — 최적화/경고/갭 분류 + 신뢰도 점수
    ↓
규칙·스킬 자동 생성 (suggest 또는 auto 모드)
    ↓
서킷 브레이커 — 회귀 발생 시 롤백
```

### LLM 비용 추적

외부 LLM(GPT, Gemini) 호출마다 토큰, 비용, 지연 시간을 `~/.vibe/llm-costs.jsonl`에 기록합니다.
캐시 히트 시 비용 0으로 기록. 프로바이더별 모델 단가 자동 적용.

```jsonl
{"ts":"...","provider":"gpt","model":"gpt-5.4","inputTokens":150,"outputTokens":420,"cost":0.0069,"durationMs":2340,"cached":false}
```

`vibe stats --quality`로 누적 비용 확인 가능.

### 롤백 체크포인트

에이전트 자동 커밋마다 `vibe-checkpoint-N` git 태그를 생성합니다.
문제 발생 시 한 줄로 롤백:

```bash
git reset --hard vibe-checkpoint-3
```

최근 5개만 유지, 오래된 체크포인트는 자동 정리.

### 에스컬레이션 (Human-in-the-loop)

동일 파일에서 P1/P2 이슈가 3회 반복되면 자동 수정을 멈추고 사용자에게 개입을 요청합니다.

```
🚨 [ESCALATION] auth.ts: 동일 이슈 3회 반복
   → 사용자 개입 필요 — 자동 수정이 수렴하지 않고 있습니다.
```

AI가 같은 실수를 반복하며 맴도는 것을 방지하는 센서입니다.

### 설치 흐름

```bash
npm install -g @su-record/vibe   # postinstall → 글로벌 에셋 배포
vibe init                         # 프로젝트 하네스 설치
```

**postinstall** (글로벌):
- `~/.claude/agents/` — 56개 에이전트 정의
- `~/.claude/skills/` — 글로벌 스킬
- `~/.claude/commands/` — 슬래시 커맨드

**vibe init** (프로젝트):
- 24개 프레임워크 자동 감지
- `.claude/settings.local.json`에 훅 등록
- 스택별 스킬·규칙 설치
- `CLAUDE.md` 생성 (프레임워크별 코딩 규칙)

---

## Requirements

- **Node.js** >= 18.0.0
- **Claude Code** (required)
- GPT, Gemini (optional — for multi-LLM features)

## License

MIT License - Copyright (c) 2025 Su
