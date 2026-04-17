/**
 * Figma 노드 → CSS 추출 + 트리 워커
 */

import fs from 'fs';
import path from 'path';
import { figmaFetch, loadToken } from './api.js';
import type {
  FigmaNode,
  FigmaRawProps,
  FigmaWarning,
  FigmaImageMap,
  FigmaTreeOptions,
  FigmaImageOptions,
  FigmaScreenshotOptions,
} from './types.js';

// ─── Color ──────────────────────────────────────────────────────────

function figmaColorToCSS(color: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a ?? 1;
  if (a === 1) {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`;
}

// ─── Node → CSS ─────────────────────────────────────────────────────

interface ExtractResult {
  css: Record<string, string>;
  raw: FigmaRawProps;
  warnings: FigmaWarning[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractCSS(node: any): ExtractResult {
  const css: Record<string, string> = {};
  const raw: FigmaRawProps = {};
  const warnings: FigmaWarning[] = [];

  // Layout
  if (node.layoutMode === 'VERTICAL') {
    css.display = 'flex';
    css.flexDirection = 'column';
  } else if (node.layoutMode === 'HORIZONTAL') {
    css.display = 'flex';
    css.flexDirection = 'row';
  }

  const axisMap: Record<string, string> = {
    MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between',
  };
  const crossMap: Record<string, string> = {
    MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline',
  };
  if (node.primaryAxisAlignItems && axisMap[node.primaryAxisAlignItems]) {
    css.justifyContent = axisMap[node.primaryAxisAlignItems];
  }
  if (node.counterAxisAlignItems && crossMap[node.counterAxisAlignItems]) {
    css.alignItems = crossMap[node.counterAxisAlignItems];
  }
  if (node.itemSpacing != null && node.itemSpacing > 0) {
    css.gap = `${node.itemSpacing}px`;
    raw.itemSpacing = node.itemSpacing;
  }

  // Padding
  const pt = node.paddingTop || 0;
  const pr = node.paddingRight || 0;
  const pb = node.paddingBottom || 0;
  const pl = node.paddingLeft || 0;
  if (pt || pr || pb || pl) {
    css.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
    raw.paddingTop = pt;
    raw.paddingRight = pr;
    raw.paddingBottom = pb;
    raw.paddingLeft = pl;
  }

  // Size
  if (node.absoluteBoundingBox) {
    css.width = `${Math.round(node.absoluteBoundingBox.width)}px`;
    css.height = `${Math.round(node.absoluteBoundingBox.height)}px`;
  }

  // Position
  if (node.layoutPositioning === 'ABSOLUTE') {
    css.position = 'absolute';
  }

  // Overflow
  if (node.clipsContent) {
    css.overflow = 'hidden';
  }

  // Opacity
  if (node.opacity != null && node.opacity < 1) {
    css.opacity = node.opacity.toFixed(2);
    raw.opacity = node.opacity;
  }

  // Blend mode — supported CSS values get mapped, everything else is
  // recorded as a warning instead of silently dropped (which was the
  // behaviour that let LINEAR_BURN / LINEAR_DODGE disappear without
  // the implementer noticing).
  const blendMap: Record<string, string> = {
    MULTIPLY: 'multiply', SCREEN: 'screen', OVERLAY: 'overlay',
    DARKEN: 'darken', LIGHTEN: 'lighten', COLOR_DODGE: 'color-dodge',
    COLOR_BURN: 'color-burn', HARD_LIGHT: 'hard-light', SOFT_LIGHT: 'soft-light',
    DIFFERENCE: 'difference', EXCLUSION: 'exclusion', HUE: 'hue',
    SATURATION: 'saturation', COLOR: 'color', LUMINOSITY: 'luminosity',
  };
  if (node.blendMode && node.blendMode !== 'NORMAL' && node.blendMode !== 'PASS_THROUGH') {
    raw.blendMode = node.blendMode;
    if (blendMap[node.blendMode]) {
      css.mixBlendMode = blendMap[node.blendMode];
    } else {
      warnings.push({
        property: 'blendMode',
        value: node.blendMode,
        reason: 'no CSS mix-blend-mode equivalent — bake into asset or replace in Figma',
      });
    }
  }

  // Corner radius
  if (node.cornerRadius != null && node.cornerRadius > 0) {
    css.borderRadius = `${node.cornerRadius}px`;
    raw.cornerRadius = node.cornerRadius;
  } else if (node.rectangleCornerRadii) {
    const [tl, tr, br, bl] = node.rectangleCornerRadii as number[];
    css.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
    raw.rectangleCornerRadii = [tl, tr, br, bl];
  }

  // Fills
  let imageRef: string | undefined;
  if (node.fills?.length) {
    for (const fill of node.fills) {
      if (fill.visible === false) continue;
      if (fill.type === 'SOLID') {
        const a = fill.opacity ?? fill.color?.a ?? 1;
        css.backgroundColor = figmaColorToCSS({ ...fill.color, a });
      } else if (fill.type === 'IMAGE') {
        imageRef = fill.imageRef;
      }
    }
  }

  // Strokes — CSS border is always centered on the edge. If Figma uses
  // INSIDE/OUTSIDE, recording a warning lets the audit pipeline flag
  // the visual shift rather than pretending the border matches.
  if (node.strokes?.length && node.strokeWeight) {
    const stroke = node.strokes.find((s: any) => s.visible !== false && s.type === 'SOLID');
    if (stroke) {
      css.border = `${node.strokeWeight}px solid ${figmaColorToCSS(stroke.color)}`;
      raw.strokeWeight = node.strokeWeight;
      if (node.strokeAlign) {
        raw.strokeAlign = node.strokeAlign;
        if (node.strokeAlign !== 'CENTER') {
          warnings.push({
            property: 'strokeAlign',
            value: node.strokeAlign,
            reason: 'CSS border is always centered — INSIDE/OUTSIDE shifts the visual box',
          });
        }
      }
    }
  }

  // Effects
  if (node.effects?.length) {
    const shadows: string[] = [];
    for (const eff of node.effects) {
      if (eff.visible === false) continue;
      if (eff.type === 'DROP_SHADOW' || eff.type === 'INNER_SHADOW') {
        const inset = eff.type === 'INNER_SHADOW' ? 'inset ' : '';
        const x = eff.offset?.x ?? 0;
        const y = eff.offset?.y ?? 0;
        const r = eff.radius ?? 0;
        const spread = eff.spread ?? 0;
        shadows.push(`${inset}${x}px ${y}px ${r}px ${spread}px ${figmaColorToCSS(eff.color)}`);
      } else if (eff.type === 'LAYER_BLUR') {
        css.filter = `blur(${eff.radius}px)`;
      } else if (eff.type === 'BACKGROUND_BLUR') {
        css.backdropFilter = `blur(${eff.radius}px)`;
      }
    }
    if (shadows.length) css.boxShadow = shadows.join(', ');
  }

  // Typography
  if (node.type === 'TEXT' && node.style) {
    const s = node.style;
    if (s.fontFamily) css.fontFamily = `'${s.fontFamily}', sans-serif`;
    if (s.fontSize) { css.fontSize = `${s.fontSize}px`; raw.fontSize = s.fontSize; }
    if (s.fontWeight) { css.fontWeight = String(s.fontWeight); raw.fontWeight = s.fontWeight; }
    if (s.lineHeightPx) { css.lineHeight = `${s.lineHeightPx}px`; raw.lineHeightPx = s.lineHeightPx; }
    if (s.letterSpacing) { css.letterSpacing = `${s.letterSpacing}px`; raw.letterSpacing = s.letterSpacing; }
    const textAlignMap: Record<string, string> = {
      LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify',
    };
    if (s.textAlignHorizontal && textAlignMap[s.textAlignHorizontal]) {
      css.textAlign = textAlignMap[s.textAlignHorizontal];
    }
    // leadingTrim / textBoxTrim → CSS text-box-trim. Firefox unsupported
    // as of 2026-04, so record a warning rather than emit a rule that
    // will behave inconsistently across browsers.
    if (s.leadingTrim || s.textBoxTrim) {
      warnings.push({
        property: 'style.leadingTrim',
        value: String(s.leadingTrim ?? s.textBoxTrim),
        reason: 'maps to text-box-trim — inconsistent browser support, rely on explicit line-height instead',
      });
    }
    if (node.fills?.length) {
      const textFill = node.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
      if (textFill) css.color = figmaColorToCSS(textFill.color);
    }
  }

  const cssOut = imageRef ? { ...css, _imageRef: imageRef } : css;
  return { css: cssOut, raw, warnings };
}

// ─── Tree Walker ────────────────────────────────────────────────────

function walkNode(node: any): FigmaNode {
  const { css, raw, warnings } = extractCSS(node);
  const result: FigmaNode = {
    nodeId: node.id,
    name: node.name || '',
    type: node.type,
    size: node.absoluteBoundingBox
      ? { width: Math.round(node.absoluteBoundingBox.width), height: Math.round(node.absoluteBoundingBox.height) }
      : null,
    css: { ...css },
    raw,
    warnings,
    children: [],
  };

  if (node.type === 'TEXT' && node.characters) {
    result.text = node.characters;
  }
  if (result.css._imageRef) {
    result.imageRef = result.css._imageRef;
    delete result.css._imageRef;
  }
  if (node.children?.length) {
    result.children = node.children.map(walkNode);
  }

  return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Public API ─────────────────────────────────────────────────────

export async function getTree(options: FigmaTreeOptions): Promise<FigmaNode> {
  const token = loadToken();
  const depthParam = options.depth ? `&depth=${options.depth}` : '';
  const data = await figmaFetch<any>(
    `/files/${options.fileKey}/nodes?ids=${options.nodeId}${depthParam}`,
    token,
  );

  const nodeData = data.nodes?.[options.nodeId];
  if (!nodeData?.document) {
    throw new Error(`Node ${options.nodeId} not found in file ${options.fileKey}`);
  }

  return walkNode(nodeData.document);
}

export function collectImageRefs(node: FigmaNode, refs: Set<string> = new Set()): Set<string> {
  if (node.imageRef) refs.add(node.imageRef);
  for (const child of node.children) collectImageRefs(child, refs);
  return refs;
}

/** Flat list of nodes with their raw numeric values — input for compareRaw. */
export function collectRawNodes(
  node: FigmaNode,
  out: Array<{ nodeId: string; name: string; raw: FigmaRawProps }> = [],
): Array<{ nodeId: string; name: string; raw: FigmaRawProps }> {
  if (Object.keys(node.raw).length > 0) {
    out.push({ nodeId: node.nodeId, name: node.name, raw: node.raw });
  }
  for (const child of node.children) collectRawNodes(child, out);
  return out;
}

/** Flat list of every extraction warning in the tree (silent-drop replacement). */
export function collectWarnings(
  node: FigmaNode,
  out: Array<{ nodeId: string; name: string; warning: FigmaWarning }> = [],
): Array<{ nodeId: string; name: string; warning: FigmaWarning }> {
  for (const w of node.warnings) out.push({ nodeId: node.nodeId, name: node.name, warning: w });
  for (const child of node.children) collectWarnings(child, out);
  return out;
}

export async function getImages(options: FigmaImageOptions): Promise<FigmaImageMap> {
  const token = loadToken();

  if (!fs.existsSync(options.outDir)) {
    fs.mkdirSync(options.outDir, { recursive: true });
  }

  // 렌더링 모드: 노드를 PNG로 렌더
  if (options.render && options.nodeIds?.length) {
    const ids = options.nodeIds.join(',');
    const data = await figmaFetch<any>(
      `/images/${options.fileKey}?ids=${ids}&format=png&scale=2`,
      token,
    );
    if (!data.images) throw new Error('No images returned');

    const imageMap: Record<string, string> = {};
    const downloads: Promise<void>[] = [];
    for (const [id, url] of Object.entries(data.images as Record<string, string>)) {
      if (!url) continue;
      const safeName = id.replace(/[:/;]/g, '-') + '.png';
      const outPath = path.join(options.outDir, safeName);
      downloads.push(downloadFile(url, outPath).then(() => { imageMap[id] = outPath; }));
    }
    await Promise.all(downloads);
    return { total: Object.keys(imageMap).length, images: imageMap };
  }

  // Fill 이미지 모드
  const data = await figmaFetch<any>(`/files/${options.fileKey}/images`, token);
  if (!data.meta?.images) throw new Error('No image fills found');

  const allImages: Record<string, string> = data.meta.images;
  const imageMap: Record<string, string> = {};
  const downloads: Promise<void>[] = [];

  for (const [ref, url] of Object.entries(allImages)) {
    if (options.imageRefs && !options.imageRefs.has(ref)) continue;
    if (!url) continue;

    const safeName = ref.slice(0, 16) + '.png';
    const outPath = path.join(options.outDir, safeName);
    downloads.push(
      downloadFile(url, outPath)
        .then(() => { imageMap[ref] = outPath; })
        .catch(err => { process.stderr.write(`Failed: ${ref}: ${(err as Error).message}\n`); }),
    );
  }
  await Promise.all(downloads);

  // verify
  for (const [ref, filePath] of Object.entries(imageMap)) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size === 0) delete imageMap[ref];
    } catch { delete imageMap[ref]; }
  }

  return { total: Object.keys(imageMap).length, images: imageMap };
}

export async function getScreenshot(options: FigmaScreenshotOptions): Promise<{ path: string; size: number }> {
  const token = loadToken();
  const fmt = options.format ?? 'png';
  const scale = options.scale ?? 2;

  const data = await figmaFetch<any>(
    `/images/${options.fileKey}?ids=${options.nodeId}&format=${fmt}&scale=${scale}`,
    token,
  );
  const url = data.images?.[options.nodeId];
  if (!url) throw new Error(`No screenshot URL for ${options.nodeId}`);

  const dir = path.dirname(options.outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await downloadFile(url, options.outPath);
  const stat = fs.statSync(options.outPath);
  return { path: options.outPath, size: stat.size };
}

async function downloadFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}
