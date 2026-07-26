# /vibe.docs agent — Agent Instruction Files (CLAUDE.md / AGENTS.md)

> vibe.docs SKILL.md 의 서브커맨드 표에서 **`agent` 가 선택됐을 때만** 로드한다.

### `/vibe.docs agent` — Agent Instruction Files (CLAUDE.md / AGENTS.md)

**CLI ↔ file mapping:**

| CLI | File | Support |
|---|---|---|
| Claude Code | `CLAUDE.md` | 100% (Primary) |
| Codex | `AGENTS.md` | 100% (Primary) |
| Antigravity CLI | `GEMINI.md` | 100% |

Cursor is not supported — do not generate or check Cursor-specific context files.

**Source of truth:**
- **`CLAUDE.md` is the content SSOT.** Always edit it first; `AGENTS.md` is a regenerated derivative.
- Behavioral block: `skills/vibe.docs/templates/behavioral-principles.md` (4 Karpathy principles, wrapped in `<!-- VIBE-BEHAVIORAL:START/END -->` markers).

**Procedure (applies to both creation and modification):**

1. **Detect state** — check which of `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` exist in project root. **`CLAUDE.md` is always the SSOT**; if missing, create it first (never derive from AGENTS.md).
2. **For `AGENTS.md`**:
   - **If missing** → create by cloning `CLAUDE.md` + applying CLI substitution (below).
   - **If exists** → regenerate from current `CLAUDE.md` + substitution, preserving user-specific additions outside the VIBE block.
3. **For `GEMINI.md`**:
   - **If missing** → create by cloning `CLAUDE.md` + applying Antigravity substitution.
   - **If exists** → regenerate from current `CLAUDE.md` + substitution, preserving user-specific additions outside the VIBE block.
4. **CLI substitution for `AGENTS.md`** (Codex): `Claude Code` → `Codex` · `~/.claude/` → `~/.codex/` · `.claude/` → `.codex/` · `CLAUDE.md` → `AGENTS.md`. `CLAUDE.md` itself gets no substitution.
5. **CLI substitution for `GEMINI.md`** (Antigravity): `Claude Code` → `Antigravity CLI` · `~/.claude/` → `~/.gemini/` · `.claude/` → `.gemini/` · `CLAUDE.md` → `GEMINI.md`.
6. **Validate every touched file (whether newly created or modified)** via the `agents-md` skill — see validation block below. **Never write or save without running this step.**
7. Report per file: created / updated / skipped / validation warnings.

**Idempotent:** Re-running re-syncs the behavioral block and re-applies substitutions without duplication.

**Mandatory validation (every create & every update) — Load skill `vibe.agents-md`:**

- Size target 60–150 lines (Optimal). Warn at 200+, force split/trim at 300+.
- 4-question check per line (outside `VIBE-BEHAVIORAL` block):
  - Would the agent make a mistake without this? (No → delete)
  - Needed every session? (No → move to SPEC/plan)
  - Can a linter/hook replace it? (Yes → move)
  - Discoverable from code? (Yes → delete)
- Lost-in-the-Middle: critical rules at top, frequently-violated rules at bottom.
- Addy Osmani test: "Can the agent discover this by reading the code?" → Yes = delete.
- Strip tech-stack name-drops already stated in `package.json`.

Report line ranges to trim per file. Do not auto-delete; surface findings for user approval before finalizing.

**When to run:**
- After `vibe init` / `vibe update` if `CLAUDE.md` or `AGENTS.md` is missing or out of sync.
- After upgrading `@su-record/vibe` when the behavioral template changes.
- Whenever the SSOT file is edited — re-sync `AGENTS.md`.
- User explicitly asks to refresh agent instructions.
