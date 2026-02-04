---
description: Core framework capabilities overview. Auto-activates when working on core projects, asking about available features, or needing workflow guidance.
---
# Core Capabilities

Complete guide to core's scenario-driven development framework.

## Core Workflow

```
/su.spec → /su.run → /su.verify → /su.review
```

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/su.spec "feature"` | Create SPEC with PTCF structure + 8 parallel research |
| `/su.spec "feature" split` | Create multiple SPECs for large scope features |
| `/su.run "feature"` | Implement based on SPEC |
| `/su.run "feature" ultrawork` | Maximum performance mode |
| `/su.verify "feature"` | BDD scenario verification |
| `/su.review` | Parallel code review (13+ agents) |
| `/su.analyze` | Project analysis |
| `/su.reason "problem"` | Systematic reasoning |
| `/su.utils --e2e` | Playwright E2E testing |
| `/su.utils --diagram` | Generate diagrams |
| `/su.utils --ui "description"` | UI preview |
| `/su.utils --continue` | Session restore (load previous context) |
| `/su.utils --compound` | Document solutions |

## Built-in Tools

### Semantic Code Analysis

```bash
node -e "import('@su-record/core/tools').then(t => t.TOOL_NAME({...}))"
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
node -e "import('@su-record/core/orchestrator').then(o =>
  o.launchBackgroundAgent({ prompt: '...', agentName: '...' })
)"
```

## Multi-LLM Research (v2.5.0)

GPT/Gemini are automatically called within `/su.spec`:

```text
/su.spec "feature"
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
su gpt auth       # Enable GPT
su gemini auth    # Enable Gemini
su status         # Check current settings
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
└── core/
    ├── rules/         # Coding rules
    ├── languages/     # Language guides
    └── templates/     # Templates

# Global (%APPDATA%/core/ or ~/.config/core/)
core/
├── hooks/scripts/     # Hook scripts (llm-orchestrate.js)
├── gpt.json           # GPT credentials
└── gemini.json        # Gemini credentials

# Project (.claude/)
.claude/
├── settings.local.json  # Hooks config (personal, gitignored)
└── core/
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

Even without `/su.*` commands, you can:

1. Call tools directly via node commands
2. Reference skills for guidance
3. Apply coding rules from `~/.claude/core/rules/` (global)
