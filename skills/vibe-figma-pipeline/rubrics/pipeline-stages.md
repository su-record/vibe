# Pipeline Stage Descriptions and Failure Handling

> This skill is merged into vibe-figma-consolidate (D-4). This rubric describes each stage of the Figma-to-code pipeline and what to do when a stage fails.

## Stage Map

```
Phase 0: Setup
  └─ Detect stack → Determine feature key → Create directories

Phase 1: Storyboard
  └─ Classify frames → Analyze SPEC/CONFIG/PAGE → Generate component shells

Phase 2: Design (per breakpoint)
  ├─ 2-1: Style scaffold
  ├─ 2-2: Classify mode (normal/literal) per section
  ├─ 2-3: Split tall frames if needed
  └─ 2-4: Section loop
       ├─ a. get_design_context
       ├─ b. Download all assets
       ├─ c. Convert code
       ├─ d. Refactor component template
       └─ e. Verify section

Phase 3: Verification
  ├─ Automated grep checks
  └─ Screenshot comparison
```

## Stage Failure Handling

### Phase 0 Failures

| Failure | Resolution |
|---------|-----------|
| Cannot detect stack | Ask user: "Vue or React? SCSS or Tailwind?" |
| Directory already exists | Proceed — do not overwrite existing files unless replacing |

### Phase 1 Failures

| Failure | Resolution |
|---------|-----------|
| Metadata too large (>100K chars) | Save to file, parse with Bash/Python to extract frame list |
| No SPEC frame found | Continue without feature requirements; note missing in report |
| No CONFIG frame | Use default scale factors (mobile: 480/720=0.667, PC: 1920/2560=0.75) |
| Storyboard URL is "없음" | Skip Phase 1, go directly to Phase 2 |

### Phase 2-a Failures (get_design_context)

| Failure | Retry | Escalation |
|---------|-------|-----------|
| Timeout on first call | Retry once with `excludeScreenshot: true` | Split frame → per-child calls |
| Timeout after split | Retry individual child once | `get_screenshot` + visual estimation |
| Empty response | Retry once | Skip section, log in consolidation report |

Maximum retries per section: 2. After 2 failures: use screenshot fallback. Never loop more than 3 times on the same section.

### Phase 2-b Failures (Asset Download)

| Failure | Resolution |
|---------|-----------|
| 0-byte file | Retry once with same curl command |
| 404 URL | Try `get_metadata` → sub-node → `get_design_context` for fresh URL |
| All retries failed | Log missing asset; continue with other assets; mark section as needs-review |

Single asset failure does not block the entire section unless it is a critical background image.

### Phase 2-e Section Verification Failures

| Check Failed | Action |
|-------------|--------|
| Figma URL in output | Find and replace all occurrences; re-verify |
| 0-byte or missing image | Re-download; if impossible, use placeholder only with TODO comment |
| Empty template | Do not proceed to next section until fixed |
| Build error | Fix TypeScript/template error; re-build |

### Phase 3 Failures (Screenshot Comparison)

| Priority | Issue Type | Action |
|----------|-----------|--------|
| P1 | Image missing, wrong layout, unstyled text | Fix immediately; re-verify before continuing |
| P2 | Spacing delta, slight color difference | Fix if time allows; defer if P1=0 and deadline is tight |
| P3 | Pixel-perfect micro-adjustments | Deferred to `/design-polish` pass |

P1 = 0 is required before the feature is considered complete. P2/P3 are best-effort.

## Design Quality Pipeline (Post-completion)

```
/design-normalize  → normalize inconsistent values
/design-audit      → automated audit (quick pass)
/design-critique   → thorough visual critique
/design-polish     → final polish pass
```

Run at minimum: `/design-normalize` → `/design-audit --quick` before committing.
