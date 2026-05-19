#!/usr/bin/env node

/**
 * clone-validate.js — written SCSS vs sections.json (source of truth)
 *
 * Usage:
 *   node clone-validate.js <styles-dir> <sections.json> [--section=<name>]
 *
 * Reads:
 *   <styles-dir>/sections/_<section>.scss
 *   <styles-dir>/class-plan.json
 *   <sections.json>
 *
 * Compares emitted CSS declarations against expectations:
 *   - Missing property → P1
 *   - Mismatched value → P1 (if box prop and delta > 4px), else P2
 *   - Extra property → P3 (informational)
 *
 * Exit codes:
 *   0 PASS, 1 FAIL (P1 found), 2 usage error
 */

import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const [, , stylesDir, sectionsPath, ...rest] = argv;
  const opts = {};
  for (const a of rest) {
    if (a.startsWith('--section=')) opts.section = a.slice(10);
    else if (a === '--quiet') opts.quiet = true;
  }
  return { stylesDir, sectionsPath, opts };
}

const { stylesDir, sectionsPath, opts } = parseArgs(process.argv);
if (!stylesDir || !sectionsPath) {
  console.error('Usage: node clone-validate.js <styles-dir> <sections.json> [--section=<name>]');
  process.exit(2);
}

// ─── Minimal SCSS parser ────────────────────────────────────────────
// Strips comments, expands `&::pseudo` (one level), flattens nested rules.
// NOT a full SCSS engine — assumes clone-to-scss.js output style.

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function parseScss(src) {
  const clean = stripComments(src);
  const rules = new Map(); // selector → { prop: value }
  let i = 0;
  const len = clean.length;

  const skipWs = () => { while (i < len && /\s/.test(clean[i])) i++; };

  const readUntil = (chars) => {
    let buf = '';
    while (i < len && !chars.includes(clean[i])) buf += clean[i++];
    return buf;
  };

  const stack = []; // selector stack

  while (i < len) {
    skipWs();
    if (i >= len) break;
    const ch = clean[i];
    if (ch === '}') { stack.pop(); i++; continue; }

    // Lookahead: is this a rule (has '{' before ';' or end) or declaration?
    let depth = 0;
    let j = i;
    let kind = 'decl';
    while (j < len) {
      const c = clean[j];
      if (c === '"' || c === "'") {
        const q = c; j++;
        while (j < len && clean[j] !== q) { if (clean[j] === '\\') j++; j++; }
      }
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && c === ';') { kind = 'decl'; break; }
      else if (depth === 0 && c === '{') { kind = 'rule'; break; }
      else if (depth === 0 && c === '}') { break; }
      j++;
    }

    if (kind === 'rule') {
      const selector = clean.slice(i, j).trim();
      i = j + 1; // consume '{'
      // Resolve nested selector
      const parent = stack[stack.length - 1] || '';
      let resolved;
      if (selector.startsWith('&')) {
        resolved = parent + selector.slice(1);
      } else if (parent) {
        // descendant
        resolved = selector.split(',').map((s) => parent + ' ' + s.trim()).join(', ');
      } else {
        resolved = selector;
      }
      stack.push(resolved);
      if (!rules.has(resolved)) rules.set(resolved, {});
    } else {
      // declaration
      const text = clean.slice(i, j).trim();
      i = j + 1;
      if (!text) continue;
      const colon = text.indexOf(':');
      if (colon < 0) continue;
      const prop = text.slice(0, colon).trim();
      const val = text.slice(colon + 1).trim();
      const sel = stack[stack.length - 1];
      if (sel) {
        if (!rules.has(sel)) rules.set(sel, {});
        rules.get(sel)[prop] = val;
      }
    }
  }

  return rules;
}

// ─── Comparison ─────────────────────────────────────────────────────
const BOX_PROPS = new Set([
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'top', 'right', 'bottom', 'left', 'gap', 'row-gap', 'column-gap',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
]);

function pxOf(v) {
  if (typeof v !== 'string') return null;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
  return m ? Number(m[1]) : null;
}

function normalize(v) {
  if (typeof v !== 'string') return v;
  return v.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareValue(prop, expected, actual) {
  if (normalize(expected) === normalize(actual)) return { ok: true };
  if (BOX_PROPS.has(prop)) {
    const ep = pxOf(expected), ap = pxOf(actual);
    if (ep !== null && ap !== null) {
      const delta = Math.abs(ep - ap);
      return { ok: delta <= 4, severity: delta > 4 ? 'P1' : 'P2', delta };
    }
  }
  return { ok: false, severity: 'P1' };
}

function walkNodes(section) {
  const flat = [];
  const recur = (n) => {
    flat.push(n);
    for (const c of (n.children || [])) recur(c);
  };
  flat.push({ id: section.nodeRef, css: section.css, tag: section.tag, classes: section.classes });
  for (const c of (section.children || [])) recur(c);
  return flat;
}

// ─── Main ───────────────────────────────────────────────────────────
function main() {
  const sectionsJson = JSON.parse(fs.readFileSync(sectionsPath, 'utf8'));
  const classPlanPath = path.join(stylesDir, 'class-plan.json');
  if (!fs.existsSync(classPlanPath)) {
    console.error(`class-plan.json not found at ${classPlanPath}. Run clone-to-scss.js first.`);
    process.exit(2);
  }
  const classPlan = JSON.parse(fs.readFileSync(classPlanPath, 'utf8'));

  const targets = opts.section
    ? sectionsJson.sections.filter((s) => s.name === opts.section)
    : sectionsJson.sections;

  if (opts.section && targets.length === 0) {
    console.error(`Section not found: ${opts.section}`);
    process.exit(2);
  }

  const issues = [];
  let totalChecked = 0;

  for (const section of targets) {
    const kebabName = section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const scssPath = path.join(stylesDir, 'sections', `_${kebabName}.scss`);
    if (!fs.existsSync(scssPath)) {
      issues.push({ section: section.name, severity: 'P1', kind: 'missing-file', path: scssPath });
      continue;
    }
    const scss = fs.readFileSync(scssPath, 'utf8');
    const rules = parseScss(scss);

    const flat = walkNodes(section);
    for (const node of flat) {
      const cls = classPlan[node.id];
      if (!cls || !node.css) continue;
      const selector = `.${cls}`;
      const declared = rules.get(selector) || {};

      for (const [prop, expected] of Object.entries(node.css)) {
        if (prop.startsWith('--')) continue;
        if (!expected || expected === 'normal' || expected === 'auto' || expected === 'none') continue;
        totalChecked++;
        const actual = declared[prop];
        if (actual === undefined) {
          issues.push({
            section: section.name,
            nodeId: node.id,
            class: cls,
            prop,
            severity: 'P1',
            kind: 'missing-prop',
            expected,
          });
          continue;
        }
        const cmp = compareValue(prop, expected, actual);
        if (!cmp.ok) {
          issues.push({
            section: section.name,
            nodeId: node.id,
            class: cls,
            prop,
            severity: cmp.severity,
            kind: 'value-mismatch',
            expected,
            actual,
            delta: cmp.delta,
          });
        }
      }
    }
  }

  const p1 = issues.filter((i) => i.severity === 'P1');
  const p2 = issues.filter((i) => i.severity === 'P2');
  const p3 = issues.filter((i) => i.severity === 'P3');

  if (!opts.quiet) {
    console.log(`[clone-validate] checked ${totalChecked} declarations across ${targets.length} section(s)`);
    console.log(`  P1: ${p1.length}, P2: ${p2.length}, P3: ${p3.length}`);
    const show = (label, list, limit = 20) => {
      if (list.length === 0) return;
      console.log(`\n${label}:`);
      for (const it of list.slice(0, limit)) {
        const loc = it.class ? `.${it.class}` : it.path || '?';
        if (it.kind === 'missing-file') console.log(`  ${it.severity} ${it.section}: missing ${it.path}`);
        else if (it.kind === 'missing-prop') console.log(`  ${it.severity} ${loc} { ${it.prop}: MISSING (expected ${it.expected}) }`);
        else console.log(`  ${it.severity} ${loc} { ${it.prop}: ${it.actual} ≠ ${it.expected}${it.delta != null ? ` (Δ${it.delta}px)` : ''} }`);
      }
      if (list.length > limit) console.log(`  …and ${list.length - limit} more`);
    };
    show('P1 issues', p1);
    show('P2 issues', p2);
  }

  if (p1.length > 0) {
    if (!opts.quiet) console.error(`\n[clone-validate] FAIL: ${p1.length} P1 issue(s)`);
    process.exit(1);
  }
  if (!opts.quiet) console.log('\n[clone-validate] PASS');
  process.exit(0);
}

try { main(); }
catch (e) {
  console.error(`[clone-validate] FAIL: ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(2);
}
