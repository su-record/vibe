/**
 * vision_capture Tool - Screen capture and Gemini vision analysis
 * Phase 3: Function Calling Tool Definitions
 *
 * Security: GeminiVision instance bound via AsyncLocalStorage
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';
import type { GeminiVision } from '../../interface/vision/index.js';
import { ScreenCapture } from '../../interface/vision/index.js';

export const visionCaptureSchema = z.object({
  area: z.enum(['full', 'region']).optional().describe('Capture area (full screen or region)'),
  region: z.object({
    x: z.number().describe('X coordinate'),
    y: z.number().describe('Y coordinate'),
    w: z.number().describe('Width'),
    h: z.number().describe('Height'),
  }).optional().describe('Region to capture (required if area=region)'),
  prompt: z.string().describe('Analysis prompt for Gemini Vision'),
});

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
  const { area, region, prompt } = args as z.infer<typeof visionCaptureSchema>;

  const vision = visionStore.getStore();
  if (!vision) {
    return 'Error: Vision service not available in current context';
  }

  try {
    const captureOptions = area === 'region' && region
      ? { area: 'region' as const, region }
      : { area: 'full' as const };

    const imageBuffer = await ScreenCapture.capture(captureOptions);
    const result = await vision.analyzeImage(imageBuffer, prompt);

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Vision capture failed: ${msg}`;
  }
}

export const visionCaptureTool: ToolRegistrationInput = {
  name: 'vision_capture',
  description: 'Capture screen and analyze with Gemini Vision',
  schema: visionCaptureSchema,
  handler: handleVisionCapture,
  scope: 'read',
};
