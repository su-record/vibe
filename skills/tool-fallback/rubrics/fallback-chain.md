# Tool Fallback Priority Chain

## Web / Documentation Search

```
1. Web Search (Brave/Tavily)
2. context7 plugin          ← library/framework docs
3. Claude built-in knowledge ← last resort, may be stale
```

**Skip to step 2 immediately** for library/API questions — context7 is faster and more accurate than web search for docs.

## Code/File Discovery

```
1. Glob (pattern match by name)
2. Grep (content search)
3. git log --all -- <path>  ← file was deleted or renamed
4. Ask user for path        ← exhausted all options
```

## LLM Routing

| Task Type | Primary | Secondary | Fallback |
|-----------|---------|-----------|----------|
| Architecture, debugging | GPT | Gemini | Claude direct |
| UI/UX, code analysis | Gemini | GPT | Claude direct |
| Code generation, general | Claude | — | — |

**On 429 / rate limit**: skip to secondary immediately — no retry on rate-limited primary.

## External API Calls

```
1. Try primary endpoint
2. On 429: skip to alternative, mark circuit OPEN
3. On 5xx: retry once with backoff (2s), then skip
4. On timeout: retry once with smaller payload, then skip
5. On 401/403: re-auth, do NOT count as circuit failure
```

## Circuit States

| State | Trigger | Recovery |
|-------|---------|----------|
| CLOSED | Normal | — |
| OPEN | 3 failures | Auto after 30s cooldown |
| HALF-OPEN | After cooldown | 1 test request; success → CLOSED |

## Never-Stop Rule

Every chain must have a terminal fallback that produces **some** output. Acceptable terminal fallbacks:

- Partial result with `TODO` annotation
- Claude's own knowledge with explicit uncertainty note
- Ask the user for the missing piece (with specific question)

**Never** return empty-handed without exhausting the chain first.
