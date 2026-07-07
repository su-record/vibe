# Review Worked Examples — Full Reference

> Loaded by vibe.review SKILL.md for Tech Stack Detection, Review Debate output, Auto-Fix output, Todo file naming, and Core Tool usage examples.

## Phase 1 Tech Stack Detection — Full Detection List

```
Read package.json      -> TypeScript, React, Node.js
Read pyproject.toml    -> Python, FastAPI, Django
Read Gemfile           -> Ruby, Rails
Read pubspec.yaml      -> Flutter, Dart
Read go.mod            -> Go
Read CLAUDE.md         -> Explicit tech stack declaration
```

## Phase 4.5 Review Debate — Example Output

**토론 결과 예시:**

```
🤝 REVIEW DEBATE RESULTS

Consensus (4 parallel reviewers):

✅ Validated P1 (unanimous):
  1. [SECURITY] SQL Injection — 4/4 agree critical

⬆️ Upgraded P2→P1 (debate result):
  2. [PERF] Unbounded query — code-reviewer (focus: architecture) pointed out
     cascading failure risk under load → agreed P1

⬇️ Downgraded P1→P2 (debate result):
  3. [SECURITY] CSRF on read-only endpoint — code-reviewer (focus: complexity)
     noted endpoint has no side effects → agreed P2

❌ Removed (false positive):
  4. [ARCH] "Circular dependency" — code-reviewer (focus: architecture) confirmed
     this is intentional bi-directional reference, not a cycle

🆕 New findings (cross-review discussion):
  5. [DATA] Race condition in concurrent updates — emerged from
     security + performance cross-review
```

## Phase 5 Auto-Fix — Example Output

```
🔧 AUTO-FIX Starting...

P1 Critical:
  1. [SECURITY] SQL Injection → Fixed with parameterized query ✅
  2. [DATA] Missing transaction rollback → Added try-finally ✅

P2 Important:
  3. [PERF] N+1 query → Added select_related ✅
  4. [ARCH] Circular dependency → Separated dependencies ✅
  5. [TEST] Missing edge case → Added test ✅

🔍 Re-validating...
  ✅ Build successful
  ✅ Tests passed

✅ 5 issues auto-fixed!
```

## Phase 6 Todo File Creation — Naming Examples

```
{priority}-{category}-{short-desc}.md

Examples:
- P2-arch-large-refactor.md  (Cannot be auto-fixed)
- P3-style-extract-helper.md (Backlog)
```

## Core Tools — Example Tool Usage in Review

**1. Validate code quality before review:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.validateCodeQuality({targetPath: 'src/', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**2. Analyze complexity of changed files:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.analyzeComplexity({targetPath: 'src/api/users.ts', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```

**3. Save critical finding for reference:**

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.saveMemory({key: 'review-pr123-critical', value: 'SQL injection in users.py:42', category: 'review', projectPath: process.cwd()}).then(r => console.log(r.content[0].text)))"
```
