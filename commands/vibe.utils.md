---
description: Utility tools (UI preview, diagram, E2E test, etc.)
argument-hint: "--ui, --diagram, --e2e, or other options"
---

# /vibe.utils

Collection of utility tools. Use with options.

## Usage

```
/vibe.utils --ui "description"       # UI ASCII preview
/vibe.utils --diagram                # Architecture diagram
/vibe.utils --diagram --er           # ERD diagram
/vibe.utils --diagram --flow         # Flowchart
/vibe.utils --e2e "scenario"         # E2E browser test (Playwright)
/vibe.utils --e2e --visual           # Visual regression test
/vibe.utils --e2e --record           # Video recording
/vibe.utils --build-fix              # Fix build errors (minimal diff)
/vibe.utils --clean                  # Remove dead code + DELETION_LOG
/vibe.utils --codemaps               # Generate architecture docs
/vibe.utils --compound               # Document solution (usually auto-triggered)
```

---

## --ui (UI Preview)

Read and follow `agents/ui-previewer.md` for ASCII UI preview generation.

Generate ASCII-based UI preview from description.

**Example:**
```
/vibe.utils --ui "Login form - email, password input + login button"
```

---

## --diagram (Diagram Generation)

Read and follow `agents/diagrammer.md` for diagram generation.

Generate Mermaid diagrams for architecture visualization.

**Options:**
- `--diagram`: Architecture overview
- `--diagram --er`: Entity-Relationship Diagram
- `--diagram --flow`: Flowchart
- `--diagram --seq`: Sequence Diagram

**Example:**
```
/vibe.utils --diagram --er
```

---

## --e2e (E2E Testing)

Read and follow `agents/e2e-tester.md` for Playwright-based E2E testing.

**Options:**
- `--e2e "scenario"`: Run specific scenario
- `--e2e --visual`: Visual regression testing
- `--e2e --record`: Video recording

**Features:**
- Screenshot capture and comparison
- Console error collection
- Accessibility (a11y) testing
- Bug reproduction automation

**Example:**
```
/vibe.utils --e2e "login flow"
/vibe.utils --e2e --visual --record
```

---

## --build-fix (Build Error Resolution)

Read and follow `agents/build-error-resolver.md` for minimal-diff build fixes.

Fix TypeScript/build errors with minimal changes.

**Philosophy:** Changes must be < 5% of file. No refactoring.

**Allowed:**
- Add type annotations
- Fix imports
- Add null checks
- Install missing deps

**Forbidden:**
- Refactor unrelated code
- Change architecture
- Rename variables

**Example:**
```
/vibe.utils --build-fix
```

**Output:** List of minimal fixes applied + build status

---

## --clean (Dead Code Removal)

Read and follow `agents/refactor-cleaner.md` for safe dead code removal.

Detect and remove unused code with audit trail.

**Analysis Tools:**
- knip (unused exports, files, deps)
- depcheck (unused npm packages)
- ts-prune (unused TS exports)

**Safety Levels:**
| Level | Category | Action |
|-------|----------|--------|
| SAFE | Private functions, local vars | Auto-delete |
| CAREFUL | Unused exports | Verify then delete |
| RISKY | Public API, shared utils | Report only |

**Example:**
```
/vibe.utils --clean
```

**Output:**
- Removed items list
- `.claude/vibe/DELETION_LOG.md` updated
- Build/test verification

---

## --codemaps (Architecture Documentation)

Generate auto-documentation from codebase structure.

**Output Location:** `docs/CODEMAPS/`

**Generated Files:**
```
docs/CODEMAPS/
├── INDEX.md          # Overview of all areas
├── frontend.md       # Frontend structure
├── backend.md        # API/backend structure
├── database.md       # Schema documentation
└── integrations.md   # External services
```

**Each file contains:**
- Module table (name, path, description)
- Data flow diagram (Mermaid)
- Dependencies list
- Related areas

**Tools Used:**
- ts-morph (TypeScript AST)
- madge (dependency graph)

**Example:**
```
/vibe.utils --codemaps
```

---

## --compound (Solution Documentation)

Read and follow `agents/compounder.md` for solution documentation.

Document solved problems for knowledge accumulation.

**Usually auto-triggered by hooks when:**
- "bug fixed", "PR merged" detected

**Output location:** `.claude/vibe/solutions/`

```
.claude/vibe/solutions/
├── security/           # Security solutions
├── performance/        # Performance optimizations
├── database/           # Database related
└── integration/        # External integrations
```

---

## --continue (Session Restore)

Restore previous session context for continuity.

**Usage:**
```
/vibe.utils --continue
```

**What it does:**
1. Calls `vibe_start_session` to load project memories
2. Restores previous conversation context
3. Resumes work from last checkpoint

---

## Quality Gate (Mandatory)

### UI Preview Quality Checklist (--ui)

| Category | Check Item | Weight |
|----------|------------|--------|
| **Completeness** | All requested elements present | 30% |
| **Layout** | Proper spacing and alignment | 20% |
| **Labels** | All buttons/inputs labeled | 20% |
| **Accessibility** | Tab order logical | 15% |
| **Responsiveness** | Mobile/desktop variants shown | 15% |

### Diagram Quality Checklist (--diagram)

| Category | Check Item | Weight |
|----------|------------|--------|
| **Accuracy** | Matches actual codebase structure | 30% |
| **Completeness** | All major components included | 25% |
| **Relationships** | Connections correctly shown | 20% |
| **Readability** | Not too cluttered | 15% |
| **Mermaid Syntax** | Valid, renders correctly | 10% |

### E2E Test Quality Checklist (--e2e)

| Category | Check Item | Weight |
|----------|------------|--------|
| **Coverage** | All critical paths tested | 25% |
| **Assertions** | Each step has verification | 20% |
| **Stability** | No flaky selectors | 20% |
| **Error Handling** | Failures captured with screenshots | 15% |
| **Performance** | Tests complete in reasonable time | 10% |
| **Accessibility** | a11y checks included | 10% |

### E2E Test Requirements

| Test Type | Required Output |
|-----------|-----------------|
| Standard | Pass/fail status + console errors |
| Visual (`--visual`) | Screenshot comparison + diff |
| Recording (`--record`) | Video file path + duration |

### E2E Forbidden Patterns

| Pattern | Issue | Required Fix |
|---------|-------|--------------|
| Hardcoded waits (`sleep(5000)`) | Flaky tests | Use `waitFor` conditions |
| XPath selectors | Brittle | Use data-testid |
| No assertions | Useless test | Add expect() calls |
| Ignoring console errors | Missing bugs | Capture and report |

### Compound (Solution) Quality Checklist (--compound)

| Category | Check Item | Weight |
|----------|------------|--------|
| **Problem** | Clearly described root cause | 25% |
| **Solution** | Step-by-step fix documented | 25% |
| **Prevention** | How to avoid in future | 20% |
| **Code Samples** | Before/after snippets | 15% |
| **Tags** | Properly categorized | 15% |

### Quality Score Calculation

```
Score = Σ(checked items × weight) / 100

Grades:
- 95-100: ✅ EXCELLENT - Ready to use
- 85-94:  ✅ GOOD - Minor improvements optional
- 70-84:  ⚠️ FAIR - Improvements needed
- 0-69:   ❌ POOR - Redo required
```

### Output Requirements by Tool

| Tool | Required Output |
|------|-----------------|
| `--ui` | ASCII preview + component list |
| `--diagram` | Valid Mermaid code + rendered preview |
| `--diagram --er` | Entity names, fields, relationships |
| `--diagram --flow` | Start/end nodes, decision points |
| `--e2e` | Test file + execution results |
| `--compound` | Solution markdown + category tag |

---

ARGUMENTS: $ARGUMENTS
