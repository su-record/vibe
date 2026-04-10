---
description: Generate or audit project folder structure optimized for AI-assisted development
argument-hint: --check (audit existing) or project-type
---

# /vibe.scaffold

Design and generate a project structure where AI works effectively on its own.

> "A well-designed project structure trains AI to follow it naturally."

## Usage

```
/vibe.scaffold                 # Generate structure (auto-detect stack)
/vibe.scaffold --check         # Audit existing structure + suggest improvements
/vibe.scaffold webapp          # Generate webapp-type structure
/vibe.scaffold api             # Generate api-type structure
```

---

## Process

### 1. Assess Current State

1. Read `CLAUDE.md`, `package.json`, `pyproject.toml`, `pubspec.yaml`
2. Scan existing folder structure via `Glob`
3. Read `.claude/vibe/config.json` for detected stacks

### 2. Determine Project Type

| Type | Structure |
|------|-----------|
| `webapp` | src/ + pages/ + components/ + hooks/ + styles/ |
| `api` | src/ + routes/ + services/ + models/ + middleware/ |
| `fullstack` | src/client/ + src/server/ or apps/ monorepo |
| `library` | src/ + examples/ + benchmarks/ |
| `mobile` | lib/ (Flutter) or src/ (React Native) |

### 3. Generate Base Structure

Common directories for all projects:

```
my-project/
├── src/              # Business logic
├── docs/             # Human-maintained business documents (AI reference)
│   ├── README.md     # Explains purpose: business rules, domain defs, ADR
│   └── adr/          # Architecture Decision Records
├── tests/            # Test infrastructure
├── .dev/             # AI-generated work logs
│   ├── README.md     # Explains purpose: learnings, debug logs, scratch
│   ├── learnings/    # Troubleshooting records
│   └── scratch/      # Experiments, scratchpad (gitignored)
├── .claude/          # AI configuration (managed by vibe init)
├── out/              # Build artifacts (gitignored)
└── CLAUDE.md         # Project map
```

### 4. Stack-Specific src/ Layout

**React/Next.js (webapp):**
```
src/
├── components/       # Reusable UI components
│   ├── ui/           # Primitives (Button, Input, Modal)
│   └── features/     # Feature-specific components
├── pages/ or app/    # Routes (varies by Next.js version)
├── hooks/            # Custom hooks
├── lib/              # Utilities, helpers
├── services/         # API calls, external services
├── stores/           # State management (zustand, jotai, etc.)
├── types/            # Type definitions
└── styles/           # Global styles
```

**Express/NestJS/FastAPI (api):**
```
src/
├── routes/           # API routes (or controllers/)
├── services/         # Business logic
├── models/           # Data models, schemas
├── middleware/       # Auth, logging, error handling
├── lib/              # Utilities
├── types/            # Type definitions
└── config/           # Configuration management
```

**Flutter (mobile):**
```
lib/
├── screens/          # Screen widgets
├── widgets/          # Reusable widgets
├── services/         # API, local storage
├── providers/        # State management
├── models/           # Data models
├── utils/            # Utilities
└── config/           # Configuration, constants
```

### 5. Clean Architecture Layers (Optional)

```
src/
├── domain/           # Business rules (pure logic, no external deps)
├── application/      # Use cases (domain composition)
├── infrastructure/   # External integrations (DB, API, files)
└── presentation/     # UI or API endpoints
```

Layer rules:
- Dependency direction: presentation → application → domain (reverse forbidden)
- domain must not import external packages
- infrastructure implements domain interfaces

### 6. Generate Supporting Files

| File | Content |
|------|---------|
| `docs/README.md` | Purpose of docs/ directory |
| `.dev/README.md` | Purpose of .dev/ directory |
| `.gitignore` additions | `out/`, `.dev/scratch/` entries |

### 7. Update CLAUDE.md

Add generated structure as pointers in CLAUDE.md:

```markdown
## Project Structure
- `src/` — Business logic
- `docs/` — Human-maintained business docs (AI reads before work)
- `tests/` — Test infrastructure
- `.dev/` — AI-generated work logs
- `.claude/` — AI configuration
```

---

## --check Mode: Audit Existing Structure

### Checklist

| Item | Criteria | Points |
|------|----------|--------|
| `docs/` exists | Business documents separated | /15 |
| `.dev/` exists | AI work logs separated | /10 |
| src/ sub-structure | Role-based folder organization | /20 |
| tests/ separated | Not co-located with source | /15 |
| CLAUDE.md describes structure | Folder purposes documented | /10 |
| .gitignore complete | Includes out/, .dev/scratch/ | /5 |
| Layer separation | Domain/service/infra distinction | /15 |
| Dependency direction consistency | No reverse imports | /10 |

### Output

```markdown
## Scaffold Audit Result (N/100)

### Current Structure
[tree output]

### Findings
| Item | Status | Recommendation |
|------|--------|----------------|
| docs/ | Missing | `mkdir docs && echo "..." > docs/README.md` |
| ... | ... | ... |

### Auto-Fixable Items
1. [ ] Create docs/
2. [ ] Create .dev/
3. [ ] Update .gitignore

Proceed with auto-fix? (y/n)
```

### Self-Repair

If audit score < 60, automatically suggest:
1. Run `/vibe.scaffold` to generate missing directories
2. Run `vibe update` to regenerate CLAUDE.md with structure info
3. Run `/vibe.harness` for full maturity assessment

---

## Principles

1. **Never delete or move existing files** — only add new directories
2. **Empty directories get a README.md** — purpose description helps AI understand context
3. **No structure < bad structure < good structure** — any scaffolding improves AI output
4. **Separate by ownership** — human docs (docs/) vs AI logs (.dev/) in different directories

---

ARGUMENTS: $ARGUMENTS
