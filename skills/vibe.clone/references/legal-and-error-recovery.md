# Clone — Legal & Ethical Notes + Error Recovery

> Loaded by vibe.clone SKILL.md — full legal/ethical usage notes and the Error Recovery troubleshooting table.

## Legal & Ethical Notes

```
This skill is intended for:
  ✅ "Clone coding" learning exercises (markup/layout study)
  ✅ Rebuilding the user's own previously-deployed sites
  ✅ Authorized redesigns where the user has rights to the source

NOT intended for:
  ❌ Republishing copyrighted content (text, images, logos) without permission
  ❌ Deceptive look-alike sites (phishing, brand impersonation)
  ❌ Bypassing robots.txt or rate-limiting protections

Claude must:
  - Replace copyrighted text content with placeholders (e.g. "[Lorem ipsum]") by default
  - --real-content: ask ONE explicit confirmation (site ownership / permission) before
    Phase 3; on confirmation keep text verbatim (clone-spec.js --real-content)
  - Skip and warn when robots.txt disallows fetching the target path
  - Refuse if the user's stated intent is brand impersonation or deception
```

## Error Recovery

| Failure | Recovery |
|---------|----------|
| clone-extract.js Puppeteer launch failure | Verify Node ≥18 and that Chromium is installed (`npx puppeteer browsers install chrome`). Retry once. |
| Target site blocks headless (403/Cloudflare) | Retry with `--stealth` flag (uses puppeteer-extra stealth plugin). If still blocked, report to user. |
| Asset download 404 | Log to asset-map.json with `status: missing`. Use a 1×1 transparent placeholder. Continue. |
| robots.txt disallows path | Halt Phase 1. Inform user; require explicit `--ignore-robots` flag to proceed. |
| clone-refine.js produces empty sections | Site likely uses Shadow DOM or canvas rendering. Report and ask whether to fall back to screenshot-only mode. |
| Pixel diff stuck > 0.05 after 5 rounds | Likely font fallback or anti-aliasing. Report metric, allow user to accept threshold. |
| Interaction model guess wrong (Phase 5) | section.interaction is a static-DOM heuristic. Re-observe the live site, correct the model in the spec, rebuild the section for the confirmed model. |
| states.json empty but site has hover/tabs | States may be set via inline JS, not CSS rules. Check behaviors.json (active sweep captures scroll/tab JS state). If still missing, note in the spec and capture manually during Phase 5. |
| behaviors.json missing or empty | Active sweep was disabled (--no-interact), hit no sticky/tab elements, or errored (logged, non-fatal). Falls back to static states.json. Re-run without --no-interact to retry. |
| clone-merge-responsive.js reports many mo-only/pc-only selectors | Section detection diverged between BPs (layout differs structurally). Expected for hidden-on-mobile elements; verify each against the two sections.json trees and gate with the media query manually if needed. |
| Merged build fails Phase 5 at one viewport only | The merge dropped or mis-bucketed a declaration. Diff the failing viewport's computed CSS against its sections.json; fix in the merged SCSS with that evidence. |
