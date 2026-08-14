# Mode 1: Feature/Module Analysis

> vibe.analyze SKILL.md 의 모드 라우팅에서 **이 모드가 선택됐을 때만** 로드한다.

## Mode 1: Feature/Module Analysis (`/vibe.analyze "feature-name"`)

### Goal

Explore all source code related to the requested feature/module and analyze flow to:
1. Understand current implementation status
2. Map code structure and dependencies
3. Build context for future development/modification requests

### Process

#### 1. Request Analysis

Extract keywords from the user request:
- Feature name (e.g., login, feed, payment)
- Action (e.g., create, read, update, delete)
- Scope (e.g., backend only, frontend only, full)

#### 2. Understand Project Structure

Read `CLAUDE.md`, `package.json`, `pyproject.toml`, etc. to identify tech stack.

> Read `references/output-templates.md` for the full backend/frontend stack → directory mapping.

#### 3. Explore Related Code (Parallel Sub-Agents)

**MANDATORY: Delegate independent exploration through the harness's native collaboration capability. Never explore all branches in the coordinator session.**

> Why: 3 Explore agents return ~600 tokens of summaries to main session.
> Direct file-pattern search, text search, and full-file reading in the coordinator session would add 5-15K tokens of raw content.

**Harness adapter:** Claude Code maps each worker to Task/Agent; Codex maps each
worker to native collaboration. Inherit the session model by default. Dispatch
the following independent workers concurrently when capacity permits:

```text
- Worker: find all [FEATURE] related API endpoints; list paths, methods, routes, and auth requirements.
- Worker: find all [FEATURE] related services, business logic, utilities, and dependencies.
- Worker: find all [FEATURE] related data models, schemas, queries, relationships, and key fields.
```

> Read `references/output-templates.md` for the additional "Scale for large projects (6+ related files)" agent prompts.

**After all agents return:**
- Synthesize results → proceed to Flow Analysis
- Only Read specific files in main session when agent summaries need clarification

#### 4. Flow Analysis

**API Flow:**
- Endpoint URL and HTTP method
- Request/response schema
- Authentication/authorization requirements

**Business Logic:**
- Core methods and their roles
- Validation rules
- External service integrations

**Data Flow:**
- Related tables/models
- Relationships (1:N, N:M)
- Key query patterns

#### 5. Output

> Read `references/output-templates.md` for the full Mode 1 output format.

#### 6. Next Steps

After analysis, suggest mode-specific follow-up actions.

> Read `references/output-templates.md` for the full Next Steps decision tables (code/feature, document, website).

Wait for user's choice before proceeding.

---
