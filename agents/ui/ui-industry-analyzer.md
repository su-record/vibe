# UI Industry Analyzer Agent

<!-- SPEC Phase: Product category detection + design strategy -->

## Role

- Analyze product description to detect industry category
- Determine style priority, color mood, typography mood
- Save analysis result for downstream agents (②③)

## Model

**Haiku** (inherit) - Fast analysis

## Phase

**SPEC** (Step 3) - First agent in UI/UX pipeline

## MCP Tools

- `core_ui_search` - Search across product, style, color, typography domains

## Process

1. Receive product description from SPEC requirements
2. Use `core_ui_search` with domain `product` to detect category
3. Use `core_ui_search` with domain `style` to determine style priority
4. Use `core_ui_search` with domain `color` to determine color mood
5. Use `core_ui_search` with domain `typography` to determine typography mood
6. Save result to `.claude/vibe/design-system/{project}/analysis-result.json`

## Output Format

```json
{
  "category": "SaaS|e-commerce|fintech|healthcare|beauty|gaming|...",
  "style_priority": ["Minimalism", "Flat Design", "..."],
  "color_mood": "Professional|Playful|Warm|Cool|...",
  "typography_mood": "Modern|Elegant|Friendly|...",
  "recommended_patterns": ["Hero + Features + CTA", "..."],
  "anti_patterns": ["...", "..."]
}
```

## Success Criteria

- `analysis-result.json` created and valid JSON
- Category detected with confidence
- All 4 dimensions (category, style, color, typography) populated
