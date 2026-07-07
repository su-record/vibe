# Analyze Output Templates — Full Reference

> Loaded by vibe.analyze SKILL.md for the Mode 1–4 output formats, the Mode 1 Next Steps decision tables, the Mode 1 stack directory mapping, and the Mode 2 document-type table.

## Mode 1: Project Structure — Stack Directory Mapping

**Backend:**
- FastAPI/Django: `app/api/`, `app/services/`, `app/models/`
- Express/NestJS: `src/controllers/`, `src/services/`, `src/models/`

**Frontend:**
- React/Next.js: `src/components/`, `src/pages/`, `src/hooks/`
- Flutter: `lib/screens/`, `lib/services/`, `lib/providers/`

## Mode 1: Scale for Large Projects (6+ related files) — Additional Agent Prompts

```text
Agent(subagent_type="Explore", model="haiku",
  prompt="Find all test files related to [FEATURE]. Identify tested vs untested paths.")

Agent(subagent_type="Explore", model="haiku",
  prompt="Analyze [FEATURE] configuration, environment variables, and external integrations.")
```

## Mode 1: Feature/Module Analysis — Output

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

## Mode 1: Next Steps — Decision Tables

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

## Mode 2: Classify Document Type

| Type | Analysis Focus |
|------|---------------|
| Technical spec | API definitions, data models, sequence diagrams |
| Presentation/slides | Key claims, frameworks, case studies |
| PRD/requirements | User stories, acceptance criteria, scope |
| Business document | Strategy, decision points, action items |
| Research/academic | Methodology, conclusions, applicability |

## Mode 2: Document Analysis — Output

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

## Mode 3: Website Analysis — Output

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

## Mode 4: Project Quality Analysis — Report

Save to `.vibe/reports/analysis-{date}.md`:

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
