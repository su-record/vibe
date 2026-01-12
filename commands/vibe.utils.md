---
description: Utility tools (UI preview, diagram, E2E test, etc.)
argument-hint: "--ui, --diagram, --e2e, or other options"
---

# /vibe.utils

Collection of utility tools. Use with options.

## Usage

```
/vibe.utils --ui "설명"              # UI ASCII preview
/vibe.utils --diagram                # Architecture diagram
/vibe.utils --diagram --er           # ERD diagram
/vibe.utils --diagram --flow         # Flowchart
/vibe.utils --e2e "scenario"         # E2E browser test (Playwright)
/vibe.utils --e2e --visual           # Visual regression test
/vibe.utils --e2e --record           # Video recording
/vibe.utils --compound               # Document solution (usually auto-triggered)
```

---

## --ui (UI Preview)

Read and follow `agents/ui-previewer.md` for ASCII UI preview generation.

Generate ASCII-based UI preview from description.

**Example:**
```
/vibe.utils --ui "로그인 폼 - 이메일, 비밀번호 입력 + 로그인 버튼"
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

## --compound (Solution Documentation)

Read and follow `agents/compounder.md` for solution documentation.

Document solved problems for knowledge accumulation.

**Usually auto-triggered by hooks when:**
- "버그 해결됨", "bug fixed", "PR merged" detected

**Output location:** `.claude/vibe/solutions/`

```
.claude/vibe/solutions/
├── security/           # Security solutions
├── performance/        # Performance optimizations
├── database/           # Database related
└── integration/        # External integrations
```

---

ARGUMENTS: $ARGUMENTS
