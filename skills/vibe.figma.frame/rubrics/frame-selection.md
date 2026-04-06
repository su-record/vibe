# Frame Selection Rubric

> This skill is merged into vibe.figma.extract. Use this rubric to select the right frames before calling `get_design_context`.

## Frame Classification by Name Pattern

| Pattern in Name | Class | Action |
|----------------|-------|--------|
| "기능 정의서", "정책", "spec", "policy" | SPEC | `get_design_context` — extract text requirements |
| "해상도", "브라우저", "config", "resolution" | CONFIG | `get_design_context` — extract scale factor |
| "공통", "GNB", "Footer", "Popup", "shared", "common" | SHARED | Read if referenced; skip if project already has them |
| "화면설계", "메인 -", "section", numbered frames | PAGE | Core implementation targets |

## Selection Priority

1. SPEC frame (1 frame) — read first, informs all feature requirements
2. CONFIG frame (1 frame) — establishes scale factors for both breakpoints
3. PAGE frames — top-level only (e.g. `3.1`, `3.2`, not `3.1.1`, `3.1.2`)
4. SHARED frames — only if component does not already exist in the project

Never read sub-case frames (e.g. `3.1.1`, `3.2.1`) during Phase 1. Read them in Phase 2 only if a sub-state is needed for a specific interaction.

## Tall Frame Decision Tree

```
Frame height > 1500px?
  YES → Split before calling get_design_context
    1. get_metadata(nodeId) → get child node list
    2. Call get_design_context per child node
    3. Merge results as one logical section
  NO → Call get_design_context directly
```

Height thresholds from real data:
- Safe direct call: up to ~900px
- Risk zone: 900–1500px (attempt once, split on timeout)
- Always split: 1500px+

## Skipping Frames

Skip a frame entirely when:
- Name contains "OLD", "archive", "deprecated", "참고", "예시" (reference only)
- Frame is a copy/duplicate of another already processed frame
- Frame is a component definition (Figma component, not an instance) — use its instances instead

## Viewport Frames

When multiple frames represent the same section at different widths:
- Smallest width = mobile (Phase 2 base URL)
- Larger widths = desktop breakpoints (Phase 2 subsequent URLs)
- Process mobile first, then add desktop as responsive layer — never the reverse

## Frame Count Warning

If total PAGE frames > 10, confirm with the user before proceeding. Large frame counts may indicate the Figma file covers multiple pages that should be separate feature implementations.
