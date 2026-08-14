# vibe.run — Tools, Guidelines & Retrospective

> vibe.run SKILL.md 에서 참조. 시맨틱 분석·메모리 도구, 코딩 가이드라인, rules 참조표, TRUST 5, 자동 회고 템플릿.

## Core Tools (Semantic Analysis & Memory)

```bash
# All tools via:
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

| Tool | Purpose |
|------|---------|
| `analyzeComplexity` | Analyze code complexity |
| `validateCodeQuality` | Validate code quality |
| `saveMemory` | Save important decisions |
| `recallMemory` | Recall saved memory |
| `listMemories` | List all memories |

Session management: explicitly load the latest checkpoint at start and persist a
checkpoint before context reset. Lifecycle hooks may accelerate those steps when
available, but completion never depends on them.

---

## Coding Guidelines (Mandatory)

> Read `references/race-review.md` for full type safety guidelines, language-specific examples, and the type-violation detection/escalation table.

**TypeScript — core rule:**
```typescript
// BAD
function process(data: any): any { return data.foo; }

// GOOD
function process(data: unknown): Result {
  if (isValidData(data)) return data.foo;
  throw new Error('Invalid');
}
```

No `any` / `as any` / `@ts-ignore` — fix at root. Explicit return types on all functions.

**Detection outcome:** Run the project's explicit static type check and treat a
non-zero exit as JUDGE failure. Harness diagnostics or auto-commit hooks may
surface the same violations earlier, but they do not replace the command result.

---

## Rules Reference

- `core/development-philosophy.md` — Surgical precision, modify only requested scope
- `core/quick-start.md` — Korean, DRY, SRP, YAGNI
- `standards/complexity-metrics.md` — Functions ≤50 lines, nesting ≤3 levels
- `quality/checklist.md` — Code quality checklist
- Language guide: `~/.claude/vibe/languages/{stack}.md`

---

## TRUST 5 Principles

| Principle | Description |
|-----------|-------------|
| **T**est-first | Write tests first |
| **R**eadable | Clear code |
| **U**nified | Consistent style |
| **S**ecured | Consider security |
| **T**rackable | Logging, monitoring |

---

## Auto-Retrospective (Post-Implementation)

After ALL phases complete, save to `.vibe/retros/{feature-name}.md`:

```markdown
## Retrospective: {feature-name}
### What Worked / What Didn't / Key Decisions / Lessons Learned
```

Keep under 20 lines. Record key lessons in the project progress/checkpoint artifact and update `claude-progress.txt`.

---

