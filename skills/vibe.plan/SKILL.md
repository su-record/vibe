---
name: vibe.plan
tier: core
description: "Refine a vibe.interview result into a human-readable markdown 기획서 (planning document). The plan is a vision document that downstream skills/commands use: /vibe.spec consumes it for code implementation, /vibe.figma uses it for UI storyboards. Must use this skill after vibe.interview completes, or when the user has raw interview notes and wants a structured plan document."
triggers: [기획서, 기획서 작성, plan document, 기획 정리, "interview 정리", refine plan]
priority: 90
chain-next: [vibe.spec, vibe.figma]
---

# vibe.plan — Interview → Plan Document Refinement

> **Principle**: Refine the raw Q&A from the interview into a **human-readable vision document**. AI execution structures like PTCF/EARS/Phase are the responsibility of `/vibe.spec`.

## When to Use

- `vibe.interview` has just completed and `.claude/vibe/interviews/{feature}.md` exists
- The user requests "write me a plan document" or "clean up the interview"
- Need to convert an external PRD/wireframe into the vibe plan document format

**Skip condition**:
- If this skill is called directly without an interview → chain to `vibe.interview` first (no chain-prev; inform the user)

## Core Flow

```
1. Read interview file
   .claude/vibe/interviews/{feature}.md
     ↓
2. Load template
   ~/.claude/vibe/templates/plan-template.md
     ↓
3. Refine per section
   - Required responses → body sections
   - Optional responses → body + "Assumptions"
   - TBD items → "Open Questions"
   - Discovered → merged into relevant sections
     ↓
4. Conditionally include UI sections
   type ∈ {website, webapp, mobile} → include Look&Feel / layout / responsive
   type ∈ {api, library, feature-data} → omit
     ↓
5. Save plan document
   .claude/vibe/plans/{feature}.md
     ↓
6. Handoff guidance
   Next steps: /vibe.spec, /vibe.figma, parallel
```

## Step 1: Read Interview File

```
Read .claude/vibe/interviews/{feature-name}.md
```

Extract `type`, `status`, `requiredCollected`, `optionalCollected`, etc. from the frontmatter.

**Validation**:
- `status: partial` + Required items incomplete → warn the user:
  ```
  ⚠️ Interview is partially complete (N Required items not collected).
  Those items will appear as "TBD" in the plan document.
  Continue? (y/N)
  ```
- If the file does not exist → guide the user to run `vibe.interview` first.

### `.last-feature` Pointer Update

```
Write ".claude/vibe/.last-feature" ← feature-name (one line)
Run immediately after extracting the feature name from the interview file.
No-op if the value is already the same.
```

## Step 2: Load Template

```
Read ~/.claude/vibe/templates/plan-template.md
```

The template has a 12-section structure:

| # | Section | All Types | UI Types Only |
|---|---------|-----------|---------------|
| 1 | Overview | ✅ | |
| 2 | Background (Why) | ✅ | |
| 3 | Target Users (Who) | ✅ | |
| 4 | Goals & Success Criteria | ✅ | |
| 5 | Core Features/Sections | ✅ | |
| 6 | Scope & Out-of-Scope | ✅ | |
| 7 | Look & Feel | | ✅ |
| 8 | Layout/Section Structure | | ✅ |
| 9 | Responsive Strategy | | ✅ |
| 10 | Tech Stack & Constraints | ✅ | |
| 11 | Assumptions & Risks | ✅ | |
| 12 | Next Steps (Handoff) | ✅ | |

### Template Fallback

If `~/.claude/vibe/templates/plan-template.md` is not found:
1. Check `{{VIBE_PATH}}/vibe/templates/plan-template.md` (package source)
2. If neither exists, use the built-in section list from this skill as the template structure
3. Never fail silently — always inform the user which template source was used

## Step 3: Per-Section Refinement Mapping

Interview items → plan document section mapping rules:

### Common Mapping

| Interview Item | Plan Section |
|----------------|--------------|
| `R1. purpose` | §2 Background (Why) |
| `R2. target-users` | §3 Target Users |
| `R3. core-message` / `R3. core-features` / `R3. core-endpoints` | §5 Core Features/Sections |
| `R4. required-sections` / `R4. data-model` / `R4. core-api` | §5 Core Features/Sections |
| `R7/R8. success-metric` | §4 Goals & Success Criteria |
| `R6/R7. tech-constraints` / `tech-stack` | §10 Tech Stack & Constraints |

### UI Types (website/webapp/mobile) Additional Mapping

| Interview Item | Plan Section |
|----------------|--------------|
| `R5. brand-tone` + `O1. reference-sites` + `O2. color-direction` + `O3. typography-preference` + `O4. animation-level` | §7 Look & Feel |
| `R4. required-sections` (website) / `R4. core-features` (webapp) | §8 Layout/Section Structure |
| `O5. responsive-strategy` + `O6/O8. accessibility-level` | §9 Responsive Strategy |

### Common Post-Processing

- `interview.TBD[]` → §11 "Assumptions & Risks" or "Open Questions" at the end of the document
- `interview.discovered[]` → merged into relevant sections + "Discovered during interview" note
- All uncollected Optional items → recorded as defaults in §11 "Assumptions" (e.g., "Accessibility: WCAG AA assumed")

## Step 4: Conditionally Include UI Sections

```python
if interview.type in {"website", "webapp", "mobile"}:
    include_sections = [1..12]  # all sections
else:  # api, library, feature-data
    include_sections = [1..6, 10..12]  # omit §7-9 (Look&Feel/Layout/Responsive)
    # note in §5: "No UI — API/Library project"
```

## Step 5: Save Plan Document

**Output path**: `.claude/vibe/plans/{feature-name}.md`

**Frontmatter**:

```yaml
---
feature: {feature-name}
type: {website | webapp | mobile | api | library | feature}
status: draft
createdAt: {ISO-timestamp}
lastUpdated: {ISO-timestamp}
source: .claude/vibe/interviews/{feature-name}.md
downstream: [spec, figma]  # or [spec] for non-UI
---
```

**Body**: Template structure + refined content.

**Quality criteria**:
- Each section takes 30 seconds or less to read
- Compressed to 3-7 bullets per section
- Minimize technical jargon (this is a human-readable vision document)
- Mark "TBD" in bold to make it clear that a follow-up decision is needed

## Step 6: Handoff Guidance

After saving the plan document, guide the user on next steps:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Plan document complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/plans/{feature-name}.md
   Sections: {N} written
   TBD: {M} (to be decided later)

Type: {type}

Next steps:

  [UI project: website/webapp/mobile]
  1. /vibe.spec ".claude/vibe/plans/{feature-name}.md"
     → Write code spec → /vibe.run implementation
  2. /vibe.figma
     → Figma design → FE UI code
  3. Run in parallel (recommended)
     → Feature + Design → website prototype

  [Non-UI: api/library]
  1. /vibe.spec ".claude/vibe/plans/{feature-name}.md"
     → Code spec → /vibe.run implementation

Where would you like to start?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Anti-Patterns

- Do not write in PTCF structure (that is /vibe.spec's responsibility)
- Do not use EARS format (WHEN/THEN)
- Do not include file lists, Phase splits, or Acceptance Criteria
- Do not over-specify the Tech Stack — high-level only
- Do not hide TBD items — they must be surfaced explicitly so they can be decided in the next step
- Do not run this skill without an interview (no raw information)
- Do not force-fill a Look&Feel section for non-UI projects

## Related

- **Prev**: `vibe.interview` — requirements collection (implicit chain-prev)
- **Next**: `/vibe.spec` (code spec), `/vibe.figma` (UI design)
- **Template**: `~/.claude/vibe/templates/plan-template.md`
