---
description: Figma design to code — extract + generate in one step
argument-hint: "figma-url" or --local
---

# /vibe.figma

Extract Figma design data and generate production-ready component code, tailored to the project's tech stack.

## Usage

```
/vibe.figma "https://www.figma.com/design/ABC123/Project?node-id=1-2"   # Full pipeline
/vibe.figma --local                                                      # Skip extraction, use existing figma-output/
/vibe.figma "url" --component LoginForm                                  # Name the root component
```

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

## Phase 3: Project Stack Detection

Determine the target tech stack:

1. Read `.claude/vibe/config.json` → check `stacks` field
2. If no config, detect from project files:
   - `package.json` → React, Vue, Svelte, Angular, etc.
   - `tailwind.config.*` → Tailwind CSS
   - `next.config.*` → Next.js
   - `nuxt.config.*` → Nuxt
   - `*.module.css` → CSS Modules pattern
   - `styled-components` / `@emotion` in deps → CSS-in-JS
3. Read `.claude/vibe/design-context.json` if available → brand tokens, theme preferences

## Phase 4: Code Generation

Generate code following these rules per stack:

#### React + TypeScript (default for TS web projects)

```
- Functional components with explicit return types
- Props interface with JSDoc for non-obvious props
- Named exports (not default)
- Tailwind classes if tailwind detected, otherwise CSS Modules
- Responsive: mobile-first breakpoints
```

#### Vue 3

```
- <script setup lang="ts"> composition API
- defineProps with TypeScript interface
- Scoped styles or Tailwind
```

#### Svelte

```
- TypeScript in <script lang="ts">
- Export let for props with types
- Scoped styles or Tailwind
```

#### React Native

```
- StyleSheet.create for styles
- Dimensions-aware responsive layout
- Platform-specific handling if needed
```

#### Flutter (Dart)

```
- StatelessWidget or StatefulWidget as appropriate
- Theme.of(context) for design tokens
- Proper widget composition
```

#### General Rules (All Stacks)

| Rule | Detail |
|------|--------|
| No hardcoded colors | Use theme tokens / CSS variables / design system |
| No magic numbers | Extract spacing/size constants |
| Semantic HTML | Use proper elements (button, nav, header, etc.) |
| Accessibility | aria-labels, roles, keyboard navigation |
| Responsive | Mobile-first, handle all breakpoints |
| Component splitting | One component per visual boundary (max 50 lines) |

## Phase 5: Token Mapping

Map extracted design tokens to the project's token system:

1. **If design system exists** (e.g., shadcn, MUI theme, Tailwind config):
   - Map Figma colors → existing theme tokens
   - Map Figma typography → existing text styles
   - Map Figma spacing → existing spacing scale

2. **If no design system**:
   - Generate CSS custom properties or Tailwind extend config
   - Group tokens by category (color, typography, spacing, shadow)

3. **Output token mapping** as a comment block at the top of generated code:
   ```
   /* Figma Token Mapping:
    * Primary: #3B82F6 → var(--color-primary) / text-blue-500
    * Body text: Inter 16/24 → var(--font-body) / text-base
    * Card padding: 24px → var(--space-6) / p-6
    */
   ```

## Phase 6: Correction Notes

After generating code, output a brief correction report:

```markdown
## Correction Notes

### Layer Issues Found
- [Layer name] was ambiguous → interpreted as [component] based on image
- [Layer structure] didn't match visual → used image-based layout

### Recommendations for Figma File
- Use Auto Layout for [specific frame] to improve extraction accuracy
- Name layers semantically (e.g., "login-form" not "Frame 47")
- Use consistent spacing tokens
```

---

## Output Format

### Single Component

```
[generated component file]
```

### Multiple Components (complex frame)

```
[parent component]
[child component 1]
[child component 2]
...
```

### With New Tokens

```
[token definitions file if needed]
[component files]
```

## Tool Usage Rules

| Tool | When |
|------|------|
| Read | Frame image, layers JSON, project config, existing components |
| Glob | Find existing components, theme files, design tokens |
| Grep | Search for existing color/spacing/typography definitions |
| Write | Create new component files |
| Edit | Update existing theme/token files to add new tokens |
| Bash | `npx vibe figma extract` for data extraction, dependency checks |

## Important

- **Never guess colors** — extract from layers.json or image analysis
- **Never invent spacing** — use extracted values or nearest design system token
- **Preserve existing patterns** — match the project's existing component style
- **Image is truth** — when layer structure is confusing, trust what the image shows
- **Ask before overwriting** — if a component file already exists, ask the user first
- **No console.log** — never include debug logging in generated code
- **Component size limit** — split components exceeding 50 lines

## Next Steps

After generating code, suggest:
1. `/design-audit` — Review the generated component for design quality
2. `/design-critique` — Get detailed design feedback
3. `/design-polish` — Fine-tune visual details before shipping
