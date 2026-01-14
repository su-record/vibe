---
description: Multi-LLM collaboration guide. Auto-activates for architecture review, design decisions, debugging, UI/UX consultation, complex problem solving, or when a different perspective is needed.
---
# Multi-LLM Orchestration

Guide for using GPT/Gemini as sub-agents in Claude Code.

## When to Use GPT (mcp__vibe-gpt)

| Situation | Reason |
|-----------|--------|
| Architecture design/review | Get different perspective on design |
| Complex debugging | Fresh eyes on the problem |
| Algorithm optimization | Alternative algorithm suggestions |
| Security review | Cross-check vulnerabilities |
| Technology decisions | Compare pros/cons |

### Usage

```
mcp__vibe-gpt__gpt_chat({
  prompt: "Review this auth architecture: [code/description]",
  model: "gpt-5.2-codex"  // coding specialized
})
```

### Recommended Models

| Model | Use Case |
|-------|----------|
| gpt-5.2 | General purpose (default) |
| gpt-5.2-codex | Coding specialized |
| gpt-5.1-codex-mini | Quick responses needed |

## When to Use Gemini (mcp__vibe-gemini)

| Situation | Reason |
|-----------|--------|
| UI/UX design consultation | User experience perspective |
| Design system advice | Component structuring |
| Accessibility (a11y) review | Accessibility guidelines |
| User flow design | UX optimization |

### Usage

```
mcp__vibe-gemini__gemini_chat({
  prompt: "Suggest UX improvements for this login form: [description]"
})
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
GPT: Architecture review (mcp__vibe-gpt__gpt_analyze_architecture)
    ↓
Claude: Incorporate feedback into final design
```

### Pattern 2: Debugging Collaboration

```
Claude: Attempt problem analysis
    ↓
If stuck, ask GPT (mcp__vibe-gpt__gpt_debug)
    ↓
Claude: Apply GPT's suggestions
```

### Pattern 3: UI/UX Consultation

```
Claude: Implement feature
    ↓
Gemini: Suggest UX improvements (mcp__vibe-gemini__gemini_chat)
    ↓
Claude: Apply UX feedback
```

## API Key Setup

```bash
vibe gpt <api-key>      # Enable GPT
vibe gemini <api-key>   # Enable Gemini
vibe status             # Check current settings
```
