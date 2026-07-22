# Clone — Setup Steps & Output Layout

> Loaded by vibe.clone SKILL.md Full Flow / Phase 0 (Setup) — working-directory + code-output layout and the full Phase 0 setup steps.

```
Working directory:
  /tmp/{feature}/
  ├── mo/ (375×812)  — rendered.html, computed.json, screenshot.png, assets/, sections.json
  ├── pc/ (1440×900) — rendered.html, computed.json, screenshot.png, assets/, sections.json
  └── tokens.json    — extracted design tokens (colors/fonts/spacing)

Code output: placed directly in the project directory per detected stack
  components/{feature}/, components/{feature}/_specs/{mo,pc}/,
  styles/{feature}/{mo,pc}/ (per-BP drafts) → styles/{feature}/ (Phase 3C merged),
  public/images/{feature}/, public/ (favicons/OG from assets/seo/)
```

```
1. Stack detection:
   - .vibe/config.json → stack (react/vue/next/svelte/vanilla, scss/tailwind/css-modules)
   - Fallback: package.json deps
2. Feature name: URL hostname → kebab-case (e.g. stripe.com → stripe-clone)
   - User may override with --name=<custom>
3. Directories:
   - components/{feature}/, styles/{feature}/, public/images/{feature}/
4. Component indexing → /tmp/{feature}/component-index.json
   (scan up to 50 existing components, extract props/slots/classes, within 2 minutes)
5. Design token scan → /tmp/{feature}/project-tokens.json
   (SCSS > CSS Variables > Tailwind > CSS-in-JS)
```
