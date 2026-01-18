---
description: Multi-LLM collaboration guide. Auto-activates for architecture review, design decisions, debugging, UI/UX consultation, complex problem solving, or when a different perspective is needed.
---
# Multi-LLM Orchestration

Guide for using GPT/Gemini as sub-agents in Claude Code via hooks.

## Calling GPT

Use `gpt-` or `gpt.` prefix:

| Situation | Example |
|-----------|---------|
| Architecture review | `gpt- Review this auth architecture: [code]` |
| Complex debugging | `gpt- Debug this error: [error message]` |
| Algorithm optimization | `gpt- Suggest better algorithm for: [problem]` |
| Security review | `gpt- Check security vulnerabilities in: [code]` |
| Technology decisions | `gpt- Compare Redis vs Memcached for caching` |

### Usage Examples

```
gpt- Review this authentication architecture: [code]
gpt.Review this REST API design
```

## Calling Gemini

Use `gemini-` or `gemini.` prefix:

| Situation | Example |
|-----------|---------|
| UI/UX consultation | `gemini- Improve UX for this login form` |
| Design system advice | `gemini- Suggest component structure` |
| Accessibility review | `gemini- Check a11y issues in this form` |
| User flow design | `gemini- Optimize this checkout flow` |

### Usage Examples

```
gemini- Improve UX for this login form
gemini.Suggest improvements for this dashboard
```

## When NOT to Use

- Simple implementation (Claude alone is sufficient)
- File read/write (use Claude's tools)
- Quick response needed (API latency exists)
- Tasks requiring project context (Claude has the context)

## Collaboration Patterns

### Pattern 1: Design Cross-check

```
Claude: Draft design
    ↓
gpt- Review this architecture: [design]
    ↓
Claude: Incorporate feedback into final design
```

### Pattern 2: Debugging Collaboration

```
Claude: Attempt problem analysis
    ↓
If stuck: gpt- Debug this issue: [error details]
    ↓
Claude: Apply GPT's suggestions
```

### Pattern 3: UI/UX Consultation

```
Claude: Implement feature
    ↓
gemini- Suggest UX improvements for: [component]
    ↓
Claude: Apply UX feedback
```

## API Key Setup

```bash
vibe gpt login      # Enable GPT (OAuth)
vibe gemini login   # Enable Gemini (OAuth)
vibe status         # Check current settings
```
