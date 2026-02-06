# VIBE

SPEC-driven AI Coding Framework (Claude Code Exclusive) — v0.1.0

## Philosophy

> **core = 바이브코딩을 쉽게 + 최소 품질 보장**

| Principle | Description |
|-----------|-------------|
| **Easy Vibe Coding** | 빠른 흐름, 직관적 개발, AI와 협업하며 생각하기 |
| **Minimum Quality Guaranteed** | 타입 안전성, 코드 품질, 보안 - 자동으로 하한선 확보 |
| **Iterative Reasoning (6번 유형)** | AI에게 답을 맡기지 말고, 문제를 쪼개고 질문하며 함께 추론 |

### How CORE Guarantees Quality

| Guardrail | Mechanism |
|-----------|-----------|
| Type Safety | Quality Gate (`any`/`Any` 차단) |
| Code Review | Race Review (GPT + Gemini + AZ Kimi K2.5 병렬) |
| Completion Check | Ralph Loop (100%까지 반복) |
| Multi-LLM | 4개 관점 검증 (Claude + GPT + Gemini + AZ Kimi K2.5) |

### User's Role (6번 Iterative-Reasoning Type)

연구에 따르면, AI에게 답을 맡기는 것(1번 유형)보다 **문제를 쪼개고 추론하며 협업하는 것(6번 유형)**이 훨씬 좋은 성과를 냅니다.

| Avoid | Do Instead |
|-------|------------|
| "로그인 기능 만들어줘" | "로그인 기능의 요구사항을 분석해보자" |
| AI 결과 그대로 사용 | "이 접근이 맞나?" 검증 질문 |
| 완성 코드만 요청 | 단계별로 검토하며 진행 |

## Response Language

**IMPORTANT: Always respond in Korean (한국어) unless the user explicitly requests otherwise.**

## Code Quality Standards (Mandatory)

Follow these standards when writing code. See `~/.claude/vibe/rules/` (global) for detailed rules.

### Core Principles

- **Modify only requested scope** - Don't touch unrelated code
- **Preserve existing style** - Follow project conventions
- **Keep working code** - No unnecessary refactoring
- **Respect user interrupts** - If user interrupts (Ctrl+C/Escape) and sends a new message, the previous task is CANCELLED. Do NOT resume or continue interrupted work. Respond ONLY to the new message.

### Code Complexity Limits

| Metric | Limit |
|--------|-------|
| Function length | ≤30 lines (recommended), ≤50 lines (allowed) |
| Nesting depth | ≤3 levels |
| Parameters | ≤5 |
| Cyclomatic complexity | ≤10 |

### TypeScript Rules

- No `any` → `unknown` + type guards
- No `as any` → proper interfaces
- No `@ts-ignore`
- Explicit return types

### Error Handling Required

- try-catch or error state required
- Loading state handling
- User-friendly error messages

### Forbidden Patterns

- No console.log in commits
- No hardcoded strings/numbers
- No commented-out code
- No incomplete code without TODO

## Workflow

```text
/vibe.spec → /new → /vibe.spec.review → /vibe.run → /vibe.trace → (auto) code review → Done
```

1. `/vibe.spec` - Write SPEC (requirements + research + draft) + 6개 LLM 병렬 리서치
2. `/new` - Start new session (clean context)
3. `/vibe.spec.review` - GPT/Gemini/AZ (Kimi K2.5) review (3-round mandatory)
4. `/vibe.run` - Implementation + GPT/Gemini/AZ (Kimi K2.5) Race Review
5. **(auto)** 13+ agent parallel review + P1/P2 auto-fix

**모든 명령어는 시작/종료 시 `getCurrentTime`을 호출하여 소요 시간을 표시합니다.**

## Plan Mode vs CORE

| Task Size | Recommended |
|-----------|-------------|
| Simple changes (1-2 files) | Plan Mode |
| Complex features (3+ files) | `/vibe.spec` |

After `/vibe.analyze` or `/vibe.review` with dev request → **Ask user for workflow choice**

## ULTRAWORK Mode

Include `ultrawork` or `ulw` keyword for maximum performance:

- Parallel sub-agent exploration (3+ concurrent)
- Background agents + Phase pipelining
- Boulder Loop (auto-continue until all Phases complete)
- Auto-retry on error (max 3), Auto-save at 70%+ context

## Commands

| Command | Description |
|---------|-------------|
| `/vibe.spec "name"` | Write SPEC (PTCF) + parallel research |
| `/vibe.spec.review "name"` | GPT/Gemini review (new session) |
| `/vibe.run "name"` | Execute implementation |
| `/vibe.run "name" ultrawork` | Maximum performance mode |
| `/vibe.verify "name"` | Verification against SPEC |
| `/vibe.review` | 13+ agent parallel code review |
| `/vibe.trace "name"` | Requirements traceability matrix |
| `/vibe.reason "problem"` | Systematic reasoning |
| `/vibe.analyze` | Project analysis |
| `/vibe.utils --e2e` | E2E testing (Playwright) |
| `/vibe.utils --diagram` | Generate diagrams |
| `/vibe.utils --ui "desc"` | UI preview |
| `/vibe.utils --continue` | Session restore |
| `/vibe.voice` | Voice-to-coding command (Gemini audio) |

## CLI Commands

| Command | Description |
|---------|-------------|
| `vibe init` | Initialize project |
| `vibe update` | Update settings |
| `vibe status` | Show status |
| `vibe sync <cmd>` | 인증/메모리 동기화 (login, push, pull, status, logout) |
| `vibe hud <cmd>` | HUD status (show, start, phase, agent, reset) |
| `vibe gpt <cmd>` | GPT commands (auth, key, status, logout) |
| `vibe gemini <cmd>` | Gemini commands (auth, key, status, logout) |
| `vibe az <cmd>` | AZ (Kimi K2.5) commands (key, status, logout) |
| `vibe remove` | Remove core |
| `vibe help` | Help |
| `vibe version` | Version info |

## Magic Keywords

| Keyword | Effect |
|---------|--------|
| `ultrawork` / `ulw` | Parallel + auto-continue + Ralph Loop |
| `ralph` | Iterate until 100% complete (no scope reduction) |
| `ralplan` | Iterative planning + persistence |
| `verify` | Strict verification mode |
| `quick` | Fast mode, minimal verification |

## PTCF Structure

SPEC documents use: `<role>` `<context>` `<task>` `<constraints>` `<output_format>` `<acceptance>`

## Built-in Tools (35+)

### Memory & Session

| Tool | Purpose |
|------|---------|
| `core_start_session` | Restore previous session context |
| `core_auto_save_context` | Save current state |
| `core_save_memory` | Save important decisions |
| `core_recall_memory` | Recall saved memories |
| `core_list_memories` | List all memories |
| `core_search_memories` | Search memories |
| `core_search_memories_advanced` | Advanced memory search |
| `core_link_memories` | Link related memories |
| `core_get_memory_graph` | Visualize memory graph |
| `core_create_memory_timeline` | Create memory timeline |
| `core_restore_session_context` | Restore session context |
| `core_prioritize_memory` | Prioritize memory items |

### Semantic & Quality

| Tool | Purpose |
|------|---------|
| `core_find_symbol` | Find symbol definitions |
| `core_find_references` | Find references |
| `core_analyze_dependency_graph` | Analyze dependency graph |
| `core_analyze_complexity` | Analyze complexity |
| `core_validate_code_quality` | Validate quality |
| `core_check_coupling_cohesion` | Check coupling/cohesion |
| `core_suggest_improvements` | Suggest improvements |
| `core_apply_quality_rules` | Apply quality rules |

### UI & Utility

| Tool | Purpose |
|------|---------|
| `core_preview_ui_ascii` | UI preview in ASCII |
| `core_get_current_time` | Get current time |

### SPEC & Testing

| Tool | Purpose |
|------|---------|
| `core_spec_generator` | Generate SPEC documents |
| `core_prd_parser` | Parse PRD documents |
| `core_traceability_matrix` | Generate traceability matrix |
| `core_e2e_test_generator` | Generate E2E tests |

### Session RAG

구조화된 세션 컨텍스트를 저장/검색하는 시스템. SQLite + FTS5 BM25 하이브리드 검색.

| Tool | Purpose |
|------|---------|
| `save_session_item` | Decision/Constraint/Goal/Evidence 저장 |
| `retrieve_session_context` | 하이브리드 검색 (BM25 + recency + priority) |
| `manage_goals` | Goal 생명주기 관리 (list/update/complete) |

**4가지 엔티티:**

| Entity | Description | Key Fields |
|--------|-------------|------------|
| Decision | 사용자 확인 결정사항 | title, rationale, alternatives, impact, priority |
| Constraint | 명시적 제약조건 | title, type (technical/business/resource/quality), severity |
| Goal | 현재 목표 스택 (계층 지원) | title, status, priority, progressPercent, successCriteria |
| Evidence | 검증/테스트 결과 | title, type (test/build/lint/coverage), status, metrics |

**자동 주입:** `start_session` 호출 시 활성 Goals, 중요 Constraints, 최근 Decisions가 자동으로 세션 컨텍스트에 포함됨.

```typescript
import { saveSessionItem, retrieveSessionContext, manageGoals } from '@su-record/core/tools';

// 결정 저장
await saveSessionItem({ itemType: 'decision', title: 'Use Vitest', rationale: 'Fast and modern' });

// 제약 저장
await saveSessionItem({ itemType: 'constraint', title: 'No vector DB', type: 'technical', severity: 'high' });

// 목표 저장
await saveSessionItem({ itemType: 'goal', title: 'Implement Session RAG', priority: 2 });

// 컨텍스트 검색
await retrieveSessionContext({ query: 'testing' });

// 목표 관리
await manageGoals({ action: 'list' });
await manageGoals({ action: 'update', goalId: 1, progressPercent: 80 });
await manageGoals({ action: 'complete', goalId: 1 });
```

## Multi-LLM Orchestration (v0.1.0)

4개 LLM(Claude + GPT + Gemini + AZ) 멀티 오케스트레이션 시스템.

### Core Modules

| Module | Purpose |
|--------|---------|
| `SmartRouter` | Task 유형별 최적 LLM 선택 + fallback chain |
| `LLMCluster` | 병렬 멀티 LLM 호출 (GPT + Gemini + AZ Kimi K2.5) |
| `AgentRegistry` | SQLite 기반 에이전트 실행 추적 (WAL mode) |
| `AllProvidersFailedError` | 모든 프로바이더 실패 시 구조화된 에러 |

### SmartRouter Priority

| Task Type | Priority Order |
|-----------|---------------|
| code-analysis, code-review | AZ (Kimi K2.5) → GPT → Gemini → Claude |
| reasoning, architecture | AZ (Kimi K2.5) → GPT → Gemini → Claude |
| code-gen | AZ (Kimi K2.5) → Claude |
| debugging | AZ (Kimi K2.5) → GPT → Gemini → Claude |
| uiux, web-search | Gemini → AZ (Kimi K2.5) → GPT → Claude |
| general | AZ (Kimi K2.5) → Claude |

### AZ (Azure Foundry) Integration

- Chat API: `https://fallingo-ai-foundry.services.ai.azure.com/openai/v1`
- Embedding API: `https://fallingo-ai-foundry.cognitiveservices.azure.com`
- Models:
  - `Kimi-K2.5` (채팅/추론/코드 분석 — 모든 태스크)
  - `text-embedding-3-large` (임베딩)
- Auth: `AZ_API_KEY` 환경변수 또는 `vibe az key <key>` (동일 키로 Chat + Embedding 모두 사용)
- Timeout: 30초/provider, 3회 재시도 (지수 백오프)

## Agents

### Main Agents (18)

- **Explorer** (high/medium/low) - Codebase exploration
- **Implementer** (high/medium/low) - Code implementation
- **Architect** (high/medium/low) - Architecture design
- **Searcher** - Code search
- **Tester** - Test generation
- **Simplifier** - Code simplification
- **Refactor Cleaner** - Refactoring cleanup
- **Build Error Resolver** - Build error fixing
- **Compounder** - Multi-step compound tasks
- **Diagrammer** - Diagram generation
- **E2E Tester** - E2E test execution
- **UI Previewer** - UI preview

### Review Agents (12)

security, performance, architecture, complexity, simplicity, data-integrity, test-coverage, git-history, typescript, python, rails, react → `agents/review/`

### Research Agents (4)

best-practices, framework-docs, codebase-patterns, security-advisory → `agents/research/`

### Agent Teams (Experimental)

> 에이전트들이 팀을 구성하여 공유 태스크 리스트로 협업하고 상호 피드백합니다.
> 요구사항: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (`.claude/settings.local.json` env)

| Team | 워크플로우 | Members | 역할 |
|------|-----------|---------|------|
| Research Team | `/vibe.spec` Step 3 | best-practices, security-advisory, codebase-patterns, framework-docs | 리서치 결과 교차 검증 + 통합 |
| Review Debate Team | `/vibe.review` Phase 4.5 | security, architecture, performance, simplicity | P1/P2 교차 검증 + 오탐 제거 |
| Implementation Team | `/vibe.run` ULTRAWORK | architect, implementer, tester, security-reviewer | 실시간 협업 구현 + 즉시 피드백 |

**기존 병렬 모드와의 차이:**

| 측면 | 병렬 서브에이전트 | Agent Teams |
|------|-----------------|-------------|
| 통신 | 결과만 수집 | 실시간 상호 피드백 |
| 검증 | 사후 검증 | 실시간 교차 검증 |
| 충돌 해결 | 메인 에이전트만 결정 | 팀 합의 (리더 주도) |

## Hooks System

| Event | Hooks |
|-------|-------|
| SessionStart | `session-start.js` |
| PreToolUse (Bash/Edit/Write) | `pre-tool-guard.js` |
| PostToolUse (Write/Edit) | `post-edit.js`, `code-check.js`, `post-tool-verify.js` |
| UserPromptSubmit | `prompt-dispatcher.js`, `skill-injector.js`, `keyword-detector.js`, `hud-status.js` |
| Notification (context 80/90/95%) | `context-save.js` |

**Additional hooks:** `code-review.js`, `llm-orchestrate.js`, `recall.js`, `complexity.js`, `compound.js`

## Language Support (23 frameworks)

- **TypeScript**: Next.js, React, Angular, NestJS, Vue, Svelte, Nuxt, Tauri, Electron, React Native, Node
- **Python**: Django, FastAPI
- **Java**: Spring
- **Kotlin**: Android
- **Ruby**: Rails
- **Go**, **Rust**, **Swift** (iOS), **C#** (Unity), **Dart** (Flutter), **GDScript** (Godot)

## Context Management

### Model Selection

- **Exploration/Search**: Haiku
- **Implementation**: Sonnet
- **Architecture**: Opus

### At 70%+ Context

- Do NOT use `/compact` (information loss risk)
- Use `save_memory` → `/new` for new session
- Restore with `/vibe.utils --continue`

## Documentation Guidelines

- Avoid ASCII boxes → Use Mermaid diagrams, Markdown tables, or indented lists
- Flowcharts → Mermaid | Structure → Indented lists | Comparisons → Tables

## Git Commit Rules

**Must include:** `.claude/vibe/specs/`, `.claude/vibe/features/`, `.claude/vibe/todos/`, `.claude/vibe/config.json`, `CLAUDE.md`

**Exclude:** `~/.claude/vibe/rules/`, `~/.claude/commands/`, `~/.claude/agents/`, `~/.claude/skills/`, `.claude/settings.local.json`

<!-- VIBE:END -->
