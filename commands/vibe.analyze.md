---
description: Analyze any target — code, document, website, or Figma design
argument-hint: "feature-name" or file.pdf or https://... or --code or --deps or --arch
---

# /vibe.analyze

Analyze any target: source code, documents, websites, or Figma designs.

## Usage

```
/vibe.analyze                  # Full project quality analysis
/vibe.analyze "login"          # Login related code exploration + context collection
/vibe.analyze --code           # Code quality analysis only
/vibe.analyze --deps           # Dependency analysis only
/vibe.analyze --arch           # Architecture analysis only
/vibe.analyze report.pdf       # Document analysis (PDF, markdown, etc.)
/vibe.analyze https://example.com  # Website analysis (UX, tech, SEO, accessibility)
/vibe.analyze https://figma.com/design/...  # Figma design analysis
```

## Input Type Auto-Detection

Determine analysis mode from the argument:

| Pattern | Mode | Description |
|---------|------|-------------|
| `*.pdf`, `*.docx`, `*.pptx`, `*.md` (external) | **Document** | 문서 구조, 내용, 품질 분석 |
| `http(s)://figma.com/*` | **Figma** | 디자인 구조, 컴포넌트, 토큰 분석 |
| `http(s)://*` | **Website** | UX, 기술 스택, SEO, 접근성 분석 |
| `--code`, `--deps`, `--arch` | **Project Quality** | 기존 프로젝트 품질 분석 |
| 문자열 (feature name) | **Feature/Module** | 소스코드 탐색 + 흐름 분석 |
| 없음 | **Project Quality** | 전체 프로젝트 분석 |

**Detection logic**: 파일 확장자 → URL 패턴 → 플래그 → 문자열 순으로 판단.

## File Reading Policy (Mandatory)

- **SPEC/Feature 파일**: 반드시 `Read` 도구로 전체 파일을 읽을 것 (Grep 금지)
- **소스코드 파일**: 분석 대상 파일은 반드시 `Read` 도구로 전체 읽은 후 분석할 것
- **Grep 사용 제한**: 파일 위치 탐색(어떤 파일에 있는지 찾기)에만 사용. 파일 내용 파악에는 반드시 Read 사용
- **에이전트 spawn 시**: 프롬프트에 "대상 파일을 Read 도구로 전체 읽은 후 분석하라"를 반드시 포함할 것
- **부분 읽기 금지**: Grep 결과의 주변 몇 줄만 보고 판단하지 말 것. 전체 맥락을 파악해야 정확한 분석 가능

## Context Reset

**When this command runs, previous conversation is ignored.**
- Explore and analyze code from scratch like new session
- Base conversation only on newly collected information from this analysis

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Mode 1: Feature/Module Analysis (`/vibe.analyze "feature-name"`)

### Goal

**Explore all source code** related to user's requested feature/module and **analyze flow** to:
1. Understand current implementation status
2. Understand code structure and dependencies
3. Build context for immediate response to future development/modification requests

### Process

#### 1. Request Analysis

Extract key keywords from user request:
- Feature name (e.g., login, feed, payment)
- Action (e.g., create, read, update, delete)
- Scope (e.g., backend only, frontend only, full)

#### 2. Understand Project Structure

Read `CLAUDE.md`, `package.json`, `pyproject.toml`, etc. to identify tech stack:

**Backend:**
- FastAPI/Django: `app/api/`, `app/services/`, `app/models/`
- Express/NestJS: `src/controllers/`, `src/services/`, `src/models/`

**Frontend:**
- React/Next.js: `src/components/`, `src/pages/`, `src/hooks/`
- Flutter: `lib/screens/`, `lib/services/`, `lib/providers/`

#### 3. Explore Related Code (Parallel Sub-Agents)

**MANDATORY: Always use explorer sub-agents. Never explore in main session.**

> Why: 3 explorer-low agents return ~600 tokens of summaries to main session.
> Direct Glob/Grep/Read in main session would add 5-15K tokens of raw file content.

**Parallel exploration (ALL tasks in ONE message):**

```text
# 3 explorer agents in parallel (single message, multiple tool calls)
Task(subagent_type="explorer-low", model="haiku",
  prompt="Find all [FEATURE] related API endpoints in this project. List file paths, HTTP methods, routes, and auth requirements.")

Task(subagent_type="explorer-low", model="haiku",
  prompt="Find all [FEATURE] related services, business logic, and utility functions. Map dependencies between them.")

Task(subagent_type="explorer-low", model="haiku",
  prompt="Find all [FEATURE] related data models, schemas, and database queries. Document relationships and key fields.")
```

**Additional exploration (scale by project size):**

```text
# Large projects (6+ related files) — add 2 more in parallel
Task(subagent_type="explorer-low", model="haiku",
  prompt="Find all test files related to [FEATURE]. Identify tested vs untested paths.")

Task(subagent_type="explorer-low", model="haiku",
  prompt="Analyze [FEATURE] configuration, environment variables, and external integrations.")
```

**After all agents return:**
- Synthesize results → proceed to Flow Analysis (Step 4)
- Only Read specific files in main session when agent summary needs clarification

#### 4. Flow Analysis

**API Flow:**
- Endpoint URL and HTTP method
- Request/response schema
- Authentication/authorization requirements

**Business Logic:**
- Core methods and roles
- Validation rules
- External service integrations

**Data Flow:**
- Related tables/models
- Relationships (1:N, N:M)
- Key query patterns

#### 5. Output Analysis Results

```markdown
## [feature-name] Analysis Results

### Overview
- **Feature description**: [one-line summary]
- **Implementation status**: [Complete/In progress/Not implemented]
- **Related files**: N files

### Structure

#### API Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/v1/auth/login | Login | - |

#### Core Services
- `auth_service.py`: Authentication logic
  - `login()`: Login processing
  - `verify_token()`: Token verification

#### Data Models
- `User`: User table
  - Key fields: id, email, password_hash
  - Relationships: Session (1:N)

### Reference File List
- src/api/auth/router.py:L10-50
- src/services/auth_service.py:L1-100
```

#### 6. Complete & Next Action

After analysis:
1. Output analysis summary (include `⏱️ Started: {start_time}` and `⏱️ Completed: {getCurrentTime 결과}`)
2. **모드별 후속 액션 제안**:

**Code/Feature 분석 후:**
```
## Next Steps
| Task Scope | Recommended Approach |
|----------|----------|
| Simple fix (1-2 files) | Plan Mode |
| Complex feature (3+ files) | /vibe.spec |
```

**Document 분석 후:**
```
## Next Steps
| 목적 | Recommended Approach |
|------|----------|
| 문서 내용을 프로젝트에 적용 | /vibe.spec "feature-name" |
| 문서 기반 개선 방향 도출 | Plan Mode |
| 추가 문서/웹사이트와 비교 분석 | /vibe.analyze [다른 대상] |
```

**Website 분석 후:**
```
## Next Steps
| 목적 | Recommended Approach |
|------|----------|
| 벤치마킹 기반 신규 개발 | /vibe.spec |
| 기존 프로젝트 UI 개선 | /vibe.figma |
| 추가 사이트와 비교 분석 | /vibe.analyze [다른 URL] |
```

3. Wait for user's choice before proceeding
4. If user chooses VIBE → wait for `/vibe.spec` command
5. If user chooses Plan Mode → proceed with EnterPlanMode

---

## Mode 2: Document Analysis (PDF, Markdown, Slides, etc.)

### Goal

문서의 **구조, 핵심 내용, 품질, 활용 방향**을 분석하여:
1. 문서가 담고 있는 정보를 구조화
2. 현재 프로젝트와의 관련성 파악
3. 후속 액션(개발, 개선, 적용) 제안

### Process

#### 1. 문서 읽기

- **PDF**: `Read` 도구로 전체 페이지 읽기 (대용량은 `pages` 파라미터로 분할)
- **Markdown/Text**: `Read` 도구로 전체 읽기
- **이미지 포함 문서**: 시각적 요소도 함께 분석 (슬라이드, 다이어그램 등)

#### 2. 문서 유형 판별

| 유형 | 분석 방향 |
|------|----------|
| 기술 문서/스펙 | API 명세, 데이터 모델, 시퀀스 다이어그램 추출 |
| 발표 자료 | 핵심 주장, 프레임워크, 사례 정리 |
| 기획서/PRD | 요구사항, 유저 스토리, 수용 기준 추출 |
| 비즈니스 문서 | 전략, 의사결정 포인트, 액션 아이템 추출 |
| 학술/리서치 | 방법론, 결론, 적용 가능성 분석 |

#### 3. 구조 분석 (Parallel Sub-Agents)

```text
# 2 agents in parallel
Agent(subagent_type="explorer-low", model="haiku",
  prompt="Read the document and extract: 1) Table of Contents / section structure 2) Key concepts and definitions 3) Main arguments or claims")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Read the document and extract: 1) Actionable items or recommendations 2) Data points, metrics, examples 3) References to external resources")
```

#### 4. 현재 프로젝트 연관성 분석

- 문서 내용이 현재 프로젝트에 어떻게 적용 가능한지 매핑
- 문서에서 언급된 패턴/도구/기법이 프로젝트에 이미 구현되어 있는지 확인
- Gap 분석: 문서 권장사항 vs 프로젝트 현재 상태

#### 5. Output

```markdown
## [문서명] 분석 결과

### Overview
- **문서 유형**: [발표 자료 / 기술 스펙 / 기획서 / ...]
- **핵심 주제**: [한 줄 요약]
- **페이지/섹션 수**: N
- **대상 독자**: [개발자 / 기획자 / 경영진 / ...]

### 핵심 내용
1. **[주요 개념 1]**: 설명
2. **[주요 개념 2]**: 설명
3. ...

### 프레임워크/모델 (있는 경우)
- [문서가 제시하는 체계적 구조]

### 현재 프로젝트 적용 분석
| 문서 권장사항 | 현재 상태 | Gap |
|---|---|---|
| ... | ... | ... |

### 핵심 인사이트
- [문서에서 가장 중요한 takeaway]

### 후속 액션 제안
1. ...
```

---

## Mode 3: Website Analysis (URL)

### Goal

웹사이트의 **기술 스택, UX/UI, SEO, 접근성, 성능**을 분석하여:
1. 기술적 구현 상태 파악
2. 개선 포인트 도출
3. 벤치마킹 인사이트 수집

### Process

#### 1. 웹사이트 수집

- `WebFetch` 도구로 HTML 수집
- 주요 페이지 탐색 (홈, 주요 기능 페이지, 로그인 등)

#### 2. 분석 (Parallel Sub-Agents)

```text
# 3 agents in parallel
Agent(subagent_type="explorer-low", model="haiku",
  prompt="Analyze the fetched HTML for: 1) Tech stack detection (framework, meta tags, scripts) 2) Page structure (header, nav, main sections, footer) 3) SEO elements (title, meta description, OG tags, structured data)")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Analyze the fetched HTML for: 1) Accessibility (ARIA labels, semantic HTML, alt texts, heading hierarchy) 2) Performance hints (script loading, image optimization, critical CSS) 3) Mobile responsiveness (viewport meta, media queries)")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Analyze the fetched HTML for: 1) UX patterns (navigation, CTA placement, form design) 2) Design system hints (CSS variables, component patterns, consistent spacing) 3) Content strategy (copywriting tone, information hierarchy)")
```

#### 3. Figma URL인 경우

Figma URL이 감지되면 **Figma 전용 분석**으로 전환:
- `get_design_context` 또는 `get_screenshot`으로 디자인 데이터 수집
- 컴포넌트 구조, 디자인 토큰, 레이아웃 패턴 분석
- 현재 프로젝트 코드와 디자인 일치도 비교

#### 4. Output

```markdown
## [웹사이트 URL] 분석 결과

### Overview
- **사이트 유형**: [SaaS / 커머스 / 포트폴리오 / ...]
- **기술 스택**: [Next.js, Tailwind, ...]
- **전체 평가**: N/100

### 기술 분석
| 항목 | 상태 | 세부사항 |
|------|------|---------|
| Framework | React/Next.js | SSR 적용 |
| CSS | Tailwind CSS | v3.4 |
| ... | ... | ... |

### UX/UI 분석
- **네비게이션**: [평가]
- **CTA 배치**: [평가]
- **반응형**: [평가]

### SEO 분석 (N/100)
| 항목 | 상태 | 권장사항 |
|------|------|---------|
| Title | 있음 | 적절한 길이 |
| Meta Description | 없음 | 추가 필요 |
| ... | ... | ... |

### 접근성 분석 (WCAG 2.1 AA)
- **시맨틱 HTML**: [평가]
- **키보드 네비게이션**: [평가]
- **스크린 리더**: [평가]

### 개선 제안
1. [우선순위 높은 개선사항]
2. ...
```

---

## Mode 4: Project Quality Analysis (--code/--deps/--arch)

### Analysis Scope

- **Default** (`/vibe.analyze`): Full analysis (code + dependencies + architecture)
- `--code`: Code quality analysis only
- `--deps`: Dependency analysis only
- `--arch`: Architecture analysis only

### Code Quality Analysis (--code)

- Complexity analysis (Cyclomatic Complexity)
- Code quality validation
- Coupling/cohesion check

### Dependency Analysis (--deps)

- Read `package.json` / `pyproject.toml` / `pubspec.yaml`
- Analyze version conflicts, security vulnerabilities, packages needing updates

### Architecture Analysis (--arch)

- Find core modules
- Identify module dependencies
- Detect circular dependencies, layer violations

### Analysis Report

`.claude/vibe/reports/analysis-{date}.md`:

```markdown
# Project Analysis Report

## Overview
- Analysis date: 2025-01-06 12:00
- Analysis scope: Full

## Code Quality (85/100)
- Average complexity: 8.2 (good)
- High complexity files: 3

## Dependencies (92/100)
- Total packages: 42
- Updates needed: 3

## Architecture (78/100)
- Circular dependencies: 2 found
- Layer violations: 1

## Improvement Suggestions
1. Refactor service.py
2. Apply lodash security patch
```

## Core Tools (Semantic Analysis)

### Tool Invocation

All tools are called via:

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Recommended Tools for Analysis

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `findSymbol` | Find symbol definitions | Locate function/class implementations |
| `findReferences` | Find all references | Track usage patterns |
| `analyzeComplexity` | Complexity analysis | Measure code complexity metrics |
| `validateCodeQuality` | Quality validation | Check code quality standards |
| `saveMemory` | Save analysis results | Store analysis findings |

### Example Tool Usage in Analysis

**1. Find function definition:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.findSymbol({symbolName: 'login', searchPath: 'src/'}).then(r => console.log(r.content[0].text)))"
```

**2. Analyze complexity:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.analyzeComplexity({targetPath: 'src/services/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Validate code quality:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.validateCodeQuality({targetPath: 'src/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**4. Save analysis results:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.saveMemory({key: 'analysis-login-module', value: 'Found 5 related files, complexity avg 6.2', category: 'analysis', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

---

## Quality Gate (Mandatory)

### Analysis Quality Checklist

Before completing analysis, ALL items must be checked (mode-specific):

**Code/Feature Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| **Completeness** | All related files identified | 20% |
| **Completeness** | All API endpoints documented | 15% |
| **Completeness** | All data models mapped | 15% |
| **Accuracy** | File paths verified to exist | 10% |
| **Accuracy** | Line numbers accurate | 10% |
| **Depth** | Business logic explained | 10% |
| **Depth** | Dependencies mapped | 10% |
| **Actionability** | Next steps clearly defined | 10% |

**Document Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| **Completeness** | 전체 문서 읽기 완료 | 20% |
| **Completeness** | 핵심 개념/주장 모두 추출 | 20% |
| **Structure** | 문서 구조 (목차/섹션) 파악 | 15% |
| **Depth** | 프로젝트 연관성 분석 | 15% |
| **Depth** | Gap 분석 (권장 vs 현재) | 15% |
| **Actionability** | 구체적 후속 액션 제안 | 15% |

**Website Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| **Completeness** | HTML 수집 및 파싱 완료 | 15% |
| **Tech** | 기술 스택 식별 | 15% |
| **UX** | UX/UI 패턴 분석 | 15% |
| **SEO** | SEO 요소 점검 | 15% |
| **A11y** | 접근성 검사 | 15% |
| **Performance** | 성능 힌트 분석 | 10% |
| **Actionability** | 개선 제안 | 15% |

### Analysis Score Calculation

```
Score = Σ(checked items × weight) / 100

Grades:
- 95-100: ✅ EXCELLENT - Comprehensive analysis
- 90-94:  ⚠️ GOOD - Additional exploration recommended
- 80-89:  ⚠️ FAIR - Needs more exploration
- 0-79:   ❌ POOR - Incomplete, re-analyze
```

### Analysis Depth Levels

| Level | Scope | Output |
|-------|-------|--------|
| **L1: Surface** | File names, basic structure | File list only |
| **L2: Structure** | Functions, classes, imports | Structure map |
| **L3: Logic** | Business logic, data flow | Flow diagrams |
| **L4: Deep** | Edge cases, dependencies, risks | Full analysis |

**Minimum required: L3 for feature analysis, L2 for project overview**

### Analysis Output Requirements

Every analysis MUST include:

1. **Overview Section**
   - Feature description (1 sentence)
   - Implementation status (Complete/In progress/Not implemented)
   - Related file count

2. **Structure Section**
   - API endpoints table (Method, Path, Description, Auth)
   - Core services list with key methods
   - Data models with fields and relationships

3. **Reference File List**
   - Absolute or relative paths
   - Line number ranges for key sections
   - Brief description per file

4. **Next Steps**
   - Workflow choice prompt (Plan Mode vs VIBE)
   - Specific action items if applicable

### Forbidden Incomplete Patterns

| Pattern | Issue | Required Fix |
|---------|-------|--------------|
| "and more..." | Incomplete list | List all items |
| "etc." | Vague scope | Be specific |
| "related files" without list | Missing details | Provide file paths |
| Missing line numbers | Hard to navigate | Add `:L10-50` format |
| No auth info on endpoints | Security gap | Always specify auth |

### Code Quality Analysis Thresholds

When running `--code` analysis:

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Avg Complexity | ≤10 | 11-15 | >15 |
| Max Function Length | ≤30 | 31-50 | >50 |
| High Complexity Files | 0 | 1-3 | >3 |
| Circular Dependencies | 0 | 1 | >1 |

### Dependency Analysis Thresholds

When running `--deps` analysis:

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Outdated Packages | 0-3 | 4-10 | >10 |
| Security Vulnerabilities | 0 | 1-2 (low) | Any high/critical |
| Major Version Behind | 0 | 1-2 | >2 |

---

ARGUMENTS: $ARGUMENTS
