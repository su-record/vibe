#!/usr/bin/env node

/**
 * clone-refine.js — computed.json → sections.json
 *
 * Usage:
 *   node clone-refine.js <rendered.html> <computed.json> --out=<sections.json> --bp=mo|pc
 *     [--stylesheets=<stylesheets.json>] [--asset-map=<asset-map.json>]
 *
 * Refinement steps:
 *   1. Tree reconstruction (flat node list → tree)
 *   2. Section detection (semantic landmarks + visual heuristics)
 *   3. Repeated pattern detection → component candidates (structural hash, ≥3 siblings)
 *   4. Design token extraction with bucketing (colors / typography / spacing / radius / shadow)
 *   5. Token-aware CSS values (e.g. color "#0070f3" → "var(--color-blue-500)")
 *
 * Output schema: see SKILL.md.
 */

import fs from 'fs';
import path from 'path';

// ─── CLI ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const [, , htmlPath, computedPath, ...rest] = argv;
  const opts = {};
  for (const a of rest) {
    if (a.startsWith('--out=')) opts.out = a.slice(6);
    else if (a.startsWith('--bp=')) opts.bp = a.slice(5);
    else if (a.startsWith('--stylesheets=')) opts.stylesheets = a.slice(14);
    else if (a.startsWith('--asset-map=')) opts.assetMap = a.slice(12);
    else if (a.startsWith('--states=')) opts.states = a.slice(9);
  }
  return { htmlPath, computedPath, opts };
}

const { htmlPath, computedPath, opts } = parseArgs(process.argv);
if (!htmlPath || !computedPath || !opts.out) {
  console.error('Usage: node clone-refine.js <rendered.html> <computed.json> --out=<sections.json> --bp=mo|pc');
  process.exit(1);
}

// ─── Tree reconstruction ────────────────────────────────────────────
function buildTree(nodes) {
  const byId = new Map();
  for (const n of nodes) byId.set(n.id, { ...n, children: [] });
  const roots = [];
  for (const n of byId.values()) {
    if (n.parent && byId.has(n.parent)) byId.get(n.parent).children.push(n);
    else roots.push(n);
  }
  return { roots, byId };
}

// ─── CSS value parsers ──────────────────────────────────────────────
function parsePx(val) {
  if (typeof val !== 'string') return null;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(val.trim());
  return m ? Number(m[1]) : null;
}

function parseColor(val) {
  if (typeof val !== 'string') return null;
  const v = val.trim().toLowerCase();
  if (!v || v === 'transparent' || v === 'currentcolor' || v === 'inherit') return null;
  // rgb(a) / hsl(a)
  let m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) {
    const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.every((x) => !isNaN(x))) {
      const [r, g, b, a] = parts;
      if (a !== undefined && a < 1) return `rgba(${r}, ${g}, ${b}, ${a})`;
      const hex = '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
      return hex;
    }
  }
  m = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length === 4) h = h.split('').map((c) => c + c).join('');
    return '#' + h;
  }
  return v;
}

// Snap spacing values to the closest grid step (4px → 8px → 16px)
function snapSpacing(px) {
  if (px === null || px === undefined) return null;
  if (px === 0) return 0;
  const abs = Math.abs(px);
  if (abs < 8) return Math.round(px); // sub-grid keep
  if (abs < 32) return Math.round(px / 4) * 4;
  if (abs < 96) return Math.round(px / 8) * 8;
  return Math.round(px / 16) * 16;
}

// ─── Token extraction ───────────────────────────────────────────────
function extractTokens(nodes) {
  const colorFreq = new Map();
  const typoFreq = new Map();
  const spacingFreq = new Map();
  const radiusFreq = new Map();
  const shadowFreq = new Map();

  const addColor = (val) => {
    const c = parseColor(val);
    if (c) colorFreq.set(c, (colorFreq.get(c) || 0) + 1);
  };
  const addSpacing = (px) => {
    if (px === null || px === undefined) return;
    const snapped = snapSpacing(px);
    if (snapped === null) return;
    spacingFreq.set(snapped, (spacingFreq.get(snapped) || 0) + 1);
  };

  for (const n of nodes) {
    if (!n.css) continue;
    addColor(n.css['color']);
    addColor(n.css['background-color']);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      addColor(n.css[`border-${side}-color`]);
    }
    // gradient stops
    const bg = n.css['background-image'];
    if (bg && /gradient/i.test(bg)) {
      const re = /(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/gi;
      let m;
      while ((m = re.exec(bg)) !== null) addColor(m[0]);
    }

    // typography
    const ff = n.css['font-family'];
    const fs = n.css['font-size'];
    const fw = n.css['font-weight'];
    const lh = n.css['line-height'];
    const ls = n.css['letter-spacing'];
    if (ff && fs) {
      const key = JSON.stringify({ ff, fs, fw: fw || '400', lh: lh || 'normal', ls: ls || 'normal' });
      typoFreq.set(key, (typoFreq.get(key) || 0) + 1);
    }

    // spacing
    for (const side of ['top', 'right', 'bottom', 'left']) {
      addSpacing(parsePx(n.css[`margin-${side}`]));
      addSpacing(parsePx(n.css[`padding-${side}`]));
    }
    addSpacing(parsePx(n.css['gap']));
    addSpacing(parsePx(n.css['row-gap']));
    addSpacing(parsePx(n.css['column-gap']));

    // radius
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      const r = parsePx(n.css[`border-${corner}-radius`]);
      if (r !== null && r > 0) radiusFreq.set(r, (radiusFreq.get(r) || 0) + 1);
    }

    // shadow
    const sh = n.css['box-shadow'];
    if (sh && sh !== 'none') shadowFreq.set(sh, (shadowFreq.get(sh) || 0) + 1);
  }

  const sortedTop = (m, limit) => Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, count]) => ({ value: k, count }));

  // Name tokens
  const colors = sortedTop(colorFreq, 20).map((t, i) => ({
    name: nameColor(t.value, i),
    value: t.value,
    count: t.count,
  }));

  const typography = sortedTop(typoFreq, 12).map((t, i) => {
    const parsed = JSON.parse(t.value);
    return {
      name: `text-${i + 1}`,
      family: parsed.ff,
      size: parsed.fs,
      weight: parsed.fw,
      lineHeight: parsed.lh,
      letterSpacing: parsed.ls,
      count: t.count,
    };
  });

  const spacing = sortedTop(spacingFreq, 16).map((t) => ({
    name: `space-${t.value}`,
    value: `${t.value}px`,
    count: t.count,
  }));

  const radius = sortedTop(radiusFreq, 8).map((t) => ({
    name: `radius-${t.value}`,
    value: `${t.value}px`,
    count: t.count,
  }));

  const shadow = sortedTop(shadowFreq, 6).map((t, i) => ({
    name: `shadow-${i + 1}`,
    value: t.value,
    count: t.count,
  }));

  return { colors, typography, spacing, radius, shadow };
}

function nameColor(hex, idx) {
  // Heuristic naming: hex → semantic label by brightness/saturation
  if (hex === '#ffffff' || hex === '#fff') return 'color-white';
  if (hex === '#000000' || hex === '#000') return 'color-black';
  if (hex.startsWith('rgba')) return `color-overlay-${idx + 1}`;
  // Compute HSL roughly for naming
  const m = /^#([0-9a-f]{6})$/.exec(hex);
  if (m) {
    const r = parseInt(m[1].slice(0, 2), 16) / 255;
    const g = parseInt(m[1].slice(2, 4), 16) / 255;
    const b = parseInt(m[1].slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d < 0.06) return `color-gray-${Math.round(l * 100)}`;
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    const hue =
      h < 15 ? 'red' :
      h < 45 ? 'orange' :
      h < 70 ? 'yellow' :
      h < 165 ? 'green' :
      h < 200 ? 'teal' :
      h < 250 ? 'blue' :
      h < 290 ? 'purple' :
      h < 330 ? 'pink' : 'red';
    return `color-${hue}-${Math.round(l * 100)}`;
  }
  return `color-${idx + 1}`;
}

// ─── Section detection ──────────────────────────────────────────────
const SEMANTIC_SECTION_TAGS = new Set(['header', 'nav', 'main', 'section', 'article', 'aside', 'footer']);

function findSections(roots) {
  // 1. Find <body>
  const html = roots.find((r) => r.tag === 'html');
  if (!html) return [];
  const body = html.children.find((c) => c.tag === 'body');
  if (!body) return [];

  // 2. Collect candidate landmarks from body subtree (BFS, prefer top-level)
  const sections = [];
  const seenIds = new Set();

  const tryAdd = (node, label) => {
    if (seenIds.has(node.id)) return;
    if (!node.box || node.box.h < 40) return;
    seenIds.add(node.id);
    sections.push({ node, label });
  };

  // First pass: explicit semantic tags within body
  const queue = [...body.children];
  while (queue.length) {
    const n = queue.shift();
    if (SEMANTIC_SECTION_TAGS.has(n.tag)) {
      tryAdd(n, sectionLabelFor(n));
      // Don't descend — keep section as atomic unit
    } else {
      queue.push(...n.children);
    }
  }

  // Second pass: if no semantic sections found, fall back to top-level body children with significant height
  if (sections.length === 0) {
    for (const child of body.children) {
      if (child.box && child.box.h >= 100) tryAdd(child, sectionLabelFor(child));
    }
  }

  // Sort by visual order (y position)
  sections.sort((a, b) => a.node.box.y - b.node.box.y);

  // Disambiguate labels (Hero → Hero, Hero-2 if duplicate)
  const labelCounts = new Map();
  for (const s of sections) {
    const base = s.label;
    const count = (labelCounts.get(base) || 0) + 1;
    labelCounts.set(base, count);
    s.label = count > 1 ? `${base}-${count}` : base;
  }

  return sections;
}

function sectionLabelFor(node) {
  // Prefer explicit class/id hints
  const cls = (node.classes || '').toLowerCase();
  const hints = [
    ['hero', 'Hero'],
    ['banner', 'Banner'],
    ['header', 'Header'],
    ['nav', 'Nav'],
    ['footer', 'Footer'],
    ['feature', 'Features'],
    ['testimonial', 'Testimonials'],
    ['pricing', 'Pricing'],
    ['cta', 'CTA'],
    ['faq', 'FAQ'],
    ['gallery', 'Gallery'],
    ['contact', 'Contact'],
  ];
  for (const [pat, name] of hints) if (cls.includes(pat) || (node.attrs && (node.attrs.role || '').includes(pat))) return name;
  // Fall back to semantic tag
  const tagLabels = { header: 'Header', footer: 'Footer', nav: 'Nav', main: 'Main', article: 'Article', aside: 'Aside' };
  if (tagLabels[node.tag]) return tagLabels[node.tag];
  return 'Section';
}

// ─── Component pattern detection ────────────────────────────────────
// Structural hash: tag + class signature + first-level child tag list + leaf count tier
function structuralHash(node, depth = 0) {
  if (depth > 3) return '';
  const classSig = (node.classes || '').split(/\s+/).filter(Boolean).sort().slice(0, 4).join('.');
  const childTags = (node.children || []).map((c) => c.tag).slice(0, 8).join(',');
  const childCount = (node.children || []).length;
  const sizeBucket = node.box ? `${Math.round(node.box.w / 40)}x${Math.round(node.box.h / 40)}` : '?';
  return `${node.tag}|${classSig}|${childTags}|${childCount}|${sizeBucket}`;
}

function detectComponents(sectionRoot) {
  // Group siblings at each depth by structural hash
  const candidates = [];
  const walk = (parent) => {
    if (!parent.children || parent.children.length < 3) {
      for (const c of (parent.children || [])) walk(c);
      return;
    }
    const groups = new Map();
    for (const child of parent.children) {
      const hash = structuralHash(child);
      if (!groups.has(hash)) groups.set(hash, []);
      groups.get(hash).push(child);
    }
    for (const [hash, members] of groups) {
      if (members.length >= 3) {
        candidates.push({
          hash,
          count: members.length,
          parentId: parent.id,
          memberIds: members.map((m) => m.id),
          exemplarTag: members[0].tag,
          exemplarClasses: members[0].classes,
          exemplarBox: members[0].box,
        });
      }
    }
    for (const c of parent.children) walk(c);
  };
  walk(sectionRoot);
  return candidates;
}

// ─── BG image classification ────────────────────────────────────────
function classifyImages(node) {
  const out = { bg: [], content: [] };
  const walk = (n) => {
    if (n.css) {
      const bg = n.css['background-image'];
      if (bg && bg !== 'none' && /url\(/.test(bg)) {
        const re = /url\(['"]?([^'")]+)['"]?\)/g;
        let m;
        while ((m = re.exec(bg)) !== null) out.bg.push(m[1]);
      }
    }
    if (n.tag === 'img') {
      const src = (n.attrs && (n.attrs.currentSrc || n.attrs.src));
      if (src) out.content.push(src);
    }
    for (const c of (n.children || [])) walk(c);
  };
  walk(node);
  return out;
}

// ─── Trim children to essential layout/text/image nodes ─────────────
function trimSubtree(node) {
  if (!node) return null;
  const trimmed = {
    id: node.id,
    tag: node.tag,
    classes: node.classes || '',
    pseudo: node.pseudo || false,
    isSvg: node.isSvg || false,
    box: node.box,
    css: node.css || {},
  };
  if (node.attrs) {
    const a = node.attrs;
    const keep = {};
    for (const k of ['src', 'currentSrc', 'href', 'alt', 'title', 'role', 'ariaLabel', 'type', 'name', 'placeholder']) {
      if (a[k]) keep[k] = a[k];
    }
    if (Object.keys(keep).length) trimmed.attrs = keep;
  }
  if (node.text) trimmed.text = node.text;
  if (node.svgMarkup) trimmed.svgMarkup = node.svgMarkup;
  if (node.children && node.children.length) {
    trimmed.children = node.children.map(trimSubtree);
  }
  return trimmed;
}

// ─── Token application: replace literal values with token refs ──────
function applyTokens(nodes, tokens) {
  const colorByValue = new Map(tokens.colors.map((t) => [t.value, t.name]));
  const spacingByValue = new Map(tokens.spacing.map((t) => [t.value, t.name]));
  const radiusByValue = new Map(tokens.radius.map((t) => [t.value, t.name]));
  const shadowByValue = new Map(tokens.shadow.map((t) => [t.value, t.name]));

  const sub = (val, map) => {
    if (!val) return val;
    const normalized = parseColor(val) || val;
    if (map.has(normalized)) return `var(--${map.get(normalized)})`;
    if (map.has(val)) return `var(--${map.get(val)})`;
    return val;
  };

  const walkAndApply = (n) => {
    if (n.css) {
      for (const prop of Object.keys(n.css)) {
        if (prop === 'color' || prop === 'background-color' || prop.endsWith('-color')) {
          n.css[prop] = sub(n.css[prop], colorByValue);
        } else if (prop.startsWith('margin-') || prop.startsWith('padding-') || prop === 'gap' || prop === 'row-gap' || prop === 'column-gap') {
          const px = parsePx(n.css[prop]);
          if (px !== null) {
            const snapped = snapSpacing(px);
            const key = `${snapped}px`;
            if (spacingByValue.has(key)) n.css[prop] = `var(--${spacingByValue.get(key)})`;
          }
        } else if (prop.endsWith('-radius')) {
          if (radiusByValue.has(n.css[prop])) n.css[prop] = `var(--${radiusByValue.get(n.css[prop])})`;
        } else if (prop === 'box-shadow') {
          if (shadowByValue.has(n.css[prop])) n.css[prop] = `var(--${shadowByValue.get(n.css[prop])})`;
        }
      }
    }
    for (const c of (n.children || [])) walkAndApply(c);
  };
  for (const n of nodes) walkAndApply(n);
}

// ─── Interaction model classification (static-DOM heuristic) ────────
// The live interaction (#1 clone failure mode) cannot be fully known from a
// static snapshot, so we surface ranked SIGNALS + a best-guess model that the
// builder confirms against the live site in Phase 5 — never a silent decision.
const CAROUSEL_RE = /slider|carousel|swiper|marquee|slick|embla|ticker|autoplay/;
const SCROLL_RE = /parallax|reveal|animate-on-scroll|scroll-|sticky|fade-in|fade-up|slide-in|in-view|gsap|lenis|locomotive/;
const TOGGLE_RE = /accordion|tabs?|dropdown|modal|toggle|menu|collaps|drawer|popover|expand|hamburger/;
const INTERACTIVE_TAGS = new Set(['button', 'summary', 'details', 'input', 'select', 'textarea', 'label']);
const TOGGLE_ROLES = new Set(['tab', 'tablist', 'switch', 'menuitem', 'menuitemcheckbox', 'button']);

function firstClass(cls, re) {
  return (cls || '').split(/\s+/).find((c) => re.test(c)) || null;
}

function collectInteractionSignals(root) {
  const sig = {
    sticky: null, anim: null, infinite: null, transition: false, pointer: false,
    interactiveTag: null, toggleClass: null, scrollClass: null, carouselClass: null, toggleRole: null,
  };
  const visit = (n) => {
    const css = n.css || {};
    const cls = (n.classes || '').toLowerCase();
    const role = ((n.attrs && n.attrs.role) || '').toLowerCase();
    if (!sig.sticky && (css.position === 'sticky' || css.position === 'fixed')) sig.sticky = `${css.position} on <${n.tag}>`;
    if (css.animation) { sig.anim = sig.anim || n.tag; if (/infinite/.test(css.animation)) sig.infinite = sig.infinite || `animation infinite on <${n.tag}>`; }
    if (css.transition) sig.transition = true;
    if (css.cursor === 'pointer') sig.pointer = true;
    if (!sig.interactiveTag && (INTERACTIVE_TAGS.has(n.tag) || (n.tag === 'a' && n.attrs && n.attrs.href))) sig.interactiveTag = n.tag;
    sig.carouselClass = sig.carouselClass || firstClass(cls, CAROUSEL_RE);
    sig.scrollClass = sig.scrollClass || firstClass(cls, SCROLL_RE);
    sig.toggleClass = sig.toggleClass || firstClass(cls, TOGGLE_RE);
    if (!sig.toggleRole && TOGGLE_ROLES.has(role)) sig.toggleRole = role;
    for (const c of (n.children || [])) visit(c);
  };
  visit(root);
  return sig;
}

function interactionSignalList(sig) {
  const s = [];
  if (sig.infinite) s.push(sig.infinite);
  if (sig.carouselClass) s.push(`carousel class ".${sig.carouselClass}"`);
  if (sig.scrollClass) s.push(`scroll class ".${sig.scrollClass}"`);
  if (sig.sticky) s.push(sig.sticky);
  if (sig.toggleClass) s.push(`toggle class ".${sig.toggleClass}"`);
  if (sig.toggleRole) s.push(`role="${sig.toggleRole}"`);
  if (sig.interactiveTag) s.push(`<${sig.interactiveTag}>`);
  if (sig.anim) s.push(`animation on <${sig.anim}>`);
  if (sig.transition) s.push('css transition');
  if (sig.pointer) s.push('cursor:pointer');
  return s.slice(0, 8);
}

function decideInteraction(sig) {
  let model = 'static';
  let confidence = 'low';
  if (sig.infinite || sig.carouselClass) {
    model = 'time-driven';
    confidence = (sig.infinite || /swiper|slick|embla|carousel/.test(sig.carouselClass || '')) ? 'high' : 'medium';
  } else if (sig.scrollClass || (sig.sticky && (sig.anim || sig.transition))) {
    model = 'scroll-driven';
    confidence = sig.scrollClass ? 'medium' : 'low';
  } else if (sig.interactiveTag === 'details' || sig.toggleRole === 'tab' || sig.toggleClass) {
    model = 'click-driven';
    confidence = (sig.interactiveTag === 'details' || sig.toggleRole === 'tab') ? 'high' : 'medium';
  } else if (sig.interactiveTag || sig.toggleRole) {
    model = 'click-driven';
    confidence = 'medium';
  } else if (sig.pointer && sig.transition) {
    model = 'hover';
    confidence = 'medium';
  }
  return {
    model,
    confidence,
    signals: interactionSignalList(sig),
    note: 'Static-DOM heuristic — confirm the real interaction on the live site (Phase 5).',
  };
}

// ─── State rule matching: attach harvested state rules to their section ─────
const LEAF_INTERACTIVE = ['button', 'a', 'input', 'summary', 'details', 'label', 'select'];

// Match a bare tag at a selector boundary (so `a:hover` matches but `.cta:hover` does not)
const _tagSelCache = {};
function tagSelRe(t) {
  return _tagSelCache[t] || (_tagSelCache[t] = new RegExp('(^|[\\s>+~,(])' + t + '(?=[:.\\[\\s>+~,)]|$)'));
}

function collectClassTagSets(root) {
  const classSet = new Set();
  const tagSet = new Set();
  const visit = (n) => {
    tagSet.add(n.tag);
    for (const c of (n.classes || '').split(/\s+/)) if (c) classSet.add(c.toLowerCase());
    for (const c of (n.children || [])) visit(c);
  };
  visit(root);
  return { classArr: Array.from(classSet), tagSet };
}

function sectionStateRules(stateRules, classArr, tagSet, limit = 60) {
  if (!stateRules || !stateRules.length) return [];
  const picked = [];
  for (const sr of stateRules) {
    const sel = sr.selector.toLowerCase();
    const classHit = classArr.some((c) => sel.includes('.' + c));
    const tagHit = !classHit && LEAF_INTERACTIVE.some((t) => tagSet.has(t) && tagSelRe(t).test(sel));
    if (classHit || tagHit) {
      picked.push({ selector: sr.selector, media: sr.media || null, css: sr.css });
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

function loadStateRules() {
  const statesPath = opts.states || path.join(path.dirname(computedPath), 'states.json');
  try {
    return JSON.parse(fs.readFileSync(statesPath, 'utf8')).stateRules || [];
  } catch {
    return [];
  }
}

// ─── Main ───────────────────────────────────────────────────────────
function main() {
  const computed = JSON.parse(fs.readFileSync(computedPath, 'utf8'));
  const { roots, byId } = buildTree(computed.nodes);

  // Token extraction first (across whole document)
  const tokens = extractTokens(computed.nodes);

  // Section detection
  const sectionEntries = findSections(roots);
  const stateRules = loadStateRules();
  console.log(`[clone-refine] detected ${sectionEntries.length} sections, ${tokens.colors.length} colors, ${tokens.typography.length} typo, ${tokens.spacing.length} spacings, ${stateRules.length} state rules`);

  // Build refined sections
  const sections = sectionEntries.map(({ node, label }) => {
    const subtree = trimSubtree(node);
    const components = detectComponents(node);
    const images = classifyImages(node);
    const interaction = decideInteraction(collectInteractionSignals(node));
    const { classArr, tagSet } = collectClassTagSets(node);
    const states = sectionStateRules(stateRules, classArr, tagSet);
    return {
      name: label,
      nodeRef: node.id,
      tag: node.tag,
      classes: node.classes,
      box: node.box,
      css: node.css || {},
      interaction,
      components,
      images,
      states,
      children: (subtree.children || []),
    };
  });

  // Apply token substitution last (so original values are preserved through detection)
  applyTokens(sections, tokens);

  const out = {
    meta: {
      feature: path.basename(path.dirname(opts.out)) || 'feature',
      url: computed.meta.url,
      viewport: computed.meta.viewport,
      bp: opts.bp || computed.meta.bp,
      generatedAt: new Date().toISOString(),
    },
    tokens,
    sections,
  };

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(out, null, 2));
  console.log(`[clone-refine] done → ${opts.out}`);
}

try { main(); }
catch (e) {
  console.error(`[clone-refine] FAIL: ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
}
