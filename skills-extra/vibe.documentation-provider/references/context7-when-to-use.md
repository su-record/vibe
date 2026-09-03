# Context7: When to Use vs Direct Docs

## Use Context7 When

| Situation | Signal |
|-----------|--------|
| Library version matters | "React 19", "Next.js 15", "Prisma 6" |
| API changed recently | Migration guides, deprecated methods |
| Official syntax needed | Schema definitions, config options |
| Knowledge cutoff risk | Any library updated after Aug 2025 |
| User asks "latest" or "current" | Explicit freshness requirement |

**Examples where context7 is the right call:**
- Next.js App Router file conventions
- Prisma schema relation syntax
- shadcn/ui component props
- Tailwind v4 config format

## Skip Context7 When

| Situation | Better Alternative |
|-----------|-------------------|
| Stable, well-known API | Claude's built-in knowledge (useState, Array.map) |
| Conceptual question | Reason directly — no docs needed |
| Project-specific code | Read the actual source file |
| Error message debugging | Grep codebase first |
| You already have the docs open | Don't duplicate the search |

**Examples where context7 is overkill:**
- "How does useEffect work?" — stable React API
- "What does Array.reduce do?" — JS standard lib
- "Why is this TypeScript error appearing?" — analyze the code

## Cost Awareness

Context7 spawns a subagent, which adds latency (~2-5s) and consumes extra tokens. Only invoke when the freshness or official accuracy is worth that cost.

## Decision Rule

> Would a wrong answer here cause a bug or wasted time? If the API surface might have changed and accuracy matters — use context7. If it's general knowledge — answer directly.

## Fallback

If context7 is unavailable or returns no results:

```
1. /plugin install context7  ← if not installed
2. Web Search for official docs
3. Claude knowledge with explicit note: "verify against latest docs"
```
