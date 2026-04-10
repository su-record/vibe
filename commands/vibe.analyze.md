---
description: Analyze any target — code, document, website, or Figma design
argument-hint: "feature-name" or file.pdf or https://... or --code or --deps or --arch
---

# /vibe.analyze

Analyze any target: source code, documents, websites, or Figma designs.

## Usage

```
/vibe.analyze                  # Full project quality analysis
/vibe.analyze "login"          # Feature/module code exploration + context collection
/vibe.analyze --code           # Code quality analysis only
/vibe.analyze --deps           # Dependency analysis only
/vibe.analyze --arch           # Architecture analysis only
/vibe.analyze report.pdf       # Document analysis (PDF, markdown, slides)
/vibe.analyze https://example.com  # Website analysis (UX, tech, SEO, accessibility)
/vibe.analyze https://figma.com/design/...  # Figma design analysis
```

## Input Type Auto-Detection

Determine analysis mode from the argument pattern:

| Pattern | Mode | Description |
|---------|------|-------------|
| `*.pdf`, `*.docx`, `*.pptx`, `*.md` (file path) | **Document** | Structure, content, quality, applicability |
| `http(s)://figma.com/*` | **Figma** | Design structure, components, tokens |
| `http(s)://*` | **Website** | UX, tech stack, SEO, accessibility |
| `--code`, `--deps`, `--arch` | **Project Quality** | Code quality, dependencies, architecture |
| String (feature name) | **Feature/Module** | Source code exploration + flow analysis |
| No argument | **Project Quality** | Full project analysis |

**Detection order**: file extension → URL pattern → flag → string.

## File Reading Policy (Mandatory)

- **SPEC/Feature files**: Always use `Read` tool for the full file (never Grep for content)
- **Source files**: Read the entire file before analyzing (no partial reads)
- **Grep restriction**: Use only for locating files, not for understanding content
- **Agent prompts**: Always include "Read target files in full before analyzing"
- **No partial analysis**: Never judge a file by a few lines around a Grep match

## Context Reset

**When this command runs, previous conversation is ignored.**
- Explore and analyze from scratch like a new session
- Base analysis only on newly collected information

---

> **Timer**: Record start time at the beginning. Include elapsed time in the final report.

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
> Direct Glob/Grep/Read in main session would add 5-15K tokens of raw content.

**Parallel exploration (ALL in ONE message):**

```text
Agent(subagent_type="explorer-low", model="haiku",
  prompt="Find all [FEATURE] related API endpoints. List file paths, HTTP methods, routes, and auth requirements.")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Find all [FEATURE] related services, business logic, and utility functions. Map dependencies.")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Find all [FEATURE] related data models, schemas, and database queries. Document relationships and key fields.")
```

**Scale for large projects (6+ related files):**

```text
Agent(subagent_type="explorer-low", model="haiku",
  prompt="Find all test files related to [FEATURE]. Identify tested vs untested paths.")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Analyze [FEATURE] configuration, environment variables, and external integrations.")
```

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

```markdown
## [feature-name] Analysis Results

### Overview
- **Feature**: [one-line summary]
- **Status**: [Complete / In progress / Not implemented]
- **Files**: N related files

### Structure

#### API Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/v1/auth/login | User login | None |

#### Core Services
- `auth_service.py`: Authentication logic
  - `login()`: Processes login
  - `verify_token()`: Validates JWT

#### Data Models
- `User`: User table
  - Key fields: id, email, password_hash
  - Relationships: Session (1:N)

### Reference Files
- src/api/auth/router.py:L10-50
- src/services/auth_service.py:L1-100
```

#### 6. Next Steps

After analysis, suggest mode-specific follow-up actions:

**After code/feature analysis:**

| Task Scope | Approach |
|------------|----------|
| Simple fix (1-2 files) | Plan Mode |
| Complex feature (3+ files) | `/vibe.spec` |

**After document analysis:**

| Goal | Approach |
|------|----------|
| Apply findings to project | `/vibe.spec "feature-name"` |
| Derive improvement direction | Plan Mode |
| Compare with another source | `/vibe.analyze [other target]` |

**After website analysis:**

| Goal | Approach |
|------|----------|
| Build similar product | `/vibe.spec` |
| Improve existing UI | `/vibe.figma` |
| Compare with another site | `/vibe.analyze [other URL]` |

Wait for user's choice before proceeding.

---

## Mode 2: Document Analysis (PDF, Markdown, Slides)

### Goal

Analyze document **structure, key content, quality, and applicability** to:
1. Extract and organize information from the document
2. Map relevance to the current project
3. Suggest follow-up actions (development, improvement, application)

### Process

#### 1. Read Document

- **PDF**: Use `Read` tool with `pages` parameter (split large documents into chunks of 20 pages)
- **Markdown/Text**: Use `Read` tool for the full file
- **Image-heavy documents**: Analyze visual elements (slides, diagrams) alongside text

#### 2. Classify Document Type

| Type | Analysis Focus |
|------|---------------|
| Technical spec | API definitions, data models, sequence diagrams |
| Presentation/slides | Key claims, frameworks, case studies |
| PRD/requirements | User stories, acceptance criteria, scope |
| Business document | Strategy, decision points, action items |
| Research/academic | Methodology, conclusions, applicability |

#### 3. Analyze Content (Parallel Sub-Agents)

```text
Agent(subagent_type="general-purpose", model="haiku",
  prompt="Read the document at [PATH] and extract: 1) Section structure / table of contents 2) Key concepts and definitions 3) Main arguments or claims. Use the Read tool with pages parameter for PDFs.")

Agent(subagent_type="general-purpose", model="haiku",
  prompt="Read the document at [PATH] and extract: 1) Actionable recommendations 2) Data points, metrics, examples 3) References to external resources. Use the Read tool with pages parameter for PDFs.")
```

#### 4. Project Relevance Analysis

- Map how document content applies to the current project
- Check if patterns/tools/techniques mentioned are already implemented
- Gap analysis: document recommendations vs current project state

#### 5. Output

```markdown
## [Document Name] Analysis

### Overview
- **Type**: [Presentation / Technical spec / PRD / ...]
- **Topic**: [one-line summary]
- **Pages/Sections**: N
- **Audience**: [Developers / PMs / Executives / ...]

### Key Content
1. **[Concept 1]**: Description
2. **[Concept 2]**: Description

### Frameworks/Models (if any)
- [Systematic structure presented in the document]

### Project Relevance
| Recommendation | Current State | Gap |
|----------------|---------------|-----|
| ... | ... | ... |

### Key Insights
- [Most important takeaway]

### Suggested Actions
1. ...
```

#### Fallback

If `Read` fails for a document format:
1. Check file extension and try alternative parsing
2. If binary format is unsupported, inform user and suggest converting to PDF/markdown
3. Never produce an analysis based on partial or failed reads

---

## Mode 3: Website Analysis (URL)

### Goal

Analyze website **tech stack, UX/UI, SEO, accessibility, and performance** to:
1. Understand technical implementation
2. Identify improvement opportunities
3. Collect benchmarking insights

### Process

#### 1. Fetch Website

- Use `WebFetch` tool to retrieve HTML
- Fetch key pages (home, main feature pages, login, etc.)

#### 2. Analyze (Parallel Sub-Agents)

```text
Agent(subagent_type="general-purpose", model="haiku",
  prompt="Analyze the HTML from [URL] (use WebFetch). Extract: 1) Tech stack (framework, meta tags, scripts) 2) Page structure (header, nav, main sections, footer) 3) SEO elements (title, meta description, OG tags, structured data)")

Agent(subagent_type="general-purpose", model="haiku",
  prompt="Analyze the HTML from [URL] (use WebFetch). Extract: 1) Accessibility (ARIA labels, semantic HTML, alt texts, heading hierarchy) 2) Performance hints (script loading, image optimization) 3) Mobile responsiveness (viewport meta, media queries)")

Agent(subagent_type="general-purpose", model="haiku",
  prompt="Analyze the HTML from [URL] (use WebFetch). Extract: 1) UX patterns (navigation, CTA placement, form design) 2) Design system hints (CSS variables, component patterns) 3) Content strategy (copywriting tone, information hierarchy)")
```

#### 3. Figma URL Handling

If a Figma URL is detected, switch to **Figma-specific analysis**:
- Use `get_design_context` or `get_screenshot` to collect design data
- Analyze component structure, design tokens, layout patterns
- Compare design intent with current project code

#### 4. Output

```markdown
## [URL] Analysis

### Overview
- **Site type**: [SaaS / E-commerce / Portfolio / ...]
- **Tech stack**: [Next.js, Tailwind, ...]
- **Overall score**: N/100

### Technical Analysis
| Area | Detection | Details |
|------|-----------|---------|
| Framework | React/Next.js | SSR enabled |
| CSS | Tailwind CSS | v3.4 |

### UX/UI Analysis
- **Navigation**: [assessment]
- **CTA placement**: [assessment]
- **Responsive design**: [assessment]

### SEO Analysis (N/100)
| Element | Status | Recommendation |
|---------|--------|----------------|
| Title | Present | Appropriate length |
| Meta Description | Missing | Add description |

### Accessibility (WCAG 2.1 AA)
- **Semantic HTML**: [assessment]
- **Keyboard navigation**: [assessment]
- **Screen reader support**: [assessment]

### Improvement Suggestions
1. [highest priority]
2. ...
```

#### Fallback

If `WebFetch` fails:
1. Retry once with a simplified URL (strip query params)
2. If still failing, inform user of the error (timeout, DNS, etc.)
3. Suggest user provide HTML file directly: `/vibe.analyze page.html`

---

## Mode 4: Project Quality Analysis (--code/--deps/--arch)

### Scope

- **Default** (`/vibe.analyze`): Full analysis (code + dependencies + architecture)
- `--code`: Code quality only
- `--deps`: Dependency analysis only
- `--arch`: Architecture analysis only

### Code Quality (--code)

- Cyclomatic complexity analysis
- Code quality validation
- Coupling/cohesion assessment

### Dependencies (--deps)

- Read `package.json` / `pyproject.toml` / `pubspec.yaml`
- Detect version conflicts, security vulnerabilities, outdated packages

### Architecture (--arch)

- Identify core modules
- Map module dependencies
- Detect circular dependencies and layer violations

### Report

Save to `.claude/vibe/reports/analysis-{date}.md`:

```markdown
# Project Analysis Report

## Overview
- Analysis date: YYYY-MM-DD HH:MM
- Scope: Full / Code / Deps / Arch

## Code Quality (N/100)
- Average complexity: N (good/warning/critical)
- High complexity files: N

## Dependencies (N/100)
- Total packages: N
- Updates needed: N
- Security issues: N

## Architecture (N/100)
- Circular dependencies: N found
- Layer violations: N

## Improvement Suggestions
1. ...
2. ...
```

## Core Tools (Semantic Analysis)

### Tool Invocation

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Available Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `findSymbol` | Find symbol definitions | Locate function/class implementations |
| `findReferences` | Find all references | Track usage patterns |
| `analyzeComplexity` | Complexity analysis | Measure complexity metrics |
| `validateCodeQuality` | Quality validation | Check code quality standards |
| `saveMemory` | Save analysis results | Persist findings for future sessions |

---

## Quality Gate (Mandatory)

### Mode-Specific Checklists

**Code/Feature Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| Completeness | All related files identified | 20% |
| Completeness | All API endpoints documented | 15% |
| Completeness | All data models mapped | 15% |
| Accuracy | File paths verified to exist | 10% |
| Accuracy | Line numbers accurate | 10% |
| Depth | Business logic explained | 10% |
| Depth | Dependencies mapped | 10% |
| Actionability | Next steps clearly defined | 10% |

**Document Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| Completeness | Full document read | 20% |
| Completeness | All key concepts extracted | 20% |
| Structure | Section structure identified | 15% |
| Depth | Project relevance analyzed | 15% |
| Depth | Gap analysis performed | 15% |
| Actionability | Specific follow-up actions suggested | 15% |

**Website Analysis:**

| Category | Check Item | Weight |
|----------|------------|--------|
| Completeness | HTML fetched and parsed | 15% |
| Tech | Tech stack identified | 15% |
| UX | UX/UI patterns analyzed | 15% |
| SEO | SEO elements inspected | 15% |
| A11y | Accessibility checked | 15% |
| Performance | Performance hints analyzed | 10% |
| Actionability | Improvements suggested | 15% |

### Score Calculation

```
Score = sum(checked items * weight) / 100

Grades:
- 95-100: EXCELLENT — comprehensive analysis
- 90-94:  GOOD — minor gaps, additional exploration recommended
- 80-89:  FAIR — needs deeper exploration
- 0-79:   POOR — incomplete, re-analyze
```

### Depth Levels

| Level | Scope | Output |
|-------|-------|--------|
| L1: Surface | File names, basic structure | File list |
| L2: Structure | Functions, classes, imports | Structure map |
| L3: Logic | Business logic, data flow | Flow analysis |
| L4: Deep | Edge cases, dependencies, risks | Full analysis |

**Minimum**: L3 for feature analysis, L2 for project overview.

### Forbidden Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| "and more..." | Incomplete | List all items |
| "etc." | Vague | Be specific |
| "related files" without paths | Missing detail | Provide file paths |
| Missing line numbers | Hard to navigate | Use `:L10-50` format |
| No auth info on endpoints | Security gap | Always specify auth |

### Quality Thresholds

**Code (`--code`):**

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Avg Complexity | ≤10 | 11-15 | >15 |
| Max Function Length | ≤30 | 31-50 | >50 |
| High Complexity Files | 0 | 1-3 | >3 |
| Circular Dependencies | 0 | 1 | >1 |

**Dependencies (`--deps`):**

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Outdated Packages | 0-3 | 4-10 | >10 |
| Security Vulnerabilities | 0 | 1-2 (low) | Any high/critical |
| Major Version Behind | 0 | 1-2 | >2 |

---

ARGUMENTS: $ARGUMENTS
