#!/usr/bin/env node

/**
 * clone-merge-responsive.js — MO/PC per-BP SCSS → mobile-first responsive merge
 *
 * Usage:
 *   node clone-merge-responsive.js --mo=<styles-dir> --pc=<styles-dir> --out=<dir> [--breakpoint=1024]
 *
 * Why this exists (clone Phase 3C):
 *   Phase 3A/3B produce two fixed-viewport SCSS trees (styles/{feature}/mo, /pc).
 *   This merges them mobile-first: MO declarations become the base, and only the
 *   declarations where PC differs go into a single @media (min-width: <bp>) block.
 *   Deterministic text merge — no value invention. Post-merge correctness is judged
 *   by Phase 5 (pixel + computed-CSS verification at BOTH viewports).
 *
 * Fail-open:
 *   - PC-only selectors → whole rule inside the media block
 *   - MO-only selectors → base as-is (reported)
 *   - unparseable/missing files → reported and skipped, never a hard abort
 */

import fs from 'fs';
import path from 'path';
import { parseScss, normalize } from './clone-validate.js';

// ─── CLI ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { breakpoint: 1024 };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--mo=')) opts.mo = a.slice(5);
    else if (a.startsWith('--pc=')) opts.pc = a.slice(5);
    else if (a.startsWith('--out=')) opts.out = a.slice(6);
    else if (a.startsWith('--breakpoint=')) opts.breakpoint = Number(a.slice(13)) || 1024;
  }
  return opts;
}

// ─── Merge core (pure — exported for tests) ─────────────────────────
// moRules/pcRules: Map<selector, {prop: value}> (parseScss output)
// → { base: Map, media: Map, stats }
function mergeRules(moRules, pcRules) {
  const base = new Map();
  const media = new Map();
  const stats = { selectors: 0, moOnly: 0, pcOnly: 0, overrides: 0, shared: 0 };

  const selectors = new Set([...moRules.keys(), ...pcRules.keys()]);
  for (const sel of selectors) {
    stats.selectors++;
    const mo = moRules.get(sel);
    const pc = pcRules.get(sel);
    if (mo && Object.keys(mo).length) base.set(sel, mo);

    if (!pc || !Object.keys(pc).length) { if (mo) stats.moOnly++; continue; }
    if (!mo || !Object.keys(mo).length) {
      // PC 전용 셀렉터 — 데스크탑에서만 존재하는 노드
      media.set(sel, pc);
      stats.pcOnly++;
      continue;
    }

    const diff = {};
    for (const [prop, val] of Object.entries(pc)) {
      if (mo[prop] === undefined || normalize(mo[prop]) !== normalize(val)) diff[prop] = val;
    }
    if (Object.keys(diff).length) { media.set(sel, diff); stats.overrides++; }
    else stats.shared++;
  }
  return { base, media, stats };
}

function emitRules(rules, indent) {
  const out = [];
  for (const [sel, decls] of rules) {
    const body = Object.entries(decls).map(([p, v]) => `${indent}  ${p}: ${v};`).join('\n');
    if (!body) continue;
    out.push(`${indent}${sel} {\n${body}\n${indent}}`);
  }
  return out.join('\n\n');
}

// Merged partial: MO base rules + one @media (min-width) block with PC diffs.
function emitMerged(moRules, pcRules, breakpoint, header) {
  const { base, media, stats } = mergeRules(moRules, pcRules);
  const parts = [header, '', emitRules(base, '')];
  if (media.size) {
    parts.push('');
    parts.push(`@media (min-width: ${breakpoint}px) {`);
    parts.push(emitRules(media, '  '));
    parts.push('}');
  }
  return { scss: parts.filter((p) => p !== null).join('\n') + '\n', stats };
}

// ─── File-level orchestration ───────────────────────────────────────
function readScssRules(file) {
  if (!fs.existsSync(file)) return null;
  try { return parseScss(fs.readFileSync(file, 'utf8')); }
  catch (e) {
    console.error(`[clone-merge] parse skipped (${e.message}): ${file}`);
    return null;
  }
}

function listSections(dir) {
  const d = path.join(dir, 'sections');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.startsWith('_') && f.endsWith('.scss'));
}

function mergeTokens(moDir, pcDir, outDir, breakpoint) {
  const mo = readScssRules(path.join(moDir, '_tokens.scss')) || new Map();
  const pc = readScssRules(path.join(pcDir, '_tokens.scss')) || new Map();
  const { scss } = emitMerged(mo, pc, breakpoint, '// Auto-merged by clone-merge-responsive.js (mobile-first)');
  fs.writeFileSync(path.join(outDir, '_tokens.scss'), scss);
}

function copyIfExists(src, dst) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

function mergeClassPlans(moDir, pcDir, outDir) {
  const read = (d) => {
    const f = path.join(d, 'class-plan.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  };
  // MO 우선 — 동일 노드 id가 다른 클래스면 MO가 base이므로 MO를 채택
  const merged = { ...read(pcDir), ...read(moDir) };
  fs.writeFileSync(path.join(outDir, 'class-plan.json'), JSON.stringify(merged, null, 2));
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.mo || !opts.pc || !opts.out) {
    console.error('Usage: node clone-merge-responsive.js --mo=<styles-dir> --pc=<styles-dir> --out=<dir> [--breakpoint=1024]');
    process.exit(2);
  }

  fs.mkdirSync(path.join(opts.out, 'sections'), { recursive: true });

  const files = [...new Set([...listSections(opts.mo), ...listSections(opts.pc)])].sort();
  const totals = { selectors: 0, moOnly: 0, pcOnly: 0, overrides: 0, shared: 0 };
  const merged = [];

  for (const f of files) {
    const mo = readScssRules(path.join(opts.mo, 'sections', f)) || new Map();
    const pc = readScssRules(path.join(opts.pc, 'sections', f)) || new Map();
    if (!mo.size && !pc.size) { console.error(`[clone-merge] empty on both BPs, skipped: ${f}`); continue; }
    const { scss, stats } = emitMerged(mo, pc, opts.breakpoint, `// Section: ${f} — merged mobile-first`);
    fs.writeFileSync(path.join(opts.out, 'sections', f), scss);
    for (const k of Object.keys(totals)) totals[k] += stats[k];
    merged.push(f);
  }

  mergeTokens(opts.mo, opts.pc, opts.out, opts.breakpoint);
  copyIfExists(path.join(opts.mo, '_base.scss'), path.join(opts.out, '_base.scss'));
  copyIfExists(path.join(opts.mo, '_shared.scss'), path.join(opts.out, '_shared.scss'));
  mergeClassPlans(opts.mo, opts.pc, opts.out);

  const index = [
    '// Auto-merged by clone-merge-responsive.js — mobile-first responsive',
    '',
    `@use './tokens';`,
    `@use './base';`,
    `@use './shared';`,
    ...merged.map((f) => `@use './sections/${f.replace(/^_|\.scss$/g, '')}';`),
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(opts.out, 'index.scss'), index);

  console.log(`[clone-merge] done → ${opts.out}`);
  console.log(`  sections: ${merged.length}, selectors: ${totals.selectors} (shared ${totals.shared}, overrides ${totals.overrides}, mo-only ${totals.moOnly}, pc-only ${totals.pcOnly})`);
  console.log(`  breakpoint: @media (min-width: ${opts.breakpoint}px)`);
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('clone-merge-responsive.js');
if (isMain) {
  try { main(); }
  catch (e) {
    console.error(`[clone-merge] FAIL: ${e.message}`);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(1);
  }
}

export { mergeRules, emitMerged };
