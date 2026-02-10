/**
 * Vision MCP Tools — Phase 4-3
 *
 * - core_vision_start: Vision 세션 시작
 * - core_vision_stop: Vision 세션 종료
 * - core_vision_mode: 모드 전환
 * - core_vision_snapshot: 단발 캡처
 * - core_vision_ask: 현재 화면에 질문
 */

import type { ToolResult, ToolDefinition } from '../../types/tool.js';
import { ScreenCaptureEngine, LocalCaptureSource, CDPCaptureSource, RemoteCaptureSource } from '../../interface/vision/ScreenCaptureEngine.js';
import { VisionSessionManager } from '../../interface/vision/VisionSession.js';
import { GeminiLiveStream } from '../../interface/vision/GeminiLiveStream.js';
import type { CaptureMode, CaptureRegion, VisionLogger } from '../../interface/vision/types.js';

// ============================================================================
// Singleton
// ============================================================================

let sessionManager: VisionSessionManager | null = null;
let captureEngine: ScreenCaptureEngine | null = null;
let liveStream: GeminiLiveStream | null = null;

function getLogger(): VisionLogger {
  return (level, message) => {
    if (level === 'error') {
      console.error(`[vision] ${message}`);
    }
  };
}

function ensureEngine(): ScreenCaptureEngine {
  if (!captureEngine) {
    const logger = getLogger();
    const sources = [
      new LocalCaptureSource(logger),
      new CDPCaptureSource(logger),
      new RemoteCaptureSource(),
    ];
    captureEngine = new ScreenCaptureEngine(sources, logger);
  }
  return captureEngine;
}

function ensureSessionManager(): VisionSessionManager {
  if (!sessionManager) {
    sessionManager = new VisionSessionManager(getLogger());
  }
  return sessionManager;
}

function ensureLiveStream(): GeminiLiveStream {
  if (!liveStream) {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    liveStream = new GeminiLiveStream(apiKey, getLogger());
  }
  return liveStream;
}

function validateRegion(x: number, y: number, width: number, height: number): string | null {
  if (x < 0 || y < 0) return '좌표는 0 이상이어야 합니다.';
  if (width < 100 || height < 100) return '최소 캡처 영역은 100x100px입니다.';
  if (width > 7680 || height > 4320) return '최대 캡처 영역은 7680x4320px입니다.';
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return '좌표값이 유효하지 않습니다.';
  }
  return null;
}

function successResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }, null, 2) }] };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const visionStartDefinition: ToolDefinition = {
  name: 'core_vision_start',
  description: 'vision start|screen share - Start a vision session with screen capture',
  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['full', 'region', 'window'], description: 'Capture mode (default: full)' },
      x: { type: 'number', description: 'Region X coordinate' },
      y: { type: 'number', description: 'Region Y coordinate' },
      width: { type: 'number', description: 'Region width' },
      height: { type: 'number', description: 'Region height' },
      windowId: { type: 'string', description: 'Window ID for window mode' },
    },
  },
  annotations: {
    title: 'Vision Start',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const visionStopDefinition: ToolDefinition = {
  name: 'core_vision_stop',
  description: 'vision stop|screen share stop - Stop vision session',
  inputSchema: { type: 'object', properties: {} },
  annotations: {
    title: 'Vision Stop',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export const visionModeDefinition: ToolDefinition = {
  name: 'core_vision_mode',
  description: 'vision mode|change capture mode - Switch capture mode',
  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['full', 'region', 'window'], description: 'New capture mode' },
      x: { type: 'number', description: 'Region X' },
      y: { type: 'number', description: 'Region Y' },
      width: { type: 'number', description: 'Region width' },
      height: { type: 'number', description: 'Region height' },
      windowId: { type: 'string', description: 'Window ID' },
    },
    required: ['mode'],
  },
  annotations: {
    title: 'Vision Mode',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export const visionSnapshotDefinition: ToolDefinition = {
  name: 'core_vision_snapshot',
  description: 'vision snapshot|screenshot - Take a single screenshot',
  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['full', 'region', 'window'], description: 'Capture mode' },
      x: { type: 'number', description: 'Region X' },
      y: { type: 'number', description: 'Region Y' },
      width: { type: 'number', description: 'Region width' },
      height: { type: 'number', description: 'Region height' },
    },
  },
  annotations: {
    title: 'Vision Snapshot',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export const visionAskDefinition: ToolDefinition = {
  name: 'core_vision_ask',
  description: 'vision ask|ask about screen - Ask a question about the current screen',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Question about the screen' },
    },
    required: ['question'],
  },
  annotations: {
    title: 'Vision Ask',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

export async function visionStart(
  args: { mode?: string; x?: number; y?: number; width?: number; height?: number; windowId?: string },
): Promise<ToolResult> {
  try {
    const engine = ensureEngine();
    const mgr = ensureSessionManager();
    const validModes = ['full', 'region', 'window'] as const;
    const mode: CaptureMode = validModes.includes(args.mode as CaptureMode) ? (args.mode as CaptureMode) : 'full';

    let region: CaptureRegion | undefined;
    if (mode === 'region' && args.x != null && args.y != null && args.width != null && args.height != null) {
      const err = validateRegion(args.x, args.y, args.width, args.height);
      if (err) return errorResult({ message: err });
      region = { x: args.x, y: args.y, width: args.width, height: args.height };
    }

    const session = mgr.create('local', engine, {
      initialMode: mode,
      initialRegion: region,
      initialWindowId: args.windowId,
    });
    session.start();

    return successResult({
      sessionId: session.sessionId,
      mode,
      state: session.getState(),
      message: 'Vision 세션이 시작되었습니다.',
    });
  } catch (err) {
    return errorResult(err);
  }
}

export async function visionStop(): Promise<ToolResult> {
  try {
    const mgr = ensureSessionManager();
    const session = mgr.get('local');
    if (!session) {
      return successResult({ message: '활성 Vision 세션이 없습니다.' });
    }
    session.end('user_request');
    return successResult({ message: 'Vision 세션이 종료되었습니다.' });
  } catch (err) {
    return errorResult(err);
  }
}

export async function visionMode(
  args: { mode: string; x?: number; y?: number; width?: number; height?: number; windowId?: string },
): Promise<ToolResult> {
  try {
    const mgr = ensureSessionManager();
    const session = mgr.get('local');
    if (!session) {
      return errorResult({ message: '활성 Vision 세션이 없습니다.' });
    }

    const validModes = ['full', 'region', 'window'] as const;
    const mode: CaptureMode = validModes.includes(args.mode as CaptureMode) ? (args.mode as CaptureMode) : 'full';

    let region: CaptureRegion | undefined;
    if (mode === 'region' && args.x != null && args.y != null && args.width != null && args.height != null) {
      const err = validateRegion(args.x, args.y, args.width, args.height);
      if (err) return errorResult({ message: err });
      region = { x: args.x, y: args.y, width: args.width, height: args.height };
    }

    session.changeMode(mode, region, args.windowId);
    return successResult({ mode, message: `모드가 ${mode}으로 전환되었습니다.` });
  } catch (err) {
    return errorResult(err);
  }
}

export async function visionSnapshot(
  args: { mode?: string; x?: number; y?: number; width?: number; height?: number },
): Promise<ToolResult> {
  try {
    const engine = ensureEngine();
    const validModes = ['full', 'region', 'window'] as const;
    const mode: CaptureMode = validModes.includes(args.mode as CaptureMode) ? (args.mode as CaptureMode) : 'full';

    let region: CaptureRegion | undefined;
    if (mode === 'region' && args.x != null && args.y != null && args.width != null && args.height != null) {
      const err = validateRegion(args.x, args.y, args.width, args.height);
      if (err) return errorResult({ message: err });
      region = { x: args.x, y: args.y, width: args.width, height: args.height };
    }

    const result = await engine.capture(mode, region);
    return successResult({
      mode,
      format: result.format,
      width: result.width,
      height: result.height,
      sizeBytes: result.sizeBytes,
      capturedAt: result.capturedAt,
      base64Length: result.buffer.toString('base64').length,
    });
  } catch (err) {
    return errorResult(err);
  }
}

export async function visionAsk(
  args: { question: string },
): Promise<ToolResult> {
  try {
    const engine = ensureEngine();
    const result = await engine.capture('full');
    const frameBase64 = result.buffer.toString('base64');

    // Use Gemini REST fallback for single-shot question
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      return errorResult({ message: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
    }

    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: args.question },
              { inlineData: { mimeType: `image/${result.format}`, data: frameBase64 } },
            ],
          }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Gemini API HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content: { parts: Array<{ text?: string }> } }>;
      };
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      return successResult({ question: args.question, answer: answer.trim() });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return errorResult(err);
  }
}

/** 서비스 종료 */
export function shutdownVisionService(): void {
  sessionManager?.endAll();
  if (liveStream) {
    liveStream.disconnect().catch(() => { /* ignore */ });
  }
  captureEngine = null;
  sessionManager = null;
  liveStream = null;
}
