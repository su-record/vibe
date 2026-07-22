# Clone — Phase 2 Refinement Rules & Output Schema

> Loaded by vibe.clone SKILL.md Phase 2 (Refine) — full refinement rule set and the sections.json output schema.

### Refinement rules

```
Refinement applied when converting rendered.html + computed.json → sections.json:
  1. Strip <script>, <noscript>, <style>, tracking pixels
  2. Strip nodes with display:none, visibility:hidden, opacity:0, size 0
  3. Detect sections: <header>, <nav>, top-level <section>/<main> children, <footer>
     Fallback: top-level children of <body> with height > 100px
  4. Detect repeated patterns (sibling nodes with same tag+class signature, count >= 3)
     → mark as component candidates
  5. Extract design tokens:
     - colors: unique color/background-color values, sorted by frequency
     - typography: font-family/size/weight combinations
     - spacing: padding/margin values (px), bucketed to nearest 4px
  6. Background images (background-image: url) → images.bg
  7. Inline <img> → images.content
  8. Keep CSS subset: layout (display/flex/grid/position/inset/margin/padding/width/height/gap),
     typography (font-*, line-height, letter-spacing, text-*, color),
     decoration (background, border, border-radius, box-shadow, opacity),
     transform/transition
  9. Classify interaction model per section (static-DOM heuristic) → section.interaction
     = { model, confidence, signals[], note }. model ∈ static | click-driven | scroll-driven
     | time-driven | hover. This is a best-guess + ranked SIGNALS, NOT a silent decision —
     the builder confirms it against the live site (Phase 5). Misidentifying the interaction
     model is the #1 clone failure mode (scroll-driven original built as a click UI, etc.).
 10. Attach matching state rules from states.json to each section → section.states
     (rules whose selector references a class/leaf-tag inside that section's subtree)
```

### Output

```
/tmp/{feature}/{bp}/sections.json:
  {
    meta: { feature, url, viewport, bp },
    tokens: { colors: [...], typography: [...], spacing: [...] },
    sections: [
      {
        name: "Header" | "Hero" | "Features" | ...,
        nodeRef, tag, size, css,
        interaction: {        // static-DOM heuristic — builder confirms in Phase 5
          model: "static" | "click-driven" | "scroll-driven" | "time-driven" | "hover",
          confidence: "high" | "medium" | "low",
          signals: [...],     // ranked evidence (sticky, infinite animation, role=tab, …)
          note
        },
        text,                 // text content (placeholder candidates)
        components: [...],    // detected repeated patterns
        states: [             // non-default state rules scoped to this section
          { selector, media, css }
        ],
        children: [...],      // full recursive subtree
        images: { bg, content: [...] }
      }
    ]
  }
```
