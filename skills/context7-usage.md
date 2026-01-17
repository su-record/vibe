---
description: Context7 plugin for latest library documentation. Auto-activates when docs, documentation, latest version, official docs, API reference, or library help is needed.
---

# Context7 Usage

Guide for searching latest library/framework documentation using Context7 plugin with subagent isolation.

## Why Subagent Approach?

| Approach | Problem |
|----------|---------|
| Direct MCP call | Docs content fills main context, causing bloat |
| Subagent isolation | Docs queried in separate context, only results returned |

**Benefits:**

- Prevents context bloat during long coding sessions
- Solves knowledge cutoff problem with latest docs
- Main context stays focused on implementation

## When to Use

| Situation | Example |
|-----------|---------|
| Latest API check | "React 19 use() hook usage" |
| Version differences | "Next.js 15 changes" |
| Official docs needed | "Prisma schema syntax" |
| Migration guide | "Vue 2 → Vue 3 migration" |

## How It Works

```
User asks library question
    ↓
Skill detects docs need
    ↓
Spawn docs-researcher subagent (haiku)
    ↓
Subagent calls context7 in isolated context
    ↓
Returns only relevant info to main context
```

## Usage

### Automatic (Recommended)

Just ask library/API questions naturally:

```
"How do I use React 19 use() hook?"
"What's new in Next.js 15?"
"Prisma many-to-many relation syntax"
```

The skill auto-detects and spawns a docs-researcher subagent.

### Manual Command

```
/context7:docs <library> [query]
```

Examples:

```
/context7:docs react hooks
/context7:docs next.js app router
/context7:docs prisma relations
```

## Implementation Pattern

When you detect a library/API documentation need, spawn a subagent:

```
Task tool call:
- subagent_type: Explore
- model: haiku
- prompt: "Use context7 to find [library] documentation about [topic]. Return only the relevant API usage examples and key points."
```

The subagent handles the context7 calls and returns a summary, keeping main context clean.

## Fallback Chain

```
context7 plugin not installed
    ↓
Prompt user: /plugin marketplace add upstash/context7
    ↓
If still unavailable: Web Search for official docs
```

## Installation

If context7 is not installed, guide user:

```bash
/plugin marketplace add upstash/context7
/plugin install context7-plugin@context7-marketplace
```
