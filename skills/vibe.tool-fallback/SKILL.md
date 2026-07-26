---
name: vibe.tool-fallback
invocation: [auto]
tier: optional
description: "Use when a tool or provider returns API errors, search failures, timeouts, 429, 5xx, or overload responses and a circuit-breaker fallback is required."
triggers: [search failure, 429, 5xx, overloaded, fallback, circuit breaker, rate limit]
priority: 60
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
  → Still fails? → active harness knowledge (last resort, label uncertainty)
```

### External LLM Fails

```
VibeOrchestrator.smartRoute({ type, prompt })
  → Primary LLM fails (429, 401, 5xx)
  → Skip to secondary LLM (no retry on rate limit)
  → Secondary fails → active harness handles directly
```

### File/Code Not Found

```
File-pattern search fails → Expand pattern: *.ts → **/*.ts → **/*
  → Use content-based text search
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

## Model Selection

Inherit the active session model by default. Use the configured provider/model
SSOT for external fallbacks instead of a hardcoded provider order. The only
permitted override is an `opus` tier for an explicitly requested deep
architecture review; if unavailable, keep the inherited model.

## Principles

1. **Never stop** — always find an alternative
2. **Try before asking** — exhaust alternatives before asking user
3. **Fail fast** — skip OPEN-circuit tools immediately
4. **Auto-recover** — test after 30s cooldown

## Done Criteria (K4)

- [ ] Work continued despite tool failure
- [ ] Alternative tool/method used successfully
- [ ] No unnecessary retries on rate-limited tools
