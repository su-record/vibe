/**
 * CLI Commands: vibe figma <subcommand>
 *
 * Figma API integration for design-to-code pipeline.
 * Token is stored in ~/.vibe/config.json credentials.figma
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  readGlobalConfig,
  patchGlobalConfig,
} from '../../infra/lib/config/GlobalConfigManager.js';
import type { FigmaBreakpoints, FigmaCredentials } from '../types.js';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

const DEFAULT_BREAKPOINTS: FigmaBreakpoints = {
  breakpoint: 1024,
  pcTarget: 1920,
  mobilePortrait: 480,
  mobileMinimum: 360,
  designPc: 2560,
  designMobile: 720,
};

function loadFigmaConfig(): FigmaCredentials | null {
  return readGlobalConfig().credentials?.figma ?? null;
}

function loadBreakpoints(): FigmaBreakpoints {
  const userBp = readGlobalConfig().figma?.breakpoints;
  if (!userBp) return DEFAULT_BREAKPOINTS;
  return { ...DEFAULT_BREAKPOINTS, ...userBp };
}

function getFigmaToken(): string | null {
  const config = loadFigmaConfig();
  return config?.accessToken ?? process.env.FIGMA_ACCESS_TOKEN ?? null;
}

/**
 * Parse Figma URL to extract file_key and node_id
 */
function parseFigmaUrl(url: string): { fileKey: string; nodeId: string | null } {
  const fileMatch = url.match(/\/(design|file)\/([a-zA-Z0-9]+)/);
  if (!fileMatch) {
    throw new Error('Invalid Figma URL. Expected: https://www.figma.com/design/<file_key>/...');
  }

  const nodeMatch = url.match(/node-id=([^&]+)/);
  return {
    fileKey: fileMatch[2],
    nodeId: nodeMatch ? decodeURIComponent(nodeMatch[1]) : null,
  };
}

/**
 * Figma API fetch helper
 */
async function figmaFetch(endpoint: string, token: string): Promise<unknown> {
  const res = await fetch(`${FIGMA_API_BASE}${endpoint}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API error ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Extract layer JSON from Figma file
 */
async function extractLayers(
  fileKey: string,
  nodeId: string | null,
  token: string,
): Promise<unknown> {
  const canonicalId = nodeId?.replaceAll('-', ':') ?? null;
  const endpoint = canonicalId
    ? `/files/${fileKey}/nodes?ids=${canonicalId}`
    : `/files/${fileKey}`;

  const data = await figmaFetch(endpoint, token) as Record<string, unknown>;

  if (canonicalId) {
    const nodes = data.nodes as Record<string, unknown> | undefined;
    return nodes?.[canonicalId] ?? data;
  }
  return (data as Record<string, unknown>).document ?? data;
}

/**
 * Render frame image from Figma
 */
async function renderImage(
  fileKey: string,
  nodeId: string | null,
  token: string,
  outputDir: string,
  filename: string = 'frame.png',
): Promise<string | null> {
  if (!nodeId) return null;

  const id = nodeId.replaceAll('-', ':');
  const data = await figmaFetch(
    `/images/${fileKey}?ids=${id}&format=png&scale=2`,
    token,
  ) as Record<string, unknown>;

  const images = data.images as Record<string, string> | undefined;
  const imageUrl = images?.[id];
  if (!imageUrl) return null;

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Image download failed: ${imgRes.status}`);
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const imgPath = path.join(outputDir, filename);
  fs.writeFileSync(imgPath, buffer);

  return imgPath;
}

/**
 * Collect all imageRef values from Figma layer data recursively.
 */
function collectImageRefs(node: unknown, refs: Set<string> = new Set<string>()): Set<string> {
  if (!node || typeof node !== 'object') return refs;
  const obj = node as Record<string, unknown>;

  const fills = obj.fills as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(fills)) {
    for (const fill of fills) {
      if (fill.type === 'IMAGE' && typeof fill.imageRef === 'string') {
        refs.add(fill.imageRef);
      }
    }
  }

  const children = obj.children as unknown[] | undefined;
  if (Array.isArray(children)) {
    for (const child of children) {
      collectImageRefs(child, refs);
    }
  }
  return refs;
}

/**
 * Download image fills from Figma file and save to assets/ directory.
 */
async function extractImageFills(
  fileKey: string,
  imageRefs: Set<string>,
  token: string,
  outputDir: string,
): Promise<number> {
  if (imageRefs.size === 0) return 0;

  const data = await figmaFetch(
    `/files/${fileKey}/images`,
    token,
  ) as Record<string, unknown>;

  const meta = data.meta as Record<string, string> | undefined;
  if (!meta) return 0;

  const assetsDir = path.join(outputDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  let count = 0;
  for (const ref of imageRefs) {
    const imageUrl = meta[ref];
    if (!imageUrl) continue;

    try {
      const res = await fetch(imageUrl);
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') ?? '';
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = contentType.includes('png') ? 'png'
        : contentType.includes('svg') ? 'svg'
        : contentType.includes('webp') ? 'webp'
        : 'jpg';
      const filePath = path.join(assetsDir, `${ref}.${ext}`);
      fs.writeFileSync(filePath, buffer);
      count++;
    } catch {
      // Skip failed downloads silently
    }
  }
  return count;
}

/**
 * Detect viewport class from Figma layer data.
 * Uses the root frame's absoluteBoundingBox width and project breakpoints.
 */
function detectViewport(layers: unknown): { width: number; label: string } {
  const node = layers as Record<string, unknown>;
  const doc = (node.document ?? node) as Record<string, unknown>;
  const bbox = doc.absoluteBoundingBox as { width?: number } | undefined;
  const width = bbox?.width ?? 0;
  const bp = loadBreakpoints();

  if (width > 0 && width <= bp.mobilePortrait) return { width, label: 'mobile' };
  if (width > bp.mobilePortrait && width <= bp.breakpoint) return { width, label: 'tablet' };
  if (width > bp.breakpoint) return { width, label: 'desktop' };
  return { width, label: 'unknown' };
}

/**
 * vibe figma setup <token>
 */
export function figmaSetup(token?: string): void {
  if (!token) {
    console.log('Usage: vibe figma setup <access-token>');
    console.log('  Get a token from: Figma > Settings > Personal access tokens');
    return;
  }

  patchGlobalConfig({
    credentials: {
      figma: {
        accessToken: token,
        createdAt: new Date().toISOString(),
      },
    },
  });
  console.log('Figma access token saved');
}

/**
 * vibe figma status
 */
export function figmaStatus(): void {
  const config = loadFigmaConfig();
  const envToken = process.env.FIGMA_ACCESS_TOKEN;

  if (!config?.accessToken && !envToken) {
    console.log('Figma: not configured');
    console.log('  Run: vibe figma setup <access-token>');
    return;
  }

  if (config?.accessToken) {
    const token = config.accessToken;
    const preview = token.slice(0, 8) + '...' + token.slice(-4);
    console.log(`Figma: configured (${preview})`);
    if (config.createdAt) {
      console.log(`  Added: ${config.createdAt}`);
    }
  } else if (envToken) {
    console.log('Figma: configured (via FIGMA_ACCESS_TOKEN env)');
  }
}

/**
 * vibe figma logout
 */
export function figmaLogout(): void {
  const config = loadFigmaConfig();
  if (!config?.accessToken) {
    console.log('Figma: not configured');
    return;
  }

  patchGlobalConfig({
    credentials: {
      figma: { accessToken: undefined, createdAt: undefined },
    },
  });
  console.log('Figma access token removed');
}

/**
 * Extract a single Figma URL into the given directory.
 * Returns the detected viewport info.
 */
async function extractSingle(
  url: string,
  token: string,
  outputDir: string,
  prefix: string = '',
): Promise<{ viewport: { width: number; label: string } }> {
  const { fileKey, nodeId } = parseFigmaUrl(url);
  console.log(`File key: ${fileKey}, Node ID: ${nodeId ?? 'entire file'}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Extracting layer data...');
  const layers = await extractLayers(fileKey, nodeId, token);
  const layersFile = prefix ? `layers.${prefix}.json` : 'layers.json';
  const layersPath = path.join(outputDir, layersFile);
  fs.writeFileSync(layersPath, JSON.stringify(layers, null, 2));
  console.log(`Layers saved: ${layersPath}`);

  const viewport = detectViewport(layers);

  if (nodeId) {
    console.log('Rendering frame image...');
    const imgFile = prefix ? `frame.${prefix}.png` : 'frame.png';
    const imgPath = await renderImage(fileKey, nodeId, token, outputDir, imgFile);
    if (imgPath) {
      console.log(`Image saved: ${imgPath}`);
    } else {
      console.log('Image rendering skipped (no image URL returned)');
    }
  } else {
    console.log('Image rendering skipped (specify node-id for frame image)');
  }

  // Extract image fills (background images, content images, etc.)
  const imageRefs = collectImageRefs(layers);
  if (imageRefs.size > 0) {
    console.log(`Extracting ${imageRefs.size} image fill(s)...`);
    const downloaded = await extractImageFills(fileKey, imageRefs, token, outputDir);
    console.log(`Image assets saved: ${downloaded}/${imageRefs.size} → ${outputDir}/assets/`);
  }

  return { viewport };
}

interface ViewportEntry {
  url: string;
  label: string;
  width: number;
  layersFile: string;
  frameFile: string;
}

/**
 * vibe figma extract <url...> [--output <dir>]
 *
 * Single URL:   vibe figma extract "url"
 * Multi URL:    vibe figma extract "mobile-url" "desktop-url"
 */
export async function figmaExtract(urls?: string[], outputDir?: string): Promise<void> {
  if (!urls || urls.length === 0) {
    console.log('Usage: vibe figma extract <figma-url> [figma-url...] [--output <dir>]');
    console.log('  Single:  vibe figma extract "url"');
    console.log('  Multi:   vibe figma extract "mobile-url" "desktop-url"');
    return;
  }

  const token = getFigmaToken();
  if (!token) {
    console.error('Figma token not configured.');
    console.error('  Run: vibe figma setup <access-token>');
    console.error('  Or set FIGMA_ACCESS_TOKEN environment variable');
    process.exit(1);
    return;
  }

  const resolvedOutput = outputDir ?? path.join(process.cwd(), 'figma-output');

  try {
    if (urls.length === 1) {
      // Single URL — backward compatible
      const { viewport } = await extractSingle(urls[0], token, resolvedOutput);
      console.log(`Viewport detected: ${viewport.label} (${viewport.width}px)`);
      console.log(`\nDone! Output: ${resolvedOutput}`);
      console.log('Next: Run /vibe.figma in Claude Code to generate components');
      return;
    }

    // Multiple URLs — responsive mode
    console.log(`Extracting ${urls.length} designs for responsive mode...\n`);
    const viewports: ViewportEntry[] = [];

    for (let i = 0; i < urls.length; i++) {
      const tag = String(i + 1);
      console.log(`--- Design ${tag} ---`);
      const { viewport } = await extractSingle(urls[i], token, resolvedOutput, tag);
      viewports.push({
        url: urls[i],
        label: viewport.label,
        width: viewport.width,
        layersFile: `layers.${tag}.json`,
        frameFile: `frame.${tag}.png`,
      });
      console.log(`Viewport: ${viewport.label} (${viewport.width}px)\n`);
    }

    // Sort by width ascending and assign canonical labels
    viewports.sort((a, b) => a.width - b.width);

    // Write responsive manifest with project breakpoints
    const bp = loadBreakpoints();
    const manifest = {
      responsive: true,
      breakpoints: bp,
      viewports: viewports.map((v) => ({
        label: v.label,
        width: v.width,
        layersFile: v.layersFile,
        frameFile: v.frameFile,
        url: v.url,
      })),
      extractedAt: new Date().toISOString(),
    };
    const manifestPath = path.join(resolvedOutput, 'responsive.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log('Responsive manifest saved: responsive.json');
    console.log('Viewports:');
    for (const v of viewports) {
      console.log(`  ${v.label} (${v.width}px) → ${v.layersFile}, ${v.frameFile}`);
    }
    console.log(`\nDone! Output: ${resolvedOutput}`);
    console.log('Next: Run /vibe.figma in Claude Code to generate responsive components');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Extract failed: ${message}`);
    process.exit(1);
  }
}

/**
 * vibe figma breakpoints [--set key=value]
 * Show or update responsive breakpoint defaults.
 */
export function figmaBreakpoints(setArg?: string): void {
  if (setArg) {
    const [key, val] = setArg.split('=');
    const num = Number(val);
    if (!key || Number.isNaN(num)) {
      console.error('Usage: vibe figma breakpoints --set <key>=<value>');
      console.error('  Keys: breakpoint, pcTarget, mobilePortrait, mobileMinimum, designPc, designMobile');
      return;
    }
    const validKeys = Object.keys(DEFAULT_BREAKPOINTS);
    if (!validKeys.includes(key)) {
      console.error(`Unknown key: ${key}. Valid keys: ${validKeys.join(', ')}`);
      return;
    }
    patchGlobalConfig({
      figma: { breakpoints: { [key]: num } },
    });
    console.log(`Breakpoint updated: ${key} = ${num}px`);
  }

  const bp = loadBreakpoints();
  const isCustom = readGlobalConfig().figma?.breakpoints;
  console.log(`Figma Breakpoints${isCustom ? ' (customized)' : ' (defaults)'}:`);
  console.log(`  breakpoint:     ${bp.breakpoint}px  (PC↔Mobile boundary)`);
  console.log(`  pcTarget:       ${bp.pcTarget}px  (PC main target)`);
  console.log(`  mobilePortrait: ${bp.mobilePortrait}px  (Mobile portrait max)`);
  console.log(`  mobileMinimum:  ${bp.mobileMinimum}px  (Mobile minimum)`);
  console.log(`  designPc:       ${bp.designPc}px  (Figma PC artboard)`);
  console.log(`  designMobile:   ${bp.designMobile}px  (Figma Mobile artboard)`);
  if (!isCustom) {
    console.log('\n  Customize: vibe figma breakpoints --set breakpoint=768');
  }
}

/**
 * vibe figma help
 */
export function figmaHelp(): void {
  console.log(`
Figma Commands:
  vibe figma setup <token>                Set Figma access token
  vibe figma extract <url> [url...]       Extract layers + image from Figma URL(s)
  vibe figma breakpoints                  Show current breakpoint defaults
  vibe figma breakpoints --set key=value  Customize a breakpoint value
  vibe figma status                       Show configuration
  vibe figma logout                       Remove access token
  vibe figma help                         Show this help

Extract options:
  --output <dir>                          Output directory (default: ./figma-output)

Breakpoint keys:
  breakpoint      PC↔Mobile boundary (default: 1024px)
  pcTarget        PC main target resolution (default: 1920px)
  mobilePortrait  Mobile portrait max width (default: 480px)
  mobileMinimum   Mobile minimum width (default: 360px)
  designPc        Figma PC artboard width (default: 2560px)
  designMobile    Figma Mobile artboard width (default: 720px)

Workflow (single design):
  1. vibe figma setup <token>
  2. vibe figma extract "https://www.figma.com/design/ABC/Project?node-id=1-2"
  3. claude /vibe.figma

Workflow (responsive — mobile + desktop):
  1. vibe figma setup <token>
  2. vibe figma extract "mobile-url" "desktop-url"
  3. claude /vibe.figma

Get a token from: Figma > Settings > Personal access tokens
  `);
}
