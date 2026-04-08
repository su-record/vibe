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
import { execFileSync } from 'child_process';

// ─── Config ─────────────────────────────────────────────────────────

const FIGMA_API = 'https://api.figma.com/v1';
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

// ─── WebP 변환 ──────────────────────────────────────────────────────

let _cwebpAvailable;
function hasCwebp() {
  if (_cwebpAvailable === undefined) {
    try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); _cwebpAvailable = true; }
    catch { _cwebpAvailable = false; }
  }
  return _cwebpAvailable;
}

/** PNG 버퍼를 webp 파일로 저장. cwebp 없으면 png 폴백. */
function writeAsWebp(pngBuf, outPath) {
  if (!hasCwebp()) {
    // cwebp 없으면 png 폴백
    const fallback = outPath.replace(/\.webp$/, '.png');
    fs.writeFileSync(fallback, pngBuf);
    return fallback;
  }
  const tmpPng = outPath + '.tmp.png';
  fs.writeFileSync(tmpPng, pngBuf);
  try {
    execFileSync('cwebp', ['-q', '85', tmpPng, '-o', outPath], { stdio: 'ignore' });
    fs.unlinkSync(tmpPng);
    return outPath;
  } catch {
    // 변환 실패 시 png 폴백
    const fallback = outPath.replace(/\.webp$/, '.png');
    fs.renameSync(tmpPng, fallback);
    return fallback;
  }
}

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

// ─── Gradient Helpers ───────────────────────────────────────────────

function toLinearGradient(f) {
  if (!f.gradientHandlePositions || !f.gradientStops) return null;
  const [p0, p1] = f.gradientHandlePositions;
  const angle = Math.round(Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI + 90);
  const opacity = f.opacity ?? 1;
  const stops = f.gradientStops.map(s => {
    const c = opacity < 1 ? { ...s.color, a: (s.color.a ?? 1) * opacity } : s.color;
    return `${toCSS(c)} ${Math.round(s.position * 100)}%`;
  }).join(', ');
  return `linear-gradient(${angle}deg, ${stops})`;
}

function toRadialGradient(f) {
  if (!f.gradientStops) return null;
  const opacity = f.opacity ?? 1;
  const stops = f.gradientStops.map(s => {
    const c = opacity < 1 ? { ...s.color, a: (s.color.a ?? 1) * opacity } : s.color;
    return `${toCSS(c)} ${Math.round(s.position * 100)}%`;
  }).join(', ');
  return `radial-gradient(circle, ${stops})`;
}

// ─── Blend Mode Map ─────────────────────────────────────────────────

const BLEND_MODES = { MULTIPLY:'multiply', SCREEN:'screen', OVERLAY:'overlay', DARKEN:'darken', LIGHTEN:'lighten', COLOR_DODGE:'color-dodge', COLOR_BURN:'color-burn', HARD_LIGHT:'hard-light', SOFT_LIGHT:'soft-light', DIFFERENCE:'difference', EXCLUSION:'exclusion', HUE:'hue', SATURATION:'saturation', COLOR:'color', LUMINOSITY:'luminosity' };

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
  // layoutGrow
  if (n.layoutGrow === 1) css.flexGrow = '1';
  // Padding
  const pt=n.paddingTop||0, pr=n.paddingRight||0, pb=n.paddingBottom||0, pl=n.paddingLeft||0;
  if (pt||pr||pb||pl) css.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
  // Size
  if (n.absoluteBoundingBox) { css.width = `${Math.round(n.absoluteBoundingBox.width)}px`; css.height = `${Math.round(n.absoluteBoundingBox.height)}px`; }
  // layoutSizing — HUG removes fixed dimensions, FILL handled by converter with parent context
  if (n.layoutSizingHorizontal === 'HUG') delete css.width;
  if (n.layoutSizingVertical === 'HUG') delete css.height;
  // Position / overflow / opacity
  if (n.layoutPositioning === 'ABSOLUTE') css.position = 'absolute';
  if (n.clipsContent) css.overflow = 'hidden';
  if (n.opacity != null && n.opacity < 1) css.opacity = n.opacity.toFixed(2);
  // Rotation
  if (n.rotation != null && Math.abs(n.rotation) > 0.05) {
    const deg = +((-n.rotation) % 360).toFixed(2);
    css.transform = `rotate(${deg}deg)`;
  }
  // Node-level blend mode
  if (n.blendMode && BLEND_MODES[n.blendMode]) css.mixBlendMode = BLEND_MODES[n.blendMode];
  // Radius
  if (n.cornerRadius > 0) css.borderRadius = `${n.cornerRadius}px`;
  else if (n.rectangleCornerRadii) { const [a,b,c,d] = n.rectangleCornerRadii; css.borderRadius = `${a}px ${b}px ${c}px ${d}px`; }
  // Fills — multi-fill aware
  let imgRef, imgScaleMode;
  const visibleFills = (n.fills||[]).filter(f=>f.visible!==false);
  // Backward compat: single-fill css properties
  const firstSolid = visibleFills.find(f=>f.type==='SOLID');
  if (firstSolid) css.backgroundColor = toCSS({ ...firstSolid.color, a: firstSolid.opacity ?? firstSolid.color?.a ?? 1 });
  const firstImage = visibleFills.find(f=>f.type==='IMAGE');
  if (firstImage) { imgRef = firstImage.imageRef; imgScaleMode = firstImage.scaleMode; }
  // Gradient → backgroundImage
  const gradients = [];
  for (const f of visibleFills) {
    if (f.type === 'GRADIENT_LINEAR') { const g = toLinearGradient(f); if (g) gradients.push(g); }
    else if (f.type === 'GRADIENT_RADIAL' || f.type === 'GRADIENT_ANGULAR' || f.type === 'GRADIENT_DIAMOND') {
      const g = toRadialGradient(f); if (g) gradients.push(g);
    }
  }
  if (gradients.length) css.backgroundImage = gradients.join(', ');
  // Per-fill blendMode → backgroundBlendMode
  for (const f of visibleFills) {
    if (f.blendMode && f.blendMode !== 'NORMAL' && BLEND_MODES[f.blendMode]) {
      css.backgroundBlendMode = BLEND_MODES[f.blendMode]; break;
    }
  }
  // Fill filters (saturation → grayscale/saturate)
  for (const f of visibleFills) {
    if (f.filters?.saturation != null && f.filters.saturation !== 0) {
      const sat = f.filters.saturation;
      const filterVal = sat < 0 ? `grayscale(${Math.round(Math.abs(sat) * 100)}%)` : `saturate(${Math.round((1 + sat) * 100)}%)`;
      css.filter = (css.filter ? css.filter + ' ' : '') + filterVal;
    }
  }
  // Multi-fill structured array (when 2+ visible fills — for converter)
  let _fills;
  if (visibleFills.length > 1) {
    _fills = visibleFills.map(f => {
      const entry = { type: f.type };
      if (f.type === 'SOLID') entry.color = toCSS({ ...f.color, a: f.opacity ?? f.color?.a ?? 1 });
      if (f.type === 'IMAGE') { entry.imageRef = f.imageRef; if (f.scaleMode) entry.scaleMode = f.scaleMode; }
      if (f.type?.startsWith('GRADIENT_')) {
        entry.gradient = f.type === 'GRADIENT_LINEAR' ? toLinearGradient(f) : toRadialGradient(f);
      }
      if (f.blendMode && f.blendMode !== 'NORMAL' && BLEND_MODES[f.blendMode]) entry.blendMode = BLEND_MODES[f.blendMode];
      if (f.filters?.saturation != null && f.filters.saturation !== 0) entry.filters = f.filters;
      return entry;
    });
  }
  // Strokes — strokeAlign aware
  const stroke = (n.strokes||[]).find(s=>s.visible!==false&&s.type==='SOLID');
  if (stroke && n.strokeWeight) {
    const strokeColor = toCSS({ ...stroke.color, a: stroke.opacity ?? stroke.color?.a ?? 1 });
    if (n.strokeAlign === 'OUTSIDE') {
      css.outline = `${n.strokeWeight}px solid ${strokeColor}`;
    } else {
      css.border = `${n.strokeWeight}px solid ${strokeColor}`;
      if (n.strokeAlign === 'INSIDE') css.boxSizing = 'border-box';
    }
  }
  // Effects
  const shadows = [];
  for (const e of (n.effects||[]).filter(e=>e.visible!==false)) {
    if (e.type==='DROP_SHADOW'||e.type==='INNER_SHADOW') {
      const ins = e.type==='INNER_SHADOW'?'inset ':'';
      shadows.push(`${ins}${e.offset?.x||0}px ${e.offset?.y||0}px ${e.radius||0}px ${e.spread||0}px ${toCSS(e.color)}`);
    } else if (e.type==='LAYER_BLUR') {
      css.filter = (css.filter ? css.filter + ' ' : '') + `blur(${e.radius}px)`;
    } else if (e.type==='BACKGROUND_BLUR') css.backdropFilter = `blur(${e.radius}px)`;
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
    const tf = visibleFills.find(f=>f.type==='SOLID');
    if (tf) css.color = toCSS(tf.color);
  }
  const result = { ...css };
  if (imgRef) result._imageRef = imgRef;
  if (imgScaleMode) result._imageScaleMode = imgScaleMode;
  if (_fills) result._fills = _fills;
  return result;
}

// ─── Tree ───────────────────────────────────────────────────────────

function walk(node, parentAbsBBox) {
  const css = extractCSS(node);
  const r = { nodeId: node.id, name: node.name||'', type: node.type, size: null, css: {...css}, children: [] };
  if (node.type==='TEXT' && node.characters) r.text = node.characters;
  if (node.absoluteBoundingBox) r.size = { width: Math.round(node.absoluteBoundingBox.width), height: Math.round(node.absoluteBoundingBox.height) };
  // Unpack internal fields → top-level metadata
  if (css._imageRef) { r.imageRef = css._imageRef; delete r.css._imageRef; }
  if (css._imageScaleMode) { r.imageScaleMode = css._imageScaleMode; delete r.css._imageScaleMode; }
  if (css._fills) { r.fills = css._fills; delete r.css._fills; }
  // layoutSizing metadata (converter uses with parent context)
  if (node.layoutSizingHorizontal) r.layoutSizingH = node.layoutSizingHorizontal;
  if (node.layoutSizingVertical) r.layoutSizingV = node.layoutSizingVertical;
  // Absolute positioning: parent-relative top/left
  if (node.layoutPositioning === 'ABSOLUTE' && node.absoluteBoundingBox && parentAbsBBox) {
    r.css.top = `${Math.round(node.absoluteBoundingBox.y - parentAbsBBox.y)}px`;
    r.css.left = `${Math.round(node.absoluteBoundingBox.x - parentAbsBBox.x)}px`;
  }
  if (node.children?.length) r.children = node.children.map(c => walk(c, node.absoluteBoundingBox));
  return r;
}

function collectRefs(node, set = new Set()) {
  if (node.imageRef) set.add(node.imageRef);
  if (node.fills) { for (const f of node.fills) { if (f.imageRef) set.add(f.imageRef); } }
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
    const outWebp = path.join(outDir, ref.slice(0,16) + '.webp');
    dl.push(fetch(url).then(r=>r.arrayBuffer()).then(b=>{
      const actual = writeAsWebp(Buffer.from(b), outWebp);
      if (fs.statSync(actual).size > 0) imageMap[ref] = actual;
    }).catch(()=>{}));
  }
  await Promise.all(dl);
  console.log(JSON.stringify({ total: Object.keys(imageMap).length, images: imageMap }, null, 2));
}

async function cmdScreenshot(token, fk, nid, outPath) {
  if (!outPath) fail('--out required');
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // scale=2 시도 → 400 에러 시 scale=1 폴백
  for (const scale of [2, 1]) {
    try {
      const data = await apiFetch(`/images/${fk}?ids=${nid}&format=png&scale=${scale}`, token);
      const url = data.images?.[nid];
      if (!url) continue;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      let finalPath = outPath;
      if (outPath.endsWith('.webp')) {
        finalPath = writeAsWebp(buf, outPath);
      } else {
        fs.writeFileSync(outPath, buf);
      }
      const sz = fs.statSync(finalPath).size;
      console.log(JSON.stringify({ path: finalPath, size: sz, scale }));
      return;
    } catch (e) {
      if (scale === 1) fail(`Screenshot failed: ${e.message}`);
    }
  }
  fail('Screenshot failed at all scales');
}

// ─── Render: HTML + SCSS + Images + Screenshot ─────────────────────

function kebab(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_/\\:]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')  // 한글 제거 — 클래스명은 영문만
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 30);  // 최대 30자
}

function nodeName(node, parentPrefix) {
  let raw = node.name || '';
  // TEXT 노드: 텍스트 대신 부모 컨텍스트 + 'text' 사용
  if (node.type === 'TEXT') raw = raw.slice(0, 20) || 'text';
  // 의미 없는 이름 정리
  raw = raw.replace(/^(Frame|Group|Rectangle|Vector|Ellipse)\s*/i, '');
  if (!raw || /^\d+$/.test(raw)) raw = node.type?.toLowerCase() || 'node';
  const k = kebab(raw);
  return parentPrefix ? `${parentPrefix}-${k}` : k;
}

/** 노드 트리 → HTML 문자열 생성 */
function toHTML(node, prefix, imgMap, indent = 0) {
  const pad = '  '.repeat(indent);
  const cls = nodeName(node, prefix);
  const lines = [];

  // 이미지 노드
  if (node.imageRef && imgMap[node.imageRef]) {
    const isDecorative = node.name?.match(/^(BG|bg|배경|Shadow|Glow|Light|snow|눈|얼음|빙판|트리|Particle)/i);
    const alt = isDecorative ? '' : (node.name || '');
    const ariaHidden = isDecorative ? ' aria-hidden="true"' : '';
    lines.push(`${pad}<img class="${cls}" src="${imgMap[node.imageRef]}" alt="${alt}"${ariaHidden} />`);
    return lines.join('\n');
  }

  // 텍스트 노드
  if (node.type === 'TEXT' && node.text) {
    const tag = node.text.length > 100 ? 'p' : 'span';
    lines.push(`${pad}<${tag} class="${cls}">${node.text}</${tag}>`);
    return lines.join('\n');
  }

  // 컨테이너 노드
  const tag = node.type === 'TEXT' ? 'p' : 'div';
  if (!node.children?.length) {
    lines.push(`${pad}<${tag} class="${cls}" />`);
    return lines.join('\n');
  }

  lines.push(`${pad}<${tag} class="${cls}">`);
  for (const child of node.children) {
    lines.push(toHTML(child, cls, imgMap, indent + 1));
  }
  lines.push(`${pad}</${tag}>`);
  return lines.join('\n');
}

/** 노드 트리 → SCSS 문자열 생성 */
function toSCSS(node, prefix, indent = 0) {
  const cls = nodeName(node, prefix);
  const lines = [];
  const css = node.css || {};
  const props = Object.entries(css);

  if (props.length) {
    lines.push(`.${cls} {`);
    for (const [k, v] of props) {
      // camelCase → kebab-case
      const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      lines.push(`  ${prop}: ${v};`);
    }
    lines.push('}');
    lines.push('');
  }

  if (node.children?.length) {
    for (const child of node.children) {
      lines.push(toSCSS(child, cls));
    }
  }
  return lines.join('\n');
}

/** imageRef → 이름 기반 매핑 (해시 아닌 노드 name 사용) */
function buildImageNames(node, prefix, result = {}) {
  if (node.imageRef) {
    const name = nodeName(node, prefix);
    result[node.imageRef] = name + '.webp';
  }
  if (node.children) {
    for (const child of node.children) {
      buildImageNames(child, nodeName(node, prefix) || prefix, result);
    }
  }
  return result;
}

async function cmdRender(token, fk, nid, outDir, depth, scale) {
  if (!outDir) fail('--out=<dir> required');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const imgDir = path.join(outDir, 'images');
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

  // 1. 트리 가져오기
  const dp = depth ? `&depth=${depth}` : '';
  const treeData = await apiFetch(`/files/${fk}/nodes?ids=${nid}${dp}`, token);
  const nd = treeData.nodes?.[nid];
  if (!nd?.document) fail(`Node ${nid} not found`);
  const tree = walk(nd.document);

  // 2. 이미지 이름 매핑 (노드 name 기반)
  const sectionPrefix = kebab(tree.name);
  const imageNames = buildImageNames(tree, sectionPrefix);
  const refs = collectRefs(tree);

  // 3. fill 이미지 다운로드 (이름 기반)
  let imageMap = {};
  if (refs.size) {
    const allImg = await apiFetch(`/files/${fk}/images`, token);
    const urls = allImg.meta?.images || {};
    const dl = [];
    for (const ref of refs) {
      const url = urls[ref];
      if (!url) continue;
      const fileName = imageNames[ref] || ref.slice(0, 16) + '.webp';
      const filePath = path.join(imgDir, fileName);
      dl.push(fetch(url).then(r => r.arrayBuffer()).then(b => {
        const actual = writeAsWebp(Buffer.from(b), filePath);
        const actualName = path.basename(actual);
        if (fs.statSync(actual).size > 0) imageMap[ref] = `images/${actualName}`;
      }).catch(() => {}));
    }
    await Promise.all(dl);
  }

  // 4. 복합 BG 노드 → 스크린샷으로 렌더링
  for (const child of tree.children || []) {
    if (/^(BG|bg|배경)$/i.test(child.name) && child.children?.length > 3) {
      const bgName = `${sectionPrefix}-bg-composite.webp`;
      const bgPath = path.join(imgDir, bgName);
      try {
        for (const s of [2, 1]) {
          const sData = await apiFetch(`/images/${fk}?ids=${child.nodeId}&format=png&scale=${s}`, token);
          const sUrl = sData.images?.[child.nodeId];
          if (!sUrl) continue;
          const buf = Buffer.from(await (await fetch(sUrl)).arrayBuffer());
          const actual = writeAsWebp(buf, bgPath);
          const actualName = path.basename(actual);
          if (fs.statSync(actual).size > 0) {
            imageMap[`__bg_${child.nodeId}`] = `images/${actualName}`;
            child.imageRef = `__bg_${child.nodeId}`;
            child.children = [];
            break;
          }
        }
      } catch { /* BG screenshot failed, keep original structure */ }
    }
  }

  // 5. 스크린샷
  const screenshotPath = path.join(outDir, `${sectionPrefix}-screenshot.webp`);
  let actualScreenshot = screenshotPath;
  try {
    for (const s of [2, 1]) {
      const sData = await apiFetch(`/images/${fk}?ids=${nid}&format=png&scale=${s}`, token);
      const sUrl = sData.images?.[nid];
      if (!sUrl) continue;
      const buf = Buffer.from(await (await fetch(sUrl)).arrayBuffer());
      actualScreenshot = writeAsWebp(buf, screenshotPath);
      break;
    }
  } catch { /* screenshot failed */ }

  // 6. HTML 생성
  const html = toHTML(tree, '', imageMap);
  fs.writeFileSync(path.join(outDir, `${sectionPrefix}.html`), html);

  // 7. SCSS 생성
  const scss = toSCSS(tree, '');
  fs.writeFileSync(path.join(outDir, `${sectionPrefix}.scss`), scss);

  // 8. 트리 JSON 저장
  fs.writeFileSync(path.join(outDir, `${sectionPrefix}.json`), JSON.stringify(tree, null, 2));

  // 출력 요약
  console.log(JSON.stringify({
    section: sectionPrefix,
    files: {
      html: `${sectionPrefix}.html`,
      scss: `${sectionPrefix}.scss`,
      json: `${sectionPrefix}.json`,
      screenshot: path.basename(actualScreenshot),
    },
    images: imageMap,
    imageCount: Object.keys(imageMap).length,
  }, null, 2));
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
  case 'render': await cmdRender(token, fk, nid, flags.out, flags.depth ? +flags.depth : 10, flags.scale ? +flags.scale : 0.667); break;
  default: console.log('Usage: node figma-extract.js <tree|images|screenshot|render> <fileKey> <nodeId> [flags]');
}
