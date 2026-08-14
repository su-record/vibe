# docs — Diagram Generation Spec

> Loaded by docs SKILL.md `diagram` mode — Mermaid diagram generation rules (architecture, ERD, flowcharts, sequence).

Produce a Mermaid diagram that reflects the actual code, not a generic
picture. Ground it in sources first: folder structure and imports for
architecture; `models/`, `migrations/`, `schema.*`, ORM definitions for ERDs;
the real branch/return structure of the code for flowcharts.

## Output Conventions

- Architecture → `graph TB` with layers top-to-bottom (client → API → data);
  label edges with the interaction (`HTTP`, `Query`, `Cache`)
- ERD → `erDiagram` with cardinality (`||--o{`), PK/FK/UK markers, and the
  fields that matter for understanding relationships (not every column)
- Flows → `flowchart TD` with decision diamonds carrying their conditions on
  the edge labels
- One diagram per concern — split rather than cram; keep each diagram readable
  at ~20 nodes or fewer
- Save to `.vibe/diagrams/{type}-{YYYY-MM-DD}.md` and note render options
  (GitHub/GitLab render Mermaid natively; otherwise https://mermaid.live/)

## Constraints

Accuracy over completeness: omit elements you couldn't verify in the code
rather than inventing plausible boxes; if a relationship is inferred rather
than read, mark it. Valid Mermaid syntax is non-negotiable — quote labels
containing special characters.

## Done

- Diagram matches verifiable code structure (each node traceable to a file/table/function)
- Mermaid syntax is valid and renders
- Saved to `.vibe/diagrams/` with a one-paragraph summary of what it shows
