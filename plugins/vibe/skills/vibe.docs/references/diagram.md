# /vibe.docs diagram — Diagram Generation

> vibe.docs SKILL.md 의 서브커맨드 표에서 **`diagram` 가 선택됐을 때만** 로드한다.

### `/vibe.docs diagram` — Diagram Generation

Generate Mermaid diagrams for architecture, ERD, flowchart, or sequence
visualization directly (native capability — no dedicated agent). Ground the
diagram in sources first: folder structure and imports for architecture;
`models/`, `migrations/`, `schema.*`, ORM definitions for ERDs; the real
branch/return structure of the code for flowcharts.

**Options:**
- `/vibe.docs diagram` (default): Architecture overview
- `/vibe.docs diagram --er`: Entity-Relationship Diagram
- `/vibe.docs diagram --flow`: Flowchart
- `/vibe.docs diagram --seq`: Sequence Diagram

> Read `references/diagram-spec.md` for the full output conventions (Mermaid syntax per diagram type, save location, accuracy constraints).

**Example:**
```
/vibe.docs diagram --er
```
