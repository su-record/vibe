# Design Polish — Final Pass Checklist

Detailed criteria for each polish category. Each item is binary: pass or fail with a file:line reference.

---

## 1. Micro-Interactions

| Item | Pass Criteria | Fail Signal |
|------|--------------|-------------|
| Button hover | Color or shadow change within 150–300ms | No change, or change > 500ms |
| Button active/pressed | Slight scale-down (`scale(0.97)`) or color shift | No pressed state |
| Link hover | Underline or color change on entry | No visual feedback |
| Input focus | Border color change + visible focus ring | Ring missing or `outline: none` with no substitute |
| Toggle/switch | Smooth slide transition (200ms) | Instant jump with no transition |
| Checkbox/radio | Fill animation or check animation on select | Instant state change only |
| Toast/notification | Fade-in entry, fade-out dismiss (200–300ms) | Instant appear/disappear |
| Dropdown open | Fade + slight translate-y on open | No entry animation |

---

## 2. Spacing & Alignment

| Item | Pass Criteria | Fail Signal |
|------|--------------|-------------|
| Grid alignment | All elements snap to 4px or 8px grid | Arbitrary values like `13px`, `22px`, `37px` |
| Section rhythm | Consistent vertical spacing between sections | Different gaps between visually equivalent sections |
| Icon-text alignment | Icons vertically centered with adjacent text label | Icon top-aligned with multi-line text (unless intentional) |
| Container padding | Symmetric horizontal padding unless intentional asymmetry | Left padding ≠ right padding without justification |
| Card internal spacing | Same padding token used for all cards of same level | One card uses `p-4`, adjacent uses `p-6` |
| List item gaps | Consistent gap between items | First item has different spacing than rest |

---

## 3. Typography Refinements

| Item | Pass Criteria | Fail Signal |
|------|--------------|-------------|
| No orphaned words | Last line of heading has ≥ 2 words | Single word dangling on its own line |
| Capitalization | Consistent Title Case or sentence case per element type | Mix of styles on same element type |
| No placeholder copy | All text is real content | "Lorem ipsum", "placeholder", "TODO", "test text" present |
| Overflow truncation | Long text uses `text-overflow: ellipsis` with `overflow: hidden` | Text overflows container or wraps unpredictably |
| Line length | Body text ≤ 75 characters wide | Wide blocks of text with no max-width constraint |
| Heading hierarchy | Visual size matches semantic level (`h1` > `h2` > `h3`) | `h2` styled larger than `h1`, or heading levels skipped |

---

## 4. Visual Consistency

| Item | Pass Criteria | Fail Signal |
|------|--------------|-------------|
| Border radius | Same-level cards and inputs share identical radius token | Card uses `rounded-lg`, adjacent input uses `rounded-md` |
| Shadow elevation | Shadow depth increases with z-index elevation | Modals (high elevation) have less shadow than cards |
| Icon size | Icons within same context use one of: 16/20/24px | Mix of 14px, 18px, 22px icons in the same component |
| Color semantics | Red = error/danger, Green = success, Yellow = warning consistently | Success toast is blue, error badge is orange |
| Empty states | All empty states have an icon or illustration + message + CTA | Some empty states show only "No data" text |

---

## 5. Code Cleanliness

| Item | Pass Criteria | Fail Signal |
|------|--------------|-------------|
| No console.log | Zero `console.log` calls in UI files | Any `console.log` in production code paths |
| No commented code | No commented-out JSX or HTML blocks | `{/* <OldButton /> */}` style remnants |
| z-index discipline | No `z-index` > 100 without a comment explaining the reason | `z-index: 9999` or `z-index: 99999` |
| No inline styles | Presentation values use classes or tokens | `style={{ color: '#3B82F6', padding: '16px' }}` on component |
| No dead CSS | No class names defined but never applied | Classes in stylesheet with zero matches in templates |
