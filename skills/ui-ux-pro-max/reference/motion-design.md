# Motion Design Reference

Animation, transitions, and motion systems for production UI.

---

## Duration Rules

Duration is not aesthetic preference — it is physics. Elements that travel farther should take longer. Small, contained feedback should be instant. Full-page transitions should be deliberate.

### The Three Duration Bands

**Micro (100–150ms):** Immediate feedback for small, contained interactions. Button hover state, checkbox toggle, tooltip appear. The user's hand is on the mouse — any longer feels sluggish.

**Medium (200–300ms):** Standard UI transitions. Dropdowns opening, drawers sliding in, modals appearing, tab switching. This is the default duration for most interactions. 250ms is a reliable default if you have no other data.

**Large (400–500ms):** Full-screen transitions, onboarding flows, complex multi-part animations. Use sparingly. Every millisecond above 300ms requires justification — you are asking the user to wait.

```css
:root {
  --duration-micro: 120ms;
  --duration-medium: 250ms;
  --duration-large: 450ms;
}
```

```tsx
// Tailwind duration classes mapped to the three bands
const DURATION = {
  micro: 'duration-100',    // 100ms
  medium: 'duration-200',   // 200ms (use 250 via arbitrary if needed)
  large: 'duration-500',    // 500ms
} as const;
```

### DO / DON'T

**DO** vary duration based on element size and travel distance. A small tooltip can fade in at 120ms. A full-page slide transition needs 400ms.

**DON'T** default every animation to `300ms` out of habit. Micro-interactions at 300ms accumulate into a UI that feels like it is wading through water.

```css
/* Bad — same duration for very different interactions */
.tooltip { transition: opacity 300ms; }
.full-page-modal { transition: transform 300ms; }

/* Good — duration proportional to scope */
.tooltip { transition: opacity var(--duration-micro); }
.full-page-modal { transition: transform var(--duration-large); }
```

**DON'T** animate beyond 500ms for any standard UI transition. If you need more time, question whether the transition is the right design decision.

---

## Easing Functions

Easing determines the velocity curve of an animation. Correct easing makes motion feel physically plausible. Incorrect easing — especially linear — makes motion feel mechanical and artificial.

### The Core Rule

- **Entering elements:** `ease-out` — fast start, slow finish. Simulates an object decelerating as it arrives.
- **Exiting elements:** `ease-in` — slow start, fast finish. Simulates an object accelerating as it leaves.
- **Moving elements:** `ease-in-out` — slow at both ends, fast in the middle. Natural for repositioning.
- **Never use `linear`** for transitions that simulate physical movement. Linear is correct only for progress bars, loading spinners, and explicitly mechanical animations.

### Cubic Bezier Reference

```css
:root {
  /* Entering: decelerates to a stop */
  --ease-out: cubic-bezier(0.0, 0.0, 0.2, 1.0);

  /* Exiting: accelerates away */
  --ease-in: cubic-bezier(0.4, 0.0, 1.0, 1.0);

  /* Moving: ease in and out */
  --ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1.0);

  /* Spring-like overshoot (use sparingly) */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1.0);
}
```

The Material Design team validated these specific curves through extensive user testing. They are a safe default for any product.

### Applied in CSS

```css
/* Dropdown enters with ease-out, exits with ease-in */
.dropdown {
  transform: translateY(-8px);
  opacity: 0;
  transition:
    transform var(--duration-medium) var(--ease-out),
    opacity var(--duration-medium) var(--ease-out);
}

.dropdown.open {
  transform: translateY(0);
  opacity: 1;
}

.dropdown.closing {
  transition:
    transform var(--duration-micro) var(--ease-in),
    opacity var(--duration-micro) var(--ease-in);
}
```

### Applied in React with Framer Motion

```tsx
// Enter with ease-out, exit with ease-in
<motion.div
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{
    duration: 0.25,
    ease: [0.0, 0.0, 0.2, 1.0], // ease-out
  }}
>
  {children}
</motion.div>
```

### DO / DON'T

**DO** use different easing for enter and exit when both are visible. The asymmetry feels natural.

**DON'T** use `ease-out` for exits — it makes elements feel like they are fighting to leave.

```css
/* Bad — ease-out on exit feels wrong */
.modal-exit { transition: opacity 200ms ease-out; }

/* Good — ease-in on exit feels natural */
.modal-exit { transition: opacity 120ms var(--ease-in); }
```

---

## Stagger Patterns

Staggering cascades a timing delay across a list of elements so they animate sequentially rather than simultaneously. A simultaneous animation of 20 cards is visually noisy. The same cards staggered at 60ms intervals read as a clean, organized reveal.

### The Formula

```
elementDelay = index * staggerInterval
```

A stagger interval of 50–100ms is the reliable range. Below 40ms the stagger is imperceptible. Above 120ms the animation drags and the last element appears too late.

### CSS Custom Properties Approach

```css
.card {
  opacity: 0;
  transform: translateY(12px);
  animation: card-enter var(--duration-medium) var(--ease-out) forwards;
  animation-delay: calc(var(--index) * 60ms);
}

@keyframes card-enter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

```tsx
// Set the CSS custom property per element
{cards.map((card, index) => (
  <div
    key={card.id}
    className="card"
    style={{ '--index': index } as React.CSSProperties}
  >
    <Card {...card} />
  </div>
))}
```

### React with Framer Motion

```tsx
const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06, // 60ms between each child
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] },
  },
};

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <motion.div
      className="grid gap-6"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      variants={container}
      initial="hidden"
      animate="show"
    >
      {cards.map(card => (
        <motion.div key={card.id} variants={item}>
          <Card {...card} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### DO / DON'T

**DO** cap your stagger list. Staggering 50 items at 60ms means the last item starts animating 3 seconds after the first. Cap at 15–20 items maximum, or reduce the interval proportionally.

```tsx
const staggerInterval = Math.min(60, 800 / cards.length); // never exceed 800ms total
```

**DON'T** stagger UI that appears in response to a direct user interaction (clicking a button). Stagger is for reveals — content that loads or enters as a set. Staggering a button's icon and label on click is disorienting.

---

## GPU Acceleration

The browser's compositor thread handles `transform` and `opacity` changes without involving the main thread. Every other CSS property — `width`, `height`, `top`, `left`, `background-color`, `border-radius`, `box-shadow` — triggers layout or paint recalculation on the main thread and produces jank.

### The Rule

**Only animate `transform` and `opacity`.** Everything else is off the table for animations.

```css
/* Bad — animating width triggers layout recalculation on every frame */
.panel {
  width: 0;
  transition: width 300ms ease-out;
}
.panel.open { width: 320px; }

/* Good — transform doesn't trigger layout */
.panel {
  transform: translateX(-320px);
  transition: transform 300ms var(--ease-out);
}
.panel.open { transform: translateX(0); }
```

### Simulating Non-Transform Properties

| What you want | How to do it with transform/opacity |
|---|---|
| Width expand | `scaleX()` + `transform-origin: left` |
| Height expand | `scaleY()` + `transform-origin: top` |
| Slide in from left | `translateX(-100%)` → `translateX(0)` |
| Fade background | `opacity` on an overlay element |
| Grow a button | `scale(0.95)` → `scale(1)` |

```css
/* Simulating height expand without animating height */
.accordion-content {
  transform: scaleY(0);
  transform-origin: top;
  opacity: 0;
  transition:
    transform var(--duration-medium) var(--ease-out),
    opacity var(--duration-medium) var(--ease-out);
}

.accordion-content.open {
  transform: scaleY(1);
  opacity: 1;
}
```

### `will-change`

`will-change: transform` hints to the browser to promote an element to its own compositor layer before animation begins, eliminating the ramp-up cost.

```css
/* Only use will-change on elements that animate frequently */
.animated-element {
  will-change: transform, opacity;
}
```

**Caution:** `will-change` consumes GPU memory. Apply it only to elements that animate. Do not apply it to static elements or as a blanket performance fix.

### DO / DON'T

**DO** test animations at 4x CPU throttle in Chrome DevTools. If frames drop below 60fps on throttled CPU, the animation is too expensive.

**DON'T** animate `box-shadow` directly — it is extremely expensive. Instead, animate `opacity` on a pseudo-element that has the shadow.

```css
/* Bad — repaints on every frame */
.card { transition: box-shadow 200ms ease-out; }
.card:hover { box-shadow: 0 20px 40px rgba(0,0,0,0.2); }

/* Good — opacity change is GPU composited */
.card { position: relative; }
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  opacity: 0;
  transition: opacity 200ms ease-out;
}
.card:hover::after { opacity: 1; }
```

---

## Reduced Motion

The `prefers-reduced-motion` media query is not optional — it is a mandatory accessibility requirement. Users who set this preference include people with vestibular disorders (motion sickness from animation), epilepsy risk, and cognitive disabilities where motion creates distraction.

### The Two Categories

**Decorative motion** (remove entirely): Entrance animations, hover effects, parallax, background animations, staggered reveals. These serve aesthetic purposes only. Disable them completely.

**Functional motion** (keep, but simplify): Toast notifications sliding in, modal appearing to indicate focus shift, loading spinners. These communicate state — remove them and the user loses information. Replace movement with instant opacity transitions instead.

```css
@media (prefers-reduced-motion: reduce) {
  /* Remove all decorative animations */
  .card-enter,
  .page-transition,
  .stagger-item {
    animation: none;
    transition: none;
  }

  /* Simplify functional animations to opacity only */
  .modal {
    transition: opacity var(--duration-micro) linear;
    /* No transform — just fade */
  }

  .toast {
    transition: opacity var(--duration-micro) linear;
    /* Remove translateY slide */
  }
}
```

### Global Reset Pattern

```css
/* Apply to all elements when user prefers reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### React Hook

```tsx
function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent): void => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}
```

```tsx
function AnimatedCard({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}
```

### DO / DON'T

**DO** test your UI with `prefers-reduced-motion: reduce` enabled in OS settings before every release.

**DON'T** use `prefers-reduced-motion` as an afterthought or accessibility checkbox. Build it into your animation system from the start so it applies automatically.

---

## Perceived Performance

Perceived performance is how fast your UI feels, independent of how fast it actually is. A 2-second load that shows content progressively feels faster than a 1-second load that shows nothing then dumps everything at once.

### Skeleton Screens

Replace empty loading states with skeletons that match the layout of the real content. The user understands what is loading and can orient their attention.

```tsx
function CardSkeleton() {
  return (
    <div className="p-6 rounded-xl border border-zinc-200 space-y-3 animate-pulse">
      <div className="h-4 w-3/4 bg-zinc-200 rounded" />
      <div className="h-3 w-full bg-zinc-100 rounded" />
      <div className="h-3 w-2/3 bg-zinc-100 rounded" />
      <div className="h-8 w-24 bg-zinc-200 rounded-lg mt-4" />
    </div>
  );
}

function CardList({ isLoading, cards }: { isLoading: boolean; cards: Card[] }) {
  if (isLoading) {
    return (
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {cards.map(card => <Card key={card.id} {...card} />)}
    </div>
  );
}
```

### Optimistic UI

For actions with high confidence of success (creating a note, liking a post, toggling a setting), update the UI immediately and reconcile with the server response asynchronously. If the server returns an error, roll back with a toast notification.

```tsx
function useLike(postId: string) {
  const [liked, setLiked] = React.useState(false);

  const toggleLike = async (): Promise<void> => {
    const previous = liked;
    setLiked(!liked); // optimistic update — instant feedback
    try {
      await api.toggleLike(postId);
    } catch {
      setLiked(previous); // rollback on error
      toast.error('Could not update like — try again');
    }
  };

  return { liked, toggleLike };
}
```

---

## Scroll-Driven Animations

The CSS Scroll-Driven Animations API links animation progress directly to scroll position without JavaScript. It runs entirely on the compositor thread — no `scroll` event listeners, no `requestAnimationFrame`, no main thread cost.

### `animation-timeline: scroll()`

`scroll()` links animation progress to the scroll position of a scroll container.

```css
/* Progress bar that fills as the user scrolls the page */
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  width: 100%;
  background: linear-gradient(to right, #3b82f6, #8b5cf6);
  transform-origin: left;
  animation: progress-grow linear;
  animation-timeline: scroll(root block);
}

@keyframes progress-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

### `animation-timeline: view()`

`view()` links animation progress to how much of an element is visible in the viewport. This is the correct replacement for IntersectionObserver reveal patterns.

```css
/* Element fades and translates in as it enters the viewport */
.reveal-on-scroll {
  animation: reveal-item linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 30%;
}

@keyframes reveal-item {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

The `animation-range: entry 0% entry 30%` clause means the animation runs from when the element starts entering the viewport to when 30% of it is visible.

### React Integration

```tsx
// No JavaScript needed — pure CSS
// Apply the class and the browser handles the rest

function RevealSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="reveal-on-scroll py-16">
      {children}
    </section>
  );
}
```

### Browser Support and Fallback

Scroll-driven animations are supported in Chrome 115+ and Safari 18+. Firefox support is in progress. Always include a fallback:

```css
/* Base state — visible by default (fallback for unsupported browsers) */
.reveal-on-scroll {
  opacity: 1;
  transform: none;
}

/* Enhanced — scroll-driven animation for supported browsers */
@supports (animation-timeline: scroll()) {
  .reveal-on-scroll {
    opacity: 0;
    transform: translateY(24px);
    animation: reveal-item linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 30%;
  }
}

/* Always respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

### DO / DON'T

**DO** use scroll-driven animations over JavaScript IntersectionObserver for simple reveal effects. The compositor-thread execution eliminates scroll jank.

**DON'T** use scroll-driven animations for complex stateful interactions (shopping cart updates, form validation, navigation). Those require JavaScript logic that cannot be expressed in CSS keyframes.

**DO** always pair `@supports (animation-timeline: scroll())` with a visible fallback state — unsupported browsers must not show hidden or broken content.
