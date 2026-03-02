---
name: core-capabilities
description: "Core framework capabilities overview. Auto-activates when working on core projects, asking about available features, or needing workflow guidance."
triggers: [core, capabilities, features, workflow, framework guide]
priority: 50
---

# Core Capabilities

## Pre-check (K1)

> Need to call VIBE tools directly or understand orchestrator patterns? For slash commands and workflow, check CLAUDE.md first — it covers `/vibe.spec`, `/vibe.run`, `/vibe.review`, etc.

## Direct Tool Invocation (Not in CLAUDE.md)

Call built-in tools without slash commands:

```bash
# Semantic code analysis
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.findSymbol({symbol: 'UserService'}))"
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.analyzeComplexity({filePath: 'src/service.ts'}))"

# Background agent via orchestrator
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(o => o.launchBackgroundAgent({prompt: '...', agentName: '...'}))"

# Parallel research
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(o => o.research('topic', ['React']).then(r => console.log(r.content[0].text)))"
```

## Available Tools

| Category | Tools |
|----------|-------|
| Code Analysis | `findSymbol`, `findReferences`, `analyzeComplexity`, `validateCodeQuality` |
| Memory | `startSession`, `autoSaveContext`, `saveMemory`, `recallMemory`, `listMemories` |

## Context Thresholds

| Threshold | Action |
|-----------|--------|
| 70% | `autoSaveContext` checkpoint |
| 80% | Warning + save |
| 90% | Critical — `saveMemory` → `/new` → `/vibe.utils --continue` |

## Done Criteria (K4)

- [ ] Tool call executed successfully (non-empty result)
- [ ] Context saved before reaching 90% threshold
