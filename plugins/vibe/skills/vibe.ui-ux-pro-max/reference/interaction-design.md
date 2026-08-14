# Interaction Design Reference

Deep reference for building interactive UI that is accessible, predictable, and polished. Covers the full lifecycle of a component's states, focus handling, form behavior, overlays, menus, touch targets, and loading feedback.

---

## 8 Interactive States

Every interactive element must account for eight distinct states. Missing even one breaks accessibility or trust.

### State Definitions and Implementation

**Default** — the element at rest. Provide enough visual affordance that the user knows it is interactive. Borders, shadows, and color contrast carry this signal.

**Hover** — pointer is over the element but not pressed. Communicate interactivity with a cursor change and a subtle visual shift. Never rely on hover alone to reveal essential UI.

**Focus** — keyboard or programmatic focus. Must be visible at all times for keyboard users. Use `:focus-visible` so mouse users are not shown an outline on click.

**Active** — element is being pressed (mousedown / touchstart). Provide immediate feedback: a slight scale-down or darker background confirms the press registered.

**Disabled** — element exists but cannot be interacted with. Reduce opacity, change cursor to `not-allowed`, and remove from tab order with `disabled` attribute (not just `aria-disabled`).

**Loading** — action has been triggered and the system is working. Replace interactive content with a spinner or skeleton. Disable the trigger to prevent double-submission.

**Error** — the action failed or input is invalid. Show a message in red near the source. Use `aria-describedby` to associate the message with the input.

**Success** — the action completed. Provide a brief confirmation (green checkmark, toast, inline message). Auto-dismiss non-critical confirmations after 3–5 seconds.

```tsx
// Button covering all 8 states
type ButtonState = 'default' | 'loading' | 'error' | 'success';

interface ButtonProps {
  label: string;
  state?: ButtonState;
  disabled?: boolean;
  onClick: () => void;
}

export function Button({ label, state = 'default', disabled = false, onClick }: ButtonProps) {
  const isLoading = state === 'loading';
  const isDisabled = disabled || isLoading;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={[
        'btn',
        `btn--${state}`,
        isDisabled ? 'btn--disabled' : '',
      ].join(' ')}
    >
      {isLoading ? <Spinner size={16} /> : label}
    </button>
  );
}
```

```css
.btn {
  cursor: pointer;
  transition: background 120ms ease, transform 80ms ease, opacity 120ms ease;
}
.btn:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled, .btn--disabled { opacity: 0.4; cursor: not-allowed; }
.btn--error { border-color: var(--color-error); color: var(--color-error); }
.btn--success { background: var(--color-success); }
```

### DO / DON'T

- DO define all 8 states in your design system before building components.
- DO use CSS custom properties so states share a single token source.
- DON'T use `pointer-events: none` as the sole disabled mechanism — it does not remove the element from tab order.
- DON'T rely on color alone to communicate state — pair color with an icon or label change.
- DON'T skip the active state; it is the only immediate feedback on slow networks.

---

## Focus Management

### Visible Focus Indicators

The browser default outline is intentionally visible. Never remove it without replacing it.

```css
/* Wrong: removes focus for everyone */
*:focus { outline: none; }

/* Correct: hides outline on mouse click, keeps it for keyboard */
*:focus-visible {
  outline: 2px solid var(--color-focus, #0066cc);
  outline-offset: 2px;
  border-radius: 2px;
}
```

A minimum 3:1 contrast ratio between the focus indicator and adjacent colors is required by WCAG 2.2 (Success Criterion 2.4.11).

### Skip Links

The first focusable element on every page must be a skip link that jumps past repeated navigation.

```tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="skip-link"
    >
      Skip to main content
    </a>
  );
}
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  z-index: 9999;
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  border: 2px solid var(--color-focus);
}
.skip-link:focus { top: 1rem; }
```

### Programmatic Focus Management

When content changes dynamically — modal opens, error appears, route changes — move focus deliberately.

```tsx
import { useEffect, useRef } from 'react';

function ErrorMessage({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="error-message"
    >
      {message}
    </div>
  );
}
```

### DO / DON'T

- DO use `:focus-visible` exclusively — never `:focus` for visual indicators.
- DO include a skip link as the first interactive element on every page.
- DON'T use `tabIndex` values above 0; they break the natural tab order.
- DON'T move focus on scroll or hover — only move it in response to user-initiated actions.

---

## Form Design

### Labels Are Non-Negotiable

Every input requires a visible, persistent label. Placeholder text is not a label — it disappears on input and has low contrast.

```tsx
interface FieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
}

export function TextField({ id, label, error, required, ...inputProps }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span aria-hidden="true" className="field__required"> *</span>}
      </label>
      <input
        id={id}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
        aria-required={required}
        className={`field__input ${error ? 'field__input--error' : ''}`}
        {...inputProps}
      />
      {error && (
        <p id={errorId} role="alert" className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Inline Validation Timing

Validate on blur (when the user leaves the field), not on every keystroke. Re-validate on change after the first error is shown. This prevents premature errors while still giving fast feedback.

```tsx
function useFieldValidation(validate: (v: string) => string | undefined) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (touched) setError(validate(e.target.value));
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validate(value));
  };

  return { value, error, handleChange, handleBlur };
}
```

### Submit Button States

The submit button must reflect loading and result states to prevent double-submission.

```tsx
type SubmitState = 'idle' | 'submitting' | 'submitted' | 'error';

function SubmitButton({ state }: { state: SubmitState }) {
  const labels: Record<SubmitState, string> = {
    idle: 'Submit',
    submitting: 'Submitting…',
    submitted: 'Submitted',
    error: 'Try again',
  };
  return (
    <button type="submit" disabled={state === 'submitting'} aria-busy={state === 'submitting'}>
      {labels[state]}
    </button>
  );
}
```

### DO / DON'T

- DO place error messages directly below the relevant field, not in a summary at the top.
- DO use `aria-describedby` to associate the error with the input programmatically.
- DON'T use placeholder text as a substitute for labels.
- DON'T validate on every keystroke for the first visit to a field.
- DON'T disable the submit button before the user attempts submission — let them try and show specific errors.

---

## Modal Patterns

### Focus Trap

When a modal opens, focus must stay inside it. Tabbing past the last focusable element wraps back to the first.

```tsx
import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', trap);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', trap);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="modal"
      >
        {children}
      </div>
    </>
  );
}
```

### Scroll Lock

Prevent the page from scrolling behind an open modal.

```css
body.modal-open {
  overflow: hidden;
  /* Compensate for scrollbar width to prevent layout shift */
  padding-right: var(--scrollbar-width, 0);
}
```

### DO / DON'T

- DO return focus to the trigger element when the modal closes.
- DO lock scroll on `<body>` when a modal is open.
- DON'T make backdrop click the only way to close — always support Escape.
- DON'T autofocus a destructive action (e.g., "Delete") as the first focusable element.

---

## Dropdown and Menu Patterns

### Keyboard Navigation

ARIA `menu` and `menuitem` roles carry expected keyboard contracts: arrow keys move between items, Enter/Space activate, Escape closes, and Home/End jump to first/last.

```tsx
function useMenuKeyboard(items: HTMLElement[], onClose: () => void) {
  return (e: React.KeyboardEvent) => {
    const current = document.activeElement as HTMLElement;
    const idx = items.indexOf(current);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Escape':
        onClose();
        break;
    }
  };
}
```

### Typeahead Search

Users expect to type a letter to jump to the matching item in a list.

```tsx
function useTypeahead(items: string[]) {
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  return (key: string): number => {
    clearTimeout(timer.current);
    buffer.current += key.toLowerCase();
    timer.current = setTimeout(() => { buffer.current = ''; }, 500);
    return items.findIndex(item => item.toLowerCase().startsWith(buffer.current));
  };
}
```

### Anchor Positioning

Position the dropdown below its trigger by default. Flip above if there is not enough viewport space below.

```css
.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  z-index: var(--z-dropdown, 100);
}
```

### DO / DON'T

- DO implement full arrow-key navigation in every menu and listbox.
- DO support typeahead in long lists (more than 7 items).
- DON'T close the menu on blur from any item — close only when focus leaves the entire menu widget.
- DON'T open a dropdown on hover for primary navigation; hover reveals are invisible to keyboard and touch users.

---

## Touch Targets

### Minimum Size Requirements

WCAG 2.5.5 (Level AAA) and WCAG 2.5.8 (Level AA, 2.2) require a minimum 24×24px target size with adequate spacing. Apple HIG and Material Design both recommend 44×44px as a practical minimum.

```css
.touch-target {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

When the visual element must be smaller (e.g., a 16px icon), expand the hit area with padding or a pseudo-element.

```css
.icon-button {
  position: relative;
  width: 20px;
  height: 20px;
}
.icon-button::before {
  content: '';
  position: absolute;
  inset: -12px; /* extends 12px on each side → 44px total */
}
```

### Spacing Between Targets

Adjacent targets need at least 8px of gap so accidental activation is unlikely.

```css
.toolbar {
  display: flex;
  gap: 8px;
}
```

### DO / DON'T

- DO expand hit areas with padding or pseudo-elements rather than enlarging the visual element.
- DO maintain at least 8px spacing between adjacent interactive elements.
- DON'T place two destructive actions (e.g., "Delete" and "Archive") adjacent with minimal spacing.
- DON'T measure touch targets by their visual size — measure the actual interactive area.

---

## Loading Patterns

### Choosing the Right Pattern

Three loading patterns serve different situations.

**Skeleton screens** — use when you know the shape of the incoming content (a card, a table row, a list). They set accurate spatial expectations and feel faster because they show structure immediately.

**Spinners** — use when you do not know the shape of the result (a search, a file upload) or when the operation is fast enough (under 300ms) that a skeleton would flash.

**Progress bars** — use only when you have a real percentage to report (file upload, batch processing). A fake animated progress bar is worse than a spinner because it lies to the user.

```tsx
function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton--avatar" />
      <div className="skeleton skeleton--line skeleton--line-80" />
      <div className="skeleton skeleton--line skeleton--line-60" />
    </div>
  );
}
```

```css
@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position:  200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-skeleton-base) 25%,
    var(--color-skeleton-highlight) 50%,
    var(--color-skeleton-base) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease infinite;
  border-radius: 4px;
}
```

### Announcing Loading State to Screen Readers

```tsx
function LoadingRegion({ isLoading, children }: { isLoading: boolean; children: React.ReactNode }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading ? <SkeletonCard /> : children}
    </div>
  );
}
```

### DO / DON'T

- DO use skeleton screens for content with a known layout.
- DO add `aria-busy="true"` and `aria-live="polite"` to regions that load asynchronously.
- DON'T use a fake animated progress bar that does not reflect real progress.
- DON'T show a spinner for operations that complete in under 100ms — the flash is disorienting.
- DON'T leave a spinner visible indefinitely without a timeout and an error fallback.
