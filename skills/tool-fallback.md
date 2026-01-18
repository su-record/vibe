---
description: Tool failure fallback strategies with circuit breaker. Auto-activates on API errors, search failures, timeouts, 429, 5xx, overloaded errors.
---
# Tool Fallback Strategies

Guide for finding alternatives when tools fail to continue work.

## Circuit Breaker Pattern

Track tool failures and temporarily disable unreliable tools:

```
Tool State Machine:
┌─────────┐   3 failures   ┌─────────┐   30s cooldown   ┌─────────────┐
│ CLOSED  │ ─────────────→ │  OPEN   │ ───────────────→ │ HALF-OPEN   │
│ (normal)│                │ (block) │                  │ (test 1 req)│
└─────────┘                └─────────┘                  └─────────────┘
     ↑                                                        │
     │                      success                           │
     └────────────────────────────────────────────────────────┘
```

| State | Behavior |
|-------|----------|
| **CLOSED** | Normal operation, count failures |
| **OPEN** | Block all requests, use alternative immediately |
| **HALF-OPEN** | Allow 1 test request after cooldown |

**Per-tool tracking:**
```
GPT hook: failures=2, state=CLOSED
Gemini hook: failures=0, state=CLOSED
WebSearch: failures=3, state=OPEN (blocked until 14:32:00)
context7: failures=1, state=CLOSED
```

## When Web Search Fails

| Alternative | Method |
|-------------|--------|
| context7 plugin | `resolve-library-id` → `get-library-docs` |
| VibeOrchestrator | `smartWebSearch()` - auto fallback chain |
| Cached knowledge | Use Claude's built-in knowledge |

```
Web Search fails (429, 529, timeout)
    ↓
Check circuit breaker state
    ↓
If OPEN → Skip to alternative immediately
    ↓
If CLOSED → Try context7 for library docs
    ↓
If still fails: VibeOrchestrator.smartWebSearch()
    ↓
Last resort: Claude's built-in knowledge
```

## API Error Responses

| Error | Cause | Response | Circuit Breaker |
|-------|-------|----------|-----------------|
| 429 | Rate Limit | Exponential backoff | +1 failure count |
| 5xx | Server Error | Switch to alternative | +1 failure count |
| 529 | Overloaded | Wait and retry | +1 failure count |
| Timeout | Network | Split request or retry | +1 failure count |
| 401/403 | Auth Error | Re-auth or alternative | Don't count (auth issue) |

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

## When External LLM Fails

**Production (VibeOrchestrator):**

```
VibeOrchestrator.smartRoute({ type, prompt })
    ↓
LLM priority based on task type:
  - architecture/debugging: GPT → Gemini → Claude
  - uiux/code-analysis: Gemini → GPT → Claude
  - code-gen: Claude only
    ↓
Auto fallback on primary LLM failure
    ↓
Claude handles directly when all fail
```

**Test/Debug Hooks (development only):**

```
gpt- or gpt. [question] fails
    ↓
Check circuit: If OPEN, skip to next
    ↓
Try gemini- or gemini. [question] (similar capability)
    ↓
Try context7 (for docs)
    ↓
Claude solves alone
```

> **Note:** `test-gpt`, `test-gemini` prefixes are for hook connectivity testing only.
> For actual work, use VIBE commands (`/vibe.run`, `/vibe.spec`, etc.) and
> VibeOrchestrator will automatically select the appropriate LLM.

## Retry Strategy with Circuit Breaker

```
Request to tool
    ↓
Check circuit state
    ↓
┌─ OPEN? ──→ Use alternative immediately (no retry)
│
└─ CLOSED/HALF-OPEN? ──→ Try request
                              ↓
                         Success? ──→ Reset failure count
                              ↓ No
                         Retry with backoff:
                           retry(1): wait 2s
                           retry(2): wait 4s
                           retry(3): wait 8s
                              ↓
                         All failed? ──→ +1 failure, check threshold
                              ↓
                         failures >= 3? ──→ OPEN circuit for 30s
                              ↓
                         Use alternative
```

## VibeOrchestrator Smart Routing

VIBE commands (`/vibe.spec`, `/vibe.run`, etc.) use VibeOrchestrator internally.

### LLM Priority by Task Type

| Task Type       | Primary | Secondary | Fallback |
|-----------------|---------|-----------|----------|
| `architecture`  | GPT     | Gemini    | Claude   |
| `debugging`     | GPT     | Gemini    | Claude   |
| `uiux`          | Gemini  | GPT       | Claude   |
| `code-analysis` | Gemini  | GPT       | Claude   |
| `web-search`    | GPT     | Gemini    | Claude   |
| `code-gen`      | Claude  | -         | -        |
| `general`       | Claude  | -         | -        |

### Auto Fallback Logic

```
smartRoute({ type: 'architecture', prompt })
    ↓
1. Try GPT (max 2 retries)
    ↓ fails (429, 401, 5xx)
2. Try Gemini (max 2 retries)
    ↓ fails
3. Claude handles directly (fallback message)
```

### Retry vs Immediate Switch

| Error            | Action                 |
|------------------|------------------------|
| 429 Rate Limit   | Skip to next LLM       |
| 401/403 Auth     | Skip to next LLM       |
| Network Error    | Retry with backoff     |
| 5xx Server Error | Retry then switch      |

### Availability Cache

- 5-minute TTL for LLM status cache
- Auto-disable after 3 consecutive failures
- Failed LLMs are skipped in subsequent requests

## Principles

1. **Never stop** - Always find an alternative
2. **Before asking user** - Try alternatives first
3. **Track failures** - Open circuit after 3 consecutive failures
4. **Auto-recover** - Test after 30s cooldown
5. **Fail fast** - Skip blocked tools immediately
