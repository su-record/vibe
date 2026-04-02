---
name: tool-fallback
tier: optional
description: "Tool failure fallback strategies with circuit breaker. Auto-activates on API errors, search failures, timeouts, 429, 5xx, overloaded errors."
triggers: [API error, search failure, timeout, 429, 5xx, overloaded, fallback, circuit breaker]
priority: 80
---

# Tool Fallback Strategies

## Pre-check (K1)

> Did a tool just fail? If the error is a simple typo or wrong path, fix the input first. This skill is for persistent failures (429, 5xx, timeouts).

## Circuit Breaker State Machine

```
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
| CLOSED | Normal operation, count failures |
| OPEN | Skip tool immediately, use alternative |
| HALF-OPEN | Allow 1 test request after cooldown |

## Decision Trees

### Web Search Fails

```
Web Search fails (429, 529, timeout)
  → Check circuit state
  → OPEN? → Skip to alternative immediately
  → CLOSED? → Try context7 for library docs
  → Still fails? → Claude's built-in knowledge (last resort)
```

### External LLM Fails

```
VibeOrchestrator.smartRoute({ type, prompt })
  → Primary LLM fails (429, 401, 5xx)
  → Skip to secondary LLM (no retry on rate limit)
  → Secondary fails → Claude handles directly
```

### File/Code Not Found

```
Glob fails → Expand pattern: *.ts → **/*.ts → **/*
  → Use Grep for content-based search
  → Check git log for file history
```

## Error Response Actions

| Error | Action | Circuit Impact |
|-------|--------|---------------|
| 429 Rate Limit | Skip to next alternative (don't retry) | +1 failure |
| 5xx Server Error | Retry with backoff, then switch | +1 failure |
| 529 Overloaded | Wait and retry once | +1 failure |
| Timeout | Split request or retry | +1 failure |
| 401/403 Auth | Re-auth or switch alternative | Don't count |

## Retry Strategy

```
Request → Check circuit
  ├─ OPEN → Use alternative immediately
  └─ CLOSED/HALF-OPEN → Try request
       ├─ Success → Reset failure count
       └─ Fail → Backoff (2s → 4s → 8s)
            └─ All retries failed → +1 failure
                 └─ failures ≥ 3 → OPEN circuit (30s)
                      └─ Use alternative
```

## LLM Priority by Task Type

| Task Type | Primary → Secondary → Fallback |
|-----------|-------------------------------|
| architecture, debugging | GPT → Gemini → Claude |
| uiux, code-analysis | Gemini → GPT → Claude |
| code-gen, general | Claude only |

## Principles

1. **Never stop** — always find an alternative
2. **Try before asking** — exhaust alternatives before asking user
3. **Fail fast** — skip OPEN-circuit tools immediately
4. **Auto-recover** — test after 30s cooldown

## Done Criteria (K4)

- [ ] Work continued despite tool failure
- [ ] Alternative tool/method used successfully
- [ ] No unnecessary retries on rate-limited tools
