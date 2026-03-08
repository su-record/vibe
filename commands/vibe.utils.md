---
description: Utility tools (UI preview, diagram, E2E test, image generation, etc.)
argument-hint: "--ui, --diagram, --e2e, --image, or other options"
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
/vibe.utils --image "description"    # Generate image with Gemini (icon, banner, etc.)
/vibe.utils --image --icon "AppName" # Generate app icon/favicon
/vibe.utils --build-fix              # Fix build errors (minimal diff)
/vibe.utils --clean                  # Remove dead code + DELETION_LOG
/vibe.utils --codemaps               # Generate architecture docs
/vibe.utils --compound               # Document solution (usually auto-triggered)
```

---

## --ui (UI Preview)

Read and follow `agents/ui-previewer.md` for UI preview generation.

Generate UI preview from description or design folder.

- **Gemini enabled**: UI mockup image + component code generation (via `llm-orchestrate.js` → `gemini-api`)
- **Gemini disabled**: ASCII art fallback

**Input types:**

| Input | Example |
| ----- | ------- |
| Text description | `"Login form with email, password"` |
| Design folder | `./design/` |
| Single file | `./mockups/login.html` |

**Supported file formats in folder:**

- `*.html` - HTML mockups
- `*.png` / `*.jpg` / `*.webp` - UI screenshots (Claude reads images)
- `*.json` - Design tokens
- `*.css` / `*.scss` - Style variables
- `*.md` - Style guides
- `*.svg` - Vector graphics

**Example:**

```
/vibe.utils --ui "Login form - email, password input + login button"
/vibe.utils --ui ./design/dashboard/
/vibe.utils --ui ./mockups/homepage.png
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

## --image (Image Generation)

Generate images using Gemini Image API.

- **Default**: Gemini Flash Image (`gemini-2.5-flash-image`) - 빠르고 가벼운 이미지 생성
- **--pro**: Gemini Pro Image (`gemini-3-pro-image-preview`) - 고품질 이미지 생성

### MANDATORY Tool Invocation

**CRITICAL: You MUST use the following command to generate images. Do NOT search for scripts, do NOT use gcloud, do NOT use any other method.**

**Step 0: Script path:**
- `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`

**General image generation (Gemini Flash Image):**
```bash
node "[LLM_SCRIPT]" gemini image "IMAGE_DESCRIPTION" --output "OUTPUT_PATH"
```

**Pro quality (Gemini Pro Image):**
```bash
node "[LLM_SCRIPT]" gemini image "IMAGE_DESCRIPTION" --pro --output "OUTPUT_PATH"
```

**With size option:**
```bash
node "[LLM_SCRIPT]" gemini image "IMAGE_DESCRIPTION" --size "1920x1080" --output "OUTPUT_PATH"
```

### How to Parse User Request

1. Extract the **image description** from the user's message (what to generate)
2. Extract the **output path** from the user's message (where to save)
   - If user specifies a path, use that path
   - Default: `--output "./generated-image.png"`
3. Extract **size** if specified, otherwise default 1024x1024
4. If user requests **high quality / pro / 고품질**, add `--pro` flag

### Examples

```bash
node "[LLM_SCRIPT]" gemini image "A cute Gemini AI character mascot, colorful, friendly" --output "./gemini-character.png"

node "[LLM_SCRIPT]" gemini image "Professional website banner, modern design" --pro --size "1920x400" --output "./banner.png"

node "[LLM_SCRIPT]" gemini image "Modern minimal logo design" --output "./public/logo.png"
```

### Output Format

The command outputs JSON to stdout:
```json
{ "success": true, "path": "/absolute/path/to/image.png", "size": 123456, "sizeKB": "120.5 KB" }
```

On error:
```json
{ "success": false, "error": "Error message" }
```

### Icon Generation (--icon)

Use the same command with a pre-built icon prompt template:

**Prompt template:** `"App icon for {APP_NAME}, primary color {COLOR}, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist"`

```bash
# --icon "MyApp"
node "[LLM_SCRIPT]" gemini image "App icon for MyApp, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist" --output "./public/app-icon.png"

# --icon "MyApp" --color "#2F6BFF"
node "[LLM_SCRIPT]" gemini image "App icon for MyApp, primary color #2F6BFF, square format 1:1, simple recognizable design, works well at small sizes, no text or letters, solid or gradient background, modern minimalist" --output "./public/app-icon.png"
```

### Prerequisites

- Gemini API key configured (`vibe gemini auth` or `vibe gemini key <key>`)

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
1. Calls `core_start_session` to load project memories
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
- 90-94:  ⚠️ GOOD - Minor improvements recommended
- 80-89:  ⚠️ FAIR - Improvements needed
- 0-79:   ❌ POOR - Redo required
```

### Image Generation Quality Checklist (--image)

| Category | Check Item | Weight |
|----------|------------|--------|
| **Relevance** | Image matches description/app concept | 30% |
| **Format** | Correct sizes for all platforms | 25% |
| **Quality** | Clear at small sizes (16x16) | 20% |
| **Consistency** | Works in light/dark backgrounds | 15% |
| **Completeness** | All required files generated | 10% |

### Output Requirements by Tool

| Tool | Required Output |
|------|-----------------|
| `--ui` | ASCII preview + component list |
| `--diagram` | Valid Mermaid code + rendered preview |
| `--diagram --er` | Entity names, fields, relationships |
| `--diagram --flow` | Start/end nodes, decision points |
| `--e2e` | Test file + execution results |
| `--image` | Generated image file(s) + path |
| `--image --icon` | Full icon set + webmanifest |
| `--compound` | Solution markdown + category tag |

---

ARGUMENTS: $ARGUMENTS
