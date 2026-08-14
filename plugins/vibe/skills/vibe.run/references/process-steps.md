# vibe.run — Process Steps 1–8 (상세)

> vibe.run SKILL.md 의 Process 표에서 참조. 각 단계의 전체 절차·체크포인트 템플릿·코드 예시.

### 1. Load SPEC + Feature

**Search order:**
```
Step 1: Check split structure (folder)
  .vibe/specs/{feature-name}/        → Folder: _index.md + phase files
  .vibe/features/{feature-name}/     → Folder: _index.feature + phase files

Step 2: If no folder, check single file
  .vibe/specs/{feature-name}.md
  .vibe/features/{feature-name}.feature

Step 3: If neither → Error: "Run /vibe.spec first"
```

**Split structure:** Load `_index.md` first, then phase files in order. Execute phases sequentially (or per `--phase` flag).

### 1-0. Compile + validate execution packet (MANDATORY)

For a monolithic SPEC, compile it after resolving the canonical path. For a split SPEC, do not compile `_index.md`; defer this step until each active phase file is loaded in Phase Isolation Step B. Compile with `writeExecutionPacket`, then immediately verify the saved artifact with `validateExecutionPacket`.

```bash
node -e "import('file://{{VIBE_PATH}}/dist/tools/index.js').then(t => {
  const projectPath=process.cwd(), specPath='.vibe/specs/{feature-name}.md';
  const profile='{codex-or-claude-code}';
  const written=t.writeExecutionPacket({projectPath,specPath,profile});
  if(!written.ok){console.error(JSON.stringify(written.errors));process.exit(1)}
  const checked=t.validateExecutionPacket({projectPath,specPath,packetPath:written.packetPath});
  if(!checked.valid){console.error(checked.code);process.exit(1)}
  console.log(written.packetPath);
})"
```

- Codex uses profile `codex`; Claude Code uses `claude-code`.
- Split SPECs compile each active `phase-N-*.md` immediately before that phase runs; `_index.md` remains the overview ANCHOR and is not treated as a phase contract.
- Use the packet only when validation returns `valid: true`.
- `STALE_PACKET`, invalid packet, preservation-audit failure, or budget failure is blocking: recompile from the canonical SPEC and never silently fall back to an unvalidated packet.
- The packet is a derived execution view. The canonical SPEC remains the ANCHOR and source of truth.

### 1-1. Phase Isolation Protocol (Large SPEC Guard, MANDATORY for 3+ phases)

```
Step A: Read _index.md (overview only — phase list, REQ IDs)
Step B: For each Phase N:
  1. RE-READ Phase N SPEC section (every time, no memory)
  2. Compile + validate Phase N execution packet using the phase file path
  3. RE-READ Phase N Feature scenarios
  4. Extract Phase N scope: files, scenarios, requirements
  5. Implement Phase N scenarios
  6. Verify Phase N
  7. Write Phase Checkpoint → .vibe/checkpoints/
  8. DISCARD Phase N details from working memory
Step C: Next Phase
```

**Phase Checkpoint** (`.vibe/checkpoints/{feature}-phase-{N}.md`):

```markdown
# Checkpoint: {feature} Phase {N}

## Completed
- Scenario 1: {name} ✅

## Files Changed
- src/auth.service.ts (added login(), validateToken())

## State for Next Phase
- Auth service exports: login(), logout(), validateToken()

## Remaining Phases
- Phase {N+1}: {name} — {scenario count} scenarios
```

**SPEC Re-anchoring (Before EVERY scenario):** Re-read the EXACT Given/When/Then from Feature file (not from memory). Compare: "Am I implementing what the SPEC says, or what I think it says?"

**Scope Lock (Per Phase):**

```
At Phase start, declare:
  MODIFY: [list of files this phase will touch]
  CREATE: [list of files this phase will create]
  DO NOT TOUCH: everything else
```

**Context Pressure:**

| Context Level | Action |
|---------------|--------|
| < 50% | Normal execution |
| 50-85% | Save checkpoint, trim exploration results |
| 85%+ | Save checkpoint → `/new` → resume from checkpoint |
| Phase boundary | Always save checkpoint |

### 1-2. SPEC-First Gate

> SPEC is the source of truth for code. To modify code, update the SPEC first.

```
Discovery: "An API endpoint not in SPEC is needed"
    ├─ Already in SPEC? YES → Implement
    ├─ Not in SPEC but within scope? → Add to SPEC + Feature → Implement
    └─ Outside scope? → TODO in .vibe/todos/out-of-scope-{item}.md
```

SPEC changes and code changes must be in the **same commit**.

### 2. Extract Scenario List

```markdown
| # | Scenario | Status |
|---|----------|--------|
| 1 | Valid login success | ⬜ |
| 2 | Invalid password error | ⬜ |
```

### 3. Scenario-by-Scenario Implementation

> Read `references/parallel-agents.md` for full parallel exploration patterns, background agents, parallel subagent group selection, and model routing.

**For each scenario:**
1. [Parallel exploration] Delegate up to 3 independent workers through native collaboration — related code, deps, patterns. Claude Code maps workers to Task/Agent; Codex maps them to native collaboration; inherit the session model by default.
2. [Implement] Write/edit the minimum required code
3. [Verify] Check Given/When/Then; E2E if UI scenario
4. [Auto-fix loop] On failure: collect evidence → root cause → fix → re-verify

**UI/UX Design Intelligence (auto-triggered before Phase 1 if UI keywords in SPEC):**
- Delegate `design-system-gen` through native collaboration: framework-specific component guidelines + chart/viz library advice (viz advice conditional on chart keywords). Inherit the session model.
- Load `.vibe/design-system/{project}/MASTER.md` if present

### 4. Brand Assets (New project only)

> Read `references/brand-assets.md` when SPEC contains brand context and this is the first run.

Trigger conditions: first run (no favicon.ico) + SPEC has brand context + Antigravity API key configured.

### 5. Race Code Review

> Read `references/race-review.md` for full Race Review invocation, confidence matrix, and quality gate thresholds.

After all scenarios: GPT + Antigravity review in parallel. ULTRAWORK enables this by default.

### 6. Quality Report (Auto-generated)

```
┌─────────────────────────────────────────────────────────────────┐
│  QUALITY REPORT: {feature}                                       │
├─────────────────────────────────────────────────────────────────┤
│  Scenarios: N/N passed                                          │
│  Quality score: 94/100                                          │
│  Build: ✅ | Tests: ✅ | Types: ✅ | Race review: ✅             │
│  Started: {start_time}  Completed: {system clock result}        │
└─────────────────────────────────────────────────────────────────┘
```

### 7. Update Feature File

Auto-update scenario status with `Last verified` timestamp and quality score.

### 8. Coverage Verification Loop (RTM)

> 루프 시맨틱은 `vibe/rules/loop-contract.md`를 따른다. 여기서의 exit 기준은 `coveragePercent === 100`. RTM 다이어그램, 출력 형식, 반복 규칙: `references/coverage-loop.md`

After ALL phases complete:

```bash
# generateTraceabilityMatrix is synchronous — no .then()
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => { const r = t.generateTraceabilityMatrix('{feature-name}', {projectPath: process.cwd()}); console.log(JSON.stringify(r, null, 2)); })"
```

> Default SPEC path is `.vibe/specs/<feature>.md`. `status === 'empty'` must be treated as failed/not-applicable — never as 100% pass.

JUDGE: `coveragePercent === 100` → 루프 종료. stuck(연속 2회 동일 발견 해시 — `loop-ledger.js check-stuck`; 커버리지 수치가 아니라 발견으로 판정한다) → **어느 automationLevel 에서도 루프를 종료한다**; confirm이면 사용자 질문, autonomous이면 TODO 기록 후 다음 독립 단위로. 미달 커버리지를 완료로 기록하지 않는다 (SSOT: `vibe/rules/loop-contract.md`).

---

