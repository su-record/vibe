---
name: wcag-checklist
type: framework
applies-to: [design-audit]
standard: WCAG 2.1 AA
---

# WCAG 2.1 AA — Key Criteria Reference Card

## Perceivable

| Criterion | Level | Requirement | Test |
|-----------|-------|-------------|------|
| 1.1.1 Non-text Content | A | All images have `alt` text | Check `<img>` for `alt` attribute |
| 1.3.1 Info and Relationships | A | Structure conveyed via markup (headings, lists, labels) | Heading hierarchy is logical |
| 1.3.3 Sensory Characteristics | A | Instructions don't rely on shape/color/location alone | "Click the red button" → add label |
| 1.4.1 Use of Color | A | Color not the only means of conveying information | Error state uses icon + color |
| 1.4.3 Contrast (Minimum) | AA | Text ≥ 4.5:1, large text ≥ 3:1 | Use contrast checker |
| 1.4.4 Resize Text | AA | Text resizable to 200% without loss of content | Test at 200% browser zoom |
| 1.4.10 Reflow | AA | Content reflows at 320px width without horizontal scroll | Test at 320px viewport |
| 1.4.11 Non-text Contrast | AA | UI components ≥ 3:1 against adjacent colors | Buttons, inputs, focus rings |
| 1.4.12 Text Spacing | AA | No content loss with: line-height 1.5, letter-spacing 0.12em | Apply via user stylesheet |
| 1.4.13 Content on Hover | AA | Hover/focus content dismissible, hoverable, persistent | Tooltips must stay on hover |

## Operable

| Criterion | Level | Requirement | Test |
|-----------|-------|-------------|------|
| 2.1.1 Keyboard | A | All functionality available via keyboard | Tab through all interactions |
| 2.1.2 No Keyboard Trap | A | Focus not trapped (except modals — must have escape) | Press Escape in all overlays |
| 2.4.1 Bypass Blocks | A | Skip-to-content link or landmark navigation | First focusable = skip link |
| 2.4.3 Focus Order | A | Focus order preserves meaning and operability | Tab order matches visual flow |
| 2.4.4 Link Purpose | A | Link purpose clear from link text or context | Avoid "click here", "read more" |
| 2.4.6 Headings and Labels | AA | Headings and labels are descriptive | No generic "Section 1" headings |
| 2.4.7 Focus Visible | AA | Keyboard focus indicator is visible | No `outline: none` without replacement |

## Understandable

| Criterion | Level | Requirement | Test |
|-----------|-------|-------------|------|
| 3.1.1 Language of Page | A | `lang` attribute on `<html>` | Check `<html lang="en">` |
| 3.2.1 On Focus | A | Focus doesn't trigger context change | No auto-submit on focus |
| 3.2.2 On Input | A | Input change doesn't auto-navigate without warning | Select menus don't auto-submit |
| 3.3.1 Error Identification | A | Errors identified and described in text | Not just red border — include message |
| 3.3.2 Labels or Instructions | A | Labels or instructions for user input | All form fields labeled |
| 3.3.3 Error Suggestion | AA | Suggest fixes when known (e.g., format hints) | "Use format MM/DD/YYYY" |
| 3.3.4 Error Prevention | AA | Legal/financial submissions reversible or confirmable | Confirm before delete |

## Robust

| Criterion | Level | Requirement | Test |
|-----------|-------|-------------|------|
| 4.1.1 Parsing | A | Valid HTML (no duplicate IDs, proper nesting) | Run HTML validator |
| 4.1.2 Name, Role, Value | A | UI components have accessible name, role, state | All custom widgets have ARIA |
| 4.1.3 Status Messages | AA | Status messages programmatically determinable | `role="status"` or `aria-live` |

## Quick Color Contrast Thresholds

| Text Type | Minimum Ratio |
|-----------|--------------|
| Normal text (<18pt / <14pt bold) | 4.5:1 |
| Large text (≥18pt / ≥14pt bold) | 3:1 |
| UI components (borders, icons) | 3:1 |
| Decorative / disabled elements | No requirement |
