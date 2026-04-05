# Extraction Checklist — What to Extract from Figma

## Colors

- [ ] Background colors (`bg-[#...]`) — section, card, overlay backgrounds
- [ ] Text colors (`text-[#...]`) — heading, body, label, disabled states
- [ ] Border colors (`border-[#...]`) — dividers, input outlines
- [ ] Overlay/alpha colors (`rgba(...)`) — modals, hover states
- [ ] Gradient stops — linear/radial gradients with exact hex + stop positions
- [ ] Blend mode colors — any element using `mix-blend-*`

## Spacing

- [ ] Section padding (`pt-[Npx]`, `pb-[Npx]`, `px-[Npx]`)
- [ ] Component gaps (`gap-[Npx]`) — flex/grid item spacing
- [ ] Inner padding (`p-[Npx]`, `px-[Npx]`) — cards, buttons
- [ ] Margin overrides (`mt-`, `mb-`, `ml-`, `mr-`)
- [ ] Absolute offsets (`top-[Npx]`, `left-[Npx]`) — positioned layers

## Typography

- [ ] Font family — extract from `font-[family-name:var(--...)]` fallback
- [ ] Font sizes (`text-[Npx]`) — all unique sizes per role (heading, sub, body, caption)
- [ ] Font weights (`font-black/bold/semibold/medium/normal`)
- [ ] Line heights (`leading-[N]` or `leading-[Npx]`)
- [ ] Letter spacing (`tracking-[Npx]` or `tracking-[-Npx]`)
- [ ] Text alignment (`text-center`, `text-left`, `text-right`)
- [ ] Text decoration / transform if present

## Components

- [ ] Button variants — primary, secondary, disabled; exact size + color + radius
- [ ] Card structures — border, shadow (`shadow-[...]`), border-radius
- [ ] Icon dimensions — width/height from `w-[Npx] h-[Npx]`
- [ ] Badges/tags — background color, font, padding, radius
- [ ] Input fields — border, focus ring, placeholder color
- [ ] Navigation — GNB/footer height, link styles

## Assets

- [ ] All `const img...` URL variables in reference code — zero omissions
- [ ] Background images vs content images vs decorative images classified
- [ ] Image dimensions noted for `width`/`height` attributes
- [ ] Sprite/overflow images identified (left negative %, width >100%)

## Tokens to Create

- [ ] Color tokens for every unique hex value used more than once
- [ ] Spacing tokens for recurring gap/padding values
- [ ] Typography tokens for each font-size role
- [ ] Breakpoint token (`$bp-pc`) from CONFIG frame
