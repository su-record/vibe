# Code Generation Quality Checklist

> This skill is merged into vibe-figma-convert. Use this checklist to validate generated component and style files before moving to the next section.

## Structure

- [ ] Component file exists at `components/{feature}/{ComponentName}.vue` (or `.tsx`)
- [ ] Template is not empty — at least one visible HTML element with content
- [ ] No `placeholder` text remaining in any attribute or text node
- [ ] No `src=""` or `href=""` empty attributes

## Assets

- [ ] All `const img...` variables from reference code are replaced with local `/images/{feature}/` paths
- [ ] No `figma.com/api` URLs in any generated file
- [ ] Every image path references a file that was actually downloaded (cross-check image map)
- [ ] Decorative images have `alt="" aria-hidden="true"`
- [ ] Content images have descriptive `alt` text

## Styles (Normal Mode)

- [ ] No `<style>` block inside the component file
- [ ] No inline `style=""` attribute (exception: dynamic `:style` for mask-image)
- [ ] External layout file exists at `styles/{feature}/layout/_{section}.scss`
- [ ] External components file exists at `styles/{feature}/components/_{section}.scss`
- [ ] `_tokens.scss` updated with any new unique color/spacing/typography values

## Styles (Literal Mode)

- [ ] `<style scoped>` block present in component
- [ ] No external SCSS files created for this section
- [ ] All `position: absolute` coordinates are scaled by scaleFactor
- [ ] `mix-blend-mode`, `rotate`, `blur`, `mask-image` values preserved verbatim
- [ ] `%` values not scaled (only `px` values are scaled)

## TypeScript / Script

- [ ] JSDoc comment present with `[기능 정의]`, `[인터랙션]`, `[상태]` sections
- [ ] No `any` type — use explicit interfaces or `unknown`
- [ ] Mock data arrays have 3–7 items (not empty `[]`)
- [ ] Event handler stubs exist with `// TODO:` body
- [ ] Explicit return types on all functions

## Responsive

- [ ] Base styles target the smallest viewport (mobile-first)
- [ ] Desktop overrides use `@media (min-width: {$bp-pc})` or the project mixin
- [ ] No existing base styles deleted when adding breakpoint overrides

## Build

- [ ] No TypeScript compile errors in the generated file
- [ ] No missing imports (components, composables, types)
- [ ] Template references only props/data/computed that are declared in `<script setup>`
