# Nielsen's 10 Usability Heuristics — Code Review Adaptation

Scoring per heuristic: 0 (violated) → 4 (excellent). Focus on what is observable in the code.

---

## H1 — Visibility of System Status

**What to look for in code**: Loading states on async actions, progress indicators, state-driven class/attribute changes, `aria-live` regions for dynamic content.

| Score | Code Evidence |
|-------|---------------|
| **4** | Every async action has a loading state; progress shown for multi-step ops; dynamic regions use `aria-live` |
| **3** | Most async actions covered; 1 operation missing feedback |
| **2** | Loading states on primary actions only; secondary actions have no feedback |
| **1** | Only a spinner on page load; form submissions and mutations give no feedback |
| **0** | No loading states anywhere; UI freezes silently on async calls |

---

## H2 — Match Between System and Real World

**What to look for**: Label copy, icon choices, terminology in component props and display text, logical grouping of related items.

| Score | Code Evidence |
|-------|---------------|
| **4** | All labels use user-facing language (not internal field names); icons are universally understood; groupings match mental models |
| **3** | Mostly natural language; 1–2 developer-facing terms exposed in UI |
| **2** | Mixed: some labels match user expectations, others use internal/technical terminology |
| **1** | Predominantly technical labels (`user_id`, `ts`, `ref_code`) in visible UI |
| **0** | Raw API field names or database column names exposed directly to users |

---

## H3 — User Control and Freedom

**What to look for**: Cancel buttons on dialogs and forms, undo functionality, ability to navigate back, escape-to-close on modals.

| Score | Code Evidence |
|-------|---------------|
| **4** | Undo available for destructive actions; all modals closeable via Escape; cancel on all multi-step flows |
| **3** | Most paths have exits; one flow lacks a clear back/cancel |
| **2** | Cancel exists on modals but destructive actions (delete, submit) have no undo |
| **1** | No undo; several flows trap the user until completion |
| **0** | Irreversible destructive actions with no confirmation or recovery path |

---

## H4 — Consistency and Standards

**What to look for**: Reuse of shared components, consistent prop naming, same action always produces same UI response, platform conventions followed.

| Score | Code Evidence |
|-------|---------------|
| **4** | Shared component library used throughout; same action triggers same visual pattern; follows platform HIG |
| **3** | 1–2 inconsistencies (e.g., one custom button not using Button component) |
| **2** | Some shared components but several one-off implementations for identical patterns |
| **1** | Each page re-implements its own UI patterns; no shared components |
| **0** | Same action produces visually different results on different screens |

---

## H5 — Error Prevention

**What to look for**: Input validation (inline, not just on submit), confirmation dialogs on destructive actions, disabled states on invalid forms, input constraints (maxLength, type, pattern).

| Score | Code Evidence |
|-------|---------------|
| **4** | Inline validation; destructive actions confirmed; submit disabled until valid; input types constrain input |
| **3** | Confirmation dialogs present; validation on submit but not inline |
| **2** | Some validation; destructive actions have confirmation but forms don't validate until submit |
| **1** | No inline validation; destructive actions unconstrained |
| **0** | No validation or confirmation; data loss possible without warning |

---

## H6 — Recognition Rather Than Recall

**What to look for**: Breadcrumbs, visible current state in navigation, contextual help text, search suggestions, recently used items.

| Score | Code Evidence |
|-------|---------------|
| **4** | Current location always visible; options surfaced in context; search includes suggestions |
| **3** | Navigation shows current state; options visible on primary flows |
| **2** | Some affordances; secondary flows require user to remember where they are |
| **1** | No breadcrumbs; navigation doesn't indicate current section; users must recall paths |
| **0** | Deep nested flows with no orientation cues |

---

## H7 — Flexibility and Efficiency

**What to look for**: Keyboard shortcuts, bulk actions, saved defaults, power-user paths that bypass multi-step flows.

| Score | Code Evidence |
|-------|---------------|
| **4** | Keyboard shortcuts for primary actions; bulk selection; smart defaults pre-populated |
| **3** | Good defaults; 1–2 keyboard shortcuts on critical actions |
| **2** | No shortcuts; forms have some defaults but key fields are always blank |
| **1** | Every task requires the same number of steps regardless of user expertise |
| **0** | Power users actively slowed down (e.g., forced onboarding on repeat visits) |

---

## H8 — Aesthetic and Minimalist Design

**What to look for**: Signal-to-noise ratio in rendered output; unnecessary decorative elements; information density relative to task complexity.

| Score | Code Evidence |
|-------|---------------|
| **4** | Every visible element serves a task or provides necessary context; no decorative noise |
| **3** | Mostly clean; 1–2 decorative elements that could be removed without loss |
| **2** | Several decorative elements that compete with primary content |
| **1** | UI is visually busy; primary actions compete with decoration |
| **0** | Information overload; users cannot identify primary action without significant scanning |

---

## H9 — Help Users Recognize and Recover from Errors

**What to look for**: Error message copy (specific, human-readable, with next steps), error placement (near the problem), error state styling.

| Score | Code Evidence |
|-------|---------------|
| **4** | Errors are specific, placed next to the problem, and suggest a fix; styled distinctly |
| **3** | Clear error messages; placed correctly; fix suggestion sometimes missing |
| **2** | Error messages exist but are generic ("Something went wrong") or placed in a toast far from the issue |
| **1** | Raw error codes or API messages exposed to users |
| **0** | No error states; failures silently ignored or produce white screens |

---

## H10 — Help and Documentation

**What to look for**: Tooltips on complex fields, onboarding flows for new users, empty states with guidance, contextual help links.

| Score | Code Evidence |
|-------|---------------|
| **4** | Tooltips on non-obvious fields; empty states guide next action; onboarding present for new users |
| **3** | Empty states with calls-to-action; tooltips on some complex fields |
| **2** | Generic empty states ("No data found") without guidance |
| **1** | No tooltips, empty state guidance, or onboarding |
| **0** | Confusing UI with no help and no path to documentation |
