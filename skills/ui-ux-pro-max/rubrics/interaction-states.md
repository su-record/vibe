# Required Interaction States Checklist

Every interactive element must implement all applicable states. Missing states are P1–P2 findings.

---

## State Definitions

| State | Trigger | Visual Requirement | ARIA Requirement |
|-------|---------|-------------------|-----------------|
| **Default** | No user interaction | Base appearance defined with sufficient contrast | — |
| **Hover** | Mouse enters element | Visible color, shadow, or opacity change | — |
| **Focus** | Keyboard navigation / tab | Clearly visible focus ring (≥ 2px, non-color-only) | — |
| **Active / Pressed** | Mouse down or tap | Distinct from hover (darker, scale-down, or depressed look) | `aria-pressed` on toggles |
| **Disabled** | Element not actionable | Reduced opacity (≤ 50%) + `cursor: not-allowed` | `disabled` attr or `aria-disabled="true"` |
| **Loading** | Async operation in progress | Spinner, skeleton, or progress bar replaces or overlays content | `aria-busy="true"` |
| **Error** | Validation fails or operation fails | Error color on border/background + error message visible | `aria-invalid="true"` + `aria-describedby` pointing to error |
| **Success** | Operation completes | Confirmation feedback (color change, checkmark, toast) | `aria-live` announcement |

---

## Element-State Matrix

Use this matrix to verify each element type has all required states implemented.

| Element | Default | Hover | Focus | Active | Disabled | Loading | Error | Success |
|---------|---------|-------|-------|--------|----------|---------|-------|---------|
| Button (primary) | Required | Required | Required | Required | Required | Required | — | — |
| Button (destructive) | Required | Required | Required | Required | Required | Required | — | — |
| Link | Required | Required | Required | Required | — | — | — | — |
| Text input | Required | Optional | Required | — | Required | — | Required | Optional |
| Select / dropdown | Required | Required | Required | — | Required | — | Required | — |
| Checkbox | Required | Required | Required | Required | Required | — | — | — |
| Radio button | Required | Required | Required | Required | Required | — | — | — |
| Toggle / switch | Required | Required | Required | Required | Required | — | — | — |
| Form submit button | Required | Required | Required | Required | Required | Required | — | Required |
| Card (interactive) | Required | Required | Required | — | — | Required | — | — |
| Tab | Required | Required | Required | Required | Required | — | — | — |
| Menu item | Required | Required | Required | Required | Required | — | — | — |
| Icon button | Required | Required | Required | Required | Required | Required | — | — |

---

## Implementation Checklist

### Hover
- [ ] Color change uses a dedicated hover token (not inline opacity hack)
- [ ] Transition applied (`transition-colors duration-150` or equivalent)
- [ ] Layout does not shift on hover (no margin/padding changes)

### Focus
- [ ] Focus ring visible at 2:1 contrast against adjacent color
- [ ] `outline: none` never used without a custom focus-visible replacement
- [ ] `:focus-visible` used instead of `:focus` to avoid visible ring on mouse click

### Active / Pressed
- [ ] Distinct visual from hover state
- [ ] `scale(0.97–0.98)` or darker color on press — not just removing hover
- [ ] Touch devices: active state triggers on `touchstart`

### Disabled
- [ ] `opacity: 0.4–0.5` on disabled elements
- [ ] `pointer-events: none` prevents interaction
- [ ] `cursor: not-allowed` set
- [ ] `disabled` attribute or `aria-disabled="true"` set on element
- [ ] Disabled state does not rely on color alone

### Loading
- [ ] Original button/element width preserved during loading (no layout jump)
- [ ] Spinner or skeleton shown within 100ms of action trigger
- [ ] Interaction re-enabled after completion or error
- [ ] `aria-busy="true"` set on loading container

### Error
- [ ] Error message visible near the element (not just a global toast)
- [ ] Error styling uses `--color-error` token
- [ ] `aria-invalid="true"` set on invalid input
- [ ] Error message linked via `aria-describedby`

### Success
- [ ] Confirmation feedback shown within 300ms of completion
- [ ] Success message auto-dismisses or provides clear dismiss action
- [ ] `aria-live="polite"` region announces success to screen readers
