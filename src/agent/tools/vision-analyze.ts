/**
 * vision_analyze Tool - Analyze image file with Gemini Vision
 * Phase 3: Function Calling Tool Definitions
 *
 * Security: Path validation (cwd/tmpdir only, no symlinks)
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join, resolve, relative, extname } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolDefinition, JsonSchema } from '../types.js';
import type { GeminiVision } from '../../interface/vision/index.js';

const visionAnalyzeParameters: JsonSchema = {
  type: 'object',
  properties: {
    imagePath: { type: 'string', description: 'Path to image file' },
    prompt: { type: 'string', description: 'Analysis prompt for Gemini Vision' },
    mode: {
      type: 'string',
      enum: ['rest', 'live'],
      description: 'Analysis mode: rest (default) or live (WebSocket)',
    },
  },
  required: ['imagePath', 'prompt'],
};

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// AsyncLocalStorage for vision instance isolation
const visionStore = new AsyncLocalStorage<GeminiVision>();

export function runInVisionAnalyzeContext<T>(vision: GeminiVision, fn: () => T): T {
  return visionStore.run(vision, fn);
}

async function validateImagePath(imagePath: string): Promise<string> {
  const cwd = process.cwd();
  const tmpDir = tmpdir();

  // Resolve to absolute path
  const absolutePath = resolve(imagePath);

  // Resolve symlinks
  let realPath: string;
  try {
    realPath = await realpath(absolutePath);
  } catch {
    throw new Error(`File not found: ${imagePath}`);
  }

  // Check if path is under cwd or tmpdir
  const relToCwd = relative(cwd, realPath);
  const relToTmp = relative(tmpDir, realPath);

  const isUnderCwd = !relToCwd.startsWith('..') && !relToCwd.startsWith('/');
  const isUnderTmp = !relToTmp.startsWith('..') && !relToTmp.startsWith('/');

  if (!isUnderCwd && !isUnderTmp) {
    throw new Error(
      `Security: Image path must be under project directory or temp directory: ${imagePath}`
    );
  }

  // Check file extension
  const ext = extname(realPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Invalid image format: ${ext}. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`
    );
  }

  // Check file size
  const stats = await stat(realPath);
  if (stats.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Image too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max 10MB)`
    );
  }

  return realPath;
}

async function handleVisionAnalyze(args: Record<string, unknown>): Promise<string> {
  const { imagePath, prompt, mode = 'rest' } = args as {
    imagePath: string;
    prompt: string;
    mode?: 'rest' | 'live';
  };

  const vision = visionStore.getStore();
  if (!vision) {
    return 'Error: Vision service not available in current context';
  }

  try {
    const validatedPath = await validateImagePath(imagePath);
    const imageBuffer = await readFile(validatedPath);

    // Use live mode (WebSocket) if requested and available
    if (mode === 'live') {
      // Try to use VisionInterface's analyzeLive method via AsyncLocalStorage
      // For now, fall back to REST if not available
      const visionInterface = (vision as unknown as { analyzeLive?: (b64: string, p: string) => Promise<string> }).analyzeLive;
      if (visionInterface) {
        const imageBase64 = imageBuffer.toString('base64');
        const result = await visionInterface.call(vision, imageBase64, prompt);
        return result;
      }
      // Fallback to REST
      const result = await vision.analyzeImage(imageBuffer, prompt);
      return result;
    }

    // Default REST mode
    const result = await vision.analyzeImage(imageBuffer, prompt);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Vision analysis failed: ${msg}`;
  }
}

export const visionAnalyzeTool: ToolDefinition = {
  name: 'vision_analyze',
  description:
    'Analyze an image file with Gemini Vision (supports png, jpg, jpeg, gif, webp, bmp). Use mode=live for WebSocket streaming.',
  parameters: visionAnalyzeParameters,
  handler: handleVisionAnalyze,
  scope: 'read',
};
