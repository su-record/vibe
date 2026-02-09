/**
 * vision_capture Tool - Screen capture and Gemini vision analysis
 * Phase 3: Function Calling Tool Definitions
 *
 * Security: GeminiVision instance bound via AsyncLocalStorage
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolDefinition, JsonSchema } from '../types.js';
import type { GeminiVision } from '../../interface/vision/index.js';
import { ScreenCapture } from '../../interface/vision/index.js';

const visionCaptureParameters: JsonSchema = {
  type: 'object',
  properties: {
    area: {
      type: 'string',
      enum: ['full', 'region'],
      description: 'Capture area (full screen or region)',
    },
    region: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        w: { type: 'number', description: 'Width' },
        h: { type: 'number', description: 'Height' },
      },
      required: ['x', 'y', 'w', 'h'],
      description: 'Region to capture (required if area=region)',
    },
    prompt: { type: 'string', description: 'Analysis prompt for Gemini Vision' },
    mode: {
      type: 'string',
      enum: ['rest', 'live'],
      description: 'Analysis mode: rest (default) or live (WebSocket)',
    },
  },
  required: ['prompt'],
};

// AsyncLocalStorage for vision instance isolation
const visionStore = new AsyncLocalStorage<GeminiVision>();

export function bindVisionCapture(vision: GeminiVision): void {
  // Vision instance is bound per-request, no persistent storage needed
}

export function unbindVisionCapture(): void {
  // No-op, cleanup handled by AsyncLocalStorage
}

export function runInVisionContext<T>(vision: GeminiVision, fn: () => T): T {
  return visionStore.run(vision, fn);
}

async function handleVisionCapture(args: Record<string, unknown>): Promise<string> {
  const { area, region, prompt, mode = 'rest' } = args as {
    area?: 'full' | 'region';
    region?: { x: number; y: number; w: number; h: number };
    prompt: string;
    mode?: 'rest' | 'live';
  };

  const vision = visionStore.getStore();
  if (!vision) {
    return 'Error: Vision service not available in current context';
  }

  try {
    const captureOptions = area === 'region' && region
      ? { area: 'region' as const, region }
      : { area: 'full' as const };

    const imageBuffer = await ScreenCapture.capture(captureOptions);

    // Use live mode (WebSocket) if requested and available
    if (mode === 'live') {
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
    return `Vision capture failed: ${msg}`;
  }
}

export const visionCaptureTool: ToolDefinition = {
  name: 'vision_capture',
  description: 'Capture screen and analyze with Gemini Vision. Use mode=live for WebSocket streaming.',
  parameters: visionCaptureParameters,
  handler: handleVisionCapture,
  scope: 'read',
};
