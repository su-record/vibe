---
description: Context7 MCP for latest library documentation. Auto-activates when docs, documentation, latest version, official docs, API reference, or library help is needed.
---
# Context7 Usage

Guide for searching latest library/framework documentation using Context7 MCP.

## When to Use

| Situation | Example |
|-----------|---------|
| Latest API check | "React 19 use() hook usage" |
| Version differences | "Next.js 15 changes" |
| Official docs needed | "Prisma schema syntax" |
| Migration guide | "Vue 2 → Vue 3 migration" |

## Usage (2 Steps)

### Step 1: Find Library ID

```
mcp__context7__resolve-library-id({
  libraryName: "react"
})
```

Returns: `/facebook/react`, `/vercel/next.js`, etc.

### Step 2: Get Documentation

```
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/facebook/react",
  topic: "hooks"  // optional: specific topic only
})
```

## Common Library IDs

| Library | Context7 ID |
|---------|-------------|
| React | /facebook/react |
| Next.js | /vercel/next.js |
| Vue | /vuejs/vue |
| Svelte | /sveltejs/svelte |
| Express | /expressjs/express |
| Prisma | /prisma/prisma |
| TypeScript | /microsoft/typescript |

## Search Tips

```
# Broad search
topic: omit → full documentation

# Narrow search
topic: "authentication" → auth related only

# Specific feature
topic: "server components" → server components only
```

## Web Search vs Context7

| Aspect | Web Search | Context7 |
|--------|------------|----------|
| Speed | Slow | Fast |
| Accuracy | Blogs mixed in | Official docs only |
| Freshness | Variable | Always latest |
| Reliability | Medium | High |

**Prefer Context7 for library documentation**

## Fallback When Fails

```
context7 fails
    ↓
Web Search for official docs
    ↓
gpt- [library question]
```
