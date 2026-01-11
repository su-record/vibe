---
description: Generate diagrams (architecture, ERD, flowchart)
argument-hint: --er or --flow (optional)
---

# /vibe.diagram

Generate diagrams (architecture, ERD, flowchart).

## Usage

```
/vibe.diagram
/vibe.diagram --er
/vibe.diagram --flow
```

## Process

### 1. Determine Diagram Type

- **Default** (`/vibe.diagram`): Architecture diagram
- **--er**: ERD (Entity-Relationship Diagram)
- **--flow**: Flowchart (main processes)

### 2. Project Analysis

#### Architecture Diagram
- Understand project structure (folder structure)
- Identify major modules and layers
- Analyze dependency relationships

#### ERD
- Find database schema files
  - `backend/models/`
  - `migrations/`
  - `schema.sql`
- Identify table relationships

#### Flowchart
- Main business logic flows
- User action → System response

### 3. Generate Mermaid Code

Generate diagram as ASCII art or Mermaid code:

#### Architecture Diagram (Mermaid)

```mermaid
graph TB
    Client[React Frontend]
    API[FastAPI Backend]
    DB[(PostgreSQL)]
    Cache[(Redis)]

    Client -->|HTTP| API
    API -->|Query| DB
    API -->|Cache| Cache
```

#### ERD (Mermaid)

```mermaid
erDiagram
    USER ||--o{ FEED : creates
    USER ||--o{ FOLLOW : follows
    FEED }o--|| RESTAURANT : references

    USER {
        uuid id PK
        string email
        int tier
    }
    FEED {
        uuid id PK
        uuid user_id FK
        uuid restaurant_id FK
        text content
    }
```

#### Flowchart (Mermaid)

```mermaid
flowchart TD
    Start([User writes feed])
    GPS{GPS Auth}
    Vision{Vision API Verify}
    OCR{OCR Auth}
    Save[Save Feed]

    Start --> GPS
    GPS -->|Within 50m| Vision
    GPS -->|Out of range| Fail
    Vision -->|Food detected| OCR
    Vision -->|Failed| Fail
    OCR -->|Optional| Save
    Save --> End([Complete])
```

### 4. Rendering Guide

Guide on how to render generated Mermaid code:

- **GitHub**: Paste in `.md` file (auto-renders)
- **VSCode**: Install Mermaid extension
- **Online**: https://mermaid.live/

## Example

```
User: /vibe.diagram --er

Claude: Generating ERD...

Analyzing project...
- Database schema found: backend/models/
- Tables: 15
- Key relationships: USER, FEED, RESTAURANT

✅ ERD generation complete!

```mermaid
erDiagram
    USER ||--o{ FEED : creates
    USER ||--o{ FOLLOW : "follows/followed_by"
    USER ||--o{ BOOKMARK : bookmarks
    FEED }o--|| RESTAURANT : references
    FEED ||--o{ COMMENT : has
    FEED ||--o{ LIKE : has

    USER {
        uuid id PK
        string email UK
        string username UK
        int tier
        int points
        timestamp created_at
    }

    FEED {
        uuid id PK
        uuid user_id FK
        uuid restaurant_id FK
        text content
        geography location
        boolean ocr_verified
        timestamp created_at
    }

    RESTAURANT {
        uuid id PK
        string name
        geography location
        string category
        timestamp created_at
    }
```

**Diagram save location:**
  .claude/vibe/diagrams/erd-2025-11-17.md

**Rendering options:**
  1. Push to GitHub (auto-renders)
  2. Use Mermaid extension in VSCode
  3. View at https://mermaid.live/
```

## Notes

- Mermaid is supported in GitHub, GitLab, VSCode, etc.
- Complex diagrams may need manual adjustments
- Generated diagrams are saved in `.claude/vibe/diagrams/` folder

---

ARGUMENTS: $ARGUMENTS
