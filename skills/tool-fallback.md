---
description: Tool failure fallback strategies. Auto-activates on API errors, search failures, timeouts, 429, 5xx, overloaded errors.
---
# Tool Fallback Strategies

Guide for finding alternatives when tools fail to continue work.

## When Web Search Fails

| Alternative | Method |
|-------------|--------|
| context7 MCP | `mcp__context7__get-library-docs` |
| vibe-gpt | `mcp__vibe-gpt__gpt_chat` |
| Cached knowledge | Use Claude's built-in knowledge |

```
Web Search fails (429, 529, timeout)
    ↓
Try context7 for library docs
    ↓
If still fails, ask GPT
    ↓
Last resort: Claude's built-in knowledge
```

## API Error Responses

| Error | Cause | Response |
|-------|-------|----------|
| 429 | Rate Limit | Exponential backoff retry (2-4-8s) |
| 5xx | Server Error | Switch to alternative tool |
| 529 | Overloaded | Wait and retry or use alternative |
| Timeout | Network | Split request or retry |

## When File/Code Not Found

```
Glob fails
    ↓
Expand pattern: *.ts → **/*.ts → **/*
    ↓
Use Grep for content-based search
    ↓
Check git log for history
```

## When MCP Fails

```
vibe-gpt fails
    ↓
Try vibe-gemini (similar capability)
    ↓
Try context7 (for docs)
    ↓
Claude solves alone
```

## Retry Strategy

```typescript
// Exponential backoff
retry(1): wait 2s
retry(2): wait 4s
retry(3): wait 8s
retry(4): give up → use alternative
```

## Principles

1. **Never stop** - Always find an alternative
2. **Before asking user** - Try alternatives first
3. **Log failures** - Prevent same failure later
