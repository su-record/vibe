---
name: design-teach
tier: standard
description: "Gather and store project design context — target audience, brand personality, aesthetic direction, constraints. Used by other design-* skills. Use when design-teach, design-setup, design-context."
triggers: [design-teach, design-setup, design-context]
priority: 50
---

# Design Teach — Project Design Context Gathering

Collect project-specific design context so all design-* skills produce tailored, brand-aware results. Saves to `.claude/vibe/design-context.json`.

## Usage

```
/design-teach                  # Interactive context gathering
/design-teach --update         # Update existing context
```

## Process

### Step 1: Auto-Explore Codebase

Before asking questions, automatically gather existing signals:

| Signal | Where to Look |
|--------|---------------|
| CSS variables / tokens | `*.css`, `tailwind.config.*`, `theme.*` |
| Color palette | Existing color definitions, brand assets |
| Typography | Font imports, font-family declarations |
| Component library | `package.json` dependencies (MUI, Chakra, shadcn, etc.) |
| Design system | `.claude/vibe/design-system/*/MASTER.md` |
| Existing context | `.claude/vibe/design-context.json` (if updating) |

### Step 2: Ask Clarifying Questions

Present findings from Step 1, then ask what's missing:

**1. Target Audience**
- Who are the primary users? (developers, consumers, enterprise, internal)
- Technical sophistication? (tech-savvy, general public, mixed)
- Usage context? (desktop office, mobile on-the-go, both)

**2. Brand Personality**
- How should the product feel? (professional, playful, minimal, bold, warm)
- Reference products with similar feel? (e.g., "Linear-like", "Notion-like")
- Any brand guidelines or style guide URL?

**3. Aesthetic Direction**
- Visual density preference? (spacious, balanced, dense)
- Color mood? (warm, cool, neutral, vibrant)
- Typography mood? (modern sans, classic serif, monospace-technical)

**4. Constraints**
- Accessibility requirements? (WCAG AA, AAA, specific needs)
- Supported devices? (desktop-only, mobile-first, responsive)
- Dark mode required?
- Performance budget? (target LCP, bundle size limits)

### Step 3: Save Context

Write gathered context to `.claude/vibe/design-context.json` using the Write tool.

**Schema (v1):**

```json
{
  "$schema": "design-context-v1",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "audience": {
    "primary": "Description of target users",
    "context": "Usage environment (desktop/mobile/mixed)",
    "expertise": "Technical level (beginner/intermediate/expert)"
  },
  "brand": {
    "personality": ["3-5 adjectives"],
    "tone": "formal | casual | playful | professional (guideline, free text allowed)",
    "existingAssets": "Path to existing brand guidelines (optional)"
  },
  "aesthetic": {
    "style": "minimal | bold | elegant | playful | corporate (guideline, free text allowed)",
    "colorMood": "warm | cool | neutral | vibrant | muted (guideline, free text allowed)",
    "typographyMood": "modern | classic | geometric | humanist (guideline, free text allowed)",
    "references": ["Reference site/app URLs"]
  },
  "constraints": {
    "accessibility": "AA | AAA",
    "performance": "core-web-vitals | balanced | unlimited",
    "browsers": ["chrome", "safari", "firefox", "edge"],
    "devices": ["mobile", "tablet", "desktop"]
  },
  "detectedStack": {
    "framework": "Detected framework",
    "componentLibrary": "Detected component library",
    "styling": "Detected styling approach",
    "fonts": ["Detected fonts"]
  }
}
```

> **Note**: `tone`, `style`, `colorMood`, `typographyMood` values are suggestions, not closed enums. Users can enter free text.

> **Size limit**: design-context.json should not exceed 10KB. The `references` array is capped at 5 items.

### Step 4: Rerun Semantics

When `/design-teach` is run again and `design-context.json` already exists:

1. Read the existing file with the Read tool
2. **Show existing values as defaults** for each question ("Current: professional, clean — do you want to change this?")
3. User replies "keep" or leaves blank → that field is preserved
4. New value entered → only that field is replaced (**field-level replacement, not merge**)
5. `createdAt` is always preserved; only `updatedAt` is updated to the current time

### Step 5: Other Skills Reference This Context

Each design-* skill does the following when it runs:

```
1. Read `.claude/vibe/design-context.json`
2. File not found → print "Run /design-teach first for better results" → continue with defaults
3. Parse failure (invalid JSON) → warn "design-context.json parse failed" + continue with defaults → recommend re-running /design-teach
4. Success → apply context to analysis criteria
```

## Design Workflow Integration

Design skills are integrated into 3 phases of the vibe workflow:

```
SPEC Phase:
  ① Check design-context.json (recommend /design-teach if missing)
  ② ui-industry-analyzer → ui-design-system-gen → ui-layout-architect

REVIEW Phase:
  ③ /design-audit (technical quality check)
  ④ /design-critique (UX review)
  ⑤ ui-antipattern-detector (AI slop + pattern detection)

PRE-SHIP Phase:
  ⑥ /design-normalize (design system alignment)
  ⑦ /design-polish (final pass)
```

## How Other Skills Use This

| Skill | Context Usage |
|-------|---------------|
| `/design-audit` | Weight findings by audience constraints (a11y level, devices) |
| `/design-critique` | Adjust persona priorities by target audience |
| `/design-polish` | Apply brand-appropriate micro-interactions |
| `/design-normalize` | Use detected token system for replacement mapping |
| `/design-distill` | Preserve brand-expressive elements based on personality |

## Output Format

```markdown
## Design Context: {project}

### Auto-Detected
- Framework: Next.js 15
- Styling: Tailwind CSS + shadcn/ui
- Fonts: Inter (heading), Inter (body)
- Tokens: 24 CSS variables found

### User Provided
- Audience: B2B SaaS, mixed technical level
- Brand: Professional, clean (like Linear)
- Density: Balanced
- A11y: WCAG AA
- Dark mode: Required

### Saved
✅ .claude/vibe/design-context.json updated
```

## Important

- **Non-destructive**: Only creates/updates the context file. No code changes.
- **Incremental**: Running `--update` preserves existing answers, only asks about gaps.
- **Foundation**: Run this first before other design-* skills for best results.
