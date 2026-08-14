#!/usr/bin/env node

/**
 * clone-to-scss.js — sections.json → SCSS partials + class plan
 *
 * Usage:
 *   node clone-to-scss.js <sections.json> --out=<styles-dir> [--feature=<name>] [--asset-root=<public-prefix>]
 *
 * Output:
 *   <styles-dir>/
 *     index.scss           (master orchestrator)
 *     _tokens.scss         (CSS variables from tokens)
 *     _base.scss           (@font-face + body defaults from stylesheets.json hints)
 *     _shared.scss         (placeholder for cross-section utilities)
 *     sections/_<name>.scss (per-section partial)
 *   <styles-dir>/class-plan.json  (node.id → BEM class name; HTML scaffolder applies these)
 *
 * Rules:
 *   - CSS values copied verbatim from sections.json — no eyeballing
 *   - Token-referenced values stay as var(--xxx)
 *   - Selectors are class-based, BEM-flavored: .{feature}__{section}__{role}
 *   - One class per node; nested rules use SCSS &__ syntax
 */

import fs from 'fs';
import path from 'path';

// ─── CLI ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const [, , inputPath, ...rest] = argv;
  const opts = {};
  for (const a of rest) {
    if (a.startsWith('--out=')) opts.out = a.slice(6);
    else if (a.startsWith('--feature=')) opts.feature = a.slice(10);
    else if (a.startsWith('--asset-root=')) opts.assetRoot = a.slice(13);
  }
  return { inputPath, opts };
}

const { inputPath, opts } = parseArgs(process.argv);
if (!inputPath || !opts.out) {
  console.error('Usage: node clone-to-scss.js <sections.json> --out=<styles-dir> [--feature=<name>] [--asset-root=<public-prefix>]');
  process.exit(1);
}

// ─── Helpers ────────────────────────────────────────────────────────
function kebab(s) {
  return String(s)
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'x';
}

function shorten(id) {
  // node id like "0.1.2.3" → "n-0-1-2-3"
  return 'n-' + id.replace(/[^0-9]/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
}

// Detect a semantic role for a node based on tag/class/text/attrs
function semanticRole(node) {
  const cls = (node.classes || '').toLowerCase();
  const tag = node.tag;
  if (tag === 'h1' || /\bheadline\b|\bhero-title\b/.test(cls)) return 'title';
  if (/^h[2-6]$/.test(tag)) return `heading-${tag.slice(1)}`;
  if (tag === 'p' || /\bsubtitle\b|\bdescription\b/.test(cls)) return 'body';
  if (tag === 'a' && (/\bbutton\b|\bbtn\b|\bcta\b/.test(cls) || (node.attrs && /button/.test(node.attrs.role || '')))) return 'button';
  if (tag === 'button') return 'button';
  if (tag === 'img' || (node.css && node.css['background-image'] && node.css['background-image'] !== 'none')) return 'media';
  if (tag === 'ul' || tag === 'ol') return 'list';
  if (tag === 'li') return 'item';
  if (tag === 'nav' || /\bnav\b/.test(cls)) return 'nav';
  if (tag === 'form') return 'form';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'field';
  if (tag === 'header') return 'header';
  if (tag === 'footer') return 'footer';
  if (tag === 'section' || tag === 'article') return 'content';
  if (tag === 'div' && node.children && node.children.length > 1) return 'group';
  return 'el';
}

// ─── Class plan: assign one BEM class per visible node ──────────────
function buildClassPlan(sections, feature) {
  const plan = {}; // id → class name
  const usedNames = new Map(); // base name → count for disambiguation
  const sectionUsedRoles = new Map();

  const assign = (sectionName, node, parentRole) => {
    if (!node || node.pseudo) return;
    const sectionKey = kebab(sectionName);
    let role = semanticRole(node);
    if (parentRole === 'list' && role !== 'item') role = 'item';
    // disambiguate within section by role
    const k = `${sectionKey}::${role}`;
    const idx = (sectionUsedRoles.get(k) || 0) + 1;
    sectionUsedRoles.set(k, idx);
    const suffix = idx === 1 ? role : `${role}-${idx}`;
    const cls = `${feature}__${sectionKey}__${suffix}`;
    plan[node.id] = cls;
    for (const child of (node.children || [])) assign(sectionName, child, role);
  };

  for (const sec of sections) {
    // Root section class
    const sectionKey = kebab(sec.name);
    plan[sec.nodeRef] = `${feature}__${sectionKey}`;
    for (const child of (sec.children || [])) assign(sec.name, child, 'section');
  }

  return plan;
}

// ─── CSS emission ───────────────────────────────────────────────────
const SKIP_DEFAULT_VALUES = {
  'pointer-events': 'auto',
  'visibility': 'visible',
  'opacity': '1',
  'transform': 'none',
  'background-repeat': 'repeat',
  'background-attachment': 'scroll',
  'background-blend-mode': 'normal',
  'mix-blend-mode': 'normal',
  'filter': 'none',
  'backdrop-filter': 'none',
  'overflow': 'visible',
  'overflow-x': 'visible',
  'overflow-y': 'visible',
};

function emitDeclarations(css, indent) {
  const out = [];
  for (const [prop, val] of Object.entries(css)) {
    if (!val || prop.startsWith('--')) continue;
    if (SKIP_DEFAULT_VALUES[prop] === val) continue;
    out.push(`${indent}${prop}: ${val};`);
  }
  return out.join('\n');
}

function emitNodeRule(node, plan, indent) {
  const cls = plan[node.id];
  if (!cls) return '';
  const lines = [];
  lines.push(`${indent}.${cls} {`);
  const decl = emitDeclarations(node.css || {}, indent + '  ');
  if (decl) lines.push(decl);
  // pseudo-elements
  for (const child of (node.children || [])) {
    if (child.pseudo) {
      const kind = child.tag.replace('::', '');
      lines.push('');
      lines.push(`${indent}  &::${kind} {`);
      lines.push(emitDeclarations(child.css || {}, indent + '    '));
      lines.push(`${indent}  }`);
    }
  }
  lines.push(`${indent}}`);

  // Non-pseudo children — emit at same level (BEM flat)
  const childRules = (node.children || [])
    .filter((c) => !c.pseudo)
    .map((c) => emitNodeRule(c, plan, indent))
    .filter(Boolean);

  return [lines.join('\n'), ...childRules].join('\n\n');
}

// ─── File emission ──────────────────────────────────────────────────
function emitTokens(tokens) {
  const lines = [':root {'];
  for (const c of tokens.colors) lines.push(`  --${c.name}: ${c.value};`);
  for (const t of tokens.typography) {
    lines.push(`  --${t.name}-family: ${t.family};`);
    lines.push(`  --${t.name}-size: ${t.size};`);
    lines.push(`  --${t.name}-weight: ${t.weight};`);
    if (t.lineHeight && t.lineHeight !== 'normal') lines.push(`  --${t.name}-line-height: ${t.lineHeight};`);
    if (t.letterSpacing && t.letterSpacing !== 'normal') lines.push(`  --${t.name}-letter-spacing: ${t.letterSpacing};`);
  }
  for (const s of tokens.spacing) lines.push(`  --${s.name}: ${s.value};`);
  for (const r of tokens.radius) lines.push(`  --${r.name}: ${r.value};`);
  for (const s of tokens.shadow) lines.push(`  --${s.name}: ${s.value};`);
  lines.push('}');
  return lines.join('\n') + '\n';
}

function emitBase(feature, stylesheets) {
  const lines = [];
  lines.push('// Auto-generated by clone-to-scss.js — do not edit by hand.');
  lines.push('');
  if (stylesheets && stylesheets.fontFaces) {
    for (const ff of stylesheets.fontFaces) {
      lines.push('@font-face {');
      lines.push(`  font-family: '${ff.family}';`);
      if (ff.weight) lines.push(`  font-weight: ${ff.weight};`);
      if (ff.style) lines.push(`  font-style: ${ff.style};`);
      if (ff.display) lines.push(`  font-display: ${ff.display};`);
      const srcs = ff.sources.map((s) => s.format
        ? `url('${s.url}') format('${s.format}')`
        : `url('${s.url}')`).join(',\n       ');
      lines.push(`  src: ${srcs};`);
      lines.push('}');
      lines.push('');
    }
  }
  return lines.join('\n');
}

function emitSection(section, plan) {
  const lines = [];
  lines.push(`// Section: ${section.name}`);
  lines.push('');
  // root + descendants
  lines.push(emitNodeRule({ ...section, id: section.nodeRef, children: section.children }, plan, ''));
  return lines.join('\n') + '\n';
}

function emitIndex(feature, sections) {
  const lines = [];
  lines.push(`// ${feature} — auto-generated by clone-to-scss.js`);
  lines.push('');
  lines.push(`@use './tokens';`);
  lines.push(`@use './base';`);
  lines.push(`@use './shared';`);
  for (const sec of sections) {
    lines.push(`@use './sections/${kebab(sec.name)}';`);
  }
  return lines.join('\n') + '\n';
}

// ─── Main ───────────────────────────────────────────────────────────
function main() {
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const feature = opts.feature || data.meta?.feature || 'clone';
  const featureClass = kebab(feature);

  // Read sibling stylesheets.json if present (from clone-extract.js output)
  const sectionsDir = path.dirname(inputPath);
  const stylesheetsPath = path.join(sectionsDir, 'stylesheets.json');
  let stylesheets = null;
  if (fs.existsSync(stylesheetsPath)) {
    stylesheets = JSON.parse(fs.readFileSync(stylesheetsPath, 'utf8'));
  }

  const outDir = opts.out;
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'sections'), { recursive: true });

  const plan = buildClassPlan(data.sections, featureClass);

  // Write files
  fs.writeFileSync(path.join(outDir, '_tokens.scss'), emitTokens(data.tokens));
  fs.writeFileSync(path.join(outDir, '_base.scss'), emitBase(featureClass, stylesheets));
  fs.writeFileSync(
    path.join(outDir, '_shared.scss'),
    `// Cross-section utilities — extend as needed.\n`,
  );

  for (const sec of data.sections) {
    const fname = `_${kebab(sec.name)}.scss`;
    fs.writeFileSync(path.join(outDir, 'sections', fname), emitSection(sec, plan));
  }

  fs.writeFileSync(path.join(outDir, 'index.scss'), emitIndex(featureClass, data.sections));
  fs.writeFileSync(path.join(outDir, 'class-plan.json'), JSON.stringify(plan, null, 2));

  console.log(`[clone-to-scss] done → ${outDir}`);
  console.log(`  sections: ${data.sections.length}, classes: ${Object.keys(plan).length}`);
}

try { main(); }
catch (e) {
  console.error(`[clone-to-scss] FAIL: ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
}
