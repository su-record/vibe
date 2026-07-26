# File and Code Lookup Fallback

Load only for file or code lookup failures.

```
File-pattern search fails → Expand pattern: *.ts → **/*.ts → **/*
  → Use content-based text search
  → Check git log for file history
```
