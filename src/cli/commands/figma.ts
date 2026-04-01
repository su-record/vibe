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
import type { FigmaCredentials } from '../types.js';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

function loadFigmaConfig(): FigmaCredentials | null {
  return readGlobalConfig().credentials?.figma ?? null;
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
  const endpoint = nodeId
    ? `/files/${fileKey}/nodes?ids=${nodeId.replace('-', ':')}`
    : `/files/${fileKey}`;

  const data = await figmaFetch(endpoint, token) as Record<string, unknown>;

  if (nodeId) {
    const nodes = data.nodes as Record<string, unknown> | undefined;
    return nodes?.[nodeId.replace('-', ':')] ?? data;
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
): Promise<string | null> {
  if (!nodeId) return null;

  const id = nodeId.replace('-', ':');
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
  const imgPath = path.join(outputDir, 'frame.png');
  fs.writeFileSync(imgPath, buffer);

  return imgPath;
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
 * vibe figma extract <url> [--output <dir>]
 */
export async function figmaExtract(url?: string, outputDir?: string): Promise<void> {
  if (!url) {
    console.log('Usage: vibe figma extract <figma-url> [--output <dir>]');
    console.log('  Example: vibe figma extract "https://www.figma.com/design/ABC123/MyProject?node-id=1-2"');
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
    const { fileKey, nodeId } = parseFigmaUrl(url);
    console.log(`File key: ${fileKey}, Node ID: ${nodeId ?? 'entire file'}`);

    if (!fs.existsSync(resolvedOutput)) {
      fs.mkdirSync(resolvedOutput, { recursive: true });
    }

    // Extract layers
    console.log('Extracting layer data...');
    const layers = await extractLayers(fileKey, nodeId, token);
    const layersPath = path.join(resolvedOutput, 'layers.json');
    fs.writeFileSync(layersPath, JSON.stringify(layers, null, 2));
    console.log(`Layers saved: ${layersPath}`);

    // Render image
    if (nodeId) {
      console.log('Rendering frame image...');
      const imgPath = await renderImage(fileKey, nodeId, token, resolvedOutput);
      if (imgPath) {
        console.log(`Image saved: ${imgPath}`);
      } else {
        console.log('Image rendering skipped (no image URL returned)');
      }
    } else {
      console.log('Image rendering skipped (specify node-id for frame image)');
    }

    console.log(`\nDone! Output: ${resolvedOutput}`);
    console.log('Next: Run /vibe.figma in Claude Code to generate components');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Extract failed: ${message}`);
    process.exit(1);
  }
}

/**
 * vibe figma help
 */
export function figmaHelp(): void {
  console.log(`
Figma Commands:
  vibe figma setup <token>       Set Figma access token
  vibe figma extract <url>       Extract layers + image from Figma URL
  vibe figma status              Show configuration
  vibe figma logout              Remove access token
  vibe figma help                Show this help

Extract options:
  --output <dir>                 Output directory (default: ./figma-output)

Workflow:
  1. vibe figma setup <token>
  2. vibe figma extract "https://www.figma.com/design/ABC/Project?node-id=1-2"
  3. claude /vibe.figma

Get a token from: Figma > Settings > Personal access tokens
  `);
}
