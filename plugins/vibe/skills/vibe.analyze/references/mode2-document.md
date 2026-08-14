# Mode 2: Document Analysis (PDF, Markdown, Slides)

> vibe.analyze SKILL.md 의 모드 라우팅에서 **이 모드가 선택됐을 때만** 로드한다.

## Mode 2: Document Analysis (PDF, Markdown, Slides)

### Goal

Analyze document **structure, key content, quality, and applicability** to:
1. Extract and organize information from the document
2. Map relevance to the current project
3. Suggest follow-up actions (development, improvement, application)

### Process

#### 1. Read Document

- **PDF**: Use `Read` tool with `pages` parameter (split large documents into chunks of 20 pages)
- **Markdown/Text**: Use `Read` tool for the full file
- **Image-heavy documents**: Analyze visual elements (slides, diagrams) alongside text

#### 2. Classify Document Type

> Read `references/output-templates.md` for the full document-type → analysis-focus table.

#### 3. Analyze Content (Parallel Sub-Agents)

```text
- Worker: read [PATH] in full (page ranges for PDFs) and extract section structure, key concepts, definitions, and claims.
- Worker: read [PATH] in full (page ranges for PDFs) and extract recommendations, data points, examples, and references.
```

#### 4. Project Relevance Analysis

- Map how document content applies to the current project
- Check if patterns/tools/techniques mentioned are already implemented
- Gap analysis: document recommendations vs current project state

#### 5. Output

> Read `references/output-templates.md` for the full Mode 2 output format.

#### Fallback

If `Read` fails for a document format:
1. Check file extension and try alternative parsing
2. If binary format is unsupported, inform user and suggest converting to PDF/markdown
3. Never produce an analysis based on partial or failed reads

---
