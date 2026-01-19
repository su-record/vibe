---
description: Vibe framework capabilities overview. Auto-activates when working on vibe projects, asking about available features, or needing workflow guidance.
---
# Vibe Capabilities

Complete guide to vibe's scenario-driven development framework.

## Core Workflow

```
/vibe.spec → /vibe.run → /vibe.verify → /vibe.review
```

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/vibe.spec "feature"` | Create SPEC with PTCF structure + 8 parallel research |
| `/vibe.spec "feature" split` | Create multiple SPECs for large scope features |
| `/vibe.run "feature"` | Implement based on SPEC |
| `/vibe.run "feature" ultrawork` | Maximum performance mode |
| `/vibe.verify "feature"` | BDD scenario verification |
| `/vibe.review` | Parallel code review (13+ agents) |
| `/vibe.analyze` | Project analysis |
| `/vibe.reason "problem"` | Systematic reasoning |
| `/vibe.utils --e2e` | Playwright E2E testing |
| `/vibe.utils --diagram` | Generate diagrams |
| `/vibe.utils --ui "description"` | UI preview |
| `/vibe.utils --continue` | Session restore (load previous context) |
| `/vibe.utils --compound` | Document solutions |

## Built-in Tools

### Semantic Code Analysis

```bash
node -e "import('@su-record/vibe/tools').then(t => t.TOOL_NAME({...}))"
```

| Tool | Purpose |
|------|---------|
| `findSymbol` | Find symbol definitions |
| `findReferences` | Find all references |
| `analyzeComplexity` | Code complexity analysis |
| `validateCodeQuality` | Quality validation |

### Memory Management

| Tool | Purpose |
|------|---------|
| `startSession` | Start session (restore previous context) |
| `autoSaveContext` | Save current state |
| `saveMemory` | Save important decisions |
| `recallMemory` | Recall saved memory |
| `listMemories` | List saved memories |

## Orchestrator

### Background Agents

```bash
node -e "import('@su-record/vibe/orchestrator').then(o =>
  o.launchBackgroundAgent({ prompt: '...', agentName: '...' })
)"
```

## Multi-LLM Research (v2.5.0)

GPT/Gemini are automatically called within `/vibe.spec`:

```text
/vibe.spec "feature"
      ↓
[Claude] Draft SPEC
      ↓
[Parallel Research] 8 parallel tasks:
  - 4x Bash: GPT/Gemini (best practices + security)
  - 4x Task: Claude agents (docs, patterns, advisories)
      ↓
[SPEC Review] GPT + Gemini parallel review
      ↓
[Claude] Finalize SPEC
```

| Phase | Method | Tasks |
|-------|--------|-------- |
| Research | `llm-orchestrate.js` via Bash | GPT best practices, GPT security, Gemini best practices, Gemini security |
| Research | Task tool (Claude agents) | framework-docs, codebase-patterns, best-practices, security-advisory |
| SPEC Review | `llm-orchestrate.js` via Bash | SPEC quality validation |
| Docs | context7 MCP | Latest library documentation |

**Setup:**
```bash
vibe gpt auth       # Enable GPT
vibe gemini auth    # Enable Gemini
vibe status         # Check current settings
```

## ULTRAWORK Mode

Add `ultrawork` or `ulw` for maximum performance:

- Parallel subagent exploration (3+ concurrent)
- Background agents preparing next phase
- Phase pipelining (no wait between phases)
- Boulder Loop (auto-progress until complete)
- Auto-retry on errors (max 3 times)
- Auto-compress at 70%+ context

## Review Agents (13+)

| Category | Agents |
|----------|--------|
| Security | security-reviewer, data-integrity-reviewer |
| Performance | performance-reviewer, complexity-reviewer |
| Architecture | architecture-reviewer, simplicity-reviewer |
| Language | python, typescript, rails, react reviewers |
| Context | git-history, test-coverage reviewers |

## Project Structure

```
# Global (~/.claude/)
~/.claude/
├── commands/          # Slash commands
├── agents/            # Sub-agents
├── skills/            # Auto-activated guides
└── vibe/
    ├── rules/         # Coding rules
    ├── languages/     # Language guides
    └── templates/     # Templates

# Global (%APPDATA%/vibe/ or ~/.config/vibe/)
vibe/
├── hooks/scripts/     # Hook scripts (llm-orchestrate.js)
├── gpt.json           # GPT credentials
└── gemini.json        # Gemini credentials

# Project (.claude/)
.claude/
├── settings.local.json  # Hooks config (personal, gitignored)
└── vibe/
    ├── specs/           # SPEC documents
    ├── features/        # BDD scenarios
    ├── config.json      # Project config
    └── constitution.md  # Project rules
```

## Context Management

- Session start: Auto-restore previous context
- 70/80/90%: Auto-save checkpoints
- Context overflow: Use `saveMemory` → `/new`

## Without Commands

Even without `/vibe.*` commands, you can:

1. Call tools directly via node commands
2. Reference skills for guidance
3. Apply coding rules from `~/.claude/vibe/rules/` (global)
