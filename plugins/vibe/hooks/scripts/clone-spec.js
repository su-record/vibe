#!/usr/bin/env node

/**
 * clone-spec.js — sections.json → per-section build-contract spec (*.spec.md)
 *
 * Usage:
 *   node clone-spec.js <sections.json> --out=<dir> [--section=Name] [--feature=name]
 *
 * Why this exists (clone Phase 3, Step 0 — the spec gate):
 *   No section is built without a completed spec. The spec is the contract AND the
 *   audit trail: it forces extraction rigor (interaction model, states, assets, text,
 *   computed CSS) into a single reviewable file before any component code is written.
 *   Generated deterministically from sections.json — Claude fills the TODOs, never guesses.
 *
 * Output (in <dir>):
 *   <Section>.spec.md   — one contract per detected section
 */

import fs from 'fs';
import path from 'path';

// ─── CLI ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const [, , sectionsPath, ...rest] = argv;
  const opts = {};
  for (const a of rest) {
    if (a.startsWith('--out=')) opts.out = a.slice(6);
    else if (a.startsWith('--section=')) opts.section = a.slice(10);
    else if (a.startsWith('--feature=')) opts.feature = a.slice(10);
    else if (a.startsWith('--behaviors=')) opts.behaviors = a.slice(12);
    else if (a === '--real-content') opts.realContent = true;
  }
  return { sectionsPath, opts };
}

const { sectionsPath, opts } = parseArgs(process.argv);

// ─── Helpers ────────────────────────────────────────────────────────
function safeName(name) {
  return (name || 'Section').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function collectText(section, limit = 25) {
  const texts = [];
  const seen = new Set();
  const visit = (n) => {
    if (n.text) {
      const t = n.text.length > 120 ? n.text.slice(0, 120) + '…' : n.text;
      if (!seen.has(t)) { seen.add(t); texts.push(t); }
    }
    for (const c of (n.children || [])) visit(c);
  };
  for (const c of (section.children || [])) visit(c);
  return texts.slice(0, limit);
}

function cssBlock(css) {
  const entries = Object.entries(css || {}).filter(([k]) => k !== '--vars');
  if (!entries.length) return '(none captured)';
  return entries.map(([k, v]) => `${k}: ${v};`).join('\n');
}

function interactionBlock(it) {
  if (!it) return '- **Heuristic guess:** `unknown`\n';
  const signals = (it.signals || []).length
    ? it.signals.map((s) => `  - ${s}`).join('\n')
    : '  - (no interaction signals detected — likely static)';
  return [
    `- **Heuristic guess:** \`${it.model}\` (confidence: ${it.confidence})`,
    `- **Signals detected:**`,
    signals,
    `- **Confirmed model:** TODO — verify on the live site, then record the final model.`,
    `- **Trigger & transition:** TODO — exact trigger (click/scroll/hover/time), duration, easing.`,
  ].join('\n');
}

function statesBlock(states) {
  if (!states || !states.length) {
    return '- None harvested. TODO: confirm there are truly no hover/focus/active/open states.';
  }
  return states.map((sr) => {
    const decls = Object.entries(sr.css || {}).map(([k, v]) => `    - ${k}: ${v}`).join('\n');
    const media = sr.media ? ` _(under \`@media ${sr.media}\`)_` : '';
    return `- \`${sr.selector}\`${media}\n${decls}`;
  }).join('\n');
}

function componentsBlock(components) {
  if (!components || !components.length) return '- None detected.';
  return components.map((c) => {
    const cls = c.exemplarClasses ? `.${String(c.exemplarClasses).split(/\s+/).slice(0, 3).join('.')}` : '';
    return `- \`<${c.exemplarTag}>${cls}\` ×${c.count} → TODO: reuse existing component or create new?`;
  }).join('\n');
}

// True if any node in the section subtree matches a behavior's tag (+ optional class).
function sectionHasNode(section, tag, cls) {
  const hit = (n) => {
    if (n.tag === tag && (!cls || (n.classes || '').split(/\s+/).includes(cls))) return true;
    return (n.children || []).some(hit);
  };
  return (section.children || []).some(hit);
}

function diffLines(changed) {
  return Object.entries(changed)
    .map(([k, v]) => `    - ${k}: \`${v.from}\` → \`${v.to}\``).join('\n');
}

function behaviorsBlock(section, behaviors) {
  if (!behaviors) return null;
  const inSection = (list) => (list || []).filter((b) => sectionHasNode(section, b.tag, b.cls));
  const scroll = inSection(behaviors.scroll);
  const hover = inSection(behaviors.hover);
  const inview = inSection(behaviors.inview);
  const timed = inSection(behaviors.timeDriven);
  // Tab groups aren't tag-keyed; attach to any section that contains a [role=tab]-ish node.
  const tabs = (behaviors.interactive || []).filter(() =>
    sectionHasNode(section, 'button') || sectionHasNode(section, 'li') || sectionHasNode(section, 'a'),
  );
  const lib = behaviors.scrollLib;
  if (!scroll.length && !tabs.length && !hover.length && !inview.length && !timed.length && !lib) return null;

  const lines = [];
  for (const b of scroll) {
    lines.push(`- **Scroll-triggered** on \`${b.label}\` (past ~${b.triggerScrollY}px scroll):\n${diffLines(b.changed)}`);
  }
  for (const t of tabs) {
    const labels = (t.tabLabels || []).map((l) => `"${l}"`).join(', ') || '(unlabeled)';
    const swap = t.contentSwapsOnClick
      ? '**content SWAPS on click** → extract every tab\'s content/assets, build click-driven'
      : 'no content swap detected (styling-only tabs)';
    lines.push(`- **Tab group** ×${t.count} [${labels}]: ${swap}`);
  }
  for (const b of hover) {
    const tr = b.transition && b.transition !== 'all 0s ease 0s' ? ` (transition: \`${b.transition}\`)` : '';
    lines.push(`- **Hover** on \`${b.label}\`${tr}:\n${diffLines(b.changed)}`);
  }
  for (const b of inview) {
    lines.push(`- **In-view entrance** on \`${b.label}\` (enters at ~${b.triggerY}px):\n${diffLines(b.changed)}`);
  }
  for (const b of timed) {
    lines.push(`- **Time-driven** \`${b.label}\` — ${b.mutations} mutations/3s [${(b.kinds || []).join(', ')}] → carousel/auto-cycle candidate`);
  }
  if (lib) {
    lines.push(`- **Smooth-scroll library (page-level):** ${lib.name} (evidence: \`${lib.evidence}\`) → wire in globals, not per-section`);
  }
  return lines.join('\n');
}

function assetsBlock(images) {
  const bg = (images && images.bg) || [];
  const content = (images && images.content) || [];
  const lines = [];
  lines.push(bg.length ? `- **background:** ${bg.map((u) => `\`${u}\``).join(', ')}` : '- **background:** none');
  lines.push(content.length ? `- **content (<img>):** ${content.map((u) => `\`${u}\``).join(', ')}` : '- **content (<img>):** none');
  return lines.join('\n');
}

// ─── Spec rendering ─────────────────────────────────────────────────
function renderSpec(section, meta, behaviors) {
  const box = section.box || {};
  const texts = collectText(section);
  const textBlock = texts.length
    ? texts.map((t) => `- "${t}"`).join('\n')
    : '- (no direct text — likely visual/asset-only section)';
  const behavior = behaviorsBlock(section, behaviors);
  const behaviorSection = behavior
    ? `\n## Dynamic behaviors — observed by ACTIVE capture (not guesses)\n_Captured by driving the live page (scroll/click). These override the static heuristic above._\n${behavior}\n`
    : '';
  return `# ${section.name} — Clone Spec (${meta.bp})

> Auto-generated skeleton from sections.json by clone-spec.js. **This is a build contract.**
> Complete every \`TODO\` before dispatching the build. No section ships without a completed spec.

- **Feature:** ${meta.feature}
- **Breakpoint:** ${meta.bp} (${meta.viewport ? `${meta.viewport.width}×${meta.viewport.height}` : '?'})
- **Source URL:** ${meta.url || '?'}
- **Node ref:** \`${section.nodeRef}\` · **Root box:** ${Math.round(box.w || 0)}×${Math.round(box.h || 0)} @ (${Math.round(box.x || 0)}, ${Math.round(box.y || 0)})

## Interaction model — ⚠ confirm before building
${interactionBlock(section.interaction)}
${behaviorSection}
## States to reproduce
_Harvested non-default state rules (hover/focus/active/checked/tab/aria/data-state). Implement each._
${statesBlock(section.states)}

## Layout — root computed CSS (use as-is, no guessing)
\`\`\`css
${cssBlock(section.css)}
\`\`\`

## Assets (local paths only — never hotlink)
${assetsBlock(section.images)}

## Text content ${meta.realContent
    ? '(verbatim — user confirmed rights to reuse this copy)'
    : '(replace copyrighted copy with placeholders)'}
${textBlock}

## Component candidates
${componentsBlock(section.components)}

## Build checklist
- [ ] HTML semantics + final tags chosen
- [ ] SCSS started from the clone-to-scss.js draft — value edits only with evidence cited from computed.json/states.json/behaviors.json (no eyeballing); clone-validate.js is the judge
- [ ] Every state above implemented
- [ ] Interaction model confirmed on live site & wired
- [ ] All assets local (public/images/${meta.feature}/) — no hotlinks
- [ ] clone-validate.js PASS
- [ ] Pixel diff ≤ 0.05 (Phase 5)
`;
}

// ─── Main ───────────────────────────────────────────────────────────
function main() {
  const data = JSON.parse(fs.readFileSync(sectionsPath, 'utf8'));
  const meta = {
    feature: opts.feature || (data.meta && data.meta.feature) || 'feature',
    url: data.meta && data.meta.url,
    viewport: data.meta && data.meta.viewport,
    bp: opts.section ? (data.meta && data.meta.bp) : (data.meta && data.meta.bp) || '?',
    realContent: !!opts.realContent,
  };
  // behaviors.json (active interaction sweep) lives next to the source computed.json.
  const behaviorsPath = opts.behaviors || path.join(path.dirname(sectionsPath), 'behaviors.json');
  let behaviors = null;
  if (fs.existsSync(behaviorsPath)) {
    try { behaviors = JSON.parse(fs.readFileSync(behaviorsPath, 'utf8')); } catch { behaviors = null; }
  }

  let sections = data.sections || [];
  if (opts.section) sections = sections.filter((s) => s.name === opts.section);
  if (!sections.length) {
    console.error(`[clone-spec] no sections${opts.section ? ` matching "${opts.section}"` : ''} in ${sectionsPath}`);
    process.exit(1);
  }

  fs.mkdirSync(opts.out, { recursive: true });
  for (const section of sections) {
    const file = path.join(opts.out, `${safeName(section.name)}.spec.md`);
    fs.writeFileSync(file, renderSpec(section, meta, behaviors));
    console.log(`[clone-spec] wrote ${file}`);
  }
  console.log(`[clone-spec] done → ${sections.length} spec(s) in ${opts.out}`);
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('clone-spec.js');
if (isMain) {
  if (!sectionsPath || !opts.out) {
    console.error('Usage: node clone-spec.js <sections.json> --out=<dir> [--section=Name] [--feature=name] [--behaviors=path] [--real-content]');
    process.exit(1);
  }
  try { main(); }
  catch (e) {
    console.error(`[clone-spec] FAIL: ${e.message}`);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(1);
  }
}

export { sectionHasNode, behaviorsBlock };
