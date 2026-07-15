---
name: vibe.analyze
description: Analyze any target — code, document, website, or Figma design
argument-hint: '"feature-name" or file.pdf or https://... or --code or --deps or --arch'
user-invocable: true
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

Read `CLAUDE.md`, `package.json`, `pyproject.toml`, etc. to identify tech stack.

> Read `references/output-templates.md` for the full backend/frontend stack → directory mapping.

#### 3. Explore Related Code (Parallel Sub-Agents)

**MANDATORY: Always use native Explore sub-agents. Never explore in main session.**

> Why: 3 Explore agents return ~600 tokens of summaries to main session.
> Direct Glob/Grep/Read in main session would add 5-15K tokens of raw content.

**Parallel exploration (ALL in ONE message):**

```text
Agent(subagent_type="Explore", model="haiku",
  prompt="Find all [FEATURE] related API endpoints. List file paths, HTTP methods, routes, and auth requirements.")

Agent(subagent_type="Explore", model="haiku",
  prompt="Find all [FEATURE] related services, business logic, and utility functions. Map dependencies.")

Agent(subagent_type="Explore", model="haiku",
  prompt="Find all [FEATURE] related data models, schemas, and database queries. Document relationships and key fields.")
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

> Read `references/output-templates.md` for the full document-type → analysis-focus table.

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

> Read `references/output-templates.md` for the full Mode 2 output format.

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

> Read `references/output-templates.md` for the full Mode 3 output format.

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

Save to `.vibe/reports/analysis-{date}.md`:

> Read `references/output-templates.md` for the full Mode 4 report format.

## Core Tools (Semantic Analysis)

### Tool Invocation

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Available Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `analyzeComplexity` | Complexity analysis | Measure complexity metrics |
| `validateCodeQuality` | Quality validation | Check code quality standards |
| `saveMemory` | Save analysis results | Persist findings for future sessions |

---

## Quality Gate (Mandatory)

Each mode has a weighted completeness checklist. Score = sum(checked items × weight) / 100. **Minimum depth: L3 for feature analysis, L2 for project overview.**

> Read `references/quality-gate.md` for the full mode-specific weighted checklists, score grades, depth-level table, forbidden-patterns table, and quality thresholds (code/deps).

---

ARGUMENTS: $ARGUMENTS
