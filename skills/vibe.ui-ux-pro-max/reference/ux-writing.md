# UX Writing Reference Guide

Practical patterns for writing UI copy that reduces friction, builds trust, and works across languages and contexts.

---

## Button Labels

Buttons are the primary call-to-action in any interface. Weak labels create hesitation; strong labels create momentum.

**The pattern: verb + object.** Tell users exactly what will happen when they click.

| Weak | Strong |
|------|--------|
| Submit | Save Profile |
| OK | Confirm Booking |
| Yes | Delete Account |
| Update | Change Password |
| Continue | Go to Checkout |

The verb signals the action type. The object anchors it to the current context. Together they eliminate ambiguity.

**DO / DON'T**

DO: Match the button label to the consequence.
```html
<!-- Destructive action: label mirrors the destruction -->
<button class="btn-danger">Delete Project</button>

<!-- Constructive action: label mirrors the creation -->
<button class="btn-primary">Create Project</button>
```

DON'T: Use generic labels that could mean anything.
```html
<!-- "OK" — OK to what? OK means nothing. -->
<button>OK</button>

<!-- "Submit" — submit what? to where? -->
<button>Submit</button>
```

DO: Reflect form field context in the CTA.
- A profile editing form ends with `Save Changes`, not `Submit`
- A payment form ends with `Pay $29.00`, not `Continue`
- A search form ends with `Search Flights`, not `Go`

DON'T: Use the same label on two buttons in the same dialog unless their actions are identical.

**Disabled states:** When a button is disabled, a nearby hint should explain why. "Save Changes (fill in required fields first)" is more useful than a greyed-out button with no explanation.

---

## Error Messages

Error messages are moments of failure — but they don't have to feel like failure. The formula is three parts:

1. **What went wrong** — one plain sentence, no jargon
2. **Why it happened** — context that helps the user understand, not blame
3. **How to fix it** — a concrete, actionable next step

**Examples:**

Validation error:
```
Your password is too short.
Passwords must be at least 8 characters.
Add more characters and try again.
```

Network error:
```
We couldn't save your changes.
Your connection dropped while saving.
Check your internet connection and click Save again.
```

Permission error:
```
You can't delete this project.
Only the project owner can delete it.
Contact the owner or ask them to transfer ownership to you.
```

**DO / DON'T**

DO: Use plain language. Avoid codes, stack traces, or internal terminology in user-facing messages.
```
// Good
"That email address is already in use. Sign in instead, or use a different email."

// Bad
"Error 409: Unique constraint violation on users.email"
```

DON'T: Blame the user. Passive or neutral framing is almost always better.
```
// Blaming
"You entered an invalid date."

// Neutral
"That date doesn't match our format. Use MM/DD/YYYY — for example, 03/31/2026."
```

DO: Keep error messages close to the problem. Inline field validation errors should appear next to the field, not in a modal.

DON'T: Use vague apologies as a substitute for explanation.
```
// Vague
"Something went wrong. Please try again."

// Informative
"Your file couldn't upload. Files must be under 10 MB. This file is 14 MB."
```

DO: For recoverable errors, include a recovery action in or near the message.
```html
<div class="error-message" role="alert">
  <p>Session expired. Your changes weren't saved.</p>
  <button onclick="restoreSession()">Restore session</button>
</div>
```

---

## Empty States

An empty state is not just the absence of content — it is an opportunity to orient the user and motivate action. Every empty state needs two things: an explanation of why it's empty, and a clear path forward.

**Structure:**

1. A heading that describes the situation (not "No items found")
2. One or two sentences of context
3. A primary CTA that starts the relevant action

**Examples:**

```
No projects yet
Projects you create or join will appear here.
[Create your first project]
```

```
Your inbox is empty
You're all caught up! New messages from teammates will show up here.
[Browse channels]
```

```
No results for "darkmode settings"
Try searching for "appearance" or "theme" instead.
[Clear search]
```

**DO / DON'T**

DO: Write empty state headings from the user's perspective, not the system's.
```
// System-centric (avoid)
"No records exist"

// User-centric (prefer)
"You haven't added any contacts yet"
```

DON'T: Leave empty states with just an icon and no text. Icons alone don't explain context or provide direction.

DO: Tailor CTAs to the specific empty state. The CTA for an empty contacts list should open a "Add Contact" form, not a generic "Get Started" page.

DON'T: Use the same empty state copy for every list or table in the application. Each surface has a different context.

---

## Confirmation Dialogs

Confirmation dialogs interrupt the user to verify intent before a significant action. The copy must be specific enough that the user understands exactly what they are confirming — and the buttons must make the choice unambiguous.

**Button rule: use action verbs, never Yes/No/OK.**

| Weak | Strong |
|------|--------|
| Yes / No | Delete / Keep |
| OK / Cancel | Remove Member / Keep Member |
| Confirm / Cancel | Archive Project / Go Back |
| Yes / Cancel | Log Out / Stay Signed In |

**Dialog structure:**

- **Title:** State the action, not a question. "Delete this project?" not "Are you sure?"
- **Body:** Describe consequences. What will be lost? Is it reversible?
- **Primary button:** Destructive action in destructive styling
- **Secondary button:** Safe exit, using specific language

```html
<dialog aria-labelledby="dialog-title" aria-describedby="dialog-desc">
  <h2 id="dialog-title">Delete "Q1 Campaign"?</h2>
  <p id="dialog-desc">
    This will permanently delete the project and all 14 assets inside it.
    This action cannot be undone.
  </p>
  <div class="dialog-actions">
    <button class="btn-secondary">Keep Project</button>
    <button class="btn-danger">Delete Project</button>
  </div>
</dialog>
```

**DO / DON'T**

DO: Be specific about what is being deleted/changed/sent. "Delete 14 files" is clearer than "Delete selected items."

DON'T: Use "Are you sure?" as the dialog title. It adds no information the user doesn't already have.

DO: Place the safe option (cancel/keep) before the destructive option in reading order. This reduces accidental confirmations.

DON'T: Use identical styling for both buttons. The destructive action should be visually distinct — typically a danger/red variant.

---

## Voice vs Tone

**Voice** is permanent. It is the brand's personality — the consistent character that shows up in every piece of copy regardless of context. Define it with three to five adjectives and concrete examples.

Example voice definition:
```
Direct: We say what we mean without filler. "Save" not "Go ahead and save your progress."
Warm: We write to people, not at them. "You're all set" not "Operation successful."
Clear: We prefer plain words over jargon. "Connected" not "Authenticated."
```

**Tone** is situational. The same brand voice adapts its tone to match the emotional context:

| Situation | Tone Adjustment | Example |
|-----------|-----------------|---------|
| Success | Warm, celebratory | "Payment received. See you on the other side." |
| Error | Calm, solution-focused | "That didn't work. Here's what to try next." |
| Onboarding | Encouraging, guiding | "Let's set up your workspace — takes about 2 minutes." |
| Warning | Direct, informative | "You're about to replace 12 files. This can't be undone." |
| Deletion | Neutral, factual | "This project has been deleted." |

**DO / DON'T**

DO: Write a voice chart and share it with every contributor who writes UI copy.

DON'T: Let tone bleed into the wrong context. Humor and celebration are wrong for error states. Formality is wrong for success toasts.

DO: Treat success messages and error messages as different tonal registers, not just different content.

DON'T: Confuse personality with friendliness. A brand can be serious and still have a consistent, recognizable voice.

---

## Translation Expansion

UI copy expands and contracts in translation. Ignoring this creates broken layouts in other languages.

**Expansion rules of thumb:**

| Language | Change vs English |
|----------|-------------------|
| German | +30% to +40% |
| French | +20% to +30% |
| Spanish | +20% to +30% |
| Russian | +20% to +30% |
| Japanese | -10% to -30% |
| Chinese (Simplified) | -20% to -30% |
| Korean | -10% to -20% |

"Save Changes" in English becomes "Änderungen speichern" in German — 30% longer. Design for the expansion, not the English string.

**Layout patterns that handle i18n gracefully:**

```css
/* Avoid fixed-width buttons — they clip translated text */
.btn {
  /* Bad */
  width: 120px;

  /* Good */
  min-width: 120px;
  padding: 0.5rem 1.25rem;
  width: auto;
}

/* Avoid fixed-height containers for label + description combos */
.form-field-label {
  /* Bad */
  height: 1.5rem;
  overflow: hidden;

  /* Good */
  min-height: 1.5rem;
  height: auto;
}
```

**DO / DON'T**

DO: Design with German text as a stress test for button and label widths.

DON'T: concatenate translated strings to build sentences. Word order differs across languages, and concatenation breaks in many of them.
```javascript
// Bad — word order is language-specific
const label = t('delete') + ' ' + itemName;

// Good — pass variables into a full translated string
const label = t('delete_item', { name: itemName });
// en: "Delete Project Alpha"
// de: "Projekt Alpha löschen"
```

DO: Use a translation key system that supports plurals and variable interpolation natively (ICU message format or equivalent).

DON'T: hard-code units, currency symbols, or date separators alongside translated strings. Treat these as formatting concerns, not translation concerns.

---

## Microcopy

Microcopy covers the small, functional copy that guides users through forms and interactions: tooltips, placeholders, help text, validation hints, and loading messages.

**Tooltips:**
- Appear on hover or focus for icon-only controls
- One sentence maximum
- Describe what the button does, not what it is
```html
<!-- Icon button with tooltip -->
<button aria-label="Share document" data-tooltip="Share a link to this document">
  <Icon name="share" />
</button>
```

**Placeholders:**
- Show example input, not instructions
- Never use placeholders as a substitute for labels — they disappear on focus
```html
<!-- Bad: instruction as placeholder -->
<input placeholder="Enter your email address" />

<!-- Good: example as placeholder, label above -->
<label for="email">Email</label>
<input id="email" placeholder="name@example.com" />
```

**Help text:**
- Place below the input, above the error zone
- Explain constraints the user needs before they start typing, not after they fail
```html
<label for="username">Username</label>
<input id="username" aria-describedby="username-hint" />
<p id="username-hint" class="field-hint">
  3–20 characters. Letters, numbers, and underscores only.
</p>
```

**Loading messages:**
- Progress over time: vary the message if loading takes more than 3 seconds
- Avoid "Loading..." alone — describe what is loading
```javascript
const loadingMessages = [
  'Loading your projects...',
  'Almost there...',
  'This is taking longer than usual — still working...',
];
```

**DO / DON'T**

DO: Write help text before the fact (constraints), not after (error explanation). "Must be at least 8 characters" belongs in help text, not only in an error message.

DON'T: use placeholder text as the only label for a form field. It fails accessibility requirements and disappears as soon as the user starts typing.

---

## Number and Date Formatting

Hard-coded number and date formats break in other locales. The `Intl` API handles locale-aware formatting without manual string construction.

**Numbers:**

```javascript
// Currency
const price = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(1299.99);
// → "$1,299.99"

const priceDE = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
}).format(1299.99);
// → "1.299,99 €"

// Large numbers with grouping
const count = new Intl.NumberFormat('en-US').format(1000000);
// → "1,000,000"

// Compact notation for space-constrained UI
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(14500);
// → "14.5K"
```

**Dates:**

```javascript
const date = new Date('2026-03-31');

// Full date, locale-aware
const fullDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(date);
// → "March 31, 2026"

// Short format for tables
const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
}).format(date);
// → "Mar 31"

// Relative time (use with a wrapper)
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
rtf.format(-1, 'day');   // → "yesterday"
rtf.format(-3, 'day');   // → "3 days ago"
rtf.format(1, 'week');   // → "next week"
```

**DO / DON'T**

DO: Accept locale as a parameter derived from the user's browser or account settings. Never hard-code `'en-US'` throughout the codebase.
```javascript
function formatCurrency(amount: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
```

DON'T: Build date strings by manually concatenating month names and separators.
```javascript
// Bad — breaks in non-English locales, fragile
const label = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

// Good — locale-aware, handles all edge cases
const label = new Intl.DateTimeFormat(userLocale, { dateStyle: 'long' }).format(date);
```

DO: Use ISO 8601 (`YYYY-MM-DD`) for data storage and API payloads. Reserve `Intl` formatting for display only.

DON'T: assume 12-hour clock. Many locales default to 24-hour. Let `Intl.DateTimeFormat` resolve clock format from locale rather than forcing `hour12: true`.

```javascript
// Locale-appropriate clock format
const time = new Intl.DateTimeFormat(userLocale, {
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date());
// en-US → "2:45 PM"
// de-DE → "14:45"
```

---

*Last updated: 2026-03. Maintained as part of the ui-ux-pro-max skill package.*
