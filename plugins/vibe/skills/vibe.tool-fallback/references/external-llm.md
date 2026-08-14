# External LLM Fallback

Load only for external LLM failures.

```
VibeOrchestrator.smartRoute({ type, prompt })
  → Primary LLM fails (429, 401, 5xx)
  → Skip to secondary LLM (no retry on rate limit)
  → Secondary fails → active harness handles directly
```
