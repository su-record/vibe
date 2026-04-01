---
description: Figma design to code — extract + generate in one step
argument-hint: "figma-url" [--standalone]
---

# /vibe.figma

Extract Figma design data and generate production-ready component code, tailored to the project's tech stack.

## Usage

```
/vibe.figma "https://www.figma.com/design/ABC123/Project?node-id=1-2"                # Project integrated (default)
/vibe.figma "url" --standalone                                                        # Self-contained output folder
/vibe.figma "url" --component LoginForm                                               # Name the root component
/vibe.figma --local                                                                   # Skip extraction, use existing figma-output/
```

### Generation Mode

| Flag | Behavior |
|------|----------|
| _(default)_ | **Project integration.** Use project's design system, existing tokens, component patterns. Place files in project's component directory. |
| `--standalone` | **Independent folder.** Create self-contained folder with own global styles, tokens, and components. No dependency on project's existing styles. Ready to copy-paste into any project. |

## File Reading Policy (Mandatory)

- **Image first**: ALWAYS read `figma-output/frame.png` with the Read tool before anything else
- **Then JSON**: Read `figma-output/layers.json` to extract structural data and tokens
- **Project config**: Read `.claude/vibe/config.json` to determine tech stack
- **Design context**: Read `.claude/vibe/design-context.json` if it exists (brand, tokens, theme)
- **Existing code**: Scan project for existing component patterns, theme config, design system

## Context Reset

**When this command runs, previous conversation is ignored.**
- Start fresh from the extracted Figma data
- Base all decisions on the design image + layer data + project stack

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Phase 0: Figma Data Extraction

**Skip this phase if `--local` flag is provided and `figma-output/` already exists.**

### 0-1. Token Check

Check Figma access token availability:

```
1. Read ~/.vibe/config.json → credentials.figma.accessToken
2. Fallback: FIGMA_ACCESS_TOKEN env variable
3. If neither → ask user: "vibe figma setup <token> 으로 토큰을 설정해주세요"
```

### 0-2. Extract via CLI

Run extraction using the Bash tool:

```bash
npx vibe figma extract "$argument"
```

This produces:
- `figma-output/layers.json` — Figma layer structure with design tokens
- `figma-output/frame.png` — Rendered frame image (when node-id present in URL)

### 0-3. Verify Output

```
1. Check figma-output/layers.json exists → if not, report error and stop
2. Check figma-output/frame.png exists → optional (only with node-id)
3. Validate layers.json has children array → warn if empty
```

---

## Phase 1: Design Analysis (Image-First)

Read `figma-output/frame.png` and analyze:

| Aspect | What to Extract |
|--------|-----------------|
| Layout | Flex/Grid direction, alignment, wrapping |
| Components | Visual boundaries (cards, buttons, inputs, modals) |
| Spacing | Padding, margins, gaps between elements |
| Typography | Font sizes, weights, line heights, hierarchy |
| Colors | Background, text, border, accent colors |
| States | Hover/active/disabled indicators if visible |
| Responsive hints | Breakpoint indicators, fluid vs fixed widths |

## Phase 2: Layer Data Extraction

Read `figma-output/layers.json` and extract:

1. **Component hierarchy** — Map nested layers to component tree
2. **Design tokens** — Colors (fill, stroke), font properties, spacing values, border radius, shadows
3. **Auto-layout** — Direction, gap, padding (maps directly to flex/grid)
4. **Constraints** — Fixed vs fluid sizing
5. **Component instances** — Identify reusable patterns

**Correction rule**: When image and JSON disagree, **image wins**. The image shows designer intent; JSON may have structural artifacts.

## Phase 3: Project Stack Detection + Mode Resolution

### 3-1. Detect Stack

1. Read `.claude/vibe/config.json` → check `stacks` field
2. If no config, detect from project files:
   - `package.json` → React, Vue, Svelte, Angular, etc.
   - `tailwind.config.*` → Tailwind CSS
   - `next.config.*` → Next.js
   - `nuxt.config.*` → Nuxt
   - `*.module.css` → CSS Modules pattern
   - `styled-components` / `@emotion` in deps → CSS-in-JS
3. Read `.claude/vibe/design-context.json` if available → brand tokens, theme preferences

### 3-2. Resolve Generation Mode

```
if --standalone flag:
  → create isolated output folder (default: figma-output/generated/)
  → generate self-contained global styles + component styles
  → no dependency on project's existing code

default (no flag):
  → scan existing component directories, theme files, token definitions
  → map output to project's conventions (file location, naming, imports)
  → add only NEW tokens that don't exist yet
```

---

## Phase 4: Style Architecture

### 4-1. Global Styles File

**Always generate a global token/style file.** This is the single source of truth for design tokens extracted from Figma.

#### --standalone mode output:

```
figma-output/generated/
├── styles/
│   ├── tokens.css              ← CSS custom properties (colors, spacing, typography, shadows)
│   ├── global.css              ← Reset + base typography + global layout
│   └── index.css               ← Re-exports tokens.css + global.css
├── components/
│   ├── ComponentName/
│   │   ├── ComponentName.tsx   ← Component code
│   │   └── ComponentName.module.css (or .styles.ts)
│   └── ...
└── index.ts                    ← Barrel export
```

#### Default (project integration) mode output:

```
{project-component-dir}/       ← e.g., src/components/
├── ComponentName/
│   ├── ComponentName.tsx
│   └── ComponentName.module.css (or .styles.ts)
└── ...

{project-style-dir}/           ← e.g., src/styles/ or extend existing
└── figma-tokens.css            ← Only NEW tokens not already in project
```

### 4-2. Token File Format

**CSS Custom Properties (default):**

```css
/* figma-tokens.css — Auto-generated from Figma. Do not edit manually. */
/* Source: https://www.figma.com/design/{fileKey} */

:root {
  /* Colors */
  --figma-primary: #3B82F6;
  --figma-primary-hover: #2563EB;
  --figma-surface: #FFFFFF;
  --figma-surface-secondary: #F9FAFB;
  --figma-text-primary: #111827;
  --figma-text-secondary: #6B7280;
  --figma-border: #E5E7EB;

  /* Typography */
  --figma-font-family: 'Inter', system-ui, sans-serif;
  --figma-text-xs: 0.75rem;    /* 12px */
  --figma-text-sm: 0.875rem;   /* 14px */
  --figma-text-base: 1rem;     /* 16px */
  --figma-text-lg: 1.125rem;   /* 18px */
  --figma-text-xl: 1.25rem;    /* 20px */
  --figma-leading-tight: 1.25;
  --figma-leading-normal: 1.5;

  /* Spacing */
  --figma-space-1: 0.25rem;    /* 4px */
  --figma-space-2: 0.5rem;     /* 8px */
  --figma-space-3: 0.75rem;    /* 12px */
  --figma-space-4: 1rem;       /* 16px */
  --figma-space-6: 1.5rem;     /* 24px */
  --figma-space-8: 2rem;       /* 32px */

  /* Shadows */
  --figma-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --figma-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);

  /* Border Radius */
  --figma-radius-sm: 0.25rem;  /* 4px */
  --figma-radius-md: 0.5rem;   /* 8px */
  --figma-radius-lg: 0.75rem;  /* 12px */
  --figma-radius-full: 9999px;
}
```

**Tailwind extend (if Tailwind detected):**

```js
// figma.config.ts — merge into tailwind.config.ts theme.extend
export const figmaTokens = {
  colors: {
    figma: {
      primary: '#3B82F6',
      'primary-hover': '#2563EB',
      // ...
    },
  },
  spacing: { /* ... */ },
  borderRadius: { /* ... */ },
};
```

### 4-3. Component Style Separation

Every component gets its own style file. **Never inline styles exceeding 3 properties.**

| Styling Method | When to Use | Component Style File |
|----------------|-------------|---------------------|
| CSS Modules | Default for React/Vue/Svelte (non-Tailwind) | `Component.module.css` |
| Tailwind | `tailwind.config.*` detected | Classes in JSX (no separate file) |
| CSS-in-JS | `styled-components`/`@emotion` in deps | `Component.styles.ts` |
| Scoped CSS | Vue SFC / Svelte | `<style scoped>` block within component |
| StyleSheet | React Native | `styles` const at bottom of component file |
| ThemeData | Flutter | Theme extension or inline `Theme.of(context)` |

**Component style file MUST reference global tokens:**

```css
/* LoginForm.module.css */
.container {
  padding: var(--figma-space-6);
  background: var(--figma-surface);
  border-radius: var(--figma-radius-lg);
  box-shadow: var(--figma-shadow-md);
}

.title {
  font-size: var(--figma-text-xl);
  font-weight: 600;
  color: var(--figma-text-primary);
  line-height: var(--figma-leading-tight);
}

.submitButton {
  background: var(--figma-primary);
  color: var(--figma-surface);
  border-radius: var(--figma-radius-md);
  padding: var(--figma-space-2) var(--figma-space-4);
  transition: background 150ms ease;
}

.submitButton:hover {
  background: var(--figma-primary-hover);
}
```

---

## Phase 5: Markup Quality Standards

### 5-1. Semantic HTML (Mandatory)

Every element MUST use the most specific semantic tag available. `<div>` is a last resort.

| Visual Element | Correct Tag | Wrong |
|---------------|------------|-------|
| Page section | `<section>`, `<article>`, `<aside>` | `<div>` |
| Navigation | `<nav>` | `<div class="nav">` |
| Page header | `<header>` | `<div class="header">` |
| Page footer | `<footer>` | `<div class="footer">` |
| Heading hierarchy | `<h1>`→`<h6>` (sequential, no skips) | `<div class="title">` |
| Paragraph text | `<p>` | `<div>` or `<span>` |
| List of items | `<ul>`/`<ol>` + `<li>` | `<div>` repeated |
| Clickable action | `<button>` | `<div onClick>` |
| Navigation link | `<a href>` | `<span onClick>` |
| Form field | `<input>` + `<label>` | `<div contenteditable>` |
| Image | `<img alt="descriptive">` or `<figure>` + `<figcaption>` | `<div style="background-image">` for content images |
| Tabular data | `<table>` + `<thead>` + `<tbody>` | `<div>` grid |
| Time/Date | `<time datetime>` | `<span>` |
| Emphasized text | `<strong>`, `<em>` | `<span class="bold">` |
| Grouped fields | `<fieldset>` + `<legend>` | `<div>` |

### 5-2. Accessibility Checklist

Every generated component MUST pass:

- [ ] All interactive elements keyboard-reachable (tab order)
- [ ] `<button>` for actions, `<a>` for navigation — never reversed
- [ ] `<img>` has descriptive `alt` (not "image", not filename)
- [ ] Form `<input>` linked to `<label>` (via `htmlFor` / `id`)
- [ ] Color contrast >= 4.5:1 (text), >= 3:1 (large text, UI controls)
- [ ] Focus indicator visible on all interactive elements
- [ ] `aria-label` on icon-only buttons
- [ ] `role` attribute on custom interactive widgets
- [ ] Heading hierarchy is sequential (no h1 → h3 skip)
- [ ] `<ul>`/`<ol>` for any visually listed items

### 5-3. Component Structure Rules

```
Max nesting depth: 3 levels (container > group > element)
Max component length: 50 lines
Max props: 5 per component
```

**Split triggers:**

| Signal | Action |
|--------|--------|
| Component > 50 lines | Split into sub-components |
| Repeated visual pattern (2+ times) | Extract shared component |
| Distinct visual boundary (card, modal, form) | Own component + own style file |
| 3+ related props | Group into object prop or extract sub-component |

### 5-4. Markup Anti-Patterns (NEVER Generate)

```tsx
// WRONG: div soup
<div className="card">
  <div className="card-header">
    <div className="title">Login</div>
  </div>
  <div className="card-body">
    <div className="input-group">
      <div className="label">Email</div>
      <div className="input"><input /></div>
    </div>
  </div>
</div>

// CORRECT: semantic markup
<article className={styles.card}>
  <header className={styles.header}>
    <h2 className={styles.title}>Login</h2>
  </header>
  <form className={styles.body}>
    <fieldset className={styles.fieldGroup}>
      <label htmlFor="email" className={styles.label}>Email</label>
      <input id="email" type="email" className={styles.input} />
    </fieldset>
  </form>
</article>
```

---

## Phase 6: Code Generation

Generate code following these rules per stack:

#### React + TypeScript (default for TS web projects)

```
- Functional components with explicit return types
- Props interface defined above component
- Named exports (not default)
- CSS Modules import: import styles from './Component.module.css'
- Tailwind: classes in JSX, extract repeated patterns to @apply
- Responsive: mobile-first breakpoints
```

#### Vue 3

```
- <script setup lang="ts"> composition API
- defineProps with TypeScript interface
- <style scoped> with CSS custom property references
- Or Tailwind classes in template
```

#### Svelte

```
- TypeScript in <script lang="ts">
- Export let for props with types
- <style> block with CSS custom property references
- Or Tailwind classes in markup
```

#### React Native

```
- StyleSheet.create at bottom of file
- Dimensions-aware responsive layout
- Platform-specific handling if needed
- Extract shared style constants to styles/tokens.ts
```

#### Flutter (Dart)

```
- StatelessWidget or StatefulWidget as appropriate
- Theme.of(context) for design tokens
- Extract shared values to lib/theme/figma_tokens.dart
- Proper widget composition
```

---

## Phase 7: Token Mapping (default mode)

**Only in default (project integration) mode.** Map extracted Figma tokens to the project's existing token system.

1. **If design system exists** (e.g., shadcn, MUI theme, Tailwind config):
   - Map Figma colors → existing theme tokens
   - Map Figma typography → existing text styles
   - Map Figma spacing → existing spacing scale
   - **Only add new tokens** that don't exist yet

2. **If no design system**:
   - Generate `figma-tokens.css` (or Tailwind extend)
   - Group tokens by category (color, typography, spacing, shadow)

3. **Output token mapping** as a comment block at the top of the token file:
   ```
   /* Figma Token Mapping:
    * Figma "Primary/Default" → var(--figma-primary) = #3B82F6
    * Figma "Text/Body" → var(--figma-text-base) = 1rem / 1.5
    * Figma "Spacing/L" → var(--figma-space-6) = 1.5rem
    * Existing match: var(--figma-primary) ≈ var(--color-blue-500)
    */
   ```

---

## Phase 8: Correction Notes

After generating code, output a brief correction report:

```markdown
## Correction Notes

### Generation Mode
- Mode: default (project integration) / --standalone
- Output directory: {path}

### Files Generated
| File | Type | Description |
|------|------|-------------|
| styles/tokens.css | Global tokens | {N} colors, {N} spacing, {N} typography |
| styles/global.css | Base styles | Reset + typography + layout |
| ComponentName/ComponentName.tsx | Component | Root component |
| ComponentName/ComponentName.module.css | Styles | Component-specific styles |

### Layer Issues Found
- [Layer name] was ambiguous → interpreted as [component] based on image
- [Layer structure] didn't match visual → used image-based layout

### Markup Quality
- Semantic tags used: {list}
- Accessibility: {pass/fail items}

### Recommendations for Figma File
- Use Auto Layout for [specific frame] to improve extraction accuracy
- Name layers semantically (e.g., "login-form" not "Frame 47")
- Use consistent spacing tokens
```

---

## Tool Usage Rules

| Tool | When |
|------|------|
| Read | Frame image, layers JSON, project config, existing components |
| Glob | Find existing components, theme files, design tokens |
| Grep | Search for existing color/spacing/typography definitions |
| Write | Create new component files and style files |
| Edit | Update existing theme/token files to add new tokens (default mode) |
| Bash | `npx vibe figma extract` for data extraction, dependency checks |

## Important

- **Never guess colors** — extract from layers.json or image analysis
- **Never invent spacing** — use extracted values mapped to token scale
- **Never hardcode values** — all visual properties reference token variables
- **Preserve existing patterns** — match the project's existing component style (default mode)
- **Image is truth** — when layer structure is confusing, trust what the image shows
- **Ask before overwriting** — if a component file already exists, ask the user first
- **No console.log** — never include debug logging in generated code
- **No div soup** — every element uses the correct semantic tag
- **Component size limit** — split components exceeding 50 lines
- **Style separation** — global tokens file + per-component style files, always

## Next Steps

After generating code, suggest:
1. `/design-audit` — Review the generated component for design quality
2. `/design-normalize` — Align tokens with project design system
3. `/design-critique` — Get detailed design feedback
4. `/design-polish` — Fine-tune visual details before shipping
