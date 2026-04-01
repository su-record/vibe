---
name: design-critique
description: "UX design review — Nielsen heuristics scoring, 5-persona red flag analysis. Use when design-critique, ux-review, design-review."
triggers: [design-critique, ux-review, design-review]
priority: 50
---

# Design Critique — UX Design Review

Evaluate design quality through Nielsen's 10 usability heuristics and 5 persona lenses. Report only — no code modifications.

## Usage

```
/design-critique <target>     # Critique specific page/flow
/design-critique .            # Critique all changed UI files
```

## Nielsen's 10 Heuristics (0–4 Score Each)

| # | Heuristic | What to Check |
|---|-----------|---------------|
| H1 | Visibility of system status | Loading indicators, progress bars, state feedback |
| H2 | Match between system and real world | Natural language, familiar icons, logical groupings |
| H3 | User control and freedom | Undo/redo, cancel actions, exit paths |
| H4 | Consistency and standards | Same action = same pattern, platform conventions |
| H5 | Error prevention | Confirmation dialogs, input constraints, disabled states |
| H6 | Recognition rather than recall | Visible options, contextual help, breadcrumbs |
| H7 | Flexibility and efficiency | Keyboard shortcuts, defaults, power user paths |
| H8 | Aesthetic and minimalist design | Signal-to-noise ratio, essential info only |
| H9 | Help users recognize and recover from errors | Clear error messages, suggested fixes |
| H10 | Help and documentation | Tooltips, onboarding, contextual guidance |

### Scoring

| Score | Meaning |
|-------|---------|
| 0 | Violated — causes real user problems |
| 1 | Weak — frequent friction points |
| 2 | Adequate — works but not smooth |
| 3 | Good — minor friction only |
| 4 | Excellent — delightful experience |

## 5-Persona Red Flag Analysis

Test the design through these persona lenses:

### 1. Power User
- Can they complete tasks quickly?
- Are there keyboard shortcuts or bulk actions?
- Is information density appropriate (not too sparse)?

### 2. First-Time User
- Is the entry point obvious?
- Can they complete the primary task without documentation?
- Is progressive disclosure used (not overwhelming)?

### 3. Accessibility-Dependent User
- Screen reader navigation makes sense?
- Color is not the only information channel?
- Text is resizable without breaking layout?

### 4. Stressed / Distracted User
- Can they recover from mistakes easily?
- Are destructive actions clearly guarded?
- Is critical information scannable (not buried in paragraphs)?

### 5. Mobile-Only User
- Touch targets adequate?
- Key actions reachable with one thumb?
- Forms don't require excessive typing?

## Platform Adaptation

When running on mobile stacks (React Native, Flutter, iOS, Android):
- Focus on platform-specific UX conventions (gestures, navigation patterns)
- Evaluate against platform HIG (Human Interface Guidelines / Material Design)
- Skip web-specific heuristic items (breadcrumbs, URL-based navigation)

## Output Format

```markdown
## Design Critique: {target}

### Heuristic Scores
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| H1 | Visibility of system status | 2/4 | No loading state on form submit |
| H2 | Match real world | 4/4 | — |
| H3 | User control | 1/4 | No undo on delete |
| ... | ... | ... | ... |
| **Total** | | **28/40** | **70%** |

### Persona Red Flags

#### Power User 🔴
- No keyboard shortcut for primary action
- Table lacks bulk selection

#### First-Time User 🟡
- CTA is clear but secondary options are confusing

#### Accessibility-Dependent User 🔴
- Color-only status indicators (red/green dots)

#### Stressed User 🟢
- Confirmation dialog on destructive actions ✓

#### Mobile-Only User 🟡
- Settings buried 3 levels deep

### Top Recommendations
1. {Priority-ordered design improvements}
```

## Preparation

Before running the critique:

1. **Read** `.claude/vibe/design-context.json`
   - If missing → display: "Run `/design-teach` first for better results" → proceed with defaults
   - If parse error → display warning → proceed with defaults → recommend `/design-teach`
   - If present → adjust persona priorities by `audience.primary` and `audience.expertise`
2. **Read** brand personality to calibrate aesthetic expectations

## Next Steps

| If Result Shows | Recommended Next |
|----------------|-----------------|
| Visual complexity / clutter | `/design-distill` — remove unnecessary elements |
| Token inconsistencies noted | `/design-normalize` — align to design system |
| Good overall, minor polish needed | `/design-polish` — final pass |

## Important

- **Read-only**: Produces design critique report. No code modifications.
- **Context-aware**: Uses `.claude/vibe/design-context.json` for brand/audience context if available.
- **Complementary**: Pairs with `/design-audit` (technical) — critique focuses on UX quality.
