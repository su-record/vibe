---
name: frontend-design
description: "Production-grade frontend with bold aesthetic direction for UI-focused projects"
triggers: [frontend, ui design, aesthetic, beautiful ui, design system, ui quality, visual design]
priority: 70
---
# Frontend Design Skill

Create production-grade frontend with bold aesthetic direction.

## When to Use

- UI-focused projects requiring high visual quality
- Design system implementation
- User-facing features where aesthetics matter

## Core Principles

### 1. Typography
- Choose distinctive typefaces that set the tone
- Establish clear hierarchy through size, weight, and spacing
- Consider custom fonts that reflect brand personality

### 2. Color & Theme
- Develop unique color palettes beyond defaults
- Consider dark/light mode with intentional contrast
- Use color purposefully for hierarchy and emphasis

### 3. Motion & Animation
- Add meaningful micro-interactions
- Use motion to guide user attention
- Implement smooth transitions between states

### 4. Composition & Layout
- Create visual rhythm through spacing
- Use asymmetry and unconventional layouts when appropriate
- Balance density with breathing room

### 5. Visual Details
- Custom icons and illustrations
- Thoughtful shadows and depth
- Refined borders, corners, and surfaces

## Anti-Patterns to Avoid

- Generic Bootstrap/Tailwind defaults without customization
- Overused fonts (Inter, Roboto without styling)
- Predictable card-based layouts everywhere
- Stock photography without curation
- Safe, corporate color palettes

## Implementation Guidelines

```typescript
// Design token structure
const tokens = {
  colors: {
    primary: { /* custom palette */ },
    semantic: { /* success, error, warning */ },
  },
  typography: {
    fontFamily: { /* display, body, mono */ },
    scale: { /* modular scale */ },
  },
  spacing: { /* consistent rhythm */ },
  motion: { /* duration, easing */ },
};
```

## Quality Checklist

- [ ] Typography creates clear hierarchy
- [ ] Color palette is distinctive and accessible
- [ ] Animations are smooth (60fps)
- [ ] Layout works across breakpoints
- [ ] Empty/loading/error states are designed
- [ ] Dark mode (if applicable) is intentional
- [ ] Micro-interactions provide feedback

## Integration with Vibe

Use with `/vibe.utils --ui` for preview:

```bash
/vibe.utils --ui "login form with bold typography and custom color scheme"
```

## Resources

- [Refactoring UI](https://www.refactoringui.com/) - Design principles
- [Motion Design](https://motion.dev/) - Animation library
- [Radix Primitives](https://www.radix-ui.com/) - Accessible components
