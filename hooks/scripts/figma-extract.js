#!/usr/bin/env node

/**
 * figma-extract.js — Figma REST API 디자인 추출 도구
 *
 * Usage:
 *   node figma-extract.js tree <fileKey> <nodeId> [--depth=10]
 *   node figma-extract.js images <fileKey> <nodeId> --out=<dir> [--depth=10]
 *   node figma-extract.js screenshot <fileKey> <nodeId> --out=<path>
 *
 * Token: ~/.vibe/config.json → credentials.figma.accessToken
 *        또는 FIGMA_ACCESS_TOKEN env
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ─── Config ─────────────────────────────────────────────────────────

const FIGMA_API = 'https://api.figma.com/v1';
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

function loadToken() {
  if (process.env.FIGMA_ACCESS_TOKEN) return process.env.FIGMA_ACCESS_TOKEN;
  const configPath = path.join(os.homedir(), '.vibe', 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const token = config?.credentials?.figma?.accessToken;
    if (token) return token;
  } catch { /* ignore */ }
  return null;
}

function fail(msg) { console.error(JSON.stringify({ error: msg })); process.exit(1); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── HTTP ───────────────────────────────────────────────────────────

async function apiFetch(endpoint, token) {
  let lastErr = '';
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${FIGMA_API}${endpoint}`, { headers: { 'X-Figma-Token': token } });
      if (res.status === 429) { await sleep(INITIAL_DELAY_MS * 2 ** i); continue; }
      if (res.status === 403) fail('403 Forbidden — check token permissions');
      if (res.status === 404) fail('404 — check fileKey/nodeId');
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        if (res.status >= 500) { await sleep(INITIAL_DELAY_MS * 2 ** i); continue; }
        fail(lastErr);
      }
      return await res.json();
    } catch (e) {
      lastErr = e.message;
      if (i < MAX_RETRIES - 1) await sleep(INITIAL_DELAY_MS * 2 ** i);
    }
  }
  fail(`Failed after ${MAX_RETRIES} retries: ${lastErr}`);
}

// ─── Color ──────────────────────────────────────────────────────────

function toCSS(c) {
  if (!c) return null;
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255), a = c.a ?? 1;
  if (a === 1) return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  return `rgba(${r}, ${g}, ${b}, ${+a.toFixed(2)})`;
}

// ─── CSS Extraction ─────────────────────────────────────────────────

function extractCSS(n) {
  const css = {};
  // Layout
  if (n.layoutMode === 'VERTICAL') { css.display = 'flex'; css.flexDirection = 'column'; }
  else if (n.layoutMode === 'HORIZONTAL') { css.display = 'flex'; css.flexDirection = 'row'; }
  const axM = { MIN:'flex-start', CENTER:'center', MAX:'flex-end', SPACE_BETWEEN:'space-between' };
  const crM = { MIN:'flex-start', CENTER:'center', MAX:'flex-end', BASELINE:'baseline' };
  if (n.primaryAxisAlignItems && axM[n.primaryAxisAlignItems]) css.justifyContent = axM[n.primaryAxisAlignItems];
  if (n.counterAxisAlignItems && crM[n.counterAxisAlignItems]) css.alignItems = crM[n.counterAxisAlignItems];
  if (n.itemSpacing > 0) css.gap = `${n.itemSpacing}px`;
  // Padding
  const pt=n.paddingTop||0, pr=n.paddingRight||0, pb=n.paddingBottom||0, pl=n.paddingLeft||0;
  if (pt||pr||pb||pl) css.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
  // Size
  if (n.absoluteBoundingBox) { css.width = `${Math.round(n.absoluteBoundingBox.width)}px`; css.height = `${Math.round(n.absoluteBoundingBox.height)}px`; }
  // Position / overflow / opacity
  if (n.layoutPositioning === 'ABSOLUTE') css.position = 'absolute';
  if (n.clipsContent) css.overflow = 'hidden';
  if (n.opacity != null && n.opacity < 1) css.opacity = n.opacity.toFixed(2);
  // Blend
  const bm = { MULTIPLY:'multiply', SCREEN:'screen', OVERLAY:'overlay', DARKEN:'darken', LIGHTEN:'lighten', COLOR_DODGE:'color-dodge', COLOR_BURN:'color-burn', HARD_LIGHT:'hard-light', SOFT_LIGHT:'soft-light', DIFFERENCE:'difference', EXCLUSION:'exclusion', HUE:'hue', SATURATION:'saturation', COLOR:'color', LUMINOSITY:'luminosity' };
  if (n.blendMode && bm[n.blendMode]) css.mixBlendMode = bm[n.blendMode];
  // Radius
  if (n.cornerRadius > 0) css.borderRadius = `${n.cornerRadius}px`;
  else if (n.rectangleCornerRadii) { const [a,b,c,d] = n.rectangleCornerRadii; css.borderRadius = `${a}px ${b}px ${c}px ${d}px`; }
  // Fills
  let imgRef;
  for (const f of (n.fills||[]).filter(f=>f.visible!==false)) {
    if (f.type === 'SOLID') css.backgroundColor = toCSS({ ...f.color, a: f.opacity ?? f.color?.a ?? 1 });
    else if (f.type === 'IMAGE') imgRef = f.imageRef;
  }
  // Strokes
  const stroke = (n.strokes||[]).find(s=>s.visible!==false&&s.type==='SOLID');
  if (stroke && n.strokeWeight) css.border = `${n.strokeWeight}px solid ${toCSS(stroke.color)}`;
  // Effects
  const shadows = [];
  for (const e of (n.effects||[]).filter(e=>e.visible!==false)) {
    if (e.type==='DROP_SHADOW'||e.type==='INNER_SHADOW') {
      const ins = e.type==='INNER_SHADOW'?'inset ':'';
      shadows.push(`${ins}${e.offset?.x||0}px ${e.offset?.y||0}px ${e.radius||0}px ${e.spread||0}px ${toCSS(e.color)}`);
    } else if (e.type==='LAYER_BLUR') css.filter = `blur(${e.radius}px)`;
    else if (e.type==='BACKGROUND_BLUR') css.backdropFilter = `blur(${e.radius}px)`;
  }
  if (shadows.length) css.boxShadow = shadows.join(', ');
  // Text
  if (n.type === 'TEXT' && n.style) {
    const s = n.style;
    if (s.fontFamily) css.fontFamily = `'${s.fontFamily}', sans-serif`;
    if (s.fontSize) css.fontSize = `${s.fontSize}px`;
    if (s.fontWeight) css.fontWeight = String(s.fontWeight);
    if (s.lineHeightPx) css.lineHeight = `${s.lineHeightPx}px`;
    if (s.letterSpacing) css.letterSpacing = `${s.letterSpacing}px`;
    const ta = { LEFT:'left', CENTER:'center', RIGHT:'right', JUSTIFIED:'justify' };
    if (s.textAlignHorizontal && ta[s.textAlignHorizontal]) css.textAlign = ta[s.textAlignHorizontal];
    const tf = (n.fills||[]).find(f=>f.visible!==false&&f.type==='SOLID');
    if (tf) css.color = toCSS(tf.color);
  }
  return imgRef ? { ...css, _imageRef: imgRef } : css;
}

// ─── Tree ───────────────────────────────────────────────────────────

function walk(node) {
  const css = extractCSS(node);
  const r = { nodeId: node.id, name: node.name||'', type: node.type, size: null, css: {...css}, children: [] };
  if (node.type==='TEXT' && node.characters) r.text = node.characters;
  if (node.absoluteBoundingBox) r.size = { width: Math.round(node.absoluteBoundingBox.width), height: Math.round(node.absoluteBoundingBox.height) };
  if (css._imageRef) { r.imageRef = css._imageRef; delete r.css._imageRef; }
  if (node.children?.length) r.children = node.children.map(walk);
  return r;
}

function collectRefs(node, set = new Set()) {
  if (node.imageRef) set.add(node.imageRef);
  (node.children||[]).forEach(c => collectRefs(c, set));
  return set;
}

// ─── Commands ───────────────────────────────────────────────────────

async function cmdTree(token, fk, nid, depth) {
  const dp = depth ? `&depth=${depth}` : '';
  const data = await apiFetch(`/files/${fk}/nodes?ids=${nid}${dp}`, token);
  const nd = data.nodes?.[nid];
  if (!nd?.document) fail(`Node ${nid} not found`);
  console.log(JSON.stringify(walk(nd.document), null, 2));
}

async function cmdImages(token, fk, nid, outDir, depth) {
  if (!outDir) fail('--out required');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // tree → refs
  const dp = depth ? `&depth=${depth}` : '';
  const data = await apiFetch(`/files/${fk}/nodes?ids=${nid}${dp}`, token);
  const nd = data.nodes?.[nid];
  if (!nd?.document) fail(`Node ${nid} not found`);
  const tree = walk(nd.document);
  const refs = collectRefs(tree);
  if (!refs.size) { console.log(JSON.stringify({ total: 0, images: {} })); return; }
  // download
  const allImg = await apiFetch(`/files/${fk}/images`, token);
  const urls = allImg.meta?.images || {};
  const imageMap = {};
  const dl = [];
  for (const ref of refs) {
    const url = urls[ref];
    if (!url) continue;
    const out = path.join(outDir, ref.slice(0,16) + '.png');
    dl.push(fetch(url).then(r=>r.arrayBuffer()).then(b=>{
      fs.writeFileSync(out, Buffer.from(b));
      const sz = fs.statSync(out).size;
      if (sz > 0) imageMap[ref] = out;
    }).catch(()=>{}));
  }
  await Promise.all(dl);
  console.log(JSON.stringify({ total: Object.keys(imageMap).length, images: imageMap }, null, 2));
}

async function cmdScreenshot(token, fk, nid, outPath) {
  if (!outPath) fail('--out required');
  const data = await apiFetch(`/images/${fk}?ids=${nid}&format=png&scale=2`, token);
  const url = data.images?.[nid];
  if (!url) fail(`No image for ${nid}`);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(outPath, buf);
  console.log(JSON.stringify({ path: outPath, size: buf.length }));
}

// ─── CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
const pos = [];
for (const a of args) {
  if (a.startsWith('--')) { const [k,v] = a.slice(2).split('='); flags[k] = v ?? ''; }
  else pos.push(a);
}

const token = loadToken();
if (!token) fail('Figma token not found. Run: vibe figma setup <token>');

const [cmd, fk, nidRaw] = pos;
const nid = nidRaw?.replace(/-/g, ':');

switch (cmd) {
  case 'tree': await cmdTree(token, fk, nid, flags.depth ? +flags.depth : undefined); break;
  case 'images': await cmdImages(token, fk, nid, flags.out, flags.depth ? +flags.depth : 10); break;
  case 'screenshot': await cmdScreenshot(token, fk, nid, flags.out); break;
  default: console.log('Usage: node figma-extract.js <tree|images|screenshot> <fileKey> <nodeId> [flags]');
}
