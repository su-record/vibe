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
| `/vibe.spec "feature"` | Create SPEC with PTCF structure + parallel research |
| `/vibe.run "feature"` | Implement based on SPEC |
| `/vibe.run "feature" ultrawork` | Maximum performance mode |
| `/vibe.verify "feature"` | BDD scenario verification |
| `/vibe.review` | Parallel code review (13+ agents) |
| `/vibe.analyze` | Project analysis |
| `/vibe.reason "problem"` | Systematic reasoning |
| `/vibe.utils --e2e` | Playwright E2E testing |
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

### Parallel Research (4 agents)

```bash
node -e "import('@su-record/vibe/orchestrator').then(o =>
  o.research('feature', ['stack1', 'stack2'])
)"
```

### Background Agents

```bash
node -e "import('@su-record/vibe/orchestrator').then(o =>
  o.launchBackgroundAgent({ prompt: '...', agentName: '...' })
)"
```

## MCP Integrations

| MCP | Purpose |
|-----|---------|
| vibe-gpt | GPT sub-agent (architecture, debugging) |
| vibe-gemini | Gemini sub-agent (UI/UX) |
| context7 | Latest library documentation |

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
.claude/
├── commands/          # Slash commands
├── agents/            # Sub-agents
├── skills/            # Auto-activated guides
└── vibe/
    ├── specs/         # SPEC documents
    ├── features/      # BDD scenarios
    ├── rules/         # Coding rules
    └── solutions/     # Documented solutions
```

## Context Management

- Session start: Auto-restore previous context
- 70/80/90%: Auto-save checkpoints
- Context overflow: Use `saveMemory` → `/new`

## Without Commands

Even without `/vibe.*` commands, you can:

1. Call tools directly via node commands
2. Use MCP integrations (gpt, gemini, context7)
3. Reference skills for guidance
4. Apply coding rules from `.claude/vibe/rules/`
