# Web Search Fallback

Load only for web search failures.

```
Web Search fails (429, 529, timeout)
  → Check circuit state
  → OPEN? → Skip to alternative immediately
  → CLOSED? → Try Context7 for library docs
  → Still fails? → active harness knowledge (last resort, label uncertainty)
```
